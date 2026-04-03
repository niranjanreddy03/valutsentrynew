"""
Vault Sentry - Shannon Entropy Analysis
Detects high-entropy strings that may be secrets
"""

import math
import re
from typing import List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class EntropyFinding:
    """Result of entropy analysis"""
    value: str
    entropy: float
    char_set: str  # hex, base64, alphanumeric
    line_number: int
    column: int
    is_likely_secret: bool


# Character sets for entropy calculation
BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
HEX_CHARS = "0123456789abcdefABCDEF"
ALPHANUMERIC_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

# Entropy thresholds
BASE64_ENTROPY_THRESHOLD = 4.5
HEX_ENTROPY_THRESHOLD = 3.0
ALPHANUMERIC_ENTROPY_THRESHOLD = 4.0

# Minimum length for entropy analysis
MIN_STRING_LENGTH = 20

# Patterns to find potential secrets (high-entropy strings in code)
STRING_PATTERNS = [
    # Quoted strings
    r'["\']([A-Za-z0-9+/=_-]{20,})["\']',
    # Assignment values
    r'=\s*["\']?([A-Za-z0-9+/=_-]{20,})["\']?',
    # Hex strings
    r'(?:0x)?([a-fA-F0-9]{32,})',
]

# Words to ignore (not secrets)
IGNORE_WORDS = {
    'abcdefghijklmnopqrstuvwxyz',
    'zyxwvutsrqponmlkjihgfedcba',
    '0123456789',
    'qwertyuiopasdfghjklzxcvbnm',
    'thequickbrownfoxjumpsoverthelazydog',
    'loremipsumdolorsitametconsecteturadipiscingelit',
}

# File extensions to skip for entropy analysis
SKIP_EXTENSIONS = {
    '.min.js', '.min.css', '.map', '.lock',
    '.svg', '.woff', '.woff2', '.ttf', '.eot'
}


def calculate_shannon_entropy(data: str) -> float:
    """
    Calculate Shannon entropy of a string.
    Higher entropy = more random = more likely to be a secret.
    
    Maximum possible entropy:
    - Binary: 1.0
    - Hex (16 chars): 4.0
    - Base64 (64 chars): 6.0
    - Full ASCII (95 printable): ~6.57
    """
    if not data:
        return 0.0
    
    # Count character frequencies
    freq = {}
    for char in data:
        freq[char] = freq.get(char, 0) + 1
    
    # Calculate entropy
    entropy = 0.0
    length = len(data)
    for count in freq.values():
        probability = count / length
        if probability > 0:
            entropy -= probability * math.log2(probability)
    
    return entropy


def detect_charset(data: str) -> str:
    """Detect the character set of a string"""
    data_set = set(data)
    
    if data_set <= set(HEX_CHARS):
        return "hex"
    elif data_set <= set(BASE64_CHARS):
        return "base64"
    elif data_set <= set(ALPHANUMERIC_CHARS + "_-"):
        return "alphanumeric"
    else:
        return "mixed"


def get_entropy_threshold(charset: str) -> float:
    """Get the appropriate entropy threshold for a character set"""
    thresholds = {
        "hex": HEX_ENTROPY_THRESHOLD,
        "base64": BASE64_ENTROPY_THRESHOLD,
        "alphanumeric": ALPHANUMERIC_ENTROPY_THRESHOLD,
        "mixed": ALPHANUMERIC_ENTROPY_THRESHOLD
    }
    return thresholds.get(charset, ALPHANUMERIC_ENTROPY_THRESHOLD)


def is_likely_false_positive(value: str) -> bool:
    """Check if a high-entropy string is likely a false positive"""
    lower_value = value.lower()
    
    # Check against known non-secrets
    if lower_value in IGNORE_WORDS:
        return True
    
    # Check for repeating patterns
    if len(set(value)) < len(value) / 4:
        return True
    
    # Check for sequential characters
    if is_sequential(value):
        return True
    
    # Check for common non-secret patterns
    non_secret_patterns = [
        r'^[A-Z]+$',  # All uppercase single word
        r'^[a-z]+$',  # All lowercase single word
        r'^[0-9]+$',  # All numbers
        r'^[a-f0-9]{32}$',  # Might be MD5 hash of test data
        r'^(.)\1+$',  # Repeating single character
        r'^(..)+$',  # Repeating two-character pattern
    ]
    
    for pattern in non_secret_patterns:
        if re.match(pattern, value):
            return True
    
    return False


def is_sequential(s: str) -> bool:
    """Check if string contains mostly sequential characters"""
    if len(s) < 4:
        return False
    
    sequential_count = 0
    for i in range(len(s) - 1):
        if ord(s[i + 1]) - ord(s[i]) in [-1, 0, 1]:
            sequential_count += 1
    
    return sequential_count / len(s) > 0.7


def analyze_line_entropy(
    line: str,
    line_number: int,
    min_length: int = MIN_STRING_LENGTH
) -> List[EntropyFinding]:
    """
    Analyze a line of code for high-entropy strings.
    Returns list of findings that exceed entropy thresholds.
    """
    findings = []
    
    # Find all potential secret strings in the line
    for pattern in STRING_PATTERNS:
        for match in re.finditer(pattern, line):
            value = match.group(1) if match.lastindex else match.group(0)
            
            # Skip if too short
            if len(value) < min_length:
                continue
            
            # Skip known false positives
            if is_likely_false_positive(value):
                continue
            
            # Calculate entropy
            entropy = calculate_shannon_entropy(value)
            charset = detect_charset(value)
            threshold = get_entropy_threshold(charset)
            
            is_likely_secret = entropy >= threshold
            
            if is_likely_secret:
                findings.append(EntropyFinding(
                    value=value,
                    entropy=round(entropy, 2),
                    char_set=charset,
                    line_number=line_number,
                    column=match.start(),
                    is_likely_secret=is_likely_secret
                ))
    
    return findings


def analyze_file_entropy(
    content: str,
    min_length: int = MIN_STRING_LENGTH,
    max_findings: int = 100
) -> List[EntropyFinding]:
    """
    Analyze entire file content for high-entropy strings.
    """
    all_findings = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, start=1):
        # Skip empty lines and very short lines
        if len(line.strip()) < min_length:
            continue
        
        findings = analyze_line_entropy(line, line_num, min_length)
        all_findings.extend(findings)
        
        # Limit findings per file
        if len(all_findings) >= max_findings:
            break
    
    # Deduplicate by value
    seen_values = set()
    unique_findings = []
    for finding in all_findings:
        if finding.value not in seen_values:
            seen_values.add(finding.value)
            unique_findings.append(finding)
    
    return unique_findings


def calculate_risk_from_entropy(entropy: float, charset: str) -> Tuple[str, float]:
    """
    Calculate risk level and score from entropy.
    Returns (risk_level, risk_score)
    """
    threshold = get_entropy_threshold(charset)
    max_entropy = 6.0 if charset == "base64" else 4.0
    
    # Normalize entropy to 0-100 scale
    normalized = min(100, (entropy / max_entropy) * 100)
    
    # Determine risk level
    if entropy >= threshold * 1.3:
        return ("high", min(90, normalized + 20))
    elif entropy >= threshold * 1.1:
        return ("medium", normalized)
    else:
        return ("low", max(20, normalized - 20))
