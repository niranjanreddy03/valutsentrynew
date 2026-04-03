"""
Vault Sentry - External Scanner Integration
Integrates Trufflehog, Gitleaks, and other external scanners
"""

import os
import json
import asyncio
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger

from app.core.config import settings


@dataclass
class ExternalFinding:
    """Finding from external scanner"""
    source: str  # trufflehog, gitleaks, custom
    rule_id: str
    description: str
    secret_type: str
    severity: str
    file_path: str
    line_number: int
    secret_value: str
    commit_hash: Optional[str] = None
    commit_message: Optional[str] = None
    author: Optional[str] = None
    date: Optional[datetime] = None
    metadata: Dict = field(default_factory=dict)


class TrufflehogScanner:
    """
    Integration with Trufflehog for detecting secrets.
    https://github.com/trufflesecurity/trufflehog
    """
    
    def __init__(self, binary_path: str = "trufflehog"):
        self.binary_path = binary_path
        self.logger = logger.bind(module="trufflehog")
        self._check_installation()
    
    def _check_installation(self):
        """Check if trufflehog is installed"""
        try:
            result = subprocess.run(
                [self.binary_path, "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            self.available = result.returncode == 0
            if self.available:
                self.logger.info(f"Trufflehog available: {result.stdout.strip()}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            self.available = False
            self.logger.warning("Trufflehog not found. External scanning disabled.")
    
    async def scan_directory(
        self,
        target_path: str,
        include_detectors: List[str] = None,
        exclude_detectors: List[str] = None,
        only_verified: bool = False
    ) -> List[ExternalFinding]:
        """Scan a directory using trufflehog"""
        if not self.available:
            return []
        
        cmd = [
            self.binary_path,
            "filesystem",
            target_path,
            "--json",
        ]
        
        if only_verified:
            cmd.append("--only-verified")
        
        if include_detectors:
            cmd.extend(["--include-detectors", ",".join(include_detectors)])
        
        if exclude_detectors:
            cmd.extend(["--exclude-detectors", ",".join(exclude_detectors)])
        
        return await self._run_scan(cmd)
    
    async def scan_git_repo(
        self,
        repo_url: str,
        branch: str = None,
        since_commit: str = None
    ) -> List[ExternalFinding]:
        """Scan a git repository using trufflehog"""
        if not self.available:
            return []
        
        cmd = [
            self.binary_path,
            "git",
            repo_url,
            "--json",
        ]
        
        if branch:
            cmd.extend(["--branch", branch])
        
        if since_commit:
            cmd.extend(["--since-commit", since_commit])
        
        return await self._run_scan(cmd)
    
    async def _run_scan(self, cmd: List[str]) -> List[ExternalFinding]:
        """Execute trufflehog scan and parse results"""
        findings = []
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=settings.SCAN_TIMEOUT
            )
            
            # Parse JSON lines output
            for line in stdout.decode().strip().split('\n'):
                if not line:
                    continue
                try:
                    result = json.loads(line)
                    finding = self._parse_result(result)
                    if finding:
                        findings.append(finding)
                except json.JSONDecodeError:
                    continue
            
        except asyncio.TimeoutError:
            self.logger.error("Trufflehog scan timed out")
        except Exception as e:
            self.logger.error(f"Trufflehog scan error: {e}")
        
        return findings
    
    def _parse_result(self, result: Dict) -> Optional[ExternalFinding]:
        """Parse trufflehog JSON result"""
        try:
            source_metadata = result.get("SourceMetadata", {}).get("Data", {})
            
            # Extract file info
            file_info = source_metadata.get("Filesystem", {}) or source_metadata.get("Git", {})
            file_path = file_info.get("file", "unknown")
            line_number = file_info.get("line", 1)
            
            # Extract git info
            commit = file_info.get("commit", "")
            
            return ExternalFinding(
                source="trufflehog",
                rule_id=result.get("DetectorName", "unknown"),
                description=result.get("DetectorType", {}).get("string", ""),
                secret_type=result.get("DetectorName", "generic"),
                severity=self._map_severity(result.get("Verified", False)),
                file_path=file_path,
                line_number=line_number,
                secret_value=result.get("Raw", ""),
                commit_hash=commit,
                metadata={
                    "verified": result.get("Verified", False),
                    "decoder_name": result.get("DecoderName", ""),
                }
            )
        except Exception as e:
            self.logger.warning(f"Failed to parse trufflehog result: {e}")
            return None
    
    def _map_severity(self, verified: bool) -> str:
        """Map trufflehog verification status to severity"""
        return "critical" if verified else "high"


class GitleaksScanner:
    """
    Integration with Gitleaks for detecting secrets.
    https://github.com/gitleaks/gitleaks
    """
    
    def __init__(self, binary_path: str = "gitleaks"):
        self.binary_path = binary_path
        self.logger = logger.bind(module="gitleaks")
        self._check_installation()
    
    def _check_installation(self):
        """Check if gitleaks is installed"""
        try:
            result = subprocess.run(
                [self.binary_path, "version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            self.available = result.returncode == 0
            if self.available:
                self.logger.info(f"Gitleaks available: {result.stdout.strip()}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            self.available = False
            self.logger.warning("Gitleaks not found. External scanning disabled.")
    
    async def scan_directory(
        self,
        target_path: str,
        config_path: str = None,
        baseline_path: str = None
    ) -> List[ExternalFinding]:
        """Scan a directory using gitleaks"""
        if not self.available:
            return []
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            report_path = f.name
        
        try:
            cmd = [
                self.binary_path,
                "detect",
                "--source", target_path,
                "--report-format", "json",
                "--report-path", report_path,
                "--exit-code", "0",  # Don't fail on findings
            ]
            
            if config_path:
                cmd.extend(["--config", config_path])
            
            if baseline_path:
                cmd.extend(["--baseline-path", baseline_path])
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            await asyncio.wait_for(
                process.communicate(),
                timeout=settings.SCAN_TIMEOUT
            )
            
            # Parse results
            findings = []
            if os.path.exists(report_path):
                with open(report_path, 'r') as f:
                    results = json.load(f)
                    for result in results:
                        finding = self._parse_result(result)
                        if finding:
                            findings.append(finding)
            
            return findings
            
        except Exception as e:
            self.logger.error(f"Gitleaks scan error: {e}")
            return []
        finally:
            if os.path.exists(report_path):
                os.remove(report_path)
    
    async def scan_git_repo(
        self,
        repo_path: str,
        log_opts: str = None
    ) -> List[ExternalFinding]:
        """Scan git history using gitleaks"""
        if not self.available:
            return []
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            report_path = f.name
        
        try:
            cmd = [
                self.binary_path,
                "detect",
                "--source", repo_path,
                "--report-format", "json",
                "--report-path", report_path,
                "--exit-code", "0",
            ]
            
            if log_opts:
                cmd.extend(["--log-opts", log_opts])
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            await asyncio.wait_for(
                process.communicate(),
                timeout=settings.SCAN_TIMEOUT
            )
            
            findings = []
            if os.path.exists(report_path):
                with open(report_path, 'r') as f:
                    results = json.load(f)
                    for result in results:
                        finding = self._parse_result(result)
                        if finding:
                            findings.append(finding)
            
            return findings
            
        except Exception as e:
            self.logger.error(f"Gitleaks scan error: {e}")
            return []
        finally:
            if os.path.exists(report_path):
                os.remove(report_path)
    
    def _parse_result(self, result: Dict) -> Optional[ExternalFinding]:
        """Parse gitleaks JSON result"""
        try:
            return ExternalFinding(
                source="gitleaks",
                rule_id=result.get("RuleID", "unknown"),
                description=result.get("Description", ""),
                secret_type=result.get("RuleID", "generic"),
                severity=self._map_severity(result.get("RuleID", "")),
                file_path=result.get("File", "unknown"),
                line_number=result.get("StartLine", 1),
                secret_value=result.get("Secret", ""),
                commit_hash=result.get("Commit", ""),
                commit_message=result.get("Message", ""),
                author=result.get("Author", ""),
                date=self._parse_date(result.get("Date", "")),
                metadata={
                    "match": result.get("Match", ""),
                    "entropy": result.get("Entropy", 0),
                    "fingerprint": result.get("Fingerprint", ""),
                }
            )
        except Exception as e:
            self.logger.warning(f"Failed to parse gitleaks result: {e}")
            return None
    
    def _map_severity(self, rule_id: str) -> str:
        """Map gitleaks rule to severity"""
        critical_rules = ['aws', 'gcp', 'azure', 'private-key', 'github']
        high_rules = ['jwt', 'api-key', 'stripe', 'slack']
        
        rule_lower = rule_id.lower()
        
        if any(r in rule_lower for r in critical_rules):
            return "critical"
        elif any(r in rule_lower for r in high_rules):
            return "high"
        else:
            return "medium"
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string from gitleaks"""
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except:
            return None


class CustomRuleEngine:
    """
    Custom rule engine for organization-specific secret patterns.
    Allows defining YAML/JSON rules for proprietary secrets.
    """
    
    def __init__(self, rules_path: str = None):
        self.rules_path = rules_path or "config/custom_rules.yaml"
        self.rules: List[Dict] = []
        self.logger = logger.bind(module="custom_rules")
        self._load_rules()
    
    def _load_rules(self):
        """Load custom rules from file"""
        import re
        
        if not os.path.exists(self.rules_path):
            self.logger.info(f"No custom rules file at {self.rules_path}")
            return
        
        try:
            import yaml
            
            with open(self.rules_path, 'r') as f:
                config = yaml.safe_load(f)
            
            self.rules = config.get('rules', [])
            
            # Compile regex patterns
            for rule in self.rules:
                rule['compiled_pattern'] = re.compile(rule['pattern'], re.IGNORECASE)
            
            self.logger.info(f"Loaded {len(self.rules)} custom rules")
            
        except Exception as e:
            self.logger.error(f"Failed to load custom rules: {e}")
    
    def scan_content(
        self,
        content: str,
        file_path: str
    ) -> List[ExternalFinding]:
        """Scan content using custom rules"""
        findings = []
        lines = content.split('\n')
        
        for rule in self.rules:
            pattern = rule.get('compiled_pattern')
            if not pattern:
                continue
            
            for line_num, line in enumerate(lines, 1):
                for match in pattern.finditer(line):
                    findings.append(ExternalFinding(
                        source="custom",
                        rule_id=rule.get('id', 'custom_rule'),
                        description=rule.get('description', ''),
                        secret_type=rule.get('type', 'custom_secret'),
                        severity=rule.get('severity', 'medium'),
                        file_path=file_path,
                        line_number=line_num,
                        secret_value=match.group(0),
                        metadata={
                            "rule_name": rule.get('name', ''),
                            "tags": rule.get('tags', []),
                        }
                    ))
        
        return findings
    
    def add_rule(
        self,
        rule_id: str,
        name: str,
        pattern: str,
        description: str = "",
        severity: str = "medium",
        secret_type: str = "custom_secret",
        tags: List[str] = None
    ):
        """Add a new custom rule"""
        import re
        
        rule = {
            'id': rule_id,
            'name': name,
            'pattern': pattern,
            'compiled_pattern': re.compile(pattern, re.IGNORECASE),
            'description': description,
            'severity': severity,
            'type': secret_type,
            'tags': tags or [],
        }
        
        self.rules.append(rule)
        self._save_rules()
    
    def _save_rules(self):
        """Save rules to file"""
        import yaml
        
        # Remove compiled patterns before saving
        rules_to_save = []
        for rule in self.rules:
            rule_copy = {k: v for k, v in rule.items() if k != 'compiled_pattern'}
            rules_to_save.append(rule_copy)
        
        os.makedirs(os.path.dirname(self.rules_path), exist_ok=True)
        
        with open(self.rules_path, 'w') as f:
            yaml.dump({'rules': rules_to_save}, f, default_flow_style=False)


class UnifiedScanner:
    """
    Unified scanner combining all detection engines.
    """
    
    def __init__(self):
        self.trufflehog = TrufflehogScanner()
        self.gitleaks = GitleaksScanner()
        self.custom_rules = CustomRuleEngine()
        self.logger = logger.bind(module="unified_scanner")
    
    async def scan_directory(
        self,
        target_path: str,
        engines: List[str] = None,
        content: str = None
    ) -> Dict[str, List[ExternalFinding]]:
        """
        Scan using all available engines.
        
        Args:
            target_path: Path to scan
            engines: List of engines to use (trufflehog, gitleaks, custom)
            content: File content for custom rule scanning
            
        Returns:
            Dict mapping engine name to findings
        """
        engines = engines or ['trufflehog', 'gitleaks', 'custom']
        results = {}
        
        tasks = []
        
        if 'trufflehog' in engines and self.trufflehog.available:
            tasks.append(('trufflehog', self.trufflehog.scan_directory(target_path)))
        
        if 'gitleaks' in engines and self.gitleaks.available:
            tasks.append(('gitleaks', self.gitleaks.scan_directory(target_path)))
        
        # Run async scans
        for name, task in tasks:
            try:
                results[name] = await task
            except Exception as e:
                self.logger.error(f"Error running {name}: {e}")
                results[name] = []
        
        # Custom rules scan (synchronous)
        if 'custom' in engines and content:
            results['custom'] = self.custom_rules.scan_content(content, target_path)
        
        return results
    
    def get_available_engines(self) -> List[str]:
        """Get list of available scanning engines"""
        engines = ['builtin']  # Always available
        
        if self.trufflehog.available:
            engines.append('trufflehog')
        
        if self.gitleaks.available:
            engines.append('gitleaks')
        
        if self.custom_rules.rules:
            engines.append('custom')
        
        return engines
