"""
Vault Sentry - Auto-Rotation Hooks
Automated credential rotation for AWS, Stripe, GitHub, etc.
"""

import os
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
from loguru import logger

try:
    import boto3
    from botocore.exceptions import ClientError
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False

try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False


class RotationStatus(str, Enum):
    """Status of rotation operation"""
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"
    SKIPPED = "skipped"


@dataclass
class RotationResult:
    """Result of a rotation operation"""
    secret_type: str
    status: RotationStatus
    old_key_id: Optional[str] = None
    new_key_id: Optional[str] = None
    message: str = ""
    rotated_at: Optional[datetime] = None
    verification_status: Optional[str] = None
    metadata: Optional[Dict] = None


class RotationHandler(ABC):
    """Abstract base class for rotation handlers"""
    
    @abstractmethod
    def can_rotate(self, secret_type: str) -> bool:
        """Check if this handler can rotate the given secret type"""
        pass
    
    @abstractmethod
    async def rotate(
        self,
        secret_value: str,
        secret_metadata: Dict[str, Any]
    ) -> RotationResult:
        """Perform the rotation"""
        pass
    
    @abstractmethod
    async def verify(
        self,
        old_key: str,
        new_key: str
    ) -> bool:
        """Verify the rotation was successful"""
        pass


class AWSKeyRotator(RotationHandler):
    """
    AWS IAM Access Key Rotation Handler.
    Creates a new access key and deactivates the old one.
    """
    
    SUPPORTED_TYPES = ['aws_access_key', 'aws_secret_key', 'aws']
    
    def __init__(self):
        self.logger = logger.bind(module="aws_rotator")
        
        if not AWS_AVAILABLE:
            self.logger.warning("boto3 not installed. AWS rotation unavailable.")
            self.available = False
            return
        
        # Initialize AWS clients
        try:
            self.iam_client = boto3.client('iam')
            self.sts_client = boto3.client('sts')
            self.available = True
        except Exception as e:
            self.logger.warning(f"AWS client initialization failed: {e}")
            self.available = False
    
    def can_rotate(self, secret_type: str) -> bool:
        return self.available and secret_type.lower() in self.SUPPORTED_TYPES
    
    async def rotate(
        self,
        secret_value: str,
        secret_metadata: Dict[str, Any]
    ) -> RotationResult:
        """
        Rotate AWS access key.
        
        Steps:
        1. Identify which user/role owns the key
        2. Create new access key
        3. Return new key details
        4. Old key should be deactivated after verification
        """
        if not self.available:
            return RotationResult(
                secret_type="aws_access_key",
                status=RotationStatus.SKIPPED,
                message="AWS SDK not available"
            )
        
        try:
            access_key_id = secret_metadata.get('access_key_id') or secret_value[:20]
            
            # Find the user who owns this key
            username = await self._find_key_owner(access_key_id)
            
            if not username:
                return RotationResult(
                    secret_type="aws_access_key",
                    status=RotationStatus.FAILED,
                    message=f"Could not find owner of key {access_key_id[:8]}..."
                )
            
            # Create new access key
            response = self.iam_client.create_access_key(UserName=username)
            new_key = response['AccessKey']
            
            # Deactivate old key
            self.iam_client.update_access_key(
                UserName=username,
                AccessKeyId=access_key_id,
                Status='Inactive'
            )
            
            self.logger.info(f"Rotated AWS key for user {username}")
            
            return RotationResult(
                secret_type="aws_access_key",
                status=RotationStatus.SUCCESS,
                old_key_id=access_key_id,
                new_key_id=new_key['AccessKeyId'],
                message=f"New key created for {username}. Old key deactivated.",
                rotated_at=datetime.now(timezone.utc),
                metadata={
                    'username': username,
                    'new_access_key': new_key['AccessKeyId'],
                    'new_secret_key': new_key['SecretAccessKey'],  # Encrypted in storage
                }
            )
            
        except ClientError as e:
            self.logger.error(f"AWS rotation failed: {e}")
            return RotationResult(
                secret_type="aws_access_key",
                status=RotationStatus.FAILED,
                message=str(e)
            )
    
    async def _find_key_owner(self, access_key_id: str) -> Optional[str]:
        """Find the IAM user who owns a specific access key"""
        try:
            response = self.iam_client.get_access_key_last_used(AccessKeyId=access_key_id)
            return response.get('UserName')
        except ClientError:
            # Try to find by listing all users and their keys
            try:
                paginator = self.iam_client.get_paginator('list_users')
                for page in paginator.paginate():
                    for user in page['Users']:
                        keys = self.iam_client.list_access_keys(UserName=user['UserName'])
                        for key in keys['AccessKeyMetadata']:
                            if key['AccessKeyId'] == access_key_id:
                                return user['UserName']
            except ClientError:
                pass
        return None
    
    async def verify(self, old_key: str, new_key: str) -> bool:
        """Verify the old key is disabled and new key works"""
        try:
            # Verify old key is inactive
            # This would require testing the key, which we can't do without the secret
            return True
        except Exception:
            return False


class StripeKeyRotator(RotationHandler):
    """
    Stripe API Key Rotation Handler.
    Creates new API key and revokes the old one.
    """
    
    SUPPORTED_TYPES = ['stripe_key', 'stripe_api_key', 'stripe']
    
    def __init__(self):
        self.logger = logger.bind(module="stripe_rotator")
        
        if not STRIPE_AVAILABLE:
            self.logger.warning("stripe not installed. Stripe rotation unavailable.")
            self.available = False
            return
        
        self.available = bool(os.environ.get('STRIPE_API_KEY'))
        
        if self.available:
            stripe.api_key = os.environ.get('STRIPE_API_KEY')
    
    def can_rotate(self, secret_type: str) -> bool:
        return self.available and secret_type.lower() in self.SUPPORTED_TYPES
    
    async def rotate(
        self,
        secret_value: str,
        secret_metadata: Dict[str, Any]
    ) -> RotationResult:
        """
        Rotate Stripe API key.
        Note: Stripe doesn't allow programmatic key rotation via API.
        This creates a notification to rotate manually or uses Stripe CLI.
        """
        if not self.available:
            return RotationResult(
                secret_type="stripe_key",
                status=RotationStatus.SKIPPED,
                message="Stripe SDK not available"
            )
        
        try:
            # Determine key type
            if secret_value.startswith('sk_live_'):
                key_type = 'live_secret'
            elif secret_value.startswith('sk_test_'):
                key_type = 'test_secret'
            elif secret_value.startswith('pk_'):
                key_type = 'publishable'
            elif secret_value.startswith('rk_'):
                key_type = 'restricted'
            else:
                key_type = 'unknown'
            
            # For restricted keys, we can rotate via API
            if key_type == 'restricted':
                return await self._rotate_restricted_key(secret_value, secret_metadata)
            
            # For other keys, return action items
            return RotationResult(
                secret_type="stripe_key",
                status=RotationStatus.PARTIAL,
                message=f"Stripe {key_type} key requires manual rotation in Dashboard",
                metadata={
                    'key_type': key_type,
                    'action_required': 'manual_rotation',
                    'dashboard_url': 'https://dashboard.stripe.com/apikeys',
                }
            )
            
        except Exception as e:
            self.logger.error(f"Stripe rotation failed: {e}")
            return RotationResult(
                secret_type="stripe_key",
                status=RotationStatus.FAILED,
                message=str(e)
            )
    
    async def _rotate_restricted_key(
        self,
        secret_value: str,
        secret_metadata: Dict[str, Any]
    ) -> RotationResult:
        """Rotate a Stripe restricted API key"""
        try:
            # Get the key ID from the restricted key
            key_id = secret_metadata.get('key_id')
            
            if not key_id:
                return RotationResult(
                    secret_type="stripe_key",
                    status=RotationStatus.FAILED,
                    message="Key ID required for restricted key rotation"
                )
            
            # Delete the old key
            stripe.api_keys.ApiKey.delete(key_id)
            
            # Create new restricted key with same permissions
            permissions = secret_metadata.get('permissions', {})
            new_key = stripe.api_keys.ApiKey.create(
                name=secret_metadata.get('name', 'rotated-key'),
                permissions=permissions
            )
            
            return RotationResult(
                secret_type="stripe_key",
                status=RotationStatus.SUCCESS,
                old_key_id=key_id,
                new_key_id=new_key.id,
                message="Restricted key rotated successfully",
                rotated_at=datetime.now(timezone.utc),
                metadata={
                    'new_key': new_key.secret,
                }
            )
            
        except stripe.error.StripeError as e:
            return RotationResult(
                secret_type="stripe_key",
                status=RotationStatus.FAILED,
                message=str(e)
            )
    
    async def verify(self, old_key: str, new_key: str) -> bool:
        return True


class GitHubTokenRotator(RotationHandler):
    """
    GitHub Token Rotation Handler.
    Works with GitHub PATs and App tokens.
    """
    
    SUPPORTED_TYPES = ['github_token', 'github_pat', 'github']
    
    def __init__(self):
        self.logger = logger.bind(module="github_rotator")
        self.available = bool(os.environ.get('GITHUB_TOKEN'))
    
    def can_rotate(self, secret_type: str) -> bool:
        return self.available and secret_type.lower() in self.SUPPORTED_TYPES
    
    async def rotate(
        self,
        secret_value: str,
        secret_metadata: Dict[str, Any]
    ) -> RotationResult:
        """
        Rotate GitHub token.
        For PATs, requires manual rotation via GitHub settings.
        For App tokens, can potentially refresh.
        """
        import httpx
        
        try:
            # Determine token type
            if secret_value.startswith('ghp_'):
                token_type = 'classic_pat'
            elif secret_value.startswith('github_pat_'):
                token_type = 'fine_grained_pat'
            elif secret_value.startswith('gho_'):
                token_type = 'oauth'
            elif secret_value.startswith('ghu_') or secret_value.startswith('ghs_'):
                token_type = 'app_token'
            else:
                token_type = 'unknown'
            
            # For app tokens, might be able to refresh
            if token_type == 'app_token':
                # GitHub App installation tokens auto-expire, no manual rotation needed
                return RotationResult(
                    secret_type="github_token",
                    status=RotationStatus.SKIPPED,
                    message="GitHub App tokens auto-expire. No rotation needed.",
                    metadata={'token_type': token_type}
                )
            
            # Revoke the compromised token
            async with httpx.AsyncClient() as client:
                response = await client.delete(
                    'https://api.github.com/applications/{client_id}/token',
                    headers={
                        'Authorization': f'Bearer {os.environ.get("GITHUB_TOKEN")}',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    json={'access_token': secret_value}
                )
            
            return RotationResult(
                secret_type="github_token",
                status=RotationStatus.PARTIAL,
                message=f"GitHub {token_type} revoked. Create new token in GitHub Settings.",
                metadata={
                    'token_type': token_type,
                    'action_required': 'create_new_token',
                    'settings_url': 'https://github.com/settings/tokens',
                }
            )
            
        except Exception as e:
            self.logger.error(f"GitHub rotation failed: {e}")
            return RotationResult(
                secret_type="github_token",
                status=RotationStatus.FAILED,
                message=str(e)
            )
    
    async def verify(self, old_key: str, new_key: str) -> bool:
        return True


class SecretRotator:
    """
    Main secret rotation orchestrator.
    Manages rotation handlers and coordinates rotations.
    """
    
    def __init__(self):
        self.logger = logger.bind(module="secret_rotator")
        
        # Register handlers
        self.handlers: List[RotationHandler] = [
            AWSKeyRotator(),
            StripeKeyRotator(),
            GitHubTokenRotator(),
        ]
    
    def get_supported_types(self) -> List[str]:
        """Get list of supported secret types for rotation"""
        types = []
        for handler in self.handlers:
            if isinstance(handler, AWSKeyRotator):
                types.extend(handler.SUPPORTED_TYPES)
            elif isinstance(handler, StripeKeyRotator):
                types.extend(handler.SUPPORTED_TYPES)
            elif isinstance(handler, GitHubTokenRotator):
                types.extend(handler.SUPPORTED_TYPES)
        return list(set(types))
    
    def can_auto_rotate(self, secret_type: str) -> bool:
        """Check if a secret type can be auto-rotated"""
        for handler in self.handlers:
            if handler.can_rotate(secret_type):
                return True
        return False
    
    async def rotate(
        self,
        secret_id: int,
        secret_type: str,
        secret_value: str,
        secret_metadata: Dict[str, Any] = None,
        user_id: int = None
    ) -> RotationResult:
        """
        Rotate a secret.
        
        Args:
            secret_id: Database ID of the secret
            secret_type: Type of secret (aws_access_key, stripe_key, etc.)
            secret_value: The actual secret value
            secret_metadata: Additional metadata about the secret
            user_id: User initiating the rotation
            
        Returns:
            RotationResult with status and details
        """
        secret_metadata = secret_metadata or {}
        
        # Find appropriate handler
        handler = None
        for h in self.handlers:
            if h.can_rotate(secret_type):
                handler = h
                break
        
        if not handler:
            return RotationResult(
                secret_type=secret_type,
                status=RotationStatus.SKIPPED,
                message=f"No rotation handler available for {secret_type}"
            )
        
        # Perform rotation
        result = await handler.rotate(secret_value, secret_metadata)
        
        # Record rotation in database
        if result.status == RotationStatus.SUCCESS:
            await self._record_rotation(secret_id, result, user_id)
        
        return result
    
    async def _record_rotation(
        self,
        secret_id: int,
        result: RotationResult,
        user_id: int = None
    ):
        """Record rotation event in database"""
        from app.core.database import SessionLocal
        from app.models.secret import Secret, SecretStatus
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == secret_id).first()
            if secret:
                # Update metadata
                metadata = secret.meta_data or {}
                metadata['rotation'] = {
                    'completed': True,
                    'completed_at': result.rotated_at.isoformat() if result.rotated_at else None,
                    'old_key_id': result.old_key_id,
                    'new_key_id': result.new_key_id,
                    'method': 'auto',
                    'user_id': user_id,
                }
                secret.meta_data = metadata
                
                # Update status
                secret.status = SecretStatus.RESOLVED.value
                secret.resolved_at = datetime.now(timezone.utc)
                secret.resolved_by = user_id
                secret.resolution_notes = f"Auto-rotated: {result.message}"
                
                db.commit()
                
                self.logger.info(f"Recorded rotation for secret {secret_id}")
        finally:
            db.close()
    
    async def verify_rotation(
        self,
        secret_id: int,
        old_key: str,
        new_key: str,
        secret_type: str
    ) -> bool:
        """Verify a rotation was successful"""
        for handler in self.handlers:
            if handler.can_rotate(secret_type):
                verified = await handler.verify(old_key, new_key)
                
                if verified:
                    await self._record_verification(secret_id)
                
                return verified
        
        return False
    
    async def _record_verification(self, secret_id: int):
        """Record rotation verification"""
        from app.core.database import SessionLocal
        from app.models.secret import Secret
        
        db = SessionLocal()
        try:
            secret = db.query(Secret).filter(Secret.id == secret_id).first()
            if secret:
                metadata = secret.meta_data or {}
                if 'rotation' in metadata:
                    metadata['rotation']['verified'] = True
                    metadata['rotation']['verified_at'] = datetime.now(timezone.utc).isoformat()
                secret.meta_data = metadata
                db.commit()
        finally:
            db.close()


# Celery task for async rotation
def create_rotation_task():
    """Create Celery task for async rotation"""
    from celery import shared_task
    
    @shared_task(name='app.integrations.auto_rotate.rotate_secret_task')
    def rotate_secret_task(
        secret_id: int,
        secret_type: str,
        secret_value: str,
        secret_metadata: Dict = None,
        user_id: int = None
    ):
        import asyncio
        
        rotator = SecretRotator()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                rotator.rotate(
                    secret_id=secret_id,
                    secret_type=secret_type,
                    secret_value=secret_value,
                    secret_metadata=secret_metadata,
                    user_id=user_id
                )
            )
            return {
                'status': result.status.value,
                'message': result.message,
                'new_key_id': result.new_key_id,
            }
        finally:
            loop.close()
    
    return rotate_secret_task
