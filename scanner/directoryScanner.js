'use strict';

/**
 * VaultSentry Node.js Scanning Engine
 * directoryScanner.js — Recursive async directory traversal
 *
 * Responsibilities:
 *  - Walk a directory tree asynchronously (breadth-first)
 *  - Honour .gitignore rules via the `ignore` npm package (optional)
 *  - Skip EXCLUDED_DIRS and binary/large files
 *  - Fan-out file scanning with controlled concurrency
 *  - Deduplicate findings globally (by finding.id)
 *  - Emit progress via an optional callback
 *  - Return a rich ScanSummary object
 */

const fs = require('fs');
const path = require('path');
const { scanFile, shouldExcludeDir } = require('./scanner');
const logger = require('./logger');

// ─── Optional .gitignore support ──────────────────────────────────────────────

let ignore;
try {
  ignore = require('ignore');
} catch {
  ignore = null; // Gracefully degrade if the package isn't installed
}

/**
 * Load and parse .gitignore file(s) for a directory, returning an `ignore`
 * instance (or null when the `ignore` package is unavailable).
 *
 * @param {string} rootDir
 * @returns {import('ignore').Ignore|null}
 */
function loadGitignore(rootDir) {
  if (!ignore) return null;

  const ig = ignore();
  // Always ignore these even without a .gitignore file
  ig.add(['node_modules', '.git', '.env', '*.lock']);

  const gitignorePath = path.join(rootDir, '.gitignore');
  try {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    ig.add(content);
    logger.debug(`.gitignore loaded from ${gitignorePath}`);
  } catch {
    // File doesn't exist — that's fine
  }

  return ig;
}

// ─── Concurrency limiter ──────────────────────────────────────────────────────

/**
 * Run `asyncFn` on every item in `items` with at most `concurrency` parallel
 * executions.
 *
 * @template T
 * @template R
 * @param {T[]}                 items
 * @param {number}              concurrency
 * @param {(item: T) => Promise<R>} asyncFn
 * @returns {Promise<R[]>}
 */
async function withConcurrency(items, concurrency, asyncFn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await asyncFn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ─── Directory collector ──────────────────────────────────────────────────────

/**
 * Recursively collect all eligible file paths under `rootDir`.
 *
 * @param {string}                    rootDir
 * @param {import('ignore').Ignore|null} ig     Gitignore instance (optional)
 * @returns {Promise<string[]>}                 Absolute file paths
 */
async function collectFiles(rootDir, ig) {
  const files = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop();

    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (err) {
      logger.warn(`Cannot read directory ${current}: ${err.message}`);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      // ── Gitignore check ──
      if (ig) {
        const relative = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        if (ig.ignores(relative)) {
          logger.debug(`Gitignore: skipping ${relative}`);
          continue;
        }
      }

      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) {
          queue.push(fullPath);
        } else {
          logger.debug(`Excluded dir: ${entry.name}`);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// ─── Main scanner ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ScanOptions
 * @property {boolean} [maskValues=true]       Mask sensitive values in output.
 * @property {boolean} [includeRawValue=false] Include raw (unmasked) value.
 * @property {boolean} [useGitignore=true]     Honour .gitignore rules.
 * @property {number}  [concurrency=10]        Max parallel file reads.
 * @property {Function} [onProgress]           Called with (scanned, total, file) after each file.
 */

/**
 * @typedef {Object} ScanSummary
 * @property {string}   scanId         UUID-like identifier for this scan run.
 * @property {string}   target         Scanned root directory.
 * @property {number}   filesScanned   Total files successfully read & scanned.
 * @property {number}   filesSkipped   Files skipped (binary, large, gitignored, etc.).
 * @property {number}   totalIssues    Total unique findings.
 * @property {number}   critical       Count of critical-severity findings.
 * @property {number}   high           Count of high-severity findings.
 * @property {number}   medium         Count of medium-severity findings.
 * @property {number}   low            Count of low-severity findings.
 * @property {number}   durationMs     Wall-clock duration in milliseconds.
 * @property {string}   startedAt      ISO 8601 start timestamp.
 * @property {string}   completedAt    ISO 8601 end timestamp.
 * @property {import('./scanner').Finding[]} findings All unique findings.
 * @property {string[]} errors         Non-fatal errors encountered during scan.
 */

/**
 * Recursively scan a directory for secrets.
 *
 * @param {string}     rootDir  Absolute path to the directory to scan.
 * @param {ScanOptions} [opts]
 * @returns {Promise<ScanSummary>}
 */
async function scanDirectory(rootDir, opts = {}) {
  const {
    maskValues = true,
    includeRawValue = false,
    useGitignore = true,
    concurrency = 10,
    onProgress = null,
  } = opts;

  const startTime = Date.now();
  const startedAt = new Date(startTime).toISOString();
  const errors = [];
  let filesSkipped = 0;

  logger.info(`Scanner started — target: ${rootDir}`);

  // ── Resolve & validate root ──
  const resolvedRoot = path.resolve(rootDir);
  try {
    const stat = await fs.promises.stat(resolvedRoot);
    if (!stat.isDirectory()) {
      throw new Error(`${resolvedRoot} is not a directory`);
    }
  } catch (err) {
    throw new Error(`Invalid scan target: ${err.message}`);
  }

  // ── Load gitignore ──
  const ig = useGitignore ? loadGitignore(resolvedRoot) : null;

  // ── Collect files ──
  logger.info('Collecting files…');
  const allFiles = await collectFiles(resolvedRoot, ig);
  logger.info(`Found ${allFiles.length} candidate files`);

  // ── Scan files with bounded concurrency ──
  let scannedCount = 0;
  /** @type {Map<string, import('./scanner').Finding>} */
  const globalDedup = new Map(); // finding.id → finding

  await withConcurrency(allFiles, concurrency, async (filePath) => {
    let fileFindings;
    try {
      fileFindings = await scanFile(filePath, {
        maskValues,
        includeRawValue,
        basePath: resolvedRoot,
      });
    } catch (err) {
      const msg = `Error scanning ${filePath}: ${err.message}`;
      logger.error(msg);
      errors.push(msg);
      filesSkipped++;
      return;
    }

    scannedCount++;

    // Global deduplication by finding.id (based on file+rule+hash+line)
    for (const finding of fileFindings) {
      if (!globalDedup.has(finding.id)) {
        globalDedup.set(finding.id, finding);
      }
    }

    // Progress callback
    if (typeof onProgress === 'function') {
      try {
        onProgress(scannedCount, allFiles.length, filePath);
      } catch {
        // Swallow callback errors
      }
    }
  });

  filesSkipped += allFiles.length - scannedCount;

  const findings = Array.from(globalDedup.values());

  // Sort: critical → high → medium → low, then by file path
  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => {
    const sev = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
    if (sev !== 0) return sev;
    return a.file.localeCompare(b.file);
  });

  // ── Build summary ──
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const summary = {
    scanId: generateScanId(),
    target: resolvedRoot,
    filesScanned: scannedCount,
    filesSkipped,
    totalIssues: findings.length,
    critical: findings.filter((f) => f.severity === 'critical').length,
    high:     findings.filter((f) => f.severity === 'high').length,
    medium:   findings.filter((f) => f.severity === 'medium').length,
    low:      findings.filter((f) => f.severity === 'low').length,
    durationMs,
    startedAt,
    completedAt,
    findings,
    errors,
  };

  logger.info(
    `Scan complete — ${scannedCount} files scanned, ` +
    `${findings.length} issues found in ${durationMs}ms`
  );

  return summary;
}

/**
 * Simple pseudo-UUID generator (no external deps required).
 * @returns {string}
 */
function generateScanId() {
  const ts = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2, 10);
  return `scan-${ts}-${rand}`;
}

module.exports = { scanDirectory };
