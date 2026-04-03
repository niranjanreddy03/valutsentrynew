"""
Vault Sentry - Secret Detection Patterns
Comprehensive regex patterns for detecting various types of secrets
"""

import re
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class SecretCategory(str, Enum):
    """Categories of secrets"""
    AWS = "aws"
    GOOGLE = "google"
    AZURE = "azure"
    GITHUB = "github"
    PRIVATE_KEY = "private_key"
    JWT = "jwt"
    DATABASE = "database"
    API_KEY = "api_key"
    PASSWORD = "password"
    OAUTH = "oauth"
    GENERIC = "generic"


@dataclass
class SecretPattern:
    """Secret detection pattern configuration"""
    name: str
    pattern: str
    category: SecretCategory
    severity: str  # critical, high, medium, low
    description: str
    confidence: float = 0.9  # 0-1, how confident we are this is a real secret
    false_positive_patterns: Optional[list] = None


# ============================================
# AWS Patterns
# ============================================
AWS_PATTERNS = [
    SecretPattern(
        name="AWS Access Key ID",
        pattern=r'(?:A3T[A-Z0-9]|AKIA|ABIA|ACCA|AGPA|AIDA|AIPA|AIPA|AROA|AIPA|APKA|ASCA|ASIA)[A-Z0-9]{16}',
        category=SecretCategory.AWS,
        severity="critical",
        description="AWS Access Key ID - provides programmatic access to AWS resources",
        confidence=0.95
    ),
    SecretPattern(
        name="AWS Secret Access Key",
        pattern=r'(?i)(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[=:]\s*["\']?([A-Za-z0-9/+=]{40})["\']?',
        category=SecretCategory.AWS,
        severity="critical",
        description="AWS Secret Access Key - paired with Access Key ID for authentication",
        confidence=0.9
    ),
    SecretPattern(
        name="AWS Account ID",
        pattern=r'(?i)(?:aws_account_id|account[_-]?id)\s*[=:]\s*["\']?(\d{12})["\']?',
        category=SecretCategory.AWS,
        severity="medium",
        description="AWS Account ID - 12-digit account identifier",
        confidence=0.7
    ),
    SecretPattern(
        name="AWS Session Token",
        pattern=r'(?i)(?:aws_session_token|session_token)\s*[=:]\s*["\']?([A-Za-z0-9/+=]{100,})["\']?',
        category=SecretCategory.AWS,
        severity="high",
        description="AWS Session Token - temporary security credential",
        confidence=0.85
    ),
]

# ============================================
# Google Cloud Patterns
# ============================================
GOOGLE_PATTERNS = [
    SecretPattern(
        name="Google API Key",
        pattern=r'AIza[0-9A-Za-z\-_]{35}',
        category=SecretCategory.GOOGLE,
        severity="high",
        description="Google Cloud API Key",
        confidence=0.95
    ),
    SecretPattern(
        name="Google OAuth Client ID",
        pattern=r'[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com',
        category=SecretCategory.GOOGLE,
        severity="medium",
        description="Google OAuth 2.0 Client ID",
        confidence=0.9
    ),
    SecretPattern(
        name="Google Cloud Service Account",
        pattern=r'(?i)"type"\s*:\s*"service_account"',
        category=SecretCategory.GOOGLE,
        severity="critical",
        description="Google Cloud Service Account JSON key file",
        confidence=0.95
    ),
    SecretPattern(
        name="Google OAuth Access Token",
        pattern=r'ya29\.[0-9A-Za-z\-_]+',
        category=SecretCategory.GOOGLE,
        severity="high",
        description="Google OAuth Access Token",
        confidence=0.9
    ),
]

# ============================================
# Azure Patterns
# ============================================
AZURE_PATTERNS = [
    SecretPattern(
        name="Azure Storage Account Key",
        pattern=r'(?i)(?:DefaultEndpointsProtocol=https;AccountName=)[A-Za-z0-9]+(?:;AccountKey=)[A-Za-z0-9+/=]{88}',
        category=SecretCategory.AZURE,
        severity="critical",
        description="Azure Storage Account Connection String",
        confidence=0.95
    ),
    SecretPattern(
        name="Azure AD Client Secret",
        pattern=r'(?i)(?:client_secret|clientsecret)\s*[=:]\s*["\']?([a-zA-Z0-9~._-]{34,})["\']?',
        category=SecretCategory.AZURE,
        severity="high",
        description="Azure Active Directory Client Secret",
        confidence=0.7
    ),
    SecretPattern(
        name="Azure SAS Token",
        pattern=r'(?i)(?:sv=)[0-9]{4}-[0-9]{2}-[0-9]{2}(?:&(?:ss|srt|sp|se|st|spr|sig)=[^&]+)+',
        category=SecretCategory.AZURE,
        severity="high",
        description="Azure Shared Access Signature Token",
        confidence=0.9
    ),
]

# ============================================
# GitHub Patterns
# ============================================
GITHUB_PATTERNS = [
    SecretPattern(
        name="GitHub Personal Access Token (Classic)",
        pattern=r'ghp_[A-Za-z0-9]{36}',
        category=SecretCategory.GITHUB,
        severity="critical",
        description="GitHub Personal Access Token (Classic)",
        confidence=0.99
    ),
    SecretPattern(
        name="GitHub OAuth Access Token",
        pattern=r'gho_[A-Za-z0-9]{36}',
        category=SecretCategory.GITHUB,
        severity="high",
        description="GitHub OAuth Access Token",
        confidence=0.99
    ),
    SecretPattern(
        name="GitHub App Token",
        pattern=r'(?:ghu|ghs)_[A-Za-z0-9]{36}',
        category=SecretCategory.GITHUB,
        severity="high",
        description="GitHub App Installation/User Access Token",
        confidence=0.99
    ),
    SecretPattern(
        name="GitHub Fine-grained PAT",
        pattern=r'github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}',
        category=SecretCategory.GITHUB,
        severity="critical",
        description="GitHub Fine-grained Personal Access Token",
        confidence=0.99
    ),
    SecretPattern(
        name="GitHub Refresh Token",
        pattern=r'ghr_[A-Za-z0-9]{36}',
        category=SecretCategory.GITHUB,
        severity="high",
        description="GitHub Refresh Token",
        confidence=0.99
    ),
]

# ============================================
# Private Key Patterns
# ============================================
PRIVATE_KEY_PATTERNS = [
    SecretPattern(
        name="RSA Private Key",
        pattern=r'-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----',
        category=SecretCategory.PRIVATE_KEY,
        severity="critical",
        description="RSA Private Key",
        confidence=0.99
    ),
    SecretPattern(
        name="OpenSSH Private Key",
        pattern=r'-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----',
        category=SecretCategory.PRIVATE_KEY,
        severity="critical",
        description="OpenSSH Private Key",
        confidence=0.99
    ),
    SecretPattern(
        name="DSA Private Key",
        pattern=r'-----BEGIN DSA PRIVATE KEY-----[\s\S]+?-----END DSA PRIVATE KEY-----',
        category=SecretCategory.PRIVATE_KEY,
        severity="critical",
        description="DSA Private Key",
        confidence=0.99
    ),
    SecretPattern(
        name="EC Private Key",
        pattern=r'-----BEGIN EC PRIVATE KEY-----[\s\S]+?-----END EC PRIVATE KEY-----',
        category=SecretCategory.PRIVATE_KEY,
        severity="critical",
        description="EC (Elliptic Curve) Private Key",
        confidence=0.99
    ),
    SecretPattern(
        name="PGP Private Key",
        pattern=r'-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----',
        category=SecretCategory.PRIVATE_KEY,
        severity="critical",
        description="PGP Private Key Block",
        confidence=0.99
    ),
    SecretPattern(
        name="Encrypted Private Key",
        pattern=r'-----BEGIN ENCRYPTED PRIVATE KEY-----[\s\S]+?-----END ENCRYPTED PRIVATE KEY-----',
        category=SecretCategory.PRIVATE_KEY,
        severity="high",
        description="Encrypted Private Key (PKCS#8)",
        confidence=0.95
    ),
]

# ============================================
# JWT Patterns
# ============================================
JWT_PATTERNS = [
    SecretPattern(
        name="JWT Token",
        pattern=r'eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*',
        category=SecretCategory.JWT,
        severity="high",
        description="JSON Web Token (JWT)",
        confidence=0.95
    ),
    SecretPattern(
        name="JWT Secret",
        pattern=r'(?i)(?:jwt[_-]?secret|jwt[_-]?key)\s*[=:]\s*["\']?([A-Za-z0-9+/=]{20,})["\']?',
        category=SecretCategory.JWT,
        severity="critical",
        description="JWT Signing Secret/Key",
        confidence=0.85
    ),
]

# ============================================
# Database Patterns
# ============================================
DATABASE_PATTERNS = [
    SecretPattern(
        name="PostgreSQL Connection String",
        pattern=r'(?i)postgres(?:ql)?://[^\s"\'<>]+:[^\s"\'<>]+@[^\s"\'<>]+',
        category=SecretCategory.DATABASE,
        severity="critical",
        description="PostgreSQL connection string with credentials",
        confidence=0.95
    ),
    SecretPattern(
        name="MySQL Connection String",
        pattern=r'(?i)mysql://[^\s"\'<>]+:[^\s"\'<>]+@[^\s"\'<>]+',
        category=SecretCategory.DATABASE,
        severity="critical",
        description="MySQL connection string with credentials",
        confidence=0.95
    ),
    SecretPattern(
        name="MongoDB Connection String",
        pattern=r'(?i)mongodb(?:\+srv)?://[^\s"\'<>]+:[^\s"\'<>]+@[^\s"\'<>]+',
        category=SecretCategory.DATABASE,
        severity="critical",
        description="MongoDB connection string with credentials",
        confidence=0.95
    ),
    SecretPattern(
        name="Redis Connection String",
        pattern=r'(?i)redis://[^\s"\'<>]+:[^\s"\'<>]+@[^\s"\'<>]+',
        category=SecretCategory.DATABASE,
        severity="high",
        description="Redis connection string with credentials",
        confidence=0.9
    ),
]

# ============================================
# Password Patterns
# ============================================
PASSWORD_PATTERNS = [
    SecretPattern(
        name="Generic Password",
        pattern=r'(?i)(?:password|passwd|pwd|pass)\s*[=:]\s*["\']([^"\']{8,})["\']',
        category=SecretCategory.PASSWORD,
        severity="high",
        description="Hardcoded password in code",
        confidence=0.7,
        false_positive_patterns=[
            r'(?i)password\s*[=:]\s*["\']?\s*$',  # Empty password
            r'(?i)password\s*[=:]\s*["\']?password["\']?',  # password = password
            r'(?i)password\s*[=:]\s*["\']?\*+["\']?',  # Masked password
            r'(?i)password\s*[=:]\s*["\']?your[_-]?password',  # Placeholder
            r'(?i)password\s*[=:]\s*["\']?example',  # Example
        ]
    ),
    SecretPattern(
        name="Secret Key Variable",
        pattern=r'(?i)(?:secret[_-]?key|api[_-]?secret)\s*[=:]\s*["\']([^"\']{16,})["\']',
        category=SecretCategory.PASSWORD,
        severity="high",
        description="Hardcoded secret key",
        confidence=0.75
    ),
]

# ============================================
# API Key Patterns
# ============================================
API_KEY_PATTERNS = [
    SecretPattern(
        name="Stripe API Key",
        pattern=r'(?:sk_live|sk_test|pk_live|pk_test)_[A-Za-z0-9]{24,}',
        category=SecretCategory.API_KEY,
        severity="critical",
        description="Stripe API Key",
        confidence=0.99
    ),
    SecretPattern(
        name="Slack Token",
        pattern=r'xox[baprs]-[0-9]+-[A-Za-z0-9-]+',
        category=SecretCategory.API_KEY,
        severity="high",
        description="Slack Bot/App Token",
        confidence=0.95
    ),
    SecretPattern(
        name="Slack Webhook URL",
        pattern=r'https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+',
        category=SecretCategory.API_KEY,
        severity="high",
        description="Slack Webhook URL",
        confidence=0.99
    ),
    SecretPattern(
        name="Twilio API Key",
        pattern=r'SK[a-z0-9]{32}',
        category=SecretCategory.API_KEY,
        severity="high",
        description="Twilio API Key",
        confidence=0.9
    ),
    SecretPattern(
        name="SendGrid API Key",
        pattern=r'SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
        category=SecretCategory.API_KEY,
        severity="high",
        description="SendGrid API Key",
        confidence=0.99
    ),
    SecretPattern(
        name="Mailchimp API Key",
        pattern=r'[a-f0-9]{32}-us[0-9]{1,2}',
        category=SecretCategory.API_KEY,
        severity="high",
        description="Mailchimp API Key",
        confidence=0.9
    ),
    SecretPattern(
        name="NPM Token",
        pattern=r'npm_[A-Za-z0-9]{36}',
        category=SecretCategory.API_KEY,
        severity="critical",
        description="NPM Access Token",
        confidence=0.99
    ),
    SecretPattern(
        name="PyPI Token",
        pattern=r'pypi-[A-Za-z0-9_-]{50,}',
        category=SecretCategory.API_KEY,
        severity="critical",
        description="PyPI API Token",
        confidence=0.99
    ),
    SecretPattern(
        name="Heroku API Key",
        pattern=r'(?i)heroku[_-]?api[_-]?key\s*[=:]\s*["\']?([a-f0-9-]{36})["\']?',
        category=SecretCategory.API_KEY,
        severity="high",
        description="Heroku API Key",
        confidence=0.85
    ),
    SecretPattern(
        name="Generic API Key",
        pattern=r'(?i)(?:api[_-]?key|apikey)\s*[=:]\s*["\']([A-Za-z0-9_-]{20,})["\']',
        category=SecretCategory.API_KEY,
        severity="medium",
        description="Generic API Key",
        confidence=0.6
    ),
]

# ============================================
# OAuth Patterns
# ============================================
OAUTH_PATTERNS = [
    SecretPattern(
        name="OAuth Client Secret",
        pattern=r'(?i)(?:client[_-]?secret|oauth[_-]?secret)\s*[=:]\s*["\']([A-Za-z0-9_-]{20,})["\']',
        category=SecretCategory.OAUTH,
        severity="high",
        description="OAuth Client Secret",
        confidence=0.75
    ),
    SecretPattern(
        name="Facebook Access Token",
        pattern=r'EAA[A-Za-z0-9]{100,}',
        category=SecretCategory.OAUTH,
        severity="high",
        description="Facebook Access Token",
        confidence=0.9
    ),
    SecretPattern(
        name="Twitter Bearer Token",
        pattern=r'(?i)(?:bearer[_-]?token|twitter[_-]?bearer)\s*[=:]\s*["\']([A-Za-z0-9%]{50,})["\']',
        category=SecretCategory.OAUTH,
        severity="high",
        description="Twitter Bearer Token",
        confidence=0.8
    ),
]

# ============================================
# All patterns combined
# ============================================
ALL_PATTERNS = (
    AWS_PATTERNS +
    GOOGLE_PATTERNS +
    AZURE_PATTERNS +
    GITHUB_PATTERNS +
    PRIVATE_KEY_PATTERNS +
    JWT_PATTERNS +
    DATABASE_PATTERNS +
    PASSWORD_PATTERNS +
    API_KEY_PATTERNS +
    OAUTH_PATTERNS
)


def get_compiled_patterns():
    """Get all patterns compiled as regex objects"""
    compiled = []
    for pattern in ALL_PATTERNS:
        try:
            compiled.append({
                "name": pattern.name,
                "regex": re.compile(pattern.pattern, re.IGNORECASE | re.MULTILINE),
                "category": pattern.category.value,
                "severity": pattern.severity,
                "description": pattern.description,
                "confidence": pattern.confidence,
                "false_positive_patterns": [
                    re.compile(fp, re.IGNORECASE)
                    for fp in (pattern.false_positive_patterns or [])
                ]
            })
        except re.error as e:
            print(f"Invalid regex pattern '{pattern.name}': {e}")
    return compiled


# Pre-compiled patterns for performance
COMPILED_PATTERNS = get_compiled_patterns()
