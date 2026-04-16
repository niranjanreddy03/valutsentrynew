'use strict';

/**
 * VaultSentry Node.js Scanning Engine
 * scanner.js — File-level scanning logic (optimized)
 *
 * Hot-path optimizations vs. the naive implementation:
 *   * Binary-file detection via a small Buffer read (4 KB NUL-byte sniff)
 *     BEFORE decoding the whole file as UTF-8.
 *   * Per-rule literal trigger pre-filter: if a rule's cheap substring
 *     triggers never appear in the file, its regex is skipped entirely.
 *   * O(log n) line-number lookup via a precomputed newline offset index
 *     (binary search), replacing O(n) slice+split per match.
 *   * Lazy split of the file into lines — only performed when the first
 *     finding actually needs a snippet.
 *   * Inline dedup using raw value (not hash) as the short-circuit key,
 *     avoiding redundant SHA-256 work on duplicates.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ALL_RULES } = require('./rules');
const logger = require('./logger');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum file size in bytes to read (default 2 MB) */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** Bytes sampled from the head of each file for the binary sniff. */
const BINARY_SNIFF_BYTES = 4096;

/** Binary file extensions that should be skipped */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
  '.mp4', '.mp3', '.avi', '.mov', '.mkv', '.wav', '.ogg',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.pyc', '.class', '.o', '.obj',
  '.lock',  // Lockfiles are large and rarely contain secrets directly
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
  const len = value.length;
  if (len <= VISIBLE * 2) return '*'.repeat(len);
  return (
    value.slice(0, VISIBLE) +
    '*'.repeat(len - VISIBLE * 2) +
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
  for (const indicator of TEST_FILE_INDICATORS) {
    if (lower.includes(indicator)) return true;
  }
  return false;
}

/**
 * Determine whether a file should be skipped entirely.
 * @param {string} filePath  Absolute path.
 * @param {number} fileSize  File size in bytes (optional, pass -1 to skip size check).
 * @returns {{ skip: boolean, reason?: string }}
 */
function shouldSkipFile(filePath, fileSize = -1) {
  const ext = path.extname(filePath).toLowerCase();

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

/**
 * Build an array of offsets of every '\n' in `content` for O(log n)
 * offset → line number lookup via binary search.
 * @param {string} content
 * @returns {number[]}
 */
function buildLineOffsetIndex(content) {
  const offsets = [];
  let idx = content.indexOf('\n');
  while (idx !== -1) {
    offsets.push(idx);
    idx = content.indexOf('\n', idx + 1);
  }
  return offsets;
}

/**
 * Binary search an offset in the newline-offset index and return the 1-based
 * line number it falls on.
 * @param {number[]} offsets  Sorted ascending newline offsets.
 * @param {number}   target   Character offset in the original content.
 * @returns {number}          1-based line number.
 */
function lineNumberForOffset(offsets, target) {
  // Equivalent of Python's bisect_right: leftmost index with offsets[i] > target.
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo + 1;
}

/**
 * Read up to `limit` bytes from `filePath` as a Buffer (single fd, then close).
 * Used for the binary-sniff step before we commit to decoding the whole file.
 * @param {string} filePath
 * @param {number} limit
 * @returns {Promise<Buffer>}
 */
async function readHeadBytes(filePath, limit) {
  const fh = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(limit);
    const { bytesRead } = await fh.read(buf, 0, limit, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

// ─── Core scanner ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Finding
 * @property {string}  id         SHA-derived finding-level unique key
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

  /** @type {Finding[]} */
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

  if (stat.size === 0) return findings;

  // ── Binary sniff on the head before reading the full file as utf8. ──
  // This catches un-extensioned binaries and saves us from decoding multi-MB
  // blobs that will be thrown away.
  let head;
  try {
    head = await readHeadBytes(filePath, Math.min(BINARY_SNIFF_BYTES, stat.size));
  } catch (err) {
    logger.warn(`Cannot read file: ${filePath} — ${err.message}`);
    return findings;
  }
  if (head.includes(0x00)) {
    logger.debug(`Skipping binary file (null byte): ${filePath}`);
    return findings;
  }

  // ── Read content ──
  let content;
  try {
    if (stat.size <= head.length) {
      // We already have the whole file in `head`.
      content = head.toString('utf8');
    } else {
      content = await fs.promises.readFile(filePath, { encoding: 'utf8' });
    }
  } catch (err) {
    logger.warn(`Cannot read file: ${filePath} — ${err.message}`);
    return findings;
  }

  if (!content || !content.trim()) return findings;

  // ── Per-file precomputation used by all rules ──
  const contentLower = content.toLowerCase();
  const displayPath = basePath ? path.relative(basePath, filePath) : filePath;
  const displayPathSlashes = displayPath.replace(/\\/g, '/');
  const testFile = isTestFile(filePath);

  // Lazily built on first finding — very often a file has zero findings and
  // the cost of splitting a big file into an array of lines is pure waste.
  let lines = null;
  let lineOffsets = null;

  /** @type {Set<string>} dedup key = `${ruleId}::${rawValue}` */
  const seen = new Set();

  // ── Apply rules ──
  for (const rule of ALL_RULES) {
    // ── Literal pre-filter ──
    // If any trigger is configured and none appears in the file, skip the
    // entire regex pass for this rule.
    const triggers = rule.triggers;
    if (triggers && triggers.length > 0) {
      let anyTrigger = false;
      for (let i = 0; i < triggers.length; i++) {
        if (contentLower.indexOf(triggers[i]) !== -1) {
          anyTrigger = true;
          break;
        }
      }
      if (!anyTrigger) continue;
    }

    // IMPORTANT: Reset regex lastIndex because rules share pattern objects.
    rule.pattern.lastIndex = 0;

    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      const hasGroup = match[1] !== undefined;
      const rawValue = hasGroup ? match[1] : match[0];

      // ── Dedup by (ruleId, rawValue) BEFORE hashing ──
      const dedupKey = rule.id + '::' + rawValue;
      if (seen.has(dedupKey)) continue;

      // ── False positive check ──
      if (rule.falsePositives && rule.falsePositives.length > 0) {
        let isFalsePositive = false;
        for (const fp of rule.falsePositives) {
          if (fp.test(rawValue)) { isFalsePositive = true; break; }
        }
        if (isFalsePositive) { seen.add(dedupKey); continue; }
      }
      seen.add(dedupKey);

      // ── Hash once per distinct finding ──
      const valueHash = sha256(rawValue);

      // ── Line number via precomputed offset index (lazy init) ──
      if (lineOffsets === null) lineOffsets = buildLineOffsetIndex(content);
      const valueStart = hasGroup ? match.index + match[0].indexOf(rawValue) : match.index;
      const lineNumber = lineNumberForOffset(lineOffsets, valueStart);

      // ── Snippet — line above, the match line, line below (lazy lines split) ──
      if (lines === null) lines = content.split('\n');
      const snippetStart = Math.max(0, lineNumber - 2);
      const snippetEnd = Math.min(lines.length - 1, lineNumber);
      let snippet = '';
      for (let i = snippetStart; i <= snippetEnd; i++) {
        if (snippet) snippet += '\n';
        snippet += (i + 1) + ': ' + lines[i];
      }

      const maskedValue = maskValue(rawValue);

      /** @type {Finding} */
      const finding = {
        id: sha256(filePath + '::' + rule.id + '::' + valueHash + '::' + lineNumber),
        ruleId: rule.id,
        type: rule.type,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
        file: displayPathSlashes,
        line: lineNumber,
        maskedValue,
        hash: valueHash,
        isTestFile: testFile,
        snippet,
        value: (!maskValues || includeRawValue) ? rawValue : maskedValue,
      };

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
