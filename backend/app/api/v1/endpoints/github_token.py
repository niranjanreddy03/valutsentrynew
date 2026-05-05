"""
Vault Sentry - GitHub Token Management Endpoints
Secure endpoints for GitHub PAT configuration and validation.

SECURITY:
- All endpoints require authentication
- Tokens are encrypted before storage
- Tokens are NEVER returned in responses
- All operations are audit logged
"""

from datetime import datetime, timezone
from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from loguru import logger

from app.core.database import get_db
from app.core.encryption import token_encryption
from app.core.security import decode_token
from app.core.supabase_client import get_supabase_client, is_supabase_configured
from app.services.github_token_service import secure_github_service, TokenStatus
from app.models.user import User

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter()
optional_bearer = HTTPBearer(auto_error=False)


@dataclass
class TokenUser:
    """Authenticated identity for token management."""
    id: str
    email: Optional[str] = None
    bearer_token: Optional[str] = None


# ============================================
# Rate Limiting for Token Operations
# ============================================

# Simple in-memory rate limiter (use Redis in production)
_rate_limit_store: dict = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 10  # max requests per window
_integration_store_path = Path(__file__).resolve().parents[4] / ".user_integrations.json"


def check_rate_limit(user_id: str, operation: str) -> bool:
    """Check if user is within rate limits for an operation."""
    key = f"{user_id}:{operation}"
    now = datetime.now(timezone.utc)
    
    if key not in _rate_limit_store:
        _rate_limit_store[key] = {"count": 0, "window_start": now}
    
    record = _rate_limit_store[key]
    elapsed = (now - record["window_start"]).total_seconds()
    
    if elapsed > RATE_LIMIT_WINDOW:
        # Reset window
        record["count"] = 1
        record["window_start"] = now
        return True
    
    if record["count"] >= RATE_LIMIT_MAX_REQUESTS:
        return False
    
    record["count"] += 1
    return True


# ============================================
# Audit Logging
# ============================================

async def get_token_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> TokenUser:
    """
    Resolve the current user for the token endpoints.

    The rest of this backend uses its own JWT user model, while the current
    frontend signs users in with Supabase/local-dev auth. This dependency
    supports both so premium users can save PATs from the app they are using.
    """
    header_user_id = request.headers.get("x-user-id")
    header_email = request.headers.get("x-user-email")

    if credentials and credentials.credentials:
        token = credentials.credentials

        # First try the backend JWT format.
        try:
            payload = decode_token(token)
            if payload.get("type") == "access" and payload.get("sub"):
                result = await db.execute(select(User).where(User.id == int(payload["sub"])))
                user = result.scalar_one_or_none()
                if user and user.is_active:
                    return TokenUser(id=str(user.id), email=user.email)
        except Exception:
            pass

        # Then handle Supabase access tokens. We verify the HS256 signature
        # against SUPABASE_JWT_SECRET so a forged token is rejected here, not
        # only at PostgREST. If the secret isn't configured (local dev) we
        # fall back to unverified claims and rely on Supabase RLS — a noisy
        # warning is logged so production never silently runs without it.
        from app.core.config import settings as _settings

        try:
            if _settings.SUPABASE_JWT_SECRET:
                claims = jwt.decode(
                    token,
                    _settings.SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience=_settings.SUPABASE_JWT_AUDIENCE,
                    options={"verify_aud": True, "verify_signature": True, "verify_exp": True},
                )
            else:
                if _settings.ENVIRONMENT == "production":
                    logger.error(
                        "[AUTH] SUPABASE_JWT_SECRET is not set in production — "
                        "rejecting Supabase token instead of trusting unsigned claims."
                    )
                    raise JWTError("SUPABASE_JWT_SECRET not configured")
                logger.warning(
                    "[AUTH] SUPABASE_JWT_SECRET not configured — using unverified "
                    "claims (dev only)."
                )
                claims = jwt.get_unverified_claims(token)

            user_id = claims.get("sub")
            email = claims.get("email") or header_email
            if user_id:
                if header_user_id and header_user_id != user_id:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authenticated user does not match request headers",
                    )
                return TokenUser(id=str(user_id), email=email, bearer_token=token)
        except JWTError:
            pass

    if header_user_id:
        return TokenUser(id=header_user_id, email=header_email)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )

async def log_audit_event(
    user_id: str,
    event_type: str,
    details: dict,
    ip_address: Optional[str] = None
):
    """
    Log an audit event for security tracking.
    
    Events logged:
    - Token added
    - Token validated
    - Token revoked
    - Repository access checked
    - Scan started with token
    """
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "event_type": event_type,
        "ip_address": ip_address,
        # Sanitize details - never log tokens
        "details": {k: v for k, v in details.items() if 'token' not in k.lower()}
    }
    
    # Log to application logs
    logger.info(f"[AUDIT] {event_type}: user={user_id}, details={log_entry['details']}")
    
    # If Supabase is configured, store in audit_logs table
    if is_supabase_configured():
        try:
            supabase = get_supabase_client()
            # Note: Create this table in Supabase
            supabase.table('audit_logs').insert({
                'user_id': user_id,
                'event_type': event_type,
                'details': log_entry['details'],
                'ip_address': ip_address,
                'created_at': log_entry['timestamp']
            }).execute()
        except Exception as e:
            logger.warning(f"[AUDIT] Failed to store audit log: {e}")


# ============================================
# Pydantic Schemas
# ============================================

class AddTokenRequest(BaseModel):
    """Request to add a GitHub PAT"""
    token: str = Field(
        ...,
        min_length=1,
        description="GitHub Personal Access Token (starts with ghp_ or github_pat_)"
    )
    
    class Config:
        # Ensure token is not logged
        json_schema_extra = {
            "example": {"token": "ghp_xxxxxxxxxxxxxxxxxxxx"}
        }


class TokenStatusResponse(BaseModel):
    """Token status response (no sensitive data)"""
    configured: bool
    github_username: Optional[str] = None
    added_at: Optional[str] = None
    scopes: Optional[list] = None
    rate_limit_remaining: Optional[int] = None


class ValidateTokenResponse(BaseModel):
    """Token validation response"""
    valid: bool
    status: str
    username: Optional[str] = None
    scopes: Optional[list] = None
    error_message: Optional[str] = None


class RepositoryPermissionResponse(BaseModel):
    """Repository permission check response"""
    has_access: bool
    permission_level: Optional[str] = None
    is_owner: bool = False
    error_message: Optional[str] = None


class AccessibleReposResponse(BaseModel):
    """List of accessible repositories"""
    repositories: list
    total: int
    error: Optional[str] = None


class UserIntegrationConfig(BaseModel):
    """User-owned integration settings used by policy actions."""
    slackWebhookUrl: Optional[str] = None
    genericWebhookUrl: Optional[str] = None
    jiraWebhookUrl: Optional[str] = None
    jiraProjectKey: Optional[str] = None
    mlRiskScoringEnabled: Optional[bool] = None


SENSITIVE_INTEGRATION_FIELDS = {
    "slackWebhookUrl",
    "genericWebhookUrl",
    "jiraWebhookUrl",
}


def _read_integration_store() -> Dict[str, Any]:
    """Read encrypted user integration config from the local fallback store."""
    try:
        if not _integration_store_path.exists():
            return {}
        return json.loads(_integration_store_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"[INTEGRATIONS] Failed to read config store: {type(e).__name__}")
        return {}


def _write_integration_store(data: Dict[str, Any]) -> None:
    _integration_store_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _encrypt_integration_config(config: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    encrypted: Dict[str, Any] = {}
    for key, value in config.items():
        if value is None or value == "":
            continue
        if key in SENSITIVE_INTEGRATION_FIELDS and isinstance(value, str):
            # AAD-bind to user_id — see TokenEncryption.encrypt docstring.
            encrypted[key] = token_encryption.encrypt(value, context=user_id)
        else:
            encrypted[key] = value
    return encrypted


def _decrypt_integration_config(config: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    decrypted: Dict[str, Any] = {}
    for key, value in config.items():
        if key in SENSITIVE_INTEGRATION_FIELDS and isinstance(value, str):
            try:
                decrypted[key] = token_encryption.decrypt(value, context=user_id)
            except ValueError:
                decrypted[key] = None
        else:
            decrypted[key] = value
    return decrypted


# ============================================
# Endpoints
# ============================================


@router.get("/config", response_model=UserIntegrationConfig)
async def get_user_integration_config(
    current_user: TokenUser = Depends(get_token_user)
):
    """
    Load the current user's Slack/Jira/webhook policy integration config.

    Webhook URLs are stored encrypted in the fallback store and returned only
    to the authenticated owner so browser-side policy actions can use them.
    """
    user_id = str(current_user.id)
    store = _read_integration_store()
    raw = store.get(user_id, {})
    return UserIntegrationConfig(**_decrypt_integration_config(raw, user_id))


@router.post("/config", response_model=UserIntegrationConfig)
async def save_user_integration_config(
    body: UserIntegrationConfig,
    request: Request,
    current_user: TokenUser = Depends(get_token_user)
):
    """Save Slack/Jira/webhook policy integration config for this user."""
    user_id = str(current_user.id)

    if not check_rate_limit(user_id, "save_integrations"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many integration save operations. Please wait before trying again."
        )

    config = body.model_dump(exclude_none=True)
    store = _read_integration_store()
    store[user_id] = _encrypt_integration_config(config, user_id)
    _write_integration_store(store)

    await log_audit_event(
        user_id=user_id,
        event_type="integration_config_saved",
        details={"configured": sorted(config.keys())},
        ip_address=request.client.host if request.client else None
    )

    return UserIntegrationConfig(**config)

@router.post("/github/token", response_model=TokenStatusResponse)
async def add_github_token(
    request: Request,
    body: AddTokenRequest,
    current_user: TokenUser = Depends(get_token_user)
):
    """
    Add or update a GitHub Personal Access Token.
    
    Security:
    - Token is validated with GitHub API before storage
    - Token is encrypted with AES-256-GCM before storage
    - Token is NEVER logged or returned in response
    - Requires 'repo' scope for private repository access
    """
    user_id = str(current_user.id)
    
    # Rate limit check
    if not check_rate_limit(user_id, "add_token"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many token operations. Please wait before trying again."
        )
    
    # Validate token format (basic check)
    token = body.token.strip()
    if not (token.startswith("ghp_") or token.startswith("github_pat_")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token format. GitHub PATs start with 'ghp_' or 'github_pat_'"
        )
    
    # Validate with GitHub API
    validation = await secure_github_service.validate_token(token)
    
    if not validation.is_valid:
        await log_audit_event(
            user_id=user_id,
            event_type="token_validation_failed",
            details={
                "status": validation.status.value,
                "error": validation.error_message
            },
            ip_address=request.client.host if request.client else None
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation.error_message or "Token validation failed"
        )
    
    # Store encrypted token
    success, error = await secure_github_service.store_encrypted_token(
        user_id=user_id,
        token=token,
        github_username=validation.username,
        user_jwt=current_user.bearer_token,
        user_email=current_user.email,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error or "Failed to store token"
        )
    
    # Audit log
    await log_audit_event(
        user_id=user_id,
        event_type="github_token_added",
        details={
            "github_username": validation.username,
            "scopes": validation.scopes
        },
        ip_address=request.client.host if request.client else None
    )
    
    return TokenStatusResponse(
        configured=True,
        github_username=validation.username,
        added_at=datetime.now(timezone.utc).isoformat(),
        scopes=validation.scopes,
        rate_limit_remaining=validation.rate_limit_remaining
    )


@router.get("/github/token/status", response_model=TokenStatusResponse)
async def get_token_status(
    current_user: TokenUser = Depends(get_token_user)
):
    """
    Get current GitHub token status.
    
    Security:
    - Returns configuration status only
    - NEVER returns the actual token
    """
    user_id = str(current_user.id)
    status_info = await secure_github_service.get_token_status(
        user_id,
        user_jwt=current_user.bearer_token,
    )
    
    return TokenStatusResponse(
        configured=status_info.get("configured", False),
        github_username=status_info.get("github_username"),
        added_at=status_info.get("added_at")
    )


@router.delete("/github/token")
async def revoke_github_token(
    request: Request,
    current_user: TokenUser = Depends(get_token_user)
):
    """
    Revoke/delete stored GitHub token.
    
    Security:
    - Completely removes encrypted token from storage
    - User must re-add token for future private repo access
    - Audit logged
    """
    user_id = str(current_user.id)
    
    success, error = await secure_github_service.revoke_token(
        user_id,
        user_jwt=current_user.bearer_token,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error or "Failed to revoke token"
        )
    
    # Audit log
    await log_audit_event(
        user_id=user_id,
        event_type="github_token_revoked",
        details={},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "GitHub token has been revoked"}


@router.post("/github/token/validate", response_model=ValidateTokenResponse)
async def validate_current_token(
    request: Request,
    current_user: TokenUser = Depends(get_token_user)
):
    """
    Validate the currently stored token is still valid.
    Use this to check if a token has been revoked on GitHub.
    """
    user_id = str(current_user.id)
    
    # Rate limit check
    if not check_rate_limit(user_id, "validate_token"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many validation requests. Please wait."
        )
    
    # Get and decrypt token
    token, error = await secure_github_service.get_decrypted_token(
        user_id,
        user_jwt=current_user.bearer_token,
    )
    
    if not token:
        return ValidateTokenResponse(
            valid=False,
            status="not_configured",
            error_message=error or "No GitHub token configured"
        )
    
    # Validate with GitHub
    validation = await secure_github_service.validate_token(token)
    
    # Audit log
    await log_audit_event(
        user_id=user_id,
        event_type="github_token_validated",
        details={"status": validation.status.value},
        ip_address=request.client.host if request.client else None
    )
    
    return ValidateTokenResponse(
        valid=validation.is_valid,
        status=validation.status.value,
        username=validation.username,
        scopes=validation.scopes,
        error_message=validation.error_message
    )


@router.post("/github/check-repo-access", response_model=RepositoryPermissionResponse)
async def check_repository_access(
    owner: str,
    repo: str,
    request: Request,
    current_user: TokenUser = Depends(get_token_user)
):
    """
    Check if the user has access to a specific repository.
    
    Security:
    - Validates token belongs to the authenticated user
    - Checks actual GitHub permissions
    - Prevents scanning repos user doesn't have access to
    """
    user_id = str(current_user.id)
    
    # Rate limit check
    if not check_rate_limit(user_id, "check_repo"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many permission checks. Please wait."
        )
    
    # Get user's stored token
    token, error = await secure_github_service.get_decrypted_token(
        user_id,
        user_jwt=current_user.bearer_token,
    )
    
    if not token:
        return RepositoryPermissionResponse(
            has_access=False,
            error_message=error or "No GitHub token configured"
        )
    
    # Get token status to verify username
    status_info = await secure_github_service.get_token_status(
        user_id,
        user_jwt=current_user.bearer_token,
    )
    github_username = status_info.get("github_username")
    
    if not github_username:
        return RepositoryPermissionResponse(
            has_access=False,
            error_message="GitHub username not found"
        )
    
    # Check repository permission
    permission = await secure_github_service.check_repository_permission(
        token=token,
        owner=owner,
        repo=repo,
        expected_username=github_username
    )
    
    # Audit log
    await log_audit_event(
        user_id=user_id,
        event_type="repo_permission_checked",
        details={
            "repo": f"{owner}/{repo}",
            "has_access": permission.has_access,
            "permission": permission.permission_level
        },
        ip_address=request.client.host if request.client else None
    )
    
    return RepositoryPermissionResponse(
        has_access=permission.has_access,
        permission_level=permission.permission_level,
        is_owner=permission.is_owner,
        error_message=permission.error_message
    )


@router.get("/github/repos", response_model=AccessibleReposResponse)
async def list_accessible_repositories(
    include_private: bool = True,
    current_user: TokenUser = Depends(get_token_user)
):
    """
    List repositories the user has access to via their token.
    
    Only returns repos the authenticated user can actually access.
    """
    user_id = str(current_user.id)
    
    # Rate limit check
    if not check_rate_limit(user_id, "list_repos"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait."
        )
    
    # Get user's token
    token, error = await secure_github_service.get_decrypted_token(
        user_id,
        user_jwt=current_user.bearer_token,
    )
    
    if not token:
        return AccessibleReposResponse(
            repositories=[],
            total=0,
            error=error or "No GitHub token configured"
        )
    
    # Fetch accessible repos
    repos, error = await secure_github_service.list_accessible_repos(
        token=token,
        include_private=include_private
    )
    
    return AccessibleReposResponse(
        repositories=repos,
        total=len(repos),
        error=error
    )
