"""
Vault Sentry - Main Scanning Engine
Combines regex patterns, entropy analysis, and keyword scanning
"""

import os
import hashlib
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, AsyncIterator, Any
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
from loguru import logger

from app.scanner.patterns import COMPILED_PATTERNS, SecretCategory
from app.scanner.entropy import (
    analyze_file_entropy,
    calculate_shannon_entropy,
    calculate_risk_from_entropy
)
from app.core.config import settings


@dataclass
class Finding:
    """Represents a detected secret finding"""
    finding_id: str
    type: str
    category: str
    severity: str
    file_path: str
    line_number: int
    column_start: int
    column_end: int
    secret_value: str
    secret_masked: str
    secret_hash: str
    code_snippet: str
    match_rule: str
    risk_score: float
    entropy_score: Optional[float] = None
    is_test_file: bool = False
    confidence: float = 0.9
    metadata: Dict = field(default_factory=dict)


@dataclass
class ScanResult:
    """Result of a complete scan"""
    scan_id: str
    target: str
    status: str
    findings: List[Finding]
    files_scanned: int
    total_findings: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    risk_score: float
    duration_seconds: float
    started_at: datetime
    completed_at: datetime
    errors: List[str] = field(default_factory=list)


class SecretScanner:
    """
    Main secret scanning engine.
    Combines regex pattern matching, entropy analysis, and keyword detection.
    """
    
    def __init__(
        self,
        max_file_size: int = settings.MAX_FILE_SIZE_SCAN,
        excluded_dirs: List[str] = None,
        excluded_extensions: List[str] = None,
        entropy_enabled: bool = True,
        max_workers: int = 4
    ):
        self.max_file_size = max_file_size
        self.excluded_dirs = set(excluded_dirs or settings.EXCLUDED_DIRS)
        self.excluded_extensions = set(excluded_extensions or settings.EXCLUDED_EXTENSIONS)
        self.entropy_enabled = entropy_enabled
        self.max_workers = max_workers
        self.patterns = COMPILED_PATTERNS
        
        # Keywords that indicate sensitive content
        self.sensitive_keywords = {
            'password', 'secret', 'api_key', 'apikey', 'api-key',
            'access_key', 'accesskey', 'auth_token', 'authtoken',
            'credentials', 'private_key', 'privatekey', 'token',
            'bearer', 'oauth', 'jwt', 'session', 'cookie'
        }
        
        # Test file indicators
        self.test_indicators = {
            'test', 'spec', 'mock', 'fake', 'dummy', 'example',
            'sample', 'fixture', '__tests__', '__mocks__'
        }
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Determine if a file should be skipped"""
        path_str = str(file_path).lower()
        
        # Check excluded directories
        for excluded in self.excluded_dirs:
            if excluded.lower() in path_str:
                return True
        
        # Check excluded extensions
        suffix = file_path.suffix.lower()
        if suffix in self.excluded_extensions:
            return True
        
        # Skip binary files by extension
        binary_extensions = {'.exe', '.dll', '.so', '.dylib', '.bin', '.dat'}
        if suffix in binary_extensions:
            return True
        
        return False
    
    def _is_test_file(self, file_path: str) -> bool:
        """Check if file is likely a test/example file"""
        path_lower = file_path.lower()
        return any(indicator in path_lower for indicator in self.test_indicators)
    
    def _mask_secret(self, secret: str, visible_chars: int = 4) -> str:
        """Mask a secret value for safe display"""
        if len(secret) <= visible_chars * 2:
            return '*' * len(secret)
        
        return secret[:visible_chars] + '*' * (len(secret) - visible_chars * 2) + secret[-visible_chars:]
    
    def _hash_secret(self, secret: str) -> str:
        """Create SHA256 hash of secret for deduplication"""
        return hashlib.sha256(secret.encode()).hexdigest()
    
    def _get_code_snippet(
        self,
        lines: List[str],
        line_number: int,
        context_lines: int = 2
    ) -> str:
        """Extract code snippet with context around finding"""
        start = max(0, line_number - context_lines - 1)
        end = min(len(lines), line_number + context_lines)
        
        snippet_lines = []
        for i in range(start, end):
            prefix = ">>> " if i == line_number - 1 else "    "
            snippet_lines.append(f"{i + 1:4d} {prefix}{lines[i]}")
        
        return '\n'.join(snippet_lines)
    
    def _calculate_risk_score(
        self,
        severity: str,
        confidence: float,
        is_test_file: bool,
        file_path: str
    ) -> float:
        """Calculate risk score based on multiple factors"""
        # Base score from severity
        severity_scores = {
            'critical': 90,
            'high': 70,
            'medium': 50,
            'low': 30
        }
        base_score = severity_scores.get(severity, 50)
        
        # Adjust for confidence
        score = base_score * confidence
        
        # Reduce score for test files
        if is_test_file:
            score *= 0.5
        
        # Reduce score for example/sample files
        if any(kw in file_path.lower() for kw in ['example', 'sample', 'demo']):
            score *= 0.6
        
        # Increase score for production-related paths
        if any(kw in file_path.lower() for kw in ['prod', 'production', 'deploy']):
            score *= 1.2
        
        return min(100, max(0, round(score, 1)))
    
    def _scan_content_patterns(
        self,
        content: str,
        file_path: str,
        lines: List[str]
    ) -> List[Finding]:
        """Scan content using regex patterns"""
        findings = []
        
        for pattern_info in self.patterns:
            try:
                for match in pattern_info["regex"].finditer(content):
                    # Check for false positives
                    is_false_positive = False
                    for fp_pattern in pattern_info["false_positive_patterns"]:
                        if fp_pattern.search(match.group(0)):
                            is_false_positive = True
                            break
                    
                    if is_false_positive:
                        continue
                    
                    # Get the matched value
                    matched_value = match.group(1) if match.lastindex else match.group(0)
                    
                    # Calculate line number
                    line_start = content[:match.start()].count('\n') + 1
                    
                    # Calculate column
                    line_start_pos = content.rfind('\n', 0, match.start()) + 1
                    column_start = match.start() - line_start_pos
                    column_end = column_start + len(matched_value)
                    
                    # Check if test file
                    is_test = self._is_test_file(file_path)
                    
                    # Calculate risk score
                    risk_score = self._calculate_risk_score(
                        pattern_info["severity"],
                        pattern_info["confidence"],
                        is_test,
                        file_path
                    )
                    
                    # Calculate entropy for additional context
                    entropy = calculate_shannon_entropy(matched_value)
                    
                    finding = Finding(
                        finding_id=str(uuid.uuid4()),
                        type=pattern_info["name"].lower().replace(" ", "_"),
                        category=pattern_info["category"],
                        severity=pattern_info["severity"],
                        file_path=file_path,
                        line_number=line_start,
                        column_start=column_start,
                        column_end=column_end,
                        secret_value=matched_value,
                        secret_masked=self._mask_secret(matched_value),
                        secret_hash=self._hash_secret(matched_value),
                        code_snippet=self._get_code_snippet(lines, line_start),
                        match_rule=pattern_info["name"],
                        risk_score=risk_score,
                        entropy_score=round(entropy, 2),
                        is_test_file=is_test,
                        confidence=pattern_info["confidence"]
                    )
                    findings.append(finding)
            
            except Exception as e:
                logger.error(f"Error applying pattern {pattern_info['name']}: {e}")
        
        return findings
    
    def _scan_content_entropy(
        self,
        content: str,
        file_path: str,
        lines: List[str]
    ) -> List[Finding]:
        """Scan content using entropy analysis"""
        findings = []
        
        if not self.entropy_enabled:
            return findings
        
        entropy_findings = analyze_file_entropy(content)
        
        for ef in entropy_findings:
            is_test = self._is_test_file(file_path)
            risk_level, risk_score = calculate_risk_from_entropy(
                ef.entropy,
                ef.char_set
            )
            
            # Adjust risk for test files
            if is_test:
                risk_score *= 0.5
            
            finding = Finding(
                finding_id=str(uuid.uuid4()),
                type="high_entropy_string",
                category="generic",
                severity=risk_level,
                file_path=file_path,
                line_number=ef.line_number,
                column_start=ef.column,
                column_end=ef.column + len(ef.value),
                secret_value=ef.value,
                secret_masked=self._mask_secret(ef.value),
                secret_hash=self._hash_secret(ef.value),
                code_snippet=self._get_code_snippet(lines, ef.line_number),
                match_rule=f"Entropy Analysis ({ef.char_set})",
                risk_score=risk_score,
                entropy_score=ef.entropy,
                is_test_file=is_test,
                confidence=0.6,  # Lower confidence for entropy-only findings
                metadata={"charset": ef.char_set}
            )
            findings.append(finding)
        
        return findings
    
    def scan_file(self, file_path: Path) -> List[Finding]:
        """Scan a single file for secrets"""
        findings = []
        
        try:
            # Check file size
            file_size = file_path.stat().st_size
            if file_size > self.max_file_size:
                logger.debug(f"Skipping large file: {file_path} ({file_size} bytes)")
                return findings
            
            # Read file content
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            except Exception as e:
                logger.debug(f"Could not read file {file_path}: {e}")
                return findings
            
            if not content.strip():
                return findings
            
            lines = content.split('\n')
            str_path = str(file_path)
            
            # Pattern-based scanning
            pattern_findings = self._scan_content_patterns(content, str_path, lines)
            findings.extend(pattern_findings)
            
            # Entropy-based scanning (only if no pattern matches found)
            if len(pattern_findings) < 10:  # Limit to avoid too many findings
                entropy_findings = self._scan_content_entropy(content, str_path, lines)
                
                # Deduplicate with pattern findings
                existing_hashes = {f.secret_hash for f in pattern_findings}
                for ef in entropy_findings:
                    if ef.secret_hash not in existing_hashes:
                        findings.append(ef)
            
        except Exception as e:
            logger.error(f"Error scanning file {file_path}: {e}")
        
        return findings
    
    def scan_directory(
        self,
        directory: Path,
        recursive: bool = True
    ) -> ScanResult:
        """Scan a directory for secrets"""
        scan_id = str(uuid.uuid4())
        started_at = datetime.utcnow()
        all_findings = []
        files_scanned = 0
        errors = []
        
        logger.info(f"Starting scan of directory: {directory}")
        
        # Collect files to scan
        files_to_scan = []
        
        if recursive:
            for root, dirs, files in os.walk(directory):
                # Remove excluded directories from traversal
                dirs[:] = [d for d in dirs if d not in self.excluded_dirs]
                
                for file in files:
                    file_path = Path(root) / file
                    if not self._should_skip_file(file_path):
                        files_to_scan.append(file_path)
        else:
            for item in directory.iterdir():
                if item.is_file() and not self._should_skip_file(item):
                    files_to_scan.append(item)
        
        logger.info(f"Found {len(files_to_scan)} files to scan")
        
        # Scan files in parallel
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(self.scan_file, file_path): file_path
                for file_path in files_to_scan
            }
            
            for future in as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    findings = future.result()
                    all_findings.extend(findings)
                    files_scanned += 1
                except Exception as e:
                    errors.append(f"Error scanning {file_path}: {e}")
                    logger.error(f"Error scanning {file_path}: {e}")
        
        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()
        
        # Deduplicate findings by hash
        seen_hashes = set()
        unique_findings = []
        for finding in all_findings:
            if finding.secret_hash not in seen_hashes:
                seen_hashes.add(finding.secret_hash)
                unique_findings.append(finding)
        
        # Count by severity
        high_count = sum(1 for f in unique_findings if f.severity in ['critical', 'high'])
        medium_count = sum(1 for f in unique_findings if f.severity == 'medium')
        low_count = sum(1 for f in unique_findings if f.severity == 'low')
        
        # Calculate overall risk score
        if unique_findings:
            risk_score = sum(f.risk_score for f in unique_findings) / len(unique_findings)
        else:
            risk_score = 0.0
        
        result = ScanResult(
            scan_id=scan_id,
            target=str(directory),
            status="completed",
            findings=unique_findings,
            files_scanned=files_scanned,
            total_findings=len(unique_findings),
            high_risk_count=high_count,
            medium_risk_count=medium_count,
            low_risk_count=low_count,
            risk_score=round(risk_score, 1),
            duration_seconds=round(duration, 2),
            started_at=started_at,
            completed_at=completed_at,
            errors=errors
        )
        
        logger.info(
            f"Scan completed: {files_scanned} files, "
            f"{len(unique_findings)} findings, "
            f"{duration:.2f}s"
        )
        
        return result
    
    async def scan_directory_async(
        self,
        directory: Path,
        recursive: bool = True,
        progress_callback: Optional[callable] = None
    ) -> ScanResult:
        """Async wrapper for directory scanning with progress updates"""
        loop = asyncio.get_event_loop()
        
        # Run scan in thread pool
        result = await loop.run_in_executor(
            None,
            lambda: self.scan_directory(directory, recursive)
        )
        
        return result


# Singleton scanner instance
scanner = SecretScanner()
