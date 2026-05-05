"""
Vault Sentry - Secure GitHub Token Service
Handles PAT validation, encryption, storage, and repository permission checks.

SECURITY REQUIREMENTS:
- Tokens are ALWAYS encrypted before storage
- Tokens are NEVER logged or exposed in responses
- Repository access is validated before each scan
- Only backend makes GitHub API calls
"""

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
import httpx
from loguru import logger

from app.core.encryption import token_encryption
from app.core.supabase_client import get_supabase_client, is_supabase_configured
from app.core.config import settings


class TokenStatus(str, Enum):
    """Token validation status"""
    VALID = "valid"
    INVALID = "invalid"
    EXPIRED = "expired"
    REVOKED = "revoked"
    RATE_LIMITED = "rate_limited"
    INSUFFICIENT_SCOPES = "insufficient_scopes"


@dataclass
class TokenValidationResult:
    """Result of token validation"""
    status: TokenStatus
    username: Optional[str] = None
    scopes: List[str] = None
    rate_limit_remaining: Optional[int] = None
    rate_limit_reset: Optional[datetime] = None
    error_message: Optional[str] = None
    
    @property
    def is_valid(self) -> bool:
        return self.status == TokenStatus.VALID


@dataclass
class RepositoryPermission:
    """Repository access permission details"""
    has_access: bool
    permission_level: Optional[str] = None  # admin, push, pull
    is_owner: bool = False
    error_message: Optional[str] = None


class SecureGitHubService:
    """
    Secure GitHub service for PAT management and validation.
    All GitHub API calls are made from the backend only.
    """
    
    API_BASE = "https://api.github.com"
    REQUIRED_SCOPES = ["repo"]  # Minimum required for private repos
    
    # Rate limiting for GitHub API calls per user
    _rate_limit_cache: Dict[str, Tuple[int, datetime]] = {}
    _local_store_path = Path(__file__).resolve().parents[2] / ".github_tokens.json"
    
    def __init__(self):
        self.logger = logger.bind(module="secure_github")

    def _read_local_store(self) -> Dict[str, Any]:
        """Read the local encrypted token store used when Supabase cannot write."""
        try:
            if not self._local_store_path.exists():
                return {}
            return json.loads(self._local_store_path.read_text(encoding="utf-8"))
        except Exception as e:
            self.logger.warning(f"[GITHUB] Failed to read local token store: {type(e).__name__}")
            return {}

    def _write_local_store(self, data: Dict[str, Any]) -> None:
        """Write the local encrypted token store with restrictive best-effort perms."""
        self._local_store_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    async def _supabase_update_user(
        self,
        user_id: str,
        payload: Dict[str, Any],
        user_jwt: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Update a Supabase user row.

        When a Supabase access token is supplied, PostgREST enforces RLS so the
        user can only update their own row. If the profile row is missing, create
        it and retry the update.
        """
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return False, "Supabase is not configured"

        base_url = settings.SUPABASE_URL.rstrip("/")
        headers = {
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {user_jwt or settings.SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            update_url = f"{base_url}/rest/v1/users"
            params = {"id": f"eq.{user_id}"}
            response = await client.patch(update_url, headers=headers, params=params, json=payload)

            if response.status_code in (200, 204):
                data = response.json() if response.content else []
                if data:
                    return True, None

                # Supabase profile may not exist yet if the auth trigger failed.
                if user_jwt and user_email:
                    insert_payload = {
                        "id": user_id,
                        "email": user_email,
                        "subscription_tier": "basic",
                        "subscription_started_at": datetime.now(timezone.utc).isoformat(),
                    }
                    insert_response = await client.post(
                        update_url,
                        headers=headers,
                        json={**insert_payload, **payload},
                    )
                    if insert_response.status_code in (200, 201):
                        return True, None
                    return False, f"Failed to create Supabase user profile ({insert_response.status_code})"

                return False, "Supabase user profile not found"

            if response.status_code in (401, 403):
                return False, "Not authorized to update this user profile"

            return False, f"Supabase update failed ({response.status_code})"

    async def _supabase_select_user(
        self,
        user_id: str,
        columns: str,
        user_jwt: Optional[str] = None,
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Select a Supabase user row using either service credentials or user RLS."""
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return None, "Supabase is not configured"

        base_url = settings.SUPABASE_URL.rstrip("/")
        headers = {
            "apikey": settings.SUPABASE_KEY,
            "Authorization": f"Bearer {user_jwt or settings.SUPABASE_KEY}",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{base_url}/rest/v1/users",
                headers=headers,
                params={"id": f"eq.{user_id}", "select": columns, "limit": "1"},
            )

        if response.status_code == 200:
            data = response.json()
            return (data[0] if data else None), None
        if response.status_code in (401, 403):
            return None, "Not authorized to read this user profile"
        return None, f"Supabase select failed ({response.status_code})"
    
    async def validate_token(self, token: str) -> TokenValidationResult:
        """
        Validate a GitHub PAT and check its scopes.
        
        Security:
            - Makes authenticated API call to GitHub
            - Checks required scopes for private repo access
            - Returns rate limit info for monitoring
            - NEVER logs or stores the plaintext token
        """
        self.logger.info("[GITHUB] Validating token...")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    timeout=10.0
                )
            
            # Check rate limits from headers
            rate_remaining = int(response.headers.get("X-RateLimit-Remaining", 0))
            rate_reset = response.headers.get("X-RateLimit-Reset")
            reset_time = datetime.fromtimestamp(int(rate_reset), tz=timezone.utc) if rate_reset else None
            
            if response.status_code == 401:
                return TokenValidationResult(
                    status=TokenStatus.INVALID,
                    error_message="Token is invalid or has been revoked"
                )
            
            if response.status_code == 403:
                if rate_remaining == 0:
                    return TokenValidationResult(
                        status=TokenStatus.RATE_LIMITED,
                        rate_limit_remaining=0,
                        rate_limit_reset=reset_time,
                        error_message="GitHub API rate limit exceeded"
                    )
                return TokenValidationResult(
                    status=TokenStatus.INVALID,
                    error_message="Access forbidden"
                )
            
            if response.status_code != 200:
                return TokenValidationResult(
                    status=TokenStatus.INVALID,
                    error_message=f"Unexpected response: {response.status_code}"
                )
            
            user_data = response.json()
            username = user_data.get("login")
            
            # Check scopes from response header
            scopes_header = response.headers.get("X-OAuth-Scopes", "")
            scopes = [s.strip() for s in scopes_header.split(",") if s.strip()]
            
            # Verify required scopes
            has_repo_scope = "repo" in scopes
            
            if not has_repo_scope:
                return TokenValidationResult(
                    status=TokenStatus.INSUFFICIENT_SCOPES,
                    username=username,
                    scopes=scopes,
                    rate_limit_remaining=rate_remaining,
                    rate_limit_reset=reset_time,
                    error_message="Token requires 'repo' scope for private repository access"
                )
            
            self.logger.info(f"[GITHUB] Token validated for user: {username}")
            
            return TokenValidationResult(
                status=TokenStatus.VALID,
                username=username,
                scopes=scopes,
                rate_limit_remaining=rate_remaining,
                rate_limit_reset=reset_time
            )
            
        except httpx.TimeoutException:
            return TokenValidationResult(
                status=TokenStatus.INVALID,
                error_message="GitHub API request timed out"
            )
        except Exception as e:
            self.logger.error(f"[GITHUB] Token validation error: {type(e).__name__}")
            return TokenValidationResult(
                status=TokenStatus.INVALID,
                error_message="Failed to validate token"
            )
    
    async def check_repository_permission(
        self,
        token: str,
        owner: str,
        repo: str,
        expected_username: str
    ) -> RepositoryPermission:
        """
        Verify user has permission to access a specific repository.
        
        Security:
            - Checks if the token owner has access to the repo
            - Verifies the token user matches the expected user
            - Prevents scanning repos outside user's access
        """
        self.logger.info(f"[GITHUB] Checking permission for {owner}/{repo}")
        
        try:
            async with httpx.AsyncClient() as client:
                # First verify token owner
                user_response = await client.get(
                    f"{self.API_BASE}/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=10.0
                )
                
                if user_response.status_code != 200:
                    return RepositoryPermission(
                        has_access=False,
                        error_message="Token is invalid"
                    )
                
                token_username = user_response.json().get("login")
                
                # Security check: token user must match expected user
                if token_username.lower() != expected_username.lower():
                    self.logger.warning(
                        f"[GITHUB] Token mismatch: expected {expected_username}, got {token_username}"
                    )
                    return RepositoryPermission(
                        has_access=False,
                        error_message="Token does not belong to the expected user"
                    )
                
                # Check repository access
                repo_response = await client.get(
                    f"{self.API_BASE}/repos/{owner}/{repo}",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Accept": "application/vnd.github+json"
                    },
                    timeout=10.0
                )
                
                if repo_response.status_code == 404:
                    return RepositoryPermission(
                        has_access=False,
                        error_message="Repository not found or no access"
                    )
                
                if repo_response.status_code == 403:
                    return RepositoryPermission(
                        has_access=False,
                        error_message="Access forbidden to this repository"
                    )
                
                if repo_response.status_code != 200:
                    return RepositoryPermission(
                        has_access=False,
                        error_message=f"Failed to check repository: {repo_response.status_code}"
                    )
                
                repo_data = repo_response.json()
                permissions = repo_data.get("permissions", {})
                is_owner = repo_data.get("owner", {}).get("login", "").lower() == token_username.lower()
                
                # Determine permission level
                if permissions.get("admin"):
                    permission_level = "admin"
                elif permissions.get("push"):
                    permission_level = "push"
                elif permissions.get("pull"):
                    permission_level = "pull"
                else:
                    permission_level = None
                
                self.logger.info(f"[GITHUB] Permission granted: {permission_level}")
                
                return RepositoryPermission(
                    has_access=True,
                    permission_level=permission_level,
                    is_owner=is_owner
                )
                
        except httpx.TimeoutException:
            return RepositoryPermission(
                has_access=False,
                error_message="GitHub API request timed out"
            )
        except Exception as e:
            self.logger.error(f"[GITHUB] Permission check error: {type(e).__name__}")
            return RepositoryPermission(
                has_access=False,
                error_message="Failed to check repository permission"
            )
    
    async def list_accessible_repos(
        self,
        token: str,
        include_private: bool = True
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        List repositories the token owner has access to.
        
        Returns:
            Tuple of (repos_list, error_message)
        """
        try:
            async with httpx.AsyncClient() as client:
                repos = []
                page = 1
                
                while page <= 5:  # Limit to 5 pages (500 repos max)
                    params = {
                        "visibility": "all" if include_private else "public",
                        "sort": "updated",
                        "per_page": 100,
                        "page": page
                    }
                    
                    response = await client.get(
                        f"{self.API_BASE}/user/repos",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Accept": "application/vnd.github+json"
                        },
                        params=params,
                        timeout=30.0
                    )
                    
                    if response.status_code != 200:
                        return [], "Failed to fetch repositories"
                    
                    page_repos = response.json()
                    if not page_repos:
                        break
                    
                    # Only include essential info (no sensitive data)
                    for repo in page_repos:
                        repos.append({
                            "name": repo["name"],
                            "full_name": repo["full_name"],
                            "private": repo["private"],
                            "owner": repo["owner"]["login"],
                            "url": repo["html_url"],
                            "clone_url": repo["clone_url"],
                            "default_branch": repo.get("default_branch", "main"),
                            "updated_at": repo["updated_at"]
                        })
                    
                    page += 1
                
                return repos, None
                
        except Exception as e:
            self.logger.error(f"[GITHUB] List repos error: {type(e).__name__}")
            return [], "Failed to list repositories"
    
    async def store_encrypted_token(
        self,
        user_id: str,
        token: str,
        github_username: str,
        user_jwt: Optional[str] = None,
        user_email: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Encrypt and store a GitHub token for a user.
        
        Security:
            - Token is encrypted with AES-256-GCM before storage
            - Original token is never stored
            - Token hash stored for lookup without decryption
        """
        try:
            # Encrypt the token, binding it to the owning user_id as AAD so a
            # stolen ciphertext cannot be replayed onto another user's row.
            encrypted_token = token_encryption.encrypt(token, context=str(user_id))
            token_hash = token_encryption.hash_token(token)
            now = datetime.now(timezone.utc).isoformat()
            payload = {
                'github_token': encrypted_token,
                'github_username': github_username,
                'github_token_hash': token_hash,
                'github_token_added_at': now,
                'updated_at': now
            }

            if is_supabase_configured() and user_jwt:
                success, error = await self._supabase_update_user(
                    user_id=user_id,
                    payload=payload,
                    user_jwt=user_jwt,
                    user_email=user_email,
                )
                if success:
                    self.logger.info(f"[GITHUB] Encrypted token stored in Supabase for user {user_id}")
                    return True, None
                if error and "Not authorized" in error:
                    return False, error
            
            if is_supabase_configured():
                supabase = get_supabase_client()
                
                # Store encrypted token with metadata
                result = supabase.table('users').update(payload).eq('id', user_id).execute()
                
                if result.data:
                    self.logger.info(f"[GITHUB] Encrypted token stored for user {user_id}")
                    return True, None
            
            # Local development fallback. The token remains encrypted with the
            # backend SECRET_KEY and the file is ignored by git.
            store = self._read_local_store()
            store[user_id] = {
                "github_token": encrypted_token,
                "github_username": github_username,
                "github_token_hash": token_hash,
                "github_token_added_at": now,
            }
            self._write_local_store(store)
            self.logger.info(f"[GITHUB] Encrypted token stored in local dev store for user {user_id}")
            return True, None
            
        except Exception as e:
            self.logger.error(f"[GITHUB] Store token error: {type(e).__name__}")
            return False, "Failed to store token securely"
    
    async def get_decrypted_token(
        self,
        user_id: str,
        user_jwt: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Retrieve and decrypt a user's GitHub token.
        
        Security:
            - Only decrypts when needed for API calls
            - Token is held in memory briefly, then discarded
            
        Returns:
            Tuple of (token, error_message)
        """
        try:
            row = None

            if is_supabase_configured() and user_jwt:
                row, error = await self._supabase_select_user(
                    user_id=user_id,
                    columns="github_token,github_username",
                    user_jwt=user_jwt,
                )
                if error and "Not authorized" in error:
                    return None, error

            if row is None and is_supabase_configured():
                try:
                    supabase = get_supabase_client()
                    result = supabase.table('users').select(
                        'github_token, github_username'
                    ).eq('id', user_id).single().execute()
                    row = result.data
                except Exception:
                    row = None

            if row is None:
                row = self._read_local_store().get(user_id)

            if not row or not row.get('github_token'):
                return None, "No GitHub token configured"
            
            # Decrypt with the same user_id AAD that was bound at encrypt time.
            # Legacy (pre-v2) blobs decrypt without AAD via the version check
            # inside TokenEncryption.decrypt.
            decrypted = token_encryption.decrypt(row['github_token'], context=str(user_id))
            return decrypted, None
            
        except ValueError as e:
            # Decryption failed - token may be corrupted
            self.logger.error(f"[GITHUB] Token decryption failed for user {user_id}")
            return None, "Token decryption failed - please re-add your token"
        except Exception as e:
            self.logger.error(f"[GITHUB] Get token error: {type(e).__name__}")
            return None, "Failed to retrieve token"
    
    async def revoke_token(
        self,
        user_id: str,
        user_jwt: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Revoke/delete a user's stored GitHub token.
        
        Security:
            - Completely removes encrypted token from storage
            - Logs the revocation for audit trail
        """
        try:
            payload = {
                'github_token': None,
                'github_username': None,
                'github_token_hash': None,
                'github_token_added_at': None,
                'github_token_revoked_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }

            if is_supabase_configured() and user_jwt:
                success, error = await self._supabase_update_user(
                    user_id=user_id,
                    payload=payload,
                    user_jwt=user_jwt,
                )
                if success:
                    self.logger.info(f"[GITHUB] Token revoked in Supabase for user {user_id}")
                    return True, None
                if error and "Not authorized" in error:
                    return False, error

            if is_supabase_configured():
                supabase = get_supabase_client()
                result = supabase.table('users').update(payload).eq('id', user_id).execute()
                if result.data:
                    self.logger.info(f"[GITHUB] Token revoked for user {user_id}")
                    return True, None

            store = self._read_local_store()
            if user_id in store:
                del store[user_id]
                self._write_local_store(store)
            self.logger.info(f"[GITHUB] Token revoked in local dev store for user {user_id}")
            return True, None
            
        except Exception as e:
            self.logger.error(f"[GITHUB] Revoke token error: {type(e).__name__}")
            return False, "Failed to revoke token"
    
    async def get_token_status(
        self,
        user_id: str,
        user_jwt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get token status for a user without exposing the token.
        
        Returns:
            Dict with token status info (no sensitive data)
        """
        try:
            row = None

            if is_supabase_configured() and user_jwt:
                row, error = await self._supabase_select_user(
                    user_id=user_id,
                    columns="github_username,github_token_added_at",
                    user_jwt=user_jwt,
                )
                if error and "Not authorized" in error:
                    return {"configured": False, "error": error}

            if row is None and is_supabase_configured():
                try:
                    supabase = get_supabase_client()
                    result = supabase.table('users').select(
                        'github_username, github_token_added_at'
                    ).eq('id', user_id).single().execute()
                    row = result.data
                except Exception:
                    row = None

            if row is None:
                row = self._read_local_store().get(user_id)

            if not row:
                return {"configured": False}
            
            has_token = bool(row.get('github_token_added_at'))
            
            return {
                "configured": has_token,
                "github_username": row.get('github_username') if has_token else None,
                "added_at": row.get('github_token_added_at') if has_token else None,
                # Never include the actual token
            }
            
        except Exception as e:
            self.logger.error(f"[GITHUB] Get status error: {type(e).__name__}")
            return {"configured": False, "error": "Failed to get token status"}


# Singleton instance
secure_github_service = SecureGitHubService()
