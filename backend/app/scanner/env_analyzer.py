"""
Vault Sentry - Environment Variables Analyzer
Analyzes .env files and environment configurations for exposed secrets
"""

import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger

from app.scanner.entropy import calculate_shannon_entropy
from app.scanner.patterns import COMPILED_PATTERNS


@dataclass
class EnvVariable:
    """Represents an environment variable"""
    key: str
    value: str
    line_number: int
    file_path: str
    is_secret: bool = False
    secret_type: Optional[str] = None
    risk_level: str = "info"
    entropy_score: float = 0.0
    is_placeholder: bool = False
    recommendations: List[str] = field(default_factory=list)


@dataclass
class EnvAnalysisResult:
    """Result of environment variable analysis"""
    file_path: str
    total_variables: int
    secrets_found: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    variables: List[EnvVariable]
    recommendations: List[str]
    analyzed_at: datetime = field(default_factory=datetime.utcnow)


class EnvVarsAnalyzer:
    """
    Analyzes environment variable files for exposed secrets.
    
    Features:
    - Parse .env files in various formats
    - Detect secrets using patterns and entropy
    - Identify placeholder vs real values
    - Provide security recommendations
    - Support for multiple env file formats
    """
    
    # Keys that typically contain sensitive values
    SENSITIVE_KEY_PATTERNS = [
        r'(?i)password',
        r'(?i)secret',
        r'(?i)api[_-]?key',
        r'(?i)access[_-]?key',
        r'(?i)private[_-]?key',
        r'(?i)token',
        r'(?i)auth',
        r'(?i)credential',
        r'(?i)jwt',
        r'(?i)bearer',
        r'(?i)oauth',
        r'(?i)connection[_-]?string',
        r'(?i)database[_-]?url',
        r'(?i)redis[_-]?url',
        r'(?i)mongo[_-]?uri',
        r'(?i)smtp[_-]?pass',
        r'(?i)encryption[_-]?key',
        r'(?i)signing[_-]?key',
        r'(?i)webhook[_-]?secret',
        r'(?i)client[_-]?secret',
        r'(?i)app[_-]?secret',
    ]
    
    # Placeholder patterns (not real secrets)
    PLACEHOLDER_PATTERNS = [
        r'^your[_-]',
        r'^<.*>$',
        r'^\$\{.*\}$',
        r'^\{\{.*\}\}$',
        r'^xxx+$',
        r'^\*+$',
        r'^changeme',
        r'^placeholder',
        r'^example',
        r'^todo',
        r'^CHANGE_ME',
        r'^REPLACE_ME',
        r'^INSERT_',
        r'__REPLACE__',
    ]
    
    # Common safe/non-secret values
    SAFE_VALUES = {
        'true', 'false', 'yes', 'no', 'on', 'off',
        'development', 'production', 'staging', 'test', 'local',
        'localhost', '127.0.0.1', '0.0.0.0',
        'debug', 'info', 'warning', 'error',
        'utf-8', 'utf8', 'ascii',
        'json', 'xml', 'html', 'text',
    }
    
    # Specific service patterns
    SERVICE_PATTERNS = {
        'AWS_ACCESS_KEY_ID': {
            'pattern': r'^AKIA[0-9A-Z]{16}$',
            'type': 'AWS Access Key',
            'risk': 'critical',
        },
        'AWS_SECRET_ACCESS_KEY': {
            'pattern': r'^[A-Za-z0-9/+=]{40}$',
            'type': 'AWS Secret Key',
            'risk': 'critical',
        },
        'GITHUB_TOKEN': {
            'pattern': r'^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]+$',
            'type': 'GitHub Token',
            'risk': 'high',
        },
        'STRIPE_SECRET_KEY': {
            'pattern': r'^sk_(live|test)_[A-Za-z0-9]+$',
            'type': 'Stripe Secret Key',
            'risk': 'critical',
        },
        'GOOGLE_API_KEY': {
            'pattern': r'^AIza[0-9A-Za-z\-_]{35}$',
            'type': 'Google API Key',
            'risk': 'high',
        },
        'SLACK_TOKEN': {
            'pattern': r'^xox[baprs]-[A-Za-z0-9\-]+$',
            'type': 'Slack Token',
            'risk': 'high',
        },
        'SENDGRID_API_KEY': {
            'pattern': r'^SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$',
            'type': 'SendGrid API Key',
            'risk': 'high',
        },
        'TWILIO_AUTH_TOKEN': {
            'pattern': r'^[a-f0-9]{32}$',
            'type': 'Twilio Auth Token',
            'risk': 'high',
        },
    }
    
    def __init__(
        self,
        entropy_threshold: float = 3.5,
        min_secret_length: int = 8
    ):
        """
        Initialize the environment variables analyzer.
        
        Args:
            entropy_threshold: Minimum entropy to consider a value as potential secret
            min_secret_length: Minimum length for secret values
        """
        self.entropy_threshold = entropy_threshold
        self.min_secret_length = min_secret_length
        self.sensitive_key_regex = [
            re.compile(pattern) for pattern in self.SENSITIVE_KEY_PATTERNS
        ]
        self.placeholder_regex = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.PLACEHOLDER_PATTERNS
        ]
    
    def _parse_env_file(self, content: str, file_path: str) -> List[Tuple[str, str, int]]:
        """
        Parse environment file content.
        
        Supports formats:
        - KEY=value
        - KEY="value"
        - KEY='value'
        - export KEY=value
        - # comments
        
        Args:
            content: File content
            file_path: Path to the file
            
        Returns:
            List of (key, value, line_number) tuples
        """
        variables = []
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, start=1):
            # Skip comments and empty lines
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            
            # Remove 'export' prefix
            if line.startswith('export '):
                line = line[7:].strip()
            
            # Parse KEY=VALUE
            match = re.match(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$', line)
            if not match:
                continue
            
            key = match.group(1)
            value = match.group(2).strip()
            
            # Remove quotes
            if (value.startswith('"') and value.endswith('"')) or \
               (value.startswith("'") and value.endswith("'")):
                value = value[1:-1]
            
            variables.append((key, value, line_num))
        
        return variables
    
    def _is_placeholder(self, value: str) -> bool:
        """Check if a value appears to be a placeholder"""
        if not value:
            return True
        
        for pattern in self.placeholder_regex:
            if pattern.search(value):
                return True
        
        return False
    
    def _is_safe_value(self, value: str) -> bool:
        """Check if a value is a known safe/non-secret value"""
        return value.lower() in self.SAFE_VALUES
    
    def _is_sensitive_key(self, key: str) -> bool:
        """Check if a key name suggests it contains sensitive data"""
        for pattern in self.sensitive_key_regex:
            if pattern.search(key):
                return True
        return False
    
    def _check_service_pattern(self, key: str, value: str) -> Optional[Tuple[str, str]]:
        """Check if value matches a known service secret pattern"""
        # Check specific key patterns
        for service_key, config in self.SERVICE_PATTERNS.items():
            if service_key in key.upper():
                if re.match(config['pattern'], value):
                    return (config['type'], config['risk'])
        
        # Check general patterns from patterns.py
        for pattern in COMPILED_PATTERNS:
            if pattern.compiled.search(value):
                return (pattern.name, pattern.severity)
        
        return None
    
    def _analyze_value(self, key: str, value: str) -> Tuple[bool, str, str, float]:
        """
        Analyze a value to determine if it's a secret.
        
        Returns:
            Tuple of (is_secret, secret_type, risk_level, entropy_score)
        """
        # Empty or very short values
        if not value or len(value) < self.min_secret_length:
            return (False, "", "info", 0.0)
        
        # Check for placeholders
        if self._is_placeholder(value):
            return (False, "", "info", 0.0)
        
        # Check for safe values
        if self._is_safe_value(value):
            return (False, "", "info", 0.0)
        
        # Calculate entropy
        entropy = calculate_shannon_entropy(value)
        
        # Check for known service patterns
        service_match = self._check_service_pattern(key, value)
        if service_match:
            return (True, service_match[0], service_match[1], entropy)
        
        # Check if key suggests sensitive data
        if self._is_sensitive_key(key):
            # High entropy + sensitive key = likely secret
            if entropy >= self.entropy_threshold:
                return (True, "Potential Secret", "medium", entropy)
            elif len(value) >= 20:
                return (True, "Possible Secret", "low", entropy)
        
        # Very high entropy values might be secrets even without sensitive key
        if entropy >= 4.5 and len(value) >= 24:
            return (True, "High Entropy String", "medium", entropy)
        
        return (False, "", "info", entropy)
    
    def _get_recommendations(self, variable: EnvVariable) -> List[str]:
        """Generate security recommendations for a variable"""
        recommendations = []
        
        if variable.is_secret and not variable.is_placeholder:
            recommendations.append(
                f"Move {variable.key} to a secure secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager)"
            )
            
            if variable.risk_level in ['critical', 'high']:
                recommendations.append(
                    f"Rotate the {variable.secret_type or 'secret'} immediately if this file was committed to version control"
                )
                recommendations.append(
                    f"Add this file to .gitignore if not already"
                )
            
            if 'password' in variable.key.lower():
                recommendations.append(
                    "Consider using environment-specific password management"
                )
            
            if 'key' in variable.key.lower() and 'api' in variable.key.lower():
                recommendations.append(
                    "Implement API key rotation policy"
                )
        
        return recommendations
    
    def analyze_file(self, file_path: str) -> EnvAnalysisResult:
        """
        Analyze an environment file for secrets.
        
        Args:
            file_path: Path to the .env file
            
        Returns:
            EnvAnalysisResult with analysis details
        """
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        content = path.read_text(encoding='utf-8', errors='ignore')
        return self.analyze_content(content, file_path)
    
    def analyze_content(self, content: str, file_path: str = "<string>") -> EnvAnalysisResult:
        """
        Analyze environment variable content.
        
        Args:
            content: Environment file content
            file_path: Source file path for reporting
            
        Returns:
            EnvAnalysisResult with analysis details
        """
        # Parse variables
        raw_variables = self._parse_env_file(content, file_path)
        
        variables: List[EnvVariable] = []
        all_recommendations: Set[str] = set()
        
        for key, value, line_num in raw_variables:
            # Analyze the value
            is_secret, secret_type, risk_level, entropy = self._analyze_value(key, value)
            is_placeholder = self._is_placeholder(value)
            
            env_var = EnvVariable(
                key=key,
                value=self._mask_value(value) if is_secret else value,
                line_number=line_num,
                file_path=file_path,
                is_secret=is_secret,
                secret_type=secret_type if is_secret else None,
                risk_level=risk_level if is_secret else "info",
                entropy_score=entropy,
                is_placeholder=is_placeholder,
            )
            
            # Generate recommendations
            env_var.recommendations = self._get_recommendations(env_var)
            all_recommendations.update(env_var.recommendations)
            
            variables.append(env_var)
        
        # Count risk levels
        secrets = [v for v in variables if v.is_secret and not v.is_placeholder]
        high_risk = sum(1 for v in secrets if v.risk_level in ['critical', 'high'])
        medium_risk = sum(1 for v in secrets if v.risk_level == 'medium')
        low_risk = sum(1 for v in secrets if v.risk_level == 'low')
        
        # Add general recommendations
        if secrets:
            all_recommendations.add(
                "Consider using a .env.example file with placeholder values for documentation"
            )
            all_recommendations.add(
                "Ensure .env files are listed in .gitignore"
            )
            if any(v.risk_level in ['critical', 'high'] for v in secrets):
                all_recommendations.add(
                    "CRITICAL: Review your Git history for accidentally committed secrets"
                )
        
        return EnvAnalysisResult(
            file_path=file_path,
            total_variables=len(variables),
            secrets_found=len(secrets),
            high_risk_count=high_risk,
            medium_risk_count=medium_risk,
            low_risk_count=low_risk,
            variables=variables,
            recommendations=sorted(all_recommendations)
        )
    
    def _mask_value(self, value: str, visible_chars: int = 4) -> str:
        """Mask a secret value for safe display"""
        if len(value) <= visible_chars * 2:
            return '*' * len(value)
        return value[:visible_chars] + '*' * (len(value) - visible_chars * 2) + value[-visible_chars:]
    
    def analyze_directory(
        self,
        directory: str,
        patterns: List[str] = None
    ) -> List[EnvAnalysisResult]:
        """
        Analyze all environment files in a directory.
        
        Args:
            directory: Directory path to scan
            patterns: File patterns to match (default: .env, .env.*)
            
        Returns:
            List of EnvAnalysisResult for each file found
        """
        dir_path = Path(directory)
        
        if not dir_path.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")
        
        # Default patterns
        if patterns is None:
            patterns = ['.env', '.env.*', '*.env', 'env', 'environment']
        
        results = []
        
        # Find all matching files
        for pattern in patterns:
            for file_path in dir_path.rglob(pattern):
                if file_path.is_file():
                    try:
                        result = self.analyze_file(str(file_path))
                        results.append(result)
                    except Exception as e:
                        logger.error(f"Error analyzing {file_path}: {e}")
        
        return results
    
    def generate_report(self, results: List[EnvAnalysisResult]) -> Dict:
        """Generate a summary report from multiple analysis results"""
        total_files = len(results)
        total_variables = sum(r.total_variables for r in results)
        total_secrets = sum(r.secrets_found for r in results)
        total_high_risk = sum(r.high_risk_count for r in results)
        total_medium_risk = sum(r.medium_risk_count for r in results)
        total_low_risk = sum(r.low_risk_count for r in results)
        
        all_recommendations = set()
        for result in results:
            all_recommendations.update(result.recommendations)
        
        # Find most common secret types
        secret_types: Dict[str, int] = {}
        for result in results:
            for var in result.variables:
                if var.is_secret and var.secret_type:
                    secret_types[var.secret_type] = secret_types.get(var.secret_type, 0) + 1
        
        return {
            'summary': {
                'total_files_analyzed': total_files,
                'total_variables': total_variables,
                'total_secrets_found': total_secrets,
                'risk_distribution': {
                    'critical_high': total_high_risk,
                    'medium': total_medium_risk,
                    'low': total_low_risk
                }
            },
            'secret_types': dict(sorted(
                secret_types.items(),
                key=lambda x: x[1],
                reverse=True
            )),
            'files': [
                {
                    'path': r.file_path,
                    'variables': r.total_variables,
                    'secrets': r.secrets_found,
                    'high_risk': r.high_risk_count
                }
                for r in results
            ],
            'recommendations': sorted(all_recommendations),
            'generated_at': datetime.utcnow().isoformat()
        }


# Singleton instance
env_analyzer = EnvVarsAnalyzer()


def analyze_env_file(file_path: str) -> EnvAnalysisResult:
    """
    Simple function to analyze an environment file.
    
    Args:
        file_path: Path to the .env file
        
    Returns:
        EnvAnalysisResult with findings
    """
    return env_analyzer.analyze_file(file_path)


def analyze_env_content(content: str) -> EnvAnalysisResult:
    """
    Analyze environment variable content directly.
    
    Args:
        content: Environment file content as string
        
    Returns:
        EnvAnalysisResult with findings
    """
    return env_analyzer.analyze_content(content)
