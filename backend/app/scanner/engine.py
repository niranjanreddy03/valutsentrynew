"""
Vault Sentry - Main Scanning Engine
Combines regex patterns, entropy analysis, and keyword scanning.

Performance-critical paths are optimized for:
  * O(log n) line-number lookup via precomputed newline offset index
  * Per-pattern literal pre-filter to skip patterns whose trigger keywords
    do not appear in the file (avoids running expensive regex at all)
  * Binary-file detection via NUL-byte sampling (skip before full read)
  * Path-parts set exclusion (O(depth) vs O(excluded_dirs * pathlen))
  * Inline deduplication by secret hash
  * Single file read shared by pattern + entropy passes
"""

import os
import hashlib
import uuid
from bisect import bisect_right
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Callable, Tuple
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
import asyncio
from loguru import logger

from app.scanner.patterns import COMPILED_PATTERNS, SecretCategory
from app.scanner.entropy import (
    analyze_file_entropy,
    calculate_shannon_entropy,
    calculate_risk_from_entropy,
)
from app.core.config import settings


# --- module-level helpers & caches -----------------------------------------

# Bytes read from the head of each file to determine binary-ness.
_BINARY_SNIFF_BYTES = 4096

# Extensions we treat as binary without even opening the file.
_BINARY_EXTENSIONS = frozenset({
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.o', '.a', '.lib',
    '.class', '.jar', '.war', '.ear', '.pyc', '.pyo',
    '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar',
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.tiff', '.webp',
    '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.wav', '.flac', '.ogg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
})

# Severity -> base risk score lookup (replaces per-call dict construction).
_SEVERITY_SCORES = {
    'critical': 90,
    'high': 70,
    'medium': 50,
    'low': 30,
}

_PROD_KEYWORDS = ('prod', 'production', 'deploy')
_EXAMPLE_KEYWORDS = ('example', 'sample', 'demo')


def _derive_pattern_triggers(pattern_info: Dict) -> Tuple[str, ...]:
    """
    Derive cheap literal trigger substrings for a compiled pattern.
    If *any* trigger is present in a file's content, we run the full regex;
    otherwise we skip this pattern entirely.

    We parse the pattern's source string for obvious literals. When no
    reliable literal can be extracted, we return an empty tuple which means
    "always run" (conservative fallback — never drops findings).
    """
    src = pattern_info["regex"].pattern
    name = pattern_info["name"].lower()

    # Hand-picked fast triggers for the high-volume patterns. These stay
    # case-insensitive via `.lower()` comparison against the content.
    manual = {
        'aws access key id': ('akia', 'a3t', 'abia', 'acca', 'agpa', 'aida',
                              'aipa', 'aroa', 'apka', 'asca', 'asia'),
        'aws secret access key': ('aws_secret', 'secret_access_key'),
        'aws account id': ('aws_account_id', 'account_id', 'account-id'),
        'aws session token': ('aws_session_token', 'session_token'),
        'google api key': ('aiza',),
        'google oauth client id': ('.apps.googleusercontent.com',),
        'google cloud service account': ('"type"', 'service_account'),
        'google oauth access token': ('ya29.',),
        'azure storage account key': ('defaultendpointsprotocol',
                                      'accountkey='),
        'azure ad client secret': ('client_secret', 'clientsecret'),
        'azure sas token': ('sv=',),
        'github personal access token (classic)': ('ghp_',),
        'github oauth access token': ('gho_',),
        'github app token': ('ghu_', 'ghs_'),
        'github fine-grained pat': ('github_pat_',),
        'github refresh token': ('ghr_',),
        'rsa private key': ('-----begin rsa private key-----',),
        'openssh private key': ('-----begin openssh private key-----',),
        'dsa private key': ('-----begin dsa private key-----',),
        'ec private key': ('-----begin ec private key-----',),
        'pgp private key': ('-----begin pgp private key block-----',),
        'encrypted private key': ('-----begin encrypted private key-----',),
        'jwt token': ('eyj',),
        'jwt secret': ('jwt_secret', 'jwt-secret', 'jwt_key', 'jwt-key'),
        'postgresql connection string': ('postgres://', 'postgresql://'),
        'mysql connection string': ('mysql://',),
        'mongodb connection string': ('mongodb://', 'mongodb+srv://'),
        'redis connection string': ('redis://',),
        'generic password': ('password', 'passwd', 'pwd', 'pass'),
        'secret key variable': ('secret_key', 'secret-key', 'api_secret',
                                'api-secret'),
        'stripe api key': ('sk_live', 'sk_test', 'pk_live', 'pk_test'),
        'slack token': ('xoxb-', 'xoxa-', 'xoxp-', 'xoxr-', 'xoxs-'),
        'slack webhook url': ('hooks.slack.com/services',),
        'twilio api key': ('sk',),  # weaker trigger; SK prefix common
        'sendgrid api key': ('sg.',),
        'mailchimp api key': ('-us',),
        'npm token': ('npm_',),
        'pypi token': ('pypi-',),
        'heroku api key': ('heroku',),
        'generic api key': ('api_key', 'apikey', 'api-key'),
        'oauth client secret': ('client_secret', 'oauth_secret',
                                'client-secret', 'oauth-secret'),
        'facebook access token': ('eaa',),
        'twitter bearer token': ('bearer_token', 'bearer-token',
                                 'twitter_bearer'),
    }
    triggers = manual.get(name)
    if triggers is not None:
        return triggers

    # Fallback: try to sniff a literal prefix from the pattern source.
    # Strip common regex scaffolding.
    cleaned = src
    for prefix in ('(?i)', '(?m)', '(?s)'):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
    # A literal leading run of non-regex-meta characters is a safe trigger.
    meta = set(r'.^$*+?()[]{}|\\')
    buf = []
    for ch in cleaned:
        if ch in meta:
            break
        buf.append(ch)
    literal = ''.join(buf).lower()
    return (literal,) if len(literal) >= 3 else ()


# Enrich compiled patterns with their trigger tuple once at import time.
for _p in COMPILED_PATTERNS:
    _p["triggers"] = _derive_pattern_triggers(_p)


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
        excluded_dirs: Optional[List[str]] = None,
        excluded_extensions: Optional[List[str]] = None,
        entropy_enabled: bool = True,
        max_workers: Optional[int] = None,
    ):
        self.max_file_size = max_file_size
        # Lowercase once; we compare against path parts only, not substrings.
        self.excluded_dirs = frozenset(
            d.lower() for d in (excluded_dirs or settings.EXCLUDED_DIRS)
        )
        self.excluded_extensions = frozenset(
            e.lower() for e in (excluded_extensions or settings.EXCLUDED_EXTENSIONS)
        )
        self.entropy_enabled = entropy_enabled
        # Regex work is partly GIL-released in CPython's `re`; scale with CPU.
        self.max_workers = max_workers or min(32, (os.cpu_count() or 4) * 2)
        self.patterns = COMPILED_PATTERNS

        self.test_indicators = (
            'test', 'spec', 'mock', 'fake', 'dummy', 'example',
            'sample', 'fixture', '__tests__', '__mocks__',
        )

    # -- file filtering -----------------------------------------------------

    def _should_skip_file(self, file_path: Path) -> bool:
        """Cheap pre-read filter. Does not open the file."""
        suffix = file_path.suffix.lower()
        if suffix in self.excluded_extensions or suffix in _BINARY_EXTENSIONS:
            return True

        # Compare each path component against the excluded set instead of
        # scanning the full string once per excluded dir.
        parts = file_path.parts
        excluded = self.excluded_dirs
        for part in parts:
            if part.lower() in excluded:
                return True
        return False

    @staticmethod
    def _is_binary_bytes(chunk: bytes) -> bool:
        """A NUL byte in a text file is a reliable binary signal."""
        return b'\x00' in chunk

    def _is_test_file(self, file_path: str) -> bool:
        path_lower = file_path.lower()
        indicators = self.test_indicators
        return any(ind in path_lower for ind in indicators)

    # -- finding helpers ----------------------------------------------------

    @staticmethod
    def _mask_secret(secret: str, visible_chars: int = 4) -> str:
        length = len(secret)
        if length <= visible_chars * 2:
            return '*' * length
        return (
            secret[:visible_chars]
            + '*' * (length - visible_chars * 2)
            + secret[-visible_chars:]
        )

    @staticmethod
    def _hash_secret(secret: str) -> str:
        return hashlib.sha256(secret.encode('utf-8', errors='ignore')).hexdigest()

    @staticmethod
    def _build_line_index(content: str) -> List[int]:
        """
        Return sorted offsets of every '\\n' in `content`. Used with bisect
        to map any character offset to a 1-based line number in O(log n).
        """
        offsets = []
        append = offsets.append
        idx = content.find('\n')
        while idx != -1:
            append(idx)
            idx = content.find('\n', idx + 1)
        return offsets

    @staticmethod
    def _line_col_from_offset(
        offset: int, line_offsets: List[int]
    ) -> Tuple[int, int]:
        """O(log n) line/column lookup using precomputed newline offsets."""
        line_idx = bisect_right(line_offsets, offset)  # 0-based line count before offset
        line_number = line_idx + 1
        line_start = line_offsets[line_idx - 1] + 1 if line_idx > 0 else 0
        column = offset - line_start
        return line_number, column

    @staticmethod
    def _get_code_snippet(
        lines: List[str], line_number: int, context_lines: int = 2
    ) -> str:
        start = max(0, line_number - context_lines - 1)
        end = min(len(lines), line_number + context_lines)
        out = []
        for i in range(start, end):
            prefix = ">>> " if i == line_number - 1 else "    "
            out.append(f"{i + 1:4d} {prefix}{lines[i]}")
        return '\n'.join(out)

    @staticmethod
    def _calculate_risk_score(
        severity: str, confidence: float, is_test_file: bool, file_path_lower: str
    ) -> float:
        score = _SEVERITY_SCORES.get(severity, 50) * confidence
        if is_test_file:
            score *= 0.5
        # Avoid lowercasing the same path twice: caller passes it lowercased.
        if any(kw in file_path_lower for kw in _EXAMPLE_KEYWORDS):
            score *= 0.6
        if any(kw in file_path_lower for kw in _PROD_KEYWORDS):
            score *= 1.2
        if score < 0:
            return 0.0
        if score > 100:
            return 100.0
        return round(score, 1)

    # -- scanning -----------------------------------------------------------

    def _scan_content_patterns(
        self,
        content: str,
        content_lower: str,
        file_path: str,
        file_path_lower: str,
        lines: List[str],
        line_offsets: List[int],
        is_test: bool,
        seen_hashes: set,
    ) -> List[Finding]:
        """Regex pattern pass. Deduplicates inline by secret hash."""
        findings = []

        for pattern_info in self.patterns:
            # Cheap literal pre-filter: skip patterns whose trigger keywords
            # never appear in the file. `content_lower` is computed once per
            # file so this is a pure O(|content|) substring search per
            # pattern — and typically misses quickly.
            triggers = pattern_info["triggers"]
            if triggers:
                for trigger in triggers:
                    if trigger in content_lower:
                        break
                else:
                    continue  # no trigger found → no chance of match

            fp_patterns = pattern_info["false_positive_patterns"]
            pattern_name = pattern_info["name"]
            severity = pattern_info["severity"]
            confidence = pattern_info["confidence"]
            category = pattern_info["category"]
            rule_type = pattern_name.lower().replace(" ", "_")

            try:
                for match in pattern_info["regex"].finditer(content):
                    matched_full = match.group(0)

                    # False positive short-circuit.
                    if fp_patterns:
                        if any(fp.search(matched_full) for fp in fp_patterns):
                            continue

                    matched_value = (
                        match.group(1) if match.lastindex else matched_full
                    )

                    # Inline dedup — skip hashing twice if we already stored it.
                    secret_hash = self._hash_secret(matched_value)
                    if secret_hash in seen_hashes:
                        continue

                    # Fast line/column via precomputed offsets.
                    # Use match.start() of the matched_value, not the full match.
                    if match.lastindex:
                        value_start = match.start(1)
                    else:
                        value_start = match.start()
                    line_number, column_start = self._line_col_from_offset(
                        value_start, line_offsets
                    )

                    finding = Finding(
                        finding_id=str(uuid.uuid4()),
                        type=rule_type,
                        category=category,
                        severity=severity,
                        file_path=file_path,
                        line_number=line_number,
                        column_start=column_start,
                        column_end=column_start + len(matched_value),
                        secret_value=matched_value,
                        secret_masked=self._mask_secret(matched_value),
                        secret_hash=secret_hash,
                        code_snippet=self._get_code_snippet(lines, line_number),
                        match_rule=pattern_name,
                        risk_score=self._calculate_risk_score(
                            severity, confidence, is_test, file_path_lower
                        ),
                        # Skip entropy calc on pattern findings — entropy is
                        # only meaningful on the entropy-heuristic path, and
                        # it was previously computed every pattern match only
                        # to attach informational metadata. That was a large
                        # chunk of per-match CPU.
                        entropy_score=None,
                        is_test_file=is_test,
                        confidence=confidence,
                    )
                    findings.append(finding)
                    seen_hashes.add(secret_hash)
            except Exception as e:
                logger.error(f"Error applying pattern {pattern_name}: {e}")

        return findings

    def _scan_content_entropy(
        self,
        content: str,
        file_path: str,
        lines: List[str],
        is_test: bool,
        seen_hashes: set,
    ) -> List[Finding]:
        if not self.entropy_enabled:
            return []

        findings = []
        entropy_findings = analyze_file_entropy(content)

        for ef in entropy_findings:
            secret_hash = self._hash_secret(ef.value)
            if secret_hash in seen_hashes:
                continue

            risk_level, risk_score = calculate_risk_from_entropy(
                ef.entropy, ef.char_set
            )
            if is_test:
                risk_score *= 0.5

            findings.append(Finding(
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
                secret_hash=secret_hash,
                code_snippet=self._get_code_snippet(lines, ef.line_number),
                match_rule=f"Entropy Analysis ({ef.char_set})",
                risk_score=risk_score,
                entropy_score=ef.entropy,
                is_test_file=is_test,
                confidence=0.6,
                metadata={"charset": ef.char_set},
            ))
            seen_hashes.add(secret_hash)

        return findings

    def scan_file(self, file_path: Path) -> List[Finding]:
        """Scan a single file for secrets."""
        try:
            try:
                file_size = file_path.stat().st_size
            except OSError as e:
                logger.debug(f"Stat failed for {file_path}: {e}")
                return []

            if file_size == 0:
                return []
            if file_size > self.max_file_size:
                logger.debug(
                    f"Skipping large file: {file_path} ({file_size} bytes)"
                )
                return []

            # Read binary first, sniff for NUL byte, then decode. This both
            # catches binary files missed by extension and saves us from the
            # cost of UTF-8 decoding things we'll immediately discard.
            try:
                with open(file_path, 'rb') as f:
                    head = f.read(_BINARY_SNIFF_BYTES)
                    if self._is_binary_bytes(head):
                        return []
                    if file_size <= _BINARY_SNIFF_BYTES:
                        raw = head
                    else:
                        raw = head + f.read()
            except OSError as e:
                logger.debug(f"Could not read file {file_path}: {e}")
                return []

            try:
                content = raw.decode('utf-8', errors='ignore')
            except Exception as e:
                logger.debug(f"Could not decode {file_path}: {e}")
                return []

            if not content or not content.strip():
                return []

            str_path = str(file_path)
            return self.scan_content(content, str_path)

        except Exception as e:
            logger.error(f"Error scanning file {file_path}: {e}")
            return []

    def scan_content(self, content: str, file_name: str) -> List[Finding]:
        """
        Scan an in-memory string. This is the shared hot path: both
        ``scan_file`` and the quick-scan Celery task route through here.
        """
        if not content:
            return []

        # Compute once, reuse across pattern pre-filter and test-file check.
        content_lower = content.lower()
        file_path_lower = file_name.lower()
        is_test = self._is_test_file(file_name)
        line_offsets = self._build_line_index(content)
        lines = content.split('\n')

        seen_hashes: set = set()

        pattern_findings = self._scan_content_patterns(
            content=content,
            content_lower=content_lower,
            file_path=file_name,
            file_path_lower=file_path_lower,
            lines=lines,
            line_offsets=line_offsets,
            is_test=is_test,
            seen_hashes=seen_hashes,
        )

        # Only run entropy heuristic when pattern matches are few. Entropy is
        # noisy and comparatively expensive — skip when we already have
        # plenty of high-signal findings.
        if len(pattern_findings) < 10:
            entropy_findings = self._scan_content_entropy(
                content=content,
                file_path=file_name,
                lines=lines,
                is_test=is_test,
                seen_hashes=seen_hashes,
            )
            pattern_findings.extend(entropy_findings)

        return pattern_findings

    def scan_directory(
        self,
        directory,
        recursive: bool = True,
        report_progress: Optional[Callable[[float], None]] = None,
    ) -> ScanResult:
        """Scan a directory for secrets."""
        directory = Path(directory)
        scan_id = str(uuid.uuid4())
        started_at = datetime.utcnow()
        all_findings: List[Finding] = []
        files_scanned = 0
        errors: List[str] = []

        logger.info(f"Starting scan of directory: {directory}")

        files_to_scan: List[Path] = []
        excluded = self.excluded_dirs

        if recursive:
            for root, dirs, files in os.walk(directory):
                # Prune excluded directories in-place so os.walk doesn't
                # descend into them. This alone can save huge amounts of
                # I/O (node_modules, .git, build dirs).
                dirs[:] = [d for d in dirs if d.lower() not in excluded]
                for file_name in files:
                    file_path = Path(root) / file_name
                    if not self._should_skip_file(file_path):
                        files_to_scan.append(file_path)
        else:
            try:
                for item in directory.iterdir():
                    if item.is_file() and not self._should_skip_file(item):
                        files_to_scan.append(item)
            except OSError as e:
                errors.append(f"Error listing {directory}: {e}")

        total_files = len(files_to_scan)
        logger.info(f"Found {total_files} files to scan")

        if total_files == 0:
            completed_at = datetime.utcnow()
            return ScanResult(
                scan_id=scan_id,
                target=str(directory),
                status="completed",
                findings=[],
                files_scanned=0,
                total_findings=0,
                high_risk_count=0,
                medium_risk_count=0,
                low_risk_count=0,
                risk_score=0.0,
                duration_seconds=(completed_at - started_at).total_seconds(),
                started_at=started_at,
                completed_at=completed_at,
                errors=errors,
            )

        # Parallel scan. `re` releases the GIL during large matches, so
        # threads are effective for file-level parallelism here.
        progress_step = max(1, total_files // 50)  # update ~50 times max
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(self.scan_file, fp): fp for fp in files_to_scan
            }
            for i, future in enumerate(as_completed(future_to_file), 1):
                file_path = future_to_file[future]
                try:
                    findings = future.result()
                    all_findings.extend(findings)
                    files_scanned += 1
                except Exception as e:
                    errors.append(f"Error scanning {file_path}: {e}")
                    logger.error(f"Error scanning {file_path}: {e}")

                if report_progress and (
                    i % progress_step == 0 or i == total_files
                ):
                    try:
                        report_progress(i / total_files)
                    except Exception:
                        pass  # never let a bad callback crash the scan

        completed_at = datetime.utcnow()
        duration = (completed_at - started_at).total_seconds()

        # Final cross-file dedup. In-file dedup already happened, but the
        # same secret may appear in multiple files and we want one record.
        seen: set = set()
        unique_findings = []
        for finding in all_findings:
            if finding.secret_hash not in seen:
                seen.add(finding.secret_hash)
                unique_findings.append(finding)

        # Severity counts in a single pass.
        high_count = medium_count = low_count = 0
        risk_sum = 0.0
        for f in unique_findings:
            risk_sum += f.risk_score
            sev = f.severity
            if sev == 'medium':
                medium_count += 1
            elif sev == 'low':
                low_count += 1
            elif sev in ('critical', 'high'):
                high_count += 1

        risk_score = (
            round(risk_sum / len(unique_findings), 1) if unique_findings else 0.0
        )

        logger.info(
            f"Scan completed: {files_scanned} files, "
            f"{len(unique_findings)} findings, "
            f"{duration:.2f}s"
        )

        return ScanResult(
            scan_id=scan_id,
            target=str(directory),
            status="completed",
            findings=unique_findings,
            files_scanned=files_scanned,
            total_findings=len(unique_findings),
            high_risk_count=high_count,
            medium_risk_count=medium_count,
            low_risk_count=low_count,
            risk_score=risk_score,
            duration_seconds=round(duration, 2),
            started_at=started_at,
            completed_at=completed_at,
            errors=errors,
        )

    async def scan_directory_async(
        self,
        directory,
        recursive: bool = True,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> ScanResult:
        """Async wrapper that runs the sync scan in the default executor."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.scan_directory(directory, recursive, progress_callback),
        )


# Singleton scanner instance
scanner = SecretScanner()
