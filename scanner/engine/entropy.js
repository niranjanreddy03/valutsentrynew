'use strict';

/**
 * entropy.js — Shannon entropy + character-distribution heuristics.
 *
 * Used by the validation layer to detect "unknown" high-entropy strings that
 * don't match any named pattern (e.g. custom tokens, opaque API keys).
 *
 * Rationale:
 *   - Real secrets (tokens, keys) are near-random → high entropy (>4.0 bits/char).
 *   - English prose, identifiers, and repetitive strings → lower entropy (<3.5).
 *   - Base64/hex charset with enough length + entropy is a strong signal.
 */

/**
 * Shannon entropy in bits per character.
 * @param {string} str
 * @returns {number}
 */
function shannonEntropy(str) {
  if (!str) return 0;
  const freq = Object.create(null);
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  let h = 0;
  for (const k in freq) {
    const p = freq[k] / len;
    h -= p * Math.log2(p);
  }
  return h;
}

const BASE64_CHARS = /^[A-Za-z0-9+/=_-]+$/;
const HEX_CHARS    = /^[a-fA-F0-9]+$/;

/**
 * Classify the character set of a candidate.
 * @param {string} str
 * @returns {'hex'|'base64'|'mixed'|'text'}
 */
function charClass(str) {
  if (HEX_CHARS.test(str))    return 'hex';
  if (BASE64_CHARS.test(str)) return 'base64';
  if (/^[\x20-\x7E]+$/.test(str)) return 'mixed';
  return 'text';
}

/**
 * True when a substring looks like a high-entropy secret candidate.
 *
 * Thresholds are intentionally conservative to keep false positives down:
 *   - hex strings need length ≥ 32 AND entropy ≥ 3.0
 *   - base64 strings need length ≥ 20 AND entropy ≥ 4.0
 *
 * @param {string} candidate
 * @returns {{ isSuspicious: boolean, entropy: number, charset: string, reason: string }}
 */
function assessEntropy(candidate) {
  const entropy = shannonEntropy(candidate);
  const charset = charClass(candidate);
  const len = candidate.length;

  if (charset === 'hex' && len >= 32 && entropy >= 3.0) {
    return { isSuspicious: true, entropy, charset, reason: `hex ${len} chars, H=${entropy.toFixed(2)}` };
  }
  if (charset === 'base64' && len >= 20 && entropy >= 4.0) {
    return { isSuspicious: true, entropy, charset, reason: `base64 ${len} chars, H=${entropy.toFixed(2)}` };
  }
  if (charset === 'mixed' && len >= 24 && entropy >= 4.5) {
    return { isSuspicious: true, entropy, charset, reason: `mixed ${len} chars, H=${entropy.toFixed(2)}` };
  }
  return { isSuspicious: false, entropy, charset, reason: 'below entropy threshold' };
}

module.exports = { shannonEntropy, assessEntropy, charClass };
