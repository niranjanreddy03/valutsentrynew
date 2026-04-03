"""
Vault Sentry - Feature Extractor for ML Model
Extracts features from secrets for risk scoring
"""

import re
import math
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict
from collections import Counter
from loguru import logger


@dataclass
class SecretFeatures:
    """Features extracted from a secret for ML model input"""
    # Basic features
    entropy: float = 0.0
    length: int = 0
    
    # Secret type encoding (one-hot style)
    is_aws_key: bool = False
    is_google_key: bool = False
    is_azure_key: bool = False
    is_github_token: bool = False
    is_private_key: bool = False
    is_jwt: bool = False
    is_password: bool = False
    is_database_url: bool = False
    is_api_key: bool = False
    is_generic: bool = False
    
    # File location features
    is_test_file: bool = False
    is_example_file: bool = False
    is_production_file: bool = False
    is_config_file: bool = False
    is_env_file: bool = False
    is_cicd_file: bool = False
    
    # Repository sensitivity
    repo_sensitivity_score: float = 0.5  # 0-1
    repo_is_public: bool = False
    repo_has_history: bool = False
    
    # Time features
    commit_age_days: int = 0
    time_exposed_hours: float = 0.0
    
    # Pattern features
    has_variable_assignment: bool = False
    is_hardcoded: bool = False
    has_comments: bool = False
    
    # Context features
    near_sensitive_keywords: bool = False
    in_function_call: bool = False
    confidence_score: float = 0.9
    
    # Additional risk factors
    appears_in_multiple_files: bool = False
    appears_in_git_history: bool = False
    has_been_rotated: bool = False
    
    def to_vector(self) -> List[float]:
        """Convert features to numeric vector for ML model"""
        return [
            self.entropy,
            self.length / 100.0,  # Normalize length
            float(self.is_aws_key),
            float(self.is_google_key),
            float(self.is_azure_key),
            float(self.is_github_token),
            float(self.is_private_key),
            float(self.is_jwt),
            float(self.is_password),
            float(self.is_database_url),
            float(self.is_api_key),
            float(self.is_generic),
            float(self.is_test_file),
            float(self.is_example_file),
            float(self.is_production_file),
            float(self.is_config_file),
            float(self.is_env_file),
            float(self.is_cicd_file),
            self.repo_sensitivity_score,
            float(self.repo_is_public),
            float(self.repo_has_history),
            min(self.commit_age_days / 365.0, 1.0),  # Normalize to 1 year
            min(self.time_exposed_hours / (24 * 30), 1.0),  # Normalize to 30 days
            float(self.has_variable_assignment),
            float(self.is_hardcoded),
            float(self.has_comments),
            float(self.near_sensitive_keywords),
            float(self.in_function_call),
            self.confidence_score,
            float(self.appears_in_multiple_files),
            float(self.appears_in_git_history),
            float(self.has_been_rotated),
        ]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)
    
    @staticmethod
    def feature_names() -> List[str]:
        """Return feature names for model interpretation"""
        return [
            "entropy",
            "length_normalized",
            "is_aws_key",
            "is_google_key",
            "is_azure_key",
            "is_github_token",
            "is_private_key",
            "is_jwt",
            "is_password",
            "is_database_url",
            "is_api_key",
            "is_generic",
            "is_test_file",
            "is_example_file",
            "is_production_file",
            "is_config_file",
            "is_env_file",
            "is_cicd_file",
            "repo_sensitivity_score",
            "repo_is_public",
            "repo_has_history",
            "commit_age_normalized",
            "time_exposed_normalized",
            "has_variable_assignment",
            "is_hardcoded",
            "has_comments",
            "near_sensitive_keywords",
            "in_function_call",
            "confidence_score",
            "appears_in_multiple_files",
            "appears_in_git_history",
            "has_been_rotated",
        ]


class FeatureExtractor:
    """Extract ML features from secret findings"""
    
    # File path patterns
    TEST_PATTERNS = ['test', 'spec', '__tests__', 'mock', 'fixture']
    EXAMPLE_PATTERNS = ['example', 'sample', 'demo', 'template']
    PRODUCTION_PATTERNS = ['prod', 'production', 'deploy', 'release']
    CONFIG_PATTERNS = ['config', 'settings', 'configuration']
    ENV_PATTERNS = ['.env', 'environment', 'dotenv']
    CICD_PATTERNS = ['.github', '.gitlab-ci', 'jenkins', 'circleci', '.travis']
    
    # Sensitive keywords
    SENSITIVE_KEYWORDS = {
        'password', 'secret', 'api_key', 'apikey', 'token', 'auth',
        'credential', 'private', 'access_key', 'session', 'bearer'
    }
    
    # Secret type mappings
    SECRET_TYPE_MAP = {
        'aws_access_key': 'is_aws_key',
        'aws_secret_key': 'is_aws_key',
        'aws': 'is_aws_key',
        'google': 'is_google_key',
        'gcp': 'is_google_key',
        'azure': 'is_azure_key',
        'github': 'is_github_token',
        'gitlab': 'is_github_token',
        'private_key': 'is_private_key',
        'rsa': 'is_private_key',
        'jwt': 'is_jwt',
        'password': 'is_password',
        'database': 'is_database_url',
        'postgres': 'is_database_url',
        'mysql': 'is_database_url',
        'mongodb': 'is_database_url',
        'api_key': 'is_api_key',
        'stripe': 'is_api_key',
        'sendgrid': 'is_api_key',
        'twilio': 'is_api_key',
    }
    
    def __init__(self):
        self.logger = logger.bind(module="feature_extractor")
    
    def calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of a string"""
        if not text:
            return 0.0
        
        # Count character frequencies
        freq = Counter(text)
        length = len(text)
        
        # Calculate entropy
        entropy = 0.0
        for count in freq.values():
            p = count / length
            if p > 0:
                entropy -= p * math.log2(p)
        
        return round(entropy, 4)
    
    def extract_features(
        self,
        secret_value: str,
        secret_type: str,
        file_path: str,
        line_number: int = 0,
        code_snippet: str = "",
        repo_metadata: Optional[Dict] = None,
        commit_metadata: Optional[Dict] = None,
        confidence: float = 0.9
    ) -> SecretFeatures:
        """Extract all features from a secret finding"""
        
        features = SecretFeatures()
        
        # Basic features
        features.entropy = self.calculate_entropy(secret_value)
        features.length = len(secret_value)
        features.confidence_score = confidence
        
        # Secret type features
        secret_type_lower = secret_type.lower()
        for key, attr in self.SECRET_TYPE_MAP.items():
            if key in secret_type_lower:
                setattr(features, attr, True)
                break
        else:
            features.is_generic = True
        
        # File location features
        file_path_lower = file_path.lower()
        features.is_test_file = any(p in file_path_lower for p in self.TEST_PATTERNS)
        features.is_example_file = any(p in file_path_lower for p in self.EXAMPLE_PATTERNS)
        features.is_production_file = any(p in file_path_lower for p in self.PRODUCTION_PATTERNS)
        features.is_config_file = any(p in file_path_lower for p in self.CONFIG_PATTERNS)
        features.is_env_file = any(p in file_path_lower for p in self.ENV_PATTERNS)
        features.is_cicd_file = any(p in file_path_lower for p in self.CICD_PATTERNS)
        
        # Repository metadata
        if repo_metadata:
            features.repo_sensitivity_score = repo_metadata.get('sensitivity_score', 0.5)
            features.repo_is_public = repo_metadata.get('is_public', False)
            features.repo_has_history = repo_metadata.get('has_history', False)
        
        # Commit metadata
        if commit_metadata:
            commit_date = commit_metadata.get('date')
            if commit_date:
                if isinstance(commit_date, str):
                    commit_date = datetime.fromisoformat(commit_date.replace('Z', '+00:00'))
                age = datetime.now(timezone.utc) - commit_date
                features.commit_age_days = age.days
                features.time_exposed_hours = age.total_seconds() / 3600
        
        # Code snippet analysis
        if code_snippet:
            snippet_lower = code_snippet.lower()
            
            # Check for variable assignment patterns
            features.has_variable_assignment = bool(
                re.search(r'[=:]\s*["\']?', code_snippet)
            )
            
            # Check for hardcoded (not referencing env vars)
            features.is_hardcoded = not bool(
                re.search(r'(process\.env|os\.environ|getenv|ENV\[)', code_snippet)
            )
            
            # Check for comments
            features.has_comments = bool(
                re.search(r'(#|//|/\*|\*\s)', code_snippet)
            )
            
            # Check for sensitive keywords nearby
            features.near_sensitive_keywords = any(
                kw in snippet_lower for kw in self.SENSITIVE_KEYWORDS
            )
            
            # Check if in function call
            features.in_function_call = bool(
                re.search(r'[a-zA-Z_]+\s*\(', code_snippet)
            )
        
        return features
    
    def extract_batch(
        self,
        findings: List[Dict[str, Any]],
        repo_metadata: Optional[Dict] = None
    ) -> List[SecretFeatures]:
        """Extract features from multiple findings"""
        return [
            self.extract_features(
                secret_value=f.get('secret_value', ''),
                secret_type=f.get('type', 'generic'),
                file_path=f.get('file_path', ''),
                line_number=f.get('line_number', 0),
                code_snippet=f.get('code_snippet', ''),
                repo_metadata=repo_metadata,
                commit_metadata=f.get('commit_metadata'),
                confidence=f.get('confidence', 0.9)
            )
            for f in findings
        ]
