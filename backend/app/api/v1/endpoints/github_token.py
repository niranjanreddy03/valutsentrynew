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
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from loguru import logger

from app.core.security import get_current_user
from app.core.supabase_client import get_supabase_client, is_supabase_configured
from app.services.github_token_service import secure_github_service, TokenStatus


router = APIRouter()


# ============================================
# Rate Limiting for Token Operations
# ============================================

# Simple in-memory rate limiter (use Redis in production)
_rate_limit_store: dict = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 10  # max requests per window


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


# ============================================
# Endpoints
# ============================================

@router.post("/github/token", response_model=TokenStatusResponse)
async def add_github_token(
    request: Request,
    body: AddTokenRequest,
    current_user = Depends(get_current_user)
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
        github_username=validation.username
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
    current_user = Depends(get_current_user)
):
    """
    Get current GitHub token status.
    
    Security:
    - Returns configuration status only
    - NEVER returns the actual token
    """
    user_id = str(current_user.id)
    status_info = await secure_github_service.get_token_status(user_id)
    
    return TokenStatusResponse(
        configured=status_info.get("configured", False),
        github_username=status_info.get("github_username"),
        added_at=status_info.get("added_at")
    )


@router.delete("/github/token")
async def revoke_github_token(
    request: Request,
    current_user = Depends(get_current_user)
):
    """
    Revoke/delete stored GitHub token.
    
    Security:
    - Completely removes encrypted token from storage
    - User must re-add token for future private repo access
    - Audit logged
    """
    user_id = str(current_user.id)
    
    success, error = await secure_github_service.revoke_token(user_id)
    
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
    current_user = Depends(get_current_user)
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
    token, error = await secure_github_service.get_decrypted_token(user_id)
    
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
    current_user = Depends(get_current_user)
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
    token, error = await secure_github_service.get_decrypted_token(user_id)
    
    if not token:
        return RepositoryPermissionResponse(
            has_access=False,
            error_message=error or "No GitHub token configured"
        )
    
    # Get token status to verify username
    status_info = await secure_github_service.get_token_status(user_id)
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
    current_user = Depends(get_current_user)
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
    token, error = await secure_github_service.get_decrypted_token(user_id)
    
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
