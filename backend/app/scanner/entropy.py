"""
Vault Sentry - Shannon Entropy Analysis
Detects high-entropy strings that may be secrets.

Optimizations vs naive per-line regex scanning:
  * A single combined alternation regex over the whole file (one pass) rather
    than three patterns re-scanned on every line.
  * Collections.Counter for frequency tallying instead of a Python dict loop.
  * Cheap character-set detection via a single pass with early-exit flags.
  * Newline offset index (bisect) for fast offset → (line, col) mapping.
  * Dedup during iteration — we never build duplicates to begin with.
"""

import math
import re
from bisect import bisect_right
from collections import Counter
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class EntropyFinding:
    """Result of entropy analysis"""
    value: str
    entropy: float
    char_set: str  # hex, base64, alphanumeric, mixed
    line_number: int
    column: int
    is_likely_secret: bool


# Character-set membership sets (prebuilt once).
_HEX_SET = frozenset("0123456789abcdefABCDEF")
_BASE64_SET = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
)
_ALNUM_EXT_SET = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
)

# Entropy thresholds per charset.
BASE64_ENTROPY_THRESHOLD = 4.5
HEX_ENTROPY_THRESHOLD = 3.0
ALPHANUMERIC_ENTROPY_THRESHOLD = 4.0

MIN_STRING_LENGTH = 20

# One combined scanner. Any group that matches yields a candidate string.
# Using a single compiled regex avoids 3x re-traversal of the content.
_CANDIDATE_RE = re.compile(
    r'["\']([A-Za-z0-9+/=_-]{20,})["\']'           # quoted
    r'|=\s*["\']?([A-Za-z0-9+/=_-]{20,})["\']?'    # assignment
    r'|(?:0x)?([a-fA-F0-9]{32,})'                  # hex
)

# Known non-secret strings (lowercased).
IGNORE_WORDS = frozenset({
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    '0123456789',
    'qwertyuiopasdfghjklzxcvbnm',
    'thequickbrownfoxjumpsoverthelazydog',
    'loremipsumdolorsitametconsecteturadipiscingelit',
})

# Compiled once — used by is_likely_false_positive.
_REPEAT_SINGLE_RE = re.compile(r'^(.)\1+$')
_ALL_UPPER_RE = re.compile(r'^[A-Z]+$')
_ALL_LOWER_RE = re.compile(r'^[a-z]+$')
_ALL_DIGIT_RE = re.compile(r'^[0-9]+$')


def calculate_shannon_entropy(data: str) -> float:
    """Calculate Shannon entropy of a string."""
    if not data:
        return 0.0
    length = len(data)
    # Counter is implemented in C and is faster than a Python dict loop.
    counts = Counter(data)
    entropy = 0.0
    for count in counts.values():
        p = count / length
        entropy -= p * math.log2(p)
    return entropy


def detect_charset(data: str) -> str:
    """Detect the character set of a string in a single pass."""
    is_hex = True
    is_base64 = True
    is_alnum = True
    for ch in data:
        if ch not in _HEX_SET:
            is_hex = False
        if ch not in _BASE64_SET:
            is_base64 = False
        if ch not in _ALNUM_EXT_SET:
            is_alnum = False
        if not (is_hex or is_base64 or is_alnum):
            return "mixed"
    if is_hex:
        return "hex"
    if is_base64:
        return "base64"
    if is_alnum:
        return "alphanumeric"
    return "mixed"


def get_entropy_threshold(charset: str) -> float:
    if charset == "hex":
        return HEX_ENTROPY_THRESHOLD
    if charset == "base64":
        return BASE64_ENTROPY_THRESHOLD
    return ALPHANUMERIC_ENTROPY_THRESHOLD


def is_sequential(s: str) -> bool:
    """True if more than 70% of adjacent character pairs are sequential."""
    if len(s) < 4:
        return False
    sequential_count = 0
    prev = ord(s[0])
    for ch in s[1:]:
        cur = ord(ch)
        if cur - prev in (-1, 0, 1):
            sequential_count += 1
        prev = cur
    return sequential_count / len(s) > 0.7


def is_likely_false_positive(value: str) -> bool:
    """Heuristic filter for strings that look random but aren't secrets."""
    lower_value = value.lower()
    if lower_value in IGNORE_WORDS:
        return True

    # Too few distinct characters — repeating/padded junk.
    unique_ratio_limit = len(value) / 4
    if len(set(value)) < unique_ratio_limit:
        return True

    if is_sequential(value):
        return True

    # Cheap whole-string filters.
    if _REPEAT_SINGLE_RE.match(value):
        return True
    if _ALL_UPPER_RE.match(value) or _ALL_LOWER_RE.match(value):
        return True
    if _ALL_DIGIT_RE.match(value):
        return True

    return False


def _build_line_index(content: str) -> List[int]:
    """Offsets of every '\\n' in `content`. Used with bisect for O(log n) lookup."""
    offsets = []
    append = offsets.append
    idx = content.find('\n')
    while idx != -1:
        append(idx)
        idx = content.find('\n', idx + 1)
    return offsets


def _offset_to_line_col(offset: int, line_offsets: List[int]) -> Tuple[int, int]:
    line_idx = bisect_right(line_offsets, offset)
    line_number = line_idx + 1
    line_start = line_offsets[line_idx - 1] + 1 if line_idx > 0 else 0
    return line_number, offset - line_start


def analyze_line_entropy(
    line: str,
    line_number: int,
    min_length: int = MIN_STRING_LENGTH,
) -> List[EntropyFinding]:
    """Analyze a single line. Kept for API compatibility; prefer
    ``analyze_file_entropy`` for whole-file scanning (one pass)."""
    findings: List[EntropyFinding] = []
    for match in _CANDIDATE_RE.finditer(line):
        value = next((g for g in match.groups() if g), None)
        if value is None or len(value) < min_length:
            continue
        if is_likely_false_positive(value):
            continue
        entropy = calculate_shannon_entropy(value)
        charset = detect_charset(value)
        if entropy < get_entropy_threshold(charset):
            continue
        findings.append(EntropyFinding(
            value=value,
            entropy=round(entropy, 2),
            char_set=charset,
            line_number=line_number,
            column=match.start(),
            is_likely_secret=True,
        ))
    return findings


def analyze_file_entropy(
    content: str,
    min_length: int = MIN_STRING_LENGTH,
    max_findings: int = 100,
) -> List[EntropyFinding]:
    """
    Analyze entire file content for high-entropy strings in a single pass.
    Deduplicates by value as it goes.
    """
    if not content:
        return []

    # Cheap bail-out: if there isn't a single run of 20+ candidate chars in
    # the file, no pattern can match. This spares us compiling state for
    # source files that are just prose or very short.
    # Using a small regex is faster than scanning Python-side.
    if not re.search(r'[A-Za-z0-9+/=_-]{%d,}' % min_length, content):
        return []

    line_offsets = _build_line_index(content)

    seen_values: set = set()
    findings: List[EntropyFinding] = []

    for match in _CANDIDATE_RE.finditer(content):
        # Pick whichever alternation group captured.
        value = None
        value_start = match.start()
        for gi in range(1, 4):
            g = match.group(gi)
            if g is not None:
                value = g
                value_start = match.start(gi)
                break
        if value is None or len(value) < min_length:
            continue
        if value in seen_values:
            continue
        if is_likely_false_positive(value):
            # Still remember to avoid re-checking the same false-positive string.
            seen_values.add(value)
            continue

        entropy = calculate_shannon_entropy(value)
        charset = detect_charset(value)
        if entropy < get_entropy_threshold(charset):
            seen_values.add(value)
            continue

        line_number, column = _offset_to_line_col(value_start, line_offsets)
        findings.append(EntropyFinding(
            value=value,
            entropy=round(entropy, 2),
            char_set=charset,
            line_number=line_number,
            column=column,
            is_likely_secret=True,
        ))
        seen_values.add(value)

        if len(findings) >= max_findings:
            break

    return findings


def calculate_risk_from_entropy(entropy: float, charset: str) -> Tuple[str, float]:
    """Calculate risk level and score from entropy."""
    threshold = get_entropy_threshold(charset)
    max_entropy = 6.0 if charset == "base64" else 4.0
    normalized = min(100.0, (entropy / max_entropy) * 100)

    if entropy >= threshold * 1.3:
        return ("high", min(90.0, normalized + 20))
    if entropy >= threshold * 1.1:
        return ("medium", normalized)
    return ("low", max(20.0, normalized - 20))
