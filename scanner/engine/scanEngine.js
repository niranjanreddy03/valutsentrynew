'use strict';

/**
 * scanEngine.js — Async secret-scanning engine with guaranteed output.
 *
 * Design goals (per security-engineer spec):
 *   • Always return a result object — never silently empty.
 *   • Detect named patterns (AWS, GitHub, JWT, RSA, …) + entropy-based unknowns.
 *   • Classify findings into high / medium / low via the validator.
 *   • Scan source, env, JSON, YAML. Skip binaries + oversized files.
 *   • Async, bounded concurrency — safe for large repos.
 *   • Emit progress callbacks for real-time UI.
 *   • Optional webhook alert on findings.
 *
 * Public API:
 *   scanPath(target, options) → Promise<ScanResult>
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const { ALL_RULES } = require('../rules');
const { validate }  = require('./validator');
const { assessEntropy } = require('./entropy');
const logger = require('../logger');

// ── Config ───────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  // Source
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.php', '.pl', '.lua', '.swift', '.m', '.sh', '.bash', '.zsh', '.fish',
  // Config / data
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.properties',
  '.env', '.envrc', '.xml', '.html', '.css', '.scss', '.md', '.txt', '.tf', '.tfvars',
  '.gradle', '.dockerfile',
]);

const ENV_FILE_NAMES = new Set([
  '.env', '.env.local', '.env.development', '.env.production', '.env.test',
  '.env.sample', '.env.example',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out',
  '.next', '.nuxt', '__pycache__', 'venv', '.venv', 'vendor',
  'coverage', '.cache', '.parcel-cache', '.turbo', 'target',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function mask(value) {
  if (!value) return '****';
  if (value.length <= 8) return '*'.repeat(value.length);
  return value.slice(0, 4) + '*'.repeat(Math.max(4, value.length - 8)) + value.slice(-4);
}

function isTextFile(filePath) {
  const base = path.basename(filePath);
  if (ENV_FILE_NAMES.has(base) || base.startsWith('.env')) return true;
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

// ── File walker (async, bounded concurrency) ─────────────────────────────────

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    logger.warn(`Cannot read dir ${dir}: ${err.message}`);
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

/**
 * Worker-pool runner — caps concurrency at `limit`.
 * @template T
 * @param {AsyncIterable<T>} source
 * @param {(item: T) => Promise<void>} handler
 * @param {number} limit
 */
async function runPool(source, handler, limit) {
  const iterator = source[Symbol.asyncIterator]();
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const { value, done } = await iterator.next();
      if (done) return;
      try { await handler(value); }
      catch (err) { logger.warn(`Worker error: ${err.message}`); }
    }
  });
  await Promise.all(workers);
}

// ── File scan ────────────────────────────────────────────────────────────────

/**
 * Scan a single file for all rule hits + entropy candidates.
 * @returns {Promise<{ findings: Array, skipped?: { reason: string } }>}
 */
async function scanFile(filePath, { debug = false, basePath = '' } = {}) {
  const findings = [];

  let stat;
  try { stat = await fs.promises.stat(filePath); }
  catch (err) { return { skipped: { reason: `stat failed: ${err.message}` } }; }

  if (!stat.isFile())            return { skipped: { reason: 'not a regular file' } };
  if (stat.size === 0)           return { skipped: { reason: 'empty file' } };
  if (stat.size > MAX_FILE_BYTES) return { skipped: { reason: `too large (${stat.size} bytes)` } };
  if (!isTextFile(filePath))      return { skipped: { reason: 'unsupported extension' } };

  let content;
  try { content = await fs.promises.readFile(filePath, 'utf8'); }
  catch (err) { return { skipped: { reason: `read failed: ${err.message}` } }; }

  // Null-byte sniff → treat as binary.
  if (content.slice(0, 8192).includes('\0')) {
    return { skipped: { reason: 'binary content' } };
  }

  const displayPath = basePath ? path.relative(basePath, filePath).replace(/\\/g, '/') : filePath;
  const seen = new Set();

  // ── Pattern-based detection ────────────────────────────────────────────────
  for (const rule of ALL_RULES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(content)) !== null) {
      const raw = m[1] !== undefined ? m[1] : m[0];

      // Rule-level false-positive filters.
      if (rule.falsePositives && rule.falsePositives.some((fp) => fp.test(raw))) {
        if (debug) logger.debug(`[${rule.id}] dropped by rule FP filter: ${mask(raw)}`);
        continue;
      }

      const verdict = validate({
        raw,
        ruleSeverity:  rule.severity,
        ruleConfidence: rule.confidence,
        filePath,
        category: rule.category,
      });

      if (!verdict.accepted) {
        if (debug) logger.debug(`[${rule.id}] rejected: ${verdict.reason}`);
        continue;
      }

      const hash = sha256(raw);
      const key = `${rule.id}::${hash}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const line = content.slice(0, m.index).split('\n').length;
      findings.push({
        type:       rule.type,
        category:   rule.category,
        ruleId:     rule.id,
        value:      mask(raw),
        rawHash:    hash,
        file:       displayPath,
        line,
        severity:   verdict.severity,
        confidence: verdict.confidence,
        entropy:    Number(verdict.entropy.toFixed(2)),
        source:     'pattern',
      });

      if (debug) logger.debug(`[${rule.id}] HIT in ${displayPath}:${line}`);
    }
  }

  // ── Entropy-based detection for "unknown" secrets ──────────────────────────
  // We look at assignment-like lines: KEY = "value"  |  key: 'value'
  // and run the entropy heuristic on the RHS.
  const assignRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*["']([^"'\n]{20,200})["']/g;
  let am;
  while ((am = assignRe.exec(content)) !== null) {
    const keyName = am[1];
    const raw = am[2];

    // Skip obviously-not-a-secret assignments.
    if (!/secret|token|key|password|credential|api|auth/i.test(keyName)) continue;

    const hash = sha256(raw);
    const dedup = `entropy::${hash}`;
    if (seen.has(dedup)) continue;

    const entropy = assessEntropy(raw);
    if (!entropy.isSuspicious) continue;

    const verdict = validate({
      raw,
      ruleSeverity: 'medium',
      ruleConfidence: 0.6,
      filePath,
      category: 'generic',
    });
    if (!verdict.accepted) continue;
    seen.add(dedup);

    const line = content.slice(0, am.index).split('\n').length;
    findings.push({
      type:       `High-entropy value in "${keyName}"`,
      category:   'entropy',
      ruleId:     'entropy-generic',
      value:      mask(raw),
      rawHash:    hash,
      file:       displayPath,
      line,
      severity:   verdict.severity === 'high' ? 'medium' : verdict.severity,
      confidence: 'low',
      entropy:    Number(entropy.entropy.toFixed(2)),
      source:     'entropy',
    });
  }

  return { findings };
}

// ── Webhook ──────────────────────────────────────────────────────────────────

async function fireWebhook(url, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    logger.info(`Webhook ${url} → ${res.status}`);
  } catch (err) {
    logger.warn(`Webhook delivery failed: ${err.message}`);
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * @typedef {Object} ScanOptions
 * @property {number}   [concurrency=10]
 * @property {boolean}  [debug=false]
 * @property {(done: number, total: number) => void} [onProgress]
 * @property {string}   [webhookUrl]           POST result here if secrets found.
 * @property {number}   [progressThrottleMs=100]
 */

/**
 * Scan a file OR directory. ALWAYS resolves with a structured result object.
 *
 * Result shape (success, findings):
 * {
 *   status: "completed",
 *   secrets: [ { type, value, file, line, severity, confidence, ... } ],
 *   total_found: N,
 *   summary: { filesScanned, filesSkipped, bySeverity: {high,medium,low}, durationMs }
 * }
 *
 * Result shape (success, no findings):
 * {
 *   status: "completed",
 *   message: "No secrets detected",
 *   confidence: "high",
 *   summary: { filesScanned, filesSkipped, durationMs }
 * }
 *
 * Result shape (error):
 * {
 *   status: "error",
 *   message: "<reason>",
 *   total_found: 0
 * }
 *
 * @param {string} target
 * @param {ScanOptions} [options]
 * @returns {Promise<Object>}
 */
async function scanPath(target, options = {}) {
  const {
    concurrency = 10,
    debug = false,
    onProgress,
    webhookUrl,
    progressThrottleMs = 100,
  } = options;

  const startedAt = Date.now();

  // ── Input sanity ──
  let rootStat;
  try {
    rootStat = await fs.promises.stat(target);
  } catch (err) {
    logger.warn(`scanPath: target missing — ${err.message}`);
    return {
      status: 'error',
      message: `Target not found: ${target}`,
      total_found: 0,
    };
  }

  const basePath = rootStat.isDirectory() ? target : path.dirname(target);

  // ── Pre-count files for progress (best-effort; non-fatal if it fails) ──
  let total = 0;
  if (rootStat.isDirectory()) {
    for await (const _ of walk(target)) total++;
  } else {
    total = 1;
  }

  logger.info(`Scan starting: ${target} (${total} candidate file${total === 1 ? '' : 's'})`);

  const allFindings = [];
  let filesScanned = 0;
  let filesSkipped = 0;
  const skipReasons = Object.create(null);
  let lastProgressEmit = 0;

  const processOne = async (filePath) => {
    const { findings, skipped } = await scanFile(filePath, { debug, basePath });
    if (skipped) {
      filesSkipped++;
      skipReasons[skipped.reason] = (skipReasons[skipped.reason] || 0) + 1;
      if (debug) logger.debug(`SKIP ${filePath} — ${skipped.reason}`);
    } else {
      filesScanned++;
      if (findings && findings.length) allFindings.push(...findings);
    }
    if (onProgress) {
      const now = Date.now();
      if (now - lastProgressEmit >= progressThrottleMs) {
        lastProgressEmit = now;
        try { onProgress(filesScanned + filesSkipped, total); } catch { /* user callback */ }
      }
    }
  };

  if (rootStat.isDirectory()) {
    await runPool(walk(target), processOne, concurrency);
  } else {
    await processOne(target);
  }

  // Final progress tick.
  if (onProgress) {
    try { onProgress(filesScanned + filesSkipped, total); } catch { /* ignore */ }
  }

  const durationMs = Date.now() - startedAt;
  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of allFindings) bySeverity[f.severity]++;

  logger.info(
    `Scan complete: scanned=${filesScanned} skipped=${filesSkipped} ` +
    `findings=${allFindings.length} (H:${bySeverity.high} M:${bySeverity.medium} L:${bySeverity.low}) ` +
    `in ${durationMs}ms`
  );

  // ── Build result — ALWAYS returns something visible ──
  let result;
  if (allFindings.length === 0) {
    result = {
      status: 'completed',
      message: 'No secrets detected',
      confidence: 'high',
      total_found: 0,
      summary: { filesScanned, filesSkipped, bySeverity, durationMs, skipReasons },
    };
  } else {
    result = {
      status: 'completed',
      total_found: allFindings.length,
      secrets: allFindings
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.severity] - order[b.severity];
        })
        .map((f) => ({
          type:       f.type,
          value:      f.value,
          file:       f.file,
          line:       f.line,
          severity:   f.severity,
          confidence: f.confidence,
          category:   f.category,
          ruleId:     f.ruleId,
          entropy:    f.entropy,
          source:     f.source,
        })),
      summary: { filesScanned, filesSkipped, bySeverity, durationMs, skipReasons },
    };
  }

  // Optional webhook alert (only when secrets found).
  if (webhookUrl && allFindings.length > 0) {
    await fireWebhook(webhookUrl, result);
  }

  return result;
}

module.exports = { scanPath, scanFile };
