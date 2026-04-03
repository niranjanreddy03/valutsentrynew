"""
Vault Sentry - AWS Integration
S3 bucket scanning, secrets manager, and AWS resource management.
"""

import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError, BotoCoreError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


class AWSRegion(str, Enum):
    """Common AWS regions"""
    US_EAST_1 = "us-east-1"
    US_EAST_2 = "us-east-2"
    US_WEST_1 = "us-west-1"
    US_WEST_2 = "us-west-2"
    EU_WEST_1 = "eu-west-1"
    EU_WEST_2 = "eu-west-2"
    EU_CENTRAL_1 = "eu-central-1"
    AP_SOUTHEAST_1 = "ap-southeast-1"
    AP_SOUTHEAST_2 = "ap-southeast-2"
    AP_NORTHEAST_1 = "ap-northeast-1"


@dataclass
class S3Bucket:
    """S3 bucket information"""
    name: str
    region: str
    creation_date: Optional[datetime] = None
    owner: Optional[str] = None
    access_control: str = "private"
    versioning_enabled: bool = False
    encryption_enabled: bool = False
    public_access_blocked: bool = True


@dataclass 
class S3Object:
    """S3 object metadata"""
    key: str
    bucket: str
    size: int
    last_modified: datetime
    etag: str
    storage_class: str = "STANDARD"
    content_type: Optional[str] = None


@dataclass
class AWSCredentials:
    """AWS credentials structure"""
    access_key_id: str
    secret_access_key: str
    session_token: Optional[str] = None
    region: str = "us-east-1"
    expires_at: Optional[datetime] = None
    
    @property
    def is_valid(self) -> bool:
        if not self.access_key_id or not self.secret_access_key:
            return False
        if self.expires_at and datetime.now(timezone.utc) >= self.expires_at:
            return False
        return True


@dataclass
class AWSIntegrationResult:
    """Result from AWS integration operations"""
    success: bool
    operation: str
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AWSIntegration:
    """
    AWS integration for Vault Sentry.
    Handles S3 bucket management, scanning, and AWS secrets management.
    """
    
    def __init__(
        self,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        region: str = "us-east-1",
        session_token: Optional[str] = None
    ):
        self.logger = logger.bind(module="aws_integration")
        
        self.access_key_id = access_key_id or os.environ.get('AWS_ACCESS_KEY_ID')
        self.secret_access_key = secret_access_key or os.environ.get('AWS_SECRET_ACCESS_KEY')
        self.session_token = session_token or os.environ.get('AWS_SESSION_TOKEN')
        self.region = region or os.environ.get('AWS_REGION', 'us-east-1')
        
        self._s3_client = None
        self._iam_client = None
        self._secretsmanager_client = None
        
        if not BOTO3_AVAILABLE:
            self.logger.warning("boto3 not installed. AWS functionality will be simulated.")
    
    @property
    def is_configured(self) -> bool:
        """Check if AWS is properly configured"""
        return bool(self.access_key_id and self.secret_access_key)
    
    @property
    def is_available(self) -> bool:
        """Check if AWS SDK is available"""
        return BOTO3_AVAILABLE
    
    def _get_s3_client(self):
        """Get or create S3 client"""
        if self._s3_client is None and BOTO3_AVAILABLE:
            try:
                self._s3_client = boto3.client(
                    's3',
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    aws_session_token=self.session_token,
                    region_name=self.region
                )
            except Exception as e:
                self.logger.error(f"Failed to create S3 client: {e}")
                raise
        return self._s3_client
    
    def _get_iam_client(self):
        """Get or create IAM client"""
        if self._iam_client is None and BOTO3_AVAILABLE:
            try:
                self._iam_client = boto3.client(
                    'iam',
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    aws_session_token=self.session_token,
                    region_name=self.region
                )
            except Exception as e:
                self.logger.error(f"Failed to create IAM client: {e}")
                raise
        return self._iam_client
    
    def _get_secretsmanager_client(self):
        """Get or create Secrets Manager client"""
        if self._secretsmanager_client is None and BOTO3_AVAILABLE:
            try:
                self._secretsmanager_client = boto3.client(
                    'secretsmanager',
                    aws_access_key_id=self.access_key_id,
                    aws_secret_access_key=self.secret_access_key,
                    aws_session_token=self.session_token,
                    region_name=self.region
                )
            except Exception as e:
                self.logger.error(f"Failed to create Secrets Manager client: {e}")
                raise
        return self._secretsmanager_client
    
    # =====================================================
    # S3 OPERATIONS
    # =====================================================
    
    async def list_buckets(self) -> AWSIntegrationResult:
        """
        List all S3 buckets accessible with current credentials.
        
        Returns:
            AWSIntegrationResult with list of S3Bucket objects
        """
        if not BOTO3_AVAILABLE:
            return self._simulate_list_buckets()
        
        try:
            s3 = self._get_s3_client()
            response = s3.list_buckets()
            
            buckets = []
            for bucket in response.get('Buckets', []):
                bucket_info = S3Bucket(
                    name=bucket['Name'],
                    region=self.region,
                    creation_date=bucket.get('CreationDate'),
                    owner=response.get('Owner', {}).get('DisplayName')
                )
                
                # Get additional bucket details
                try:
                    # Check versioning
                    versioning = s3.get_bucket_versioning(Bucket=bucket['Name'])
                    bucket_info.versioning_enabled = versioning.get('Status') == 'Enabled'
                    
                    # Check encryption
                    try:
                        s3.get_bucket_encryption(Bucket=bucket['Name'])
                        bucket_info.encryption_enabled = True
                    except ClientError:
                        bucket_info.encryption_enabled = False
                    
                    # Check public access block
                    try:
                        pab = s3.get_public_access_block(Bucket=bucket['Name'])
                        config = pab.get('PublicAccessBlockConfiguration', {})
                        bucket_info.public_access_blocked = all([
                            config.get('BlockPublicAcls', False),
                            config.get('BlockPublicPolicy', False),
                            config.get('IgnorePublicAcls', False),
                            config.get('RestrictPublicBuckets', False)
                        ])
                    except ClientError:
                        bucket_info.public_access_blocked = False
                        
                except ClientError as e:
                    self.logger.warning(f"Could not get details for bucket {bucket['Name']}: {e}")
                
                buckets.append(bucket_info)
            
            self.logger.info(f"Listed {len(buckets)} S3 buckets")
            return AWSIntegrationResult(
                success=True,
                operation="list_buckets",
                data={"buckets": [vars(b) for b in buckets], "count": len(buckets)}
            )
            
        except NoCredentialsError:
            return AWSIntegrationResult(
                success=False,
                operation="list_buckets",
                error="AWS credentials not found"
            )
        except ClientError as e:
            self.logger.error(f"S3 list_buckets error: {e}")
            return AWSIntegrationResult(
                success=False,
                operation="list_buckets",
                error=str(e)
            )
    
    async def list_objects(
        self,
        bucket_name: str,
        prefix: str = "",
        max_keys: int = 1000,
        extensions: Optional[List[str]] = None
    ) -> AWSIntegrationResult:
        """
        List objects in an S3 bucket.
        
        Args:
            bucket_name: Name of the bucket
            prefix: Filter by key prefix
            max_keys: Maximum number of objects to return
            extensions: Filter by file extensions (e.g., ['.py', '.js'])
            
        Returns:
            AWSIntegrationResult with list of S3Object
        """
        if not BOTO3_AVAILABLE:
            return self._simulate_list_objects(bucket_name, prefix)
        
        try:
            s3 = self._get_s3_client()
            
            objects = []
            continuation_token = None
            
            while len(objects) < max_keys:
                kwargs = {
                    'Bucket': bucket_name,
                    'MaxKeys': min(1000, max_keys - len(objects))
                }
                if prefix:
                    kwargs['Prefix'] = prefix
                if continuation_token:
                    kwargs['ContinuationToken'] = continuation_token
                
                response = s3.list_objects_v2(**kwargs)
                
                for obj in response.get('Contents', []):
                    key = obj['Key']
                    
                    # Filter by extension if specified
                    if extensions:
                        ext = os.path.splitext(key)[1].lower()
                        if ext not in extensions:
                            continue
                    
                    objects.append(S3Object(
                        key=key,
                        bucket=bucket_name,
                        size=obj['Size'],
                        last_modified=obj['LastModified'],
                        etag=obj['ETag'],
                        storage_class=obj.get('StorageClass', 'STANDARD')
                    ))
                
                if not response.get('IsTruncated'):
                    break
                continuation_token = response.get('NextContinuationToken')
            
            self.logger.info(f"Listed {len(objects)} objects in bucket {bucket_name}")
            return AWSIntegrationResult(
                success=True,
                operation="list_objects",
                data={
                    "bucket": bucket_name,
                    "prefix": prefix,
                    "objects": [vars(o) for o in objects],
                    "count": len(objects)
                }
            )
            
        except ClientError as e:
            self.logger.error(f"S3 list_objects error: {e}")
            return AWSIntegrationResult(
                success=False,
                operation="list_objects",
                error=str(e)
            )
    
    async def get_object_content(
        self,
        bucket_name: str,
        key: str,
        max_size: int = 10 * 1024 * 1024  # 10MB
    ) -> AWSIntegrationResult:
        """
        Get the content of an S3 object.
        
        Args:
            bucket_name: Name of the bucket
            key: Object key
            max_size: Maximum file size to download (bytes)
            
        Returns:
            AWSIntegrationResult with object content
        """
        if not BOTO3_AVAILABLE:
            return self._simulate_get_object(bucket_name, key)
        
        try:
            s3 = self._get_s3_client()
            
            # Check object size first
            head = s3.head_object(Bucket=bucket_name, Key=key)
            size = head['ContentLength']
            
            if size > max_size:
                return AWSIntegrationResult(
                    success=False,
                    operation="get_object_content",
                    error=f"Object size ({size} bytes) exceeds maximum ({max_size} bytes)"
                )
            
            # Download object
            response = s3.get_object(Bucket=bucket_name, Key=key)
            content = response['Body'].read()
            
            # Try to decode as text
            try:
                content_text = content.decode('utf-8')
            except UnicodeDecodeError:
                content_text = None
            
            return AWSIntegrationResult(
                success=True,
                operation="get_object_content",
                data={
                    "bucket": bucket_name,
                    "key": key,
                    "size": size,
                    "content_type": response.get('ContentType'),
                    "content": content_text,
                    "is_binary": content_text is None
                }
            )
            
        except ClientError as e:
            self.logger.error(f"S3 get_object error: {e}")
            return AWSIntegrationResult(
                success=False,
                operation="get_object_content",
                error=str(e)
            )
    
    async def get_bucket_policy(self, bucket_name: str) -> AWSIntegrationResult:
        """
        Get the bucket policy for an S3 bucket.
        
        Args:
            bucket_name: Name of the bucket
            
        Returns:
            AWSIntegrationResult with bucket policy
        """
        if not BOTO3_AVAILABLE:
            return AWSIntegrationResult(
                success=True,
                operation="get_bucket_policy",
                data={"bucket": bucket_name, "policy": None}
            )
        
        try:
            s3 = self._get_s3_client()
            response = s3.get_bucket_policy(Bucket=bucket_name)
            
            return AWSIntegrationResult(
                success=True,
                operation="get_bucket_policy",
                data={
                    "bucket": bucket_name,
                    "policy": response['Policy']
                }
            )
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchBucketPolicy':
                return AWSIntegrationResult(
                    success=True,
                    operation="get_bucket_policy",
                    data={"bucket": bucket_name, "policy": None}
                )
            return AWSIntegrationResult(
                success=False,
                operation="get_bucket_policy",
                error=str(e)
            )
    
    # =====================================================
    # AWS SECRETS MANAGER OPERATIONS
    # =====================================================
    
    async def list_secrets(self) -> AWSIntegrationResult:
        """
        List secrets in AWS Secrets Manager.
        
        Returns:
            AWSIntegrationResult with list of secrets
        """
        if not BOTO3_AVAILABLE:
            return self._simulate_list_secrets()
        
        try:
            sm = self._get_secretsmanager_client()
            
            secrets = []
            next_token = None
            
            while True:
                kwargs = {'MaxResults': 100}
                if next_token:
                    kwargs['NextToken'] = next_token
                
                response = sm.list_secrets(**kwargs)
                
                for secret in response.get('SecretList', []):
                    secrets.append({
                        'name': secret['Name'],
                        'arn': secret['ARN'],
                        'description': secret.get('Description'),
                        'created_at': secret.get('CreatedDate'),
                        'last_accessed': secret.get('LastAccessedDate'),
                        'last_rotated': secret.get('LastRotatedDate'),
                        'rotation_enabled': secret.get('RotationEnabled', False)
                    })
                
                next_token = response.get('NextToken')
                if not next_token:
                    break
            
            self.logger.info(f"Listed {len(secrets)} secrets from Secrets Manager")
            return AWSIntegrationResult(
                success=True,
                operation="list_secrets",
                data={"secrets": secrets, "count": len(secrets)}
            )
            
        except ClientError as e:
            self.logger.error(f"Secrets Manager error: {e}")
            return AWSIntegrationResult(
                success=False,
                operation="list_secrets",
                error=str(e)
            )
    
    async def store_secret(
        self,
        name: str,
        value: str,
        description: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> AWSIntegrationResult:
        """
        Store a secret in AWS Secrets Manager.
        
        Args:
            name: Secret name
            value: Secret value (string or JSON)
            description: Optional description
            tags: Optional tags
            
        Returns:
            AWSIntegrationResult with secret ARN
        """
        if not BOTO3_AVAILABLE:
            return AWSIntegrationResult(
                success=True,
                operation="store_secret",
                data={"name": name, "arn": f"arn:aws:secretsmanager:{self.region}:123456789:secret:{name}"}
            )
        
        try:
            sm = self._get_secretsmanager_client()
            
            kwargs = {
                'Name': name,
                'SecretString': value
            }
            if description:
                kwargs['Description'] = description
            if tags:
                kwargs['Tags'] = [{'Key': k, 'Value': v} for k, v in tags.items()]
            
            response = sm.create_secret(**kwargs)
            
            self.logger.info(f"Created secret: {name}")
            return AWSIntegrationResult(
                success=True,
                operation="store_secret",
                data={
                    "name": name,
                    "arn": response['ARN'],
                    "version_id": response['VersionId']
                }
            )
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceExistsException':
                # Update existing secret
                try:
                    response = sm.update_secret(SecretId=name, SecretString=value)
                    return AWSIntegrationResult(
                        success=True,
                        operation="store_secret",
                        data={
                            "name": name,
                            "arn": response['ARN'],
                            "version_id": response['VersionId'],
                            "updated": True
                        }
                    )
                except ClientError as update_error:
                    return AWSIntegrationResult(
                        success=False,
                        operation="store_secret",
                        error=str(update_error)
                    )
            return AWSIntegrationResult(
                success=False,
                operation="store_secret",
                error=str(e)
            )
    
    # =====================================================
    # IAM OPERATIONS
    # =====================================================
    
    async def validate_credentials(self) -> AWSIntegrationResult:
        """
        Validate AWS credentials by calling STS GetCallerIdentity.
        
        Returns:
            AWSIntegrationResult with account info
        """
        if not BOTO3_AVAILABLE:
            return AWSIntegrationResult(
                success=True,
                operation="validate_credentials",
                data={
                    "account_id": "123456789012",
                    "arn": "arn:aws:iam::123456789012:user/test-user",
                    "user_id": "AIDAEXAMPLE"
                }
            )
        
        try:
            sts = boto3.client(
                'sts',
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                aws_session_token=self.session_token,
                region_name=self.region
            )
            
            response = sts.get_caller_identity()
            
            self.logger.info(f"Validated AWS credentials for account {response['Account']}")
            return AWSIntegrationResult(
                success=True,
                operation="validate_credentials",
                data={
                    "account_id": response['Account'],
                    "arn": response['Arn'],
                    "user_id": response['UserId']
                }
            )
            
        except (ClientError, NoCredentialsError) as e:
            return AWSIntegrationResult(
                success=False,
                operation="validate_credentials",
                error=str(e)
            )
    
    async def list_access_keys(self, username: Optional[str] = None) -> AWSIntegrationResult:
        """
        List IAM access keys for a user.
        
        Args:
            username: IAM username (defaults to current user)
            
        Returns:
            AWSIntegrationResult with access key list
        """
        if not BOTO3_AVAILABLE:
            return AWSIntegrationResult(
                success=True,
                operation="list_access_keys",
                data={"keys": [], "count": 0}
            )
        
        try:
            iam = self._get_iam_client()
            
            kwargs = {}
            if username:
                kwargs['UserName'] = username
            
            response = iam.list_access_keys(**kwargs)
            
            keys = []
            for key in response.get('AccessKeyMetadata', []):
                keys.append({
                    'access_key_id': key['AccessKeyId'],
                    'status': key['Status'],
                    'created_at': key['CreateDate'],
                    'username': key['UserName']
                })
            
            return AWSIntegrationResult(
                success=True,
                operation="list_access_keys",
                data={"keys": keys, "count": len(keys)}
            )
            
        except ClientError as e:
            return AWSIntegrationResult(
                success=False,
                operation="list_access_keys",
                error=str(e)
            )
    
    # =====================================================
    # SIMULATION METHODS (for testing without AWS)
    # =====================================================
    
    def _simulate_list_buckets(self) -> AWSIntegrationResult:
        """Simulate bucket listing for testing"""
        simulated_buckets = [
            S3Bucket(
                name="my-app-configs",
                region="us-east-1",
                creation_date=datetime(2024, 1, 15, tzinfo=timezone.utc),
                owner="test-owner",
                encryption_enabled=True,
                public_access_blocked=True
            ),
            S3Bucket(
                name="my-app-logs",
                region="us-east-1",
                creation_date=datetime(2024, 3, 20, tzinfo=timezone.utc),
                owner="test-owner",
                encryption_enabled=False,
                public_access_blocked=True
            ),
            S3Bucket(
                name="my-app-uploads",
                region="us-west-2",
                creation_date=datetime(2024, 6, 10, tzinfo=timezone.utc),
                owner="test-owner",
                encryption_enabled=True,
                public_access_blocked=False
            ),
        ]
        
        return AWSIntegrationResult(
            success=True,
            operation="list_buckets",
            data={
                "buckets": [vars(b) for b in simulated_buckets],
                "count": len(simulated_buckets),
                "simulated": True
            }
        )
    
    def _simulate_list_objects(self, bucket_name: str, prefix: str) -> AWSIntegrationResult:
        """Simulate object listing for testing"""
        simulated_objects = [
            S3Object(
                key="config/settings.json",
                bucket=bucket_name,
                size=2048,
                last_modified=datetime.now(timezone.utc),
                etag='"abc123"'
            ),
            S3Object(
                key="src/app.py",
                bucket=bucket_name,
                size=4096,
                last_modified=datetime.now(timezone.utc),
                etag='"def456"'
            ),
            S3Object(
                key=".env.production",
                bucket=bucket_name,
                size=512,
                last_modified=datetime.now(timezone.utc),
                etag='"ghi789"'
            ),
        ]
        
        # Filter by prefix
        if prefix:
            simulated_objects = [o for o in simulated_objects if o.key.startswith(prefix)]
        
        return AWSIntegrationResult(
            success=True,
            operation="list_objects",
            data={
                "bucket": bucket_name,
                "prefix": prefix,
                "objects": [vars(o) for o in simulated_objects],
                "count": len(simulated_objects),
                "simulated": True
            }
        )
    
    def _simulate_get_object(self, bucket_name: str, key: str) -> AWSIntegrationResult:
        """Simulate object content retrieval for testing"""
        simulated_content = {
            "config/settings.json": '{"database_url": "postgres://user:pass123@localhost/db"}',
            "src/app.py": 'API_KEY = "demo_api_key_1234567890abcdefghijklmnop"',
            ".env.production": 'AWS_ACCESS_KEY_ID=EXAMPLE_AWS_KEY_ID_12345\nAWS_SECRET_ACCESS_KEY=example_aws_secret_key_placeholder'
        }
        
        content = simulated_content.get(key, f"# Content of {key}\n")
        
        return AWSIntegrationResult(
            success=True,
            operation="get_object_content",
            data={
                "bucket": bucket_name,
                "key": key,
                "size": len(content),
                "content_type": "text/plain",
                "content": content,
                "is_binary": False,
                "simulated": True
            }
        )
    
    def _simulate_list_secrets(self) -> AWSIntegrationResult:
        """Simulate Secrets Manager listing for testing"""
        simulated_secrets = [
            {
                'name': 'prod/database/credentials',
                'arn': 'arn:aws:secretsmanager:us-east-1:123456789:secret:prod/database/credentials',
                'description': 'Production database credentials',
                'rotation_enabled': True
            },
            {
                'name': 'prod/api/stripe-key',
                'arn': 'arn:aws:secretsmanager:us-east-1:123456789:secret:prod/api/stripe-key',
                'description': 'Stripe API key',
                'rotation_enabled': False
            },
        ]
        
        return AWSIntegrationResult(
            success=True,
            operation="list_secrets",
            data={
                "secrets": simulated_secrets,
                "count": len(simulated_secrets),
                "simulated": True
            }
        )
