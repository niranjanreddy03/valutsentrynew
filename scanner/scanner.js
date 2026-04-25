'use strict';

/**
 * VaultSentry Node.js Scanning Engine
 * scanner.js — File-level scanning logic
 *
 * Responsibilities:
 *  - Read a single file safely (UTF-8, skipping binary/large files)
 *  - Apply all detection rules
 *  - Deduplicate findings within the file (by hash)
 *  - Return structured Finding objects
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ALL_RULES } = require('./rules');
const logger = require('./logger');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum file size in bytes to read (default 2 MB) */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** Binary file extensions that should be skipped */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
  '.mp4', '.mp3', '.avi', '.mov', '.mkv', '.wav', '.ogg', '.flac', '.m4a',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.tgz',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.pyc', '.class', '.o', '.obj', '.a', '.lib',
  '.lock',  // Lockfiles are large and rarely contain secrets directly
  '.min.js', '.min.css', '.map',  // Minified assets / source maps
]);

/** Filenames that are large and rarely contain unhashed secrets.
 *  Skipping these by basename (no stat needed) saves serious I/O on big repos. */
const SKIP_BASENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json',
  'composer.lock', 'Gemfile.lock', 'poetry.lock', 'Cargo.lock', 'go.sum',
]);

/** Directory names to always skip */
const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  'dist', 'build', '.next', '.nuxt', 'out',
  'vendor', 'venv', '.venv', 'env', '.env',
  'coverage', '.nyc_output', 'htmlcov',
  '.cache', '.parcel-cache', '.turbo',
]);

/** Test-file path indicators (reduce severity weight, but still flag) */
const TEST_FILE_INDICATORS = [
  'test', 'spec', 'mock', 'fake', 'dummy',
  'example', 'sample', 'fixture', '__tests__', '__mocks__',
];

// ─── Helper utilities ─────────────────────────────────────────────────────────

/**
 * Compute SHA-256 hash of a string for deduplication.
 * @param {string} value
 * @returns {string}
 */
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Mask a sensitive value — keep first 4 and last 4 characters, star the rest.
 * @param {string} value
 * @returns {string}
 */
function maskValue(value) {
  if (!value || typeof value !== 'string') return '****';
  const VISIBLE = 4;
  if (value.length <= VISIBLE * 2) return '*'.repeat(value.length);
  return (
    value.slice(0, VISIBLE) +
    '*'.repeat(Math.max(0, value.length - VISIBLE * 2)) +
    value.slice(-VISIBLE)
  );
}

/**
 * Determine if a file path points to a test / example file.
 * @param {string} filePath
 * @returns {boolean}
 */
function isTestFile(filePath) {
  const lower = filePath.toLowerCase();
  return TEST_FILE_INDICATORS.some((indicator) => lower.includes(indicator));
}

/**
 * Determine whether a file should be skipped entirely.
 * @param {string} filePath  Absolute path.
 * @param {number} fileSize  File size in bytes (optional, pass -1 to skip size check).
 * @returns {{ skip: boolean, reason?: string }}
 */
function shouldSkipFile(filePath, fileSize = -1) {
  const base = path.basename(filePath);
  if (SKIP_BASENAMES.has(base)) {
    return { skip: true, reason: `skipped lockfile (${base})` };
  }

  const lower = base.toLowerCase();
  const ext = path.extname(lower);

  // Handle compound extensions like .min.js / .min.css before the simple check.
  if (lower.endsWith('.min.js') || lower.endsWith('.min.css') || lower.endsWith('.map')) {
    return { skip: true, reason: `generated asset` };
  }

  if (BINARY_EXTENSIONS.has(ext)) {
    return { skip: true, reason: `binary extension (${ext})` };
  }

  if (fileSize !== -1 && fileSize > MAX_FILE_SIZE) {
    return { skip: true, reason: `file too large (${Math.round(fileSize / 1024)} KB)` };
  }

  return { skip: false };
}

/**
 * Check whether a directory segment should be excluded from traversal.
 * @param {string} dirName  Basename of the directory.
 * @returns {boolean}
 */
function shouldExcludeDir(dirName) {
  return EXCLUDED_DIRS.has(dirName);
}

// ─── Core scanner ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Finding
 * @property {string}  id         UUID-like SHA hash (finding-level unique key)
 * @property {string}  ruleId     Rule identifier
 * @property {string}  type       Human-readable secret type
 * @property {string}  category   aws | github | jwt | …
 * @property {'critical'|'high'|'medium'|'low'} severity
 * @property {number}  confidence 0–1
 * @property {string}  file       Relative or absolute file path
 * @property {number}  line       1-based line number
 * @property {string}  value      Full matched value (raw — handle carefully)
 * @property {string}  maskedValue Partially masked value for safe display
 * @property {string}  hash       SHA-256 of the raw value (deduplication key)
 * @property {boolean} isTestFile True when the finding is inside a test/example file
 * @property {string}  snippet    Up-to-3-line context around the finding
 */

/**
 * Scan a single file and return all findings.
 *
 * @param {string}  filePath     Absolute path to the file.
 * @param {Object}  [options]
 * @param {boolean} [options.maskValues=true]      Mask raw secret values.
 * @param {boolean} [options.includeRawValue=false] Expose unmasked value.
 * @param {string}  [options.basePath='']          Strip prefix from file path in output.
 * @returns {Promise<Finding[]>}
 */
async function scanFile(filePath, options = {}) {
  const {
    maskValues = true,
    includeRawValue = false,
    basePath = '',
  } = options;

  const findings = [];

  // ── File stat ──
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch (err) {
    logger.warn(`Cannot stat file: ${filePath} — ${err.message}`);
    return findings;
  }

  if (!stat.isFile()) return findings;

  const { skip, reason } = shouldSkipFile(filePath, stat.size);
  if (skip) {
    logger.debug(`Skipping ${filePath}: ${reason}`);
    return findings;
  }

  // ── Read content ──
  let content;
  try {
    content = await fs.promises.readFile(filePath, { encoding: 'utf8' });
  } catch (err) {
    // Could be a binary file Node couldn't read gracefully — skip silently.
    logger.warn(`Cannot read file: ${filePath} — ${err.message}`);
    return findings;
  }

  if (!content || !content.trim()) return findings;

  // Quick binary sniff: if the first 8 KB contains a NULL byte, treat as binary.
  if (content.slice(0, 8192).includes('\0')) {
    logger.debug(`Skipping binary file (null byte): ${filePath}`);
    return findings;
  }

  const lines = content.split('\n');
  const displayPath = basePath ? path.relative(basePath, filePath) : filePath;
  const testFile = isTestFile(filePath);

  // ── Precompute line-start offsets (one linear pass) so we can resolve
  //    a match's line number in O(log n) instead of O(fileSize) per match.
  //    Huge win for files with lots of matches: old code sliced + split on
  //    the entire prefix for every single match.
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10 /* '\n' */) lineStarts.push(i + 1);
  }
  const lineNumberAt = (offset) => {
    // Binary search for the largest lineStart <= offset.
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1; // 1-based
  };

  // ── Deduplication set (within this file) ──
  const seenHashes = new Set();

  // ── Apply rules ──
  for (const rule of ALL_RULES) {
    // IMPORTANT: Reset regex lastIndex because rules share pattern objects.
    rule.pattern.lastIndex = 0;

    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      // Extract the best capture group or fall back to full match.
      const rawValue = match[1] !== undefined ? match[1] : match[0];

      // ── False positive check ──
      if (rule.falsePositives && rule.falsePositives.length > 0) {
        const isFalsePositive = rule.falsePositives.some((fp) => fp.test(rawValue));
        if (isFalsePositive) continue;
      }

      // ── Dedup by (ruleId + hash) ──
      const valueHash = sha256(rawValue);
      const dedupKey = `${rule.id}::${valueHash}`;
      if (seenHashes.has(dedupKey)) continue;
      seenHashes.add(dedupKey);

      // ── Line number (1-based) — O(log n) lookup ──
      const lineNumber = lineNumberAt(match.index);

      // ── Snippet — line above, the match line, line below ──
      const snippetStart = Math.max(0, lineNumber - 2);
      const snippetEnd = Math.min(lines.length - 1, lineNumber);  // lineNumber is 1-based
      const snippet = lines
        .slice(snippetStart, snippetEnd + 1)
        .map((l, i) => `${snippetStart + i + 1}: ${l}`)
        .join('\n');

      /** @type {Finding} */
      const finding = {
        id: sha256(`${filePath}::${rule.id}::${valueHash}::${lineNumber}`),
        ruleId: rule.id,
        type: rule.type,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
        file: displayPath.replace(/\\/g, '/'),
        line: lineNumber,
        maskedValue: maskValue(rawValue),
        hash: valueHash,
        isTestFile: testFile,
        snippet,
      };

      // Only include the raw value when explicitly requested.
      if (!maskValues || includeRawValue) {
        finding.value = rawValue;
      } else {
        finding.value = finding.maskedValue;
      }

      findings.push(finding);
    }
  }

  return findings;
}

module.exports = {
  scanFile,
  shouldSkipFile,
  shouldExcludeDir,
  maskValue,
  isTestFile,
  EXCLUDED_DIRS,
  BINARY_EXTENSIONS,
};
