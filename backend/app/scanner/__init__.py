"""
Vault Sentry - Scanner Module
"""

from app.scanner.engine import SecretScanner, Finding, ScanResult, scanner
from app.scanner.patterns import COMPILED_PATTERNS, ALL_PATTERNS, SecretCategory
from app.scanner.entropy import (
    calculate_shannon_entropy,
    analyze_file_entropy,
    analyze_line_entropy,
    EntropyFinding
)
from app.scanner.s3_scanner import (
    S3Scanner,
    S3ScanConfig,
    S3ScanResult,
    S3Object,
    scan_s3_bucket,
    s3_scanner
)
from app.scanner.env_analyzer import (
    EnvVarsAnalyzer,
    EnvVariable,
    EnvAnalysisResult,
    env_analyzer,
    analyze_env_file,
    analyze_env_content
)

__all__ = [
    # Core Scanner
    "SecretScanner",
    "Finding",
    "ScanResult",
    "scanner",
    
    # Patterns
    "COMPILED_PATTERNS",
    "ALL_PATTERNS",
    "SecretCategory",
    
    # Entropy Analysis
    "calculate_shannon_entropy",
    "analyze_file_entropy",
    "analyze_line_entropy",
    "EntropyFinding",
    
    # S3 Scanner
    "S3Scanner",
    "S3ScanConfig",
    "S3ScanResult",
    "S3Object",
    "scan_s3_bucket",
    "s3_scanner",
    
    # Environment Variable Analyzer
    "EnvVarsAnalyzer",
    "EnvVariable",
    "EnvAnalysisResult",
    "env_analyzer",
    "analyze_env_file",
    "analyze_env_content"
]
