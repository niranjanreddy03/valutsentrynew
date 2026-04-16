'use strict';

/**
 * VaultSentry Node.js Scanning Engine
 * directoryScanner.js — Recursive async directory traversal (optimized)
 *
 * Optimizations vs. the naive implementation:
 *   * Higher default concurrency (I/O-bound workload scales well past 10).
 *   * Worker-pool model without a pre-allocated results array — the old
 *     `withConcurrency` kept every scanFile result alive in memory even
 *     though the callback only cared about globalDedup.
 *   * Single-pass severity counting instead of four `findings.filter()`
 *     linear scans.
 *   * Same Finding / ScanSummary shape — API unchanged.
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
  ignore = null;
}

/**
 * Load and parse the root .gitignore file, returning an `ignore` instance
 * (or null when the `ignore` package is unavailable).
 * @param {string} rootDir
 * @returns {import('ignore').Ignore|null}
 */
function loadGitignore(rootDir) {
  if (!ignore) return null;

  const ig = ignore();
  ig.add(['node_modules', '.git', '.env', '*.lock']);

  const gitignorePath = path.join(rootDir, '.gitignore');
  try {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    ig.add(content);
    logger.debug(`.gitignore loaded from ${gitignorePath}`);
  } catch {
    // File doesn't exist — fine.
  }

  return ig;
}

// ─── Directory collector ──────────────────────────────────────────────────────

/**
 * Recursively collect all eligible file paths under `rootDir`.
 * @param {string} rootDir
 * @param {import('ignore').Ignore|null} ig
 * @returns {Promise<string[]>} Absolute file paths.
 */
async function collectFiles(rootDir, ig) {
  const files = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();

    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (err) {
      logger.warn(`Cannot read directory ${current}: ${err.message}`);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (ig) {
        const relative = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        if (ig.ignores(relative)) continue;
      }

      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) stack.push(fullPath);
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
 * @property {boolean} [maskValues=true]
 * @property {boolean} [includeRawValue=false]
 * @property {boolean} [useGitignore=true]
 * @property {number}  [concurrency=32]
 * @property {Function} [onProgress]  Called with (scanned, total, file).
 */

/**
 * @typedef {Object} ScanSummary
 * @property {string}   scanId
 * @property {string}   target
 * @property {number}   filesScanned
 * @property {number}   filesSkipped
 * @property {number}   totalIssues
 * @property {number}   critical
 * @property {number}   high
 * @property {number}   medium
 * @property {number}   low
 * @property {number}   durationMs
 * @property {string}   startedAt
 * @property {string}   completedAt
 * @property {import('./scanner').Finding[]} findings
 * @property {string[]} errors
 */

/**
 * Recursively scan a directory for secrets.
 * @param {string}     rootDir
 * @param {ScanOptions} [opts]
 * @returns {Promise<ScanSummary>}
 */
async function scanDirectory(rootDir, opts = {}) {
  const {
    maskValues = true,
    includeRawValue = false,
    useGitignore = true,
    // File I/O is the bottleneck; Node's libuv thread pool can sustain far
    // more than 10 concurrent reads on any modern disk.
    concurrency = 32,
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
  const totalFiles = allFiles.length;
  logger.info(`Found ${totalFiles} candidate files`);

  // ── Scan files with bounded concurrency ──
  let scannedCount = 0;
  let nextIndex = 0;
  /** @type {Map<string, import('./scanner').Finding>} */
  const globalDedup = new Map();

  const workerCount = Math.min(concurrency, totalFiles) || 1;
  const workers = new Array(workerCount);
  const hasProgressCb = typeof onProgress === 'function';

  for (let w = 0; w < workerCount; w++) {
    workers[w] = (async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= totalFiles) return;
        const filePath = allFiles[i];

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
          continue;
        }

        scannedCount++;

        for (let j = 0; j < fileFindings.length; j++) {
          const finding = fileFindings[j];
          if (!globalDedup.has(finding.id)) {
            globalDedup.set(finding.id, finding);
          }
        }

        if (hasProgressCb) {
          try { onProgress(scannedCount, totalFiles, filePath); } catch { /* swallow */ }
        }
      }
    })();
  }
  await Promise.all(workers);

  filesSkipped += totalFiles - scannedCount;

  // ── Single-pass severity tally + sort ──
  const findings = Array.from(globalDedup.values());
  let critical = 0, high = 0, medium = 0, low = 0;
  for (let i = 0; i < findings.length; i++) {
    switch (findings[i].severity) {
      case 'critical': critical++; break;
      case 'high':     high++;     break;
      case 'medium':   medium++;   break;
      case 'low':      low++;      break;
    }
  }

  const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => {
    const sev = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
    if (sev !== 0) return sev;
    return a.file.localeCompare(b.file);
  });

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const summary = {
    scanId: generateScanId(),
    target: resolvedRoot,
    filesScanned: scannedCount,
    filesSkipped,
    totalIssues: findings.length,
    critical,
    high,
    medium,
    low,
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
