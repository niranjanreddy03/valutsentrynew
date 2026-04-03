"""
Vault Sentry - AWS S3 Scanner
Scans files stored in AWS S3 buckets for exposed secrets
"""

import asyncio
import tempfile
import os
from pathlib import Path
from typing import List, Dict, Optional, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger.warning("boto3 not installed. AWS S3 scanning will be simulated.")

from app.scanner.engine import SecretScanner, ScanResult, Finding
from app.core.config import settings


@dataclass
class S3Object:
    """Represents an S3 object to scan"""
    bucket: str
    key: str
    size: int
    last_modified: datetime
    etag: str
    storage_class: str = "STANDARD"


@dataclass
class S3ScanConfig:
    """Configuration for S3 scanning"""
    bucket_name: str
    prefix: str = ""
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    file_extensions: Optional[List[str]] = None
    exclude_patterns: Optional[List[str]] = None
    recursive: bool = True
    max_files: int = 1000


@dataclass
class S3ScanResult(ScanResult):
    """Extended scan result for S3 scans"""
    bucket_name: str = ""
    objects_scanned: int = 0
    total_size_scanned: int = 0
    skipped_objects: List[str] = field(default_factory=list)


class S3Scanner:
    """
    Scans AWS S3 buckets for exposed secrets.
    
    Features:
    - List and filter objects in S3 buckets
    - Download objects for scanning
    - Apply secret detection patterns
    - Support for various file types
    - Configurable size limits and filters
    """
    
    # Default file extensions to scan
    DEFAULT_EXTENSIONS = {
        '.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml',
        '.env', '.ini', '.cfg', '.conf', '.config', '.properties',
        '.xml', '.sh', '.bash', '.zsh', '.ps1', '.tf', '.tfvars',
        '.sql', '.php', '.rb', '.java', '.go', '.rs', '.cs',
        '.dockerfile', '.vue', '.svelte', '.md', '.txt'
    }
    
    # File patterns to exclude
    DEFAULT_EXCLUDE_PATTERNS = [
        'node_modules/', '.git/', '__pycache__/', 'venv/',
        '.terraform/', 'dist/', 'build/', 'coverage/'
    ]
    
    def __init__(
        self,
        aws_access_key_id: Optional[str] = None,
        aws_secret_access_key: Optional[str] = None,
        aws_region: str = "us-east-1",
        simulate: bool = False
    ):
        """
        Initialize the S3 scanner.
        
        Args:
            aws_access_key_id: AWS access key (uses env var if not provided)
            aws_secret_access_key: AWS secret key (uses env var if not provided)
            aws_region: AWS region
            simulate: If True, use simulated S3 data for testing
        """
        self.aws_region = aws_region or settings.AWS_REGION
        self.simulate = simulate or not BOTO3_AVAILABLE
        
        if not self.simulate and BOTO3_AVAILABLE:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=aws_access_key_id or settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=aws_secret_access_key or settings.AWS_SECRET_ACCESS_KEY,
                region_name=self.aws_region
            )
        else:
            self.s3_client = None
            
        self.secret_scanner = SecretScanner()
        
    def _get_simulated_objects(self, config: S3ScanConfig) -> List[S3Object]:
        """Generate simulated S3 objects for testing"""
        simulated_files = [
            ("config/settings.json", 2048, '{"database_url": "postgres://user:pass123@localhost/db"}'),
            ("src/api/auth.py", 4096, 'API_KEY = "demo_api_key_1234567890abcdefghijklmnop"'),
            (".env.production", 512, 'AWS_ACCESS_KEY_ID=EXAMPLE_AWS_KEY_ID_12345\nAWS_SECRET_ACCESS_KEY=example_aws_secret_key_placeholder'),
            ("deploy/secrets.yaml", 1024, 'stripe_key: demo_stripe_key_abc123\ngoogle_api: demo_google_api_key_1234'),
            ("scripts/backup.sh", 768, 'DB_PASSWORD="SuperSecret123!"\nencryption_key="mybase64encryptedkey=="'),
            ("terraform/main.tf", 2560, 'secret_key = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"'),
            ("docs/README.md", 1536, "# API Documentation\nNo secrets here"),
            ("logs/app.log", 10240, "[INFO] Application started"),
            ("public/index.html", 4096, "<!DOCTYPE html><html>...</html>"),
            ("test/fixtures/mock_config.json", 512, '{"test_mode": true, "api_key": "test_key_not_real"}'),
        ]
        
        objects = []
        for key, size, _ in simulated_files:
            if config.prefix and not key.startswith(config.prefix):
                continue
            if config.file_extensions:
                ext = Path(key).suffix.lower()
                if ext not in config.file_extensions:
                    continue
            
            objects.append(S3Object(
                bucket=config.bucket_name,
                key=key,
                size=size,
                last_modified=datetime.utcnow(),
                etag=f'"{hash(key):032x}"',
                storage_class="STANDARD"
            ))
        
        return objects[:config.max_files]
    
    def _get_simulated_content(self, obj: S3Object) -> bytes:
        """Get simulated file content for testing"""
        simulated_contents = {
            "config/settings.json": b'''{
    "app_name": "MyApp",
    "database_url": "postgres://admin:SuperSecretPass123@prod-db.example.com:5432/myapp",
    "redis_url": "redis://default:RedisPassword456@cache.example.com:6379",
    "api_base_url": "https://api.example.com"
}''',
            "src/api/auth.py": b'''"""Authentication module"""
import os

# WARNING: Hardcoded API key detected!
STRIPE_API_KEY = "demo_stripe_api_key_placeholder_value"
SENDGRID_KEY = "SG.abcdefghijklmnop.qrstuvwxyz0123456789ABCDEFGH"

def authenticate_user(token):
    # Verify JWT token
    pass
''',
            ".env.production": b'''# Production Environment Variables
DATABASE_URL=postgres://prod_user:Pr0d_P@ssw0rd!@db.example.com:5432/production
AWS_ACCESS_KEY_ID=EXAMPLE_AWS_KEY_ID_12345
AWS_SECRET_ACCESS_KEY=example_aws_secret_key_placeholder
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=my-super-secret-jwt-key-that-should-not-be-here
SLACK_WEBHOOK=https://hooks.slack.com/services/T00000/B00000/XXXXXXXX
''',
            "deploy/secrets.yaml": b'''# Deployment Secrets (Should be in vault!)
production:
  stripe_secret_key: demo_stripe_key_xxxxxxxxxxxxxxxx
  google_api_key: demo_google_api_xxxxxxxxxxxxxx
  twilio_auth_token: demo_twilio_token_xxxxxxxxxxxxxxx
  
staging:
  stripe_secret_key: demo_stripe_test_yyyyyyyyyyyy
''',
            "scripts/backup.sh": b'''#!/bin/bash
# Database backup script

DB_HOST="production-db.example.com"
DB_USER="backup_user"
DB_PASSWORD="BackupP@ssw0rd2024!"

# Encryption key for backup files
ENCRYPTION_KEY="aGVsbG8gd29ybGQgdGhpcyBpcyBhIHRlc3Qga2V5"

pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > backup.sql.gz
''',
            "terraform/main.tf": b'''# Terraform configuration
provider "aws" {
  region = "us-east-1"
  # DANGER: Hardcoded credentials!
  access_key = "EXAMPLE_AWS_KEY_ID_12345"
  secret_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
''',
            "docs/README.md": b'''# Project Documentation

This is the main documentation file.

## Getting Started

1. Clone the repository
2. Install dependencies
3. Run the application

No secrets here, just documentation.
''',
        }
        
        return simulated_contents.get(obj.key, b"# Empty file for testing")
    
    async def list_objects(self, config: S3ScanConfig) -> List[S3Object]:
        """
        List all objects in an S3 bucket matching the configuration.
        
        Args:
            config: S3 scan configuration
            
        Returns:
            List of S3Object instances
        """
        if self.simulate:
            return self._get_simulated_objects(config)
        
        objects = []
        paginator = self.s3_client.get_paginator('list_objects_v2')
        
        try:
            page_iterator = paginator.paginate(
                Bucket=config.bucket_name,
                Prefix=config.prefix
            )
            
            for page in page_iterator:
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    
                    # Skip directories
                    if key.endswith('/'):
                        continue
                    
                    # Check file size
                    if obj['Size'] > config.max_file_size:
                        continue
                    
                    # Check file extension
                    ext = Path(key).suffix.lower()
                    allowed_extensions = config.file_extensions or self.DEFAULT_EXTENSIONS
                    if ext not in allowed_extensions:
                        continue
                    
                    # Check exclude patterns
                    exclude_patterns = config.exclude_patterns or self.DEFAULT_EXCLUDE_PATTERNS
                    if any(pattern in key for pattern in exclude_patterns):
                        continue
                    
                    objects.append(S3Object(
                        bucket=config.bucket_name,
                        key=key,
                        size=obj['Size'],
                        last_modified=obj['LastModified'],
                        etag=obj['ETag'],
                        storage_class=obj.get('StorageClass', 'STANDARD')
                    ))
                    
                    if len(objects) >= config.max_files:
                        break
                
                if len(objects) >= config.max_files:
                    break
                    
        except ClientError as e:
            logger.error(f"Error listing S3 objects: {e}")
            raise
        except NoCredentialsError:
            logger.error("AWS credentials not configured")
            raise
        
        return objects
    
    async def download_object(self, obj: S3Object) -> bytes:
        """
        Download an S3 object's content.
        
        Args:
            obj: S3Object to download
            
        Returns:
            File content as bytes
        """
        if self.simulate:
            return self._get_simulated_content(obj)
        
        try:
            response = self.s3_client.get_object(
                Bucket=obj.bucket,
                Key=obj.key
            )
            return response['Body'].read()
        except ClientError as e:
            logger.error(f"Error downloading S3 object {obj.key}: {e}")
            raise
    
    async def scan_bucket(self, config: S3ScanConfig) -> S3ScanResult:
        """
        Scan an entire S3 bucket for secrets.
        
        Args:
            config: S3 scan configuration
            
        Returns:
            S3ScanResult with all findings
        """
        import uuid
        start_time = datetime.utcnow()
        scan_id = str(uuid.uuid4())
        
        logger.info(f"Starting S3 scan for bucket: {config.bucket_name}")
        
        # List all objects
        objects = await self.list_objects(config)
        logger.info(f"Found {len(objects)} objects to scan")
        
        all_findings: List[Finding] = []
        files_scanned = 0
        total_size = 0
        skipped = []
        errors = []
        
        # Create temp directory for scanning
        with tempfile.TemporaryDirectory() as temp_dir:
            for obj in objects:
                try:
                    # Download file content
                    content = await self.download_object(obj)
                    total_size += len(content)
                    
                    # Write to temp file
                    temp_path = Path(temp_dir) / obj.key
                    temp_path.parent.mkdir(parents=True, exist_ok=True)
                    temp_path.write_bytes(content)
                    
                    # Scan the file
                    findings = self.secret_scanner.scan_file(temp_path)
                    
                    # Update file paths to show S3 location
                    for finding in findings:
                        finding.file_path = f"s3://{obj.bucket}/{obj.key}"
                        finding.metadata['s3_etag'] = obj.etag
                        finding.metadata['s3_last_modified'] = obj.last_modified.isoformat()
                        all_findings.append(finding)
                    
                    files_scanned += 1
                    
                except Exception as e:
                    logger.error(f"Error scanning {obj.key}: {e}")
                    errors.append(f"Error scanning {obj.key}: {str(e)}")
                    skipped.append(obj.key)
        
        # Calculate risk counts
        high_risk = sum(1 for f in all_findings if f.severity in ['critical', 'high'])
        medium_risk = sum(1 for f in all_findings if f.severity == 'medium')
        low_risk = sum(1 for f in all_findings if f.severity in ['low', 'info'])
        
        # Calculate overall risk score
        risk_score = 0.0
        if all_findings:
            weights = {'critical': 100, 'high': 75, 'medium': 50, 'low': 25, 'info': 10}
            total_weight = sum(weights.get(f.severity, 0) for f in all_findings)
            risk_score = min(100, total_weight / len(all_findings))
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        logger.info(
            f"S3 scan completed: {files_scanned} files, "
            f"{len(all_findings)} findings, {duration:.2f}s"
        )
        
        return S3ScanResult(
            scan_id=scan_id,
            target=f"s3://{config.bucket_name}/{config.prefix}",
            status="completed" if not errors else "completed_with_errors",
            findings=all_findings,
            files_scanned=files_scanned,
            total_findings=len(all_findings),
            high_risk_count=high_risk,
            medium_risk_count=medium_risk,
            low_risk_count=low_risk,
            risk_score=risk_score,
            duration_seconds=duration,
            started_at=start_time,
            completed_at=end_time,
            errors=errors,
            bucket_name=config.bucket_name,
            objects_scanned=files_scanned,
            total_size_scanned=total_size,
            skipped_objects=skipped
        )
    
    async def scan_object(self, bucket: str, key: str) -> List[Finding]:
        """
        Scan a single S3 object for secrets.
        
        Args:
            bucket: S3 bucket name
            key: Object key
            
        Returns:
            List of findings
        """
        obj = S3Object(
            bucket=bucket,
            key=key,
            size=0,
            last_modified=datetime.utcnow(),
            etag="",
            storage_class="STANDARD"
        )
        
        content = await self.download_object(obj)
        
        with tempfile.NamedTemporaryFile(
            suffix=Path(key).suffix,
            delete=False
        ) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)
        
        try:
            findings = self.secret_scanner.scan_file(temp_path)
            for finding in findings:
                finding.file_path = f"s3://{bucket}/{key}"
            return findings
        finally:
            temp_path.unlink(missing_ok=True)


# Singleton instance for simulation mode
s3_scanner = S3Scanner(simulate=True)


async def scan_s3_bucket(
    bucket_name: str,
    prefix: str = "",
    max_files: int = 100
) -> S3ScanResult:
    """
    Simple function to scan an S3 bucket.
    Uses simulation mode if AWS credentials are not configured.
    
    Args:
        bucket_name: S3 bucket name
        prefix: Optional prefix to filter objects
        max_files: Maximum number of files to scan
        
    Returns:
        S3ScanResult with findings
    """
    config = S3ScanConfig(
        bucket_name=bucket_name,
        prefix=prefix,
        max_files=max_files
    )
    
    return await s3_scanner.scan_bucket(config)
