'use strict';

/**
 * validator.js — Post-match validation & confidence classification.
 *
 * Every raw match produced by the regex layer goes through validate() so we can:
 *   - Reject placeholder/mock values ("your-api-key-here", "XXXX", "example", …)
 *   - Downgrade confidence in test/fixture files
 *   - Reject candidates whose entropy is inconsistent with a real secret
 *   - Map to the public severity buckets: high | medium | low
 */

const { assessEntropy } = require('./entropy');

// ── Placeholder / mock value indicators ──────────────────────────────────────
const PLACEHOLDER_PATTERNS = [
  /^x+$/i,                         // xxxxxxxxx
  /^\*+$/,                         // *********
  /^<[^>]+>$/,                     // <your-key>
  /^\$\{[^}]+\}$/,                 // ${ENV_VAR}
  /^%[^%]+%$/,                     // %PLACEHOLDER%
  /^(your|my|sample|example|placeholder|dummy|fake|test|mock|todo|changeme|insert)[-_]/i,
  /^(your|my|sample|example|placeholder|dummy|fake|test|mock|todo|changeme|insert)$/i,
  /^(abc123|foobar|password123|secret123)$/i,
  /^(0+|1+|9+|a+|z+)$/i,           // 00000, aaaaa, zzzzz
];

const TEST_FILE_HINTS = [
  'test', 'spec', '__tests__', '__mocks__',
  'fixture', 'mock', 'sample', 'example',
];

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isPlaceholder(raw) {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * @param {string} filePath
 * @returns {boolean}
 */
function isTestPath(filePath) {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  return TEST_FILE_HINTS.some((h) => lower.includes(h));
}

/**
 * Check character diversity — a string of one repeated char is never a secret.
 * @param {string} s
 * @returns {number} unique-char ratio, 0..1
 */
function diversityRatio(s) {
  if (!s) return 0;
  return new Set(s).size / s.length;
}

/**
 * Validate a raw match and decide final severity.
 *
 * @param {Object} params
 * @param {string} params.raw              Matched secret string.
 * @param {string} params.ruleSeverity     Rule-declared severity (critical|high|medium|low).
 * @param {number} params.ruleConfidence   Rule-declared confidence 0..1.
 * @param {string} params.filePath
 * @param {string} [params.category]
 * @returns {{
 *   accepted: boolean,
 *   severity: 'high'|'medium'|'low',
 *   confidence: 'high'|'medium'|'low',
 *   reason: string,
 *   entropy: number
 * }}
 */
function validate({ raw, ruleSeverity, ruleConfidence, filePath, category }) {
  // 1. Empty / placeholder → reject outright.
  if (isPlaceholder(raw)) {
    return {
      accepted: false, severity: 'low', confidence: 'low',
      reason: 'placeholder or mock value', entropy: 0,
    };
  }

  // 2. Length sanity — anything <8 chars is noise (except for known formats
  //    which the rule layer already constrained).
  if (raw.length < 8) {
    return {
      accepted: false, severity: 'low', confidence: 'low',
      reason: `too short (${raw.length} chars)`, entropy: 0,
    };
  }

  // 3. Character diversity — reject "aaaaaaaaaaa" style strings.
  const diversity = diversityRatio(raw);
  if (diversity < 0.2) {
    return {
      accepted: false, severity: 'low', confidence: 'low',
      reason: `low character diversity (${diversity.toFixed(2)})`, entropy: 0,
    };
  }

  // 4. Entropy gate. Known-format matches (AWS keys, GitHub PATs, …) have
  //    their own structural validation, so we only enforce entropy for
  //    generic / password / api_key categories.
  const entropyAssessment = assessEntropy(raw);
  const needsEntropyGate =
    category === 'password' || category === 'api_key' || category === 'oauth' || category === 'generic';

  if (needsEntropyGate && !entropyAssessment.isSuspicious && raw.length < 32) {
    return {
      accepted: false, severity: 'low', confidence: 'low',
      reason: `entropy too low for generic secret (${entropyAssessment.reason})`,
      entropy: entropyAssessment.entropy,
    };
  }

  // 5. Map rule severity → public bucket. Then adjust for context.
  let severity = ruleSeverity === 'critical' || ruleSeverity === 'high' ? 'high'
                : ruleSeverity === 'medium' ? 'medium' : 'low';
  let confidence = ruleConfidence >= 0.9 ? 'high'
                  : ruleConfidence >= 0.7 ? 'medium' : 'low';

  // 6. Test / fixture files → downgrade one step. They're still reported,
  //    but a leaked mock token is rarely exploitable.
  if (isTestPath(filePath)) {
    severity = severity === 'high' ? 'medium' : 'low';
    confidence = confidence === 'high' ? 'medium' : 'low';
  }

  return {
    accepted: true, severity, confidence,
    reason: 'validated', entropy: entropyAssessment.entropy,
  };
}

module.exports = { validate, isPlaceholder, isTestPath, diversityRatio };
