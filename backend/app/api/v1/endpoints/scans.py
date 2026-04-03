"""
Vault Sentry - Scan Management Endpoints
"""

import uuid
import tempfile
import shutil
import zipfile
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel, Field
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.supabase_client import get_supabase_client, is_supabase_configured
from app.models.user import User
from app.models.repository import Repository
from app.models.scan import Scan, ScanStatus, ScanTrigger
from app.models.secret import Secret, SecretType, RiskLevel, SecretStatus
from app.scanner import scanner
from app.api.v1.endpoints.subscription import check_can_run_scan, increment_scan_counter


router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================

class ScanCreate(BaseModel):
    """Scan creation schema"""
    repository_id: Optional[int] = None
    branch: Optional[str] = None
    target_path: Optional[str] = None


class ScanResponse(BaseModel):
    """Scan response schema"""
    id: int
    scan_id: str
    repository_id: Optional[int]
    target_path: Optional[str]
    branch: Optional[str]
    trigger: str
    status: str
    progress: int
    files_scanned: int
    total_findings: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    risk_score: float
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]
    error_message: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class ScanListResponse(BaseModel):
    """Paginated scan list response"""
    items: List[ScanResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ScanResultResponse(BaseModel):
    """Detailed scan result with findings"""
    scan: ScanResponse
    findings: List[dict]


# ============================================
# Helper Functions
# ============================================

async def get_user_github_token(user_id: str) -> Optional[str]:
    """
    Fetch and decrypt user's GitHub token securely.
    Returns None if not configured or Supabase is not available.
    
    Security:
        - Token is decrypted from encrypted storage
        - Falls back to env token only if no user token
        - Never logs the actual token
    """
    try:
        if not is_supabase_configured():
            logger.debug("[AUTH] Supabase not configured, falling back to env token")
            return settings.GITHUB_TOKEN
        
        # Use secure service for encrypted token retrieval
        from app.services.github_token_service import secure_github_service
        
        token, error = await secure_github_service.get_decrypted_token(str(user_id))
        
        if token:
            logger.debug(f"[AUTH] Using decrypted user token for user {user_id}")
            return token
        
        logger.debug(f"[AUTH] No user token found for {user_id}, falling back to env token")
        return settings.GITHUB_TOKEN
        
    except Exception as e:
        logger.warning(f"[AUTH] Error fetching user token: {e}, falling back to env token")
        return settings.GITHUB_TOKEN


async def verify_repository_access(
    user_id: str,
    owner: str,
    repo: str,
    token: str
) -> Tuple[bool, Optional[str]]:
    """
    Verify user has permission to access a repository before scanning.
    
    Security:
        - Validates token belongs to the user
        - Checks GitHub API for actual permissions
        - Prevents unauthorized repo scanning
    
    Returns:
        Tuple of (has_access, error_message)
    """
    from app.services.github_token_service import secure_github_service
    
    # Get stored username for this user's token
    status_info = await secure_github_service.get_token_status(user_id)
    github_username = status_info.get("github_username")
    
    if not github_username:
        return False, "GitHub username not found for token"
    
    # Check repository permission
    permission = await secure_github_service.check_repository_permission(
        token=token,
        owner=owner,
        repo=repo,
        expected_username=github_username
    )
    
    if not permission.has_access:
        logger.warning(f"[PERMISSION] User {user_id} denied access to {owner}/{repo}")
        return False, permission.error_message
    
    logger.info(f"[PERMISSION] User {user_id} has {permission.permission_level} access to {owner}/{repo}")
    return True, None


def get_authenticated_clone_url(clone_url: str, github_token: Optional[str] = None) -> str:
    """
    Add authentication token to clone URL for private repositories.
    Uses user's token if provided, otherwise falls back to system GITHUB_TOKEN.
    """
    # Use provided token or fall back to env variable
    token = github_token or settings.GITHUB_TOKEN
    
    if not token:
        logger.debug("[CLONE] No GitHub token available, using URL as-is")
        return clone_url
    
    # Only add token for GitHub HTTPS URLs
    if 'github.com' in clone_url and clone_url.startswith('https://'):
        # Format: https://TOKEN@github.com/owner/repo.git
        authenticated_url = clone_url.replace('https://github.com', f'https://{token}@github.com')
        logger.debug("[CLONE] Added GitHub token to clone URL")
        return authenticated_url
    
    # GitLab support
    if 'gitlab.com' in clone_url and clone_url.startswith('https://'):
        # Format: https://oauth2:TOKEN@gitlab.com/owner/repo.git
        authenticated_url = clone_url.replace('https://gitlab.com', f'https://oauth2:{token}@gitlab.com')
        logger.debug("[CLONE] Added GitLab token to clone URL")
        return authenticated_url
    
    return clone_url


def clone_repository(clone_url: str, target_dir: str, branch: str = "main", github_token: Optional[str] = None) -> bool:
    """Clone a git repository to a target directory"""
    logger.info(f"[CLONE] Starting clone: {clone_url} -> {target_dir}")
    
    try:
        # Add authentication for private repos (use provided token)
        auth_url = get_authenticated_clone_url(clone_url, github_token)
        
        # Use git command line for cloning
        cmd = [
            'git', 'clone',
            '--depth', '1',
            '--single-branch',
            '--branch', branch,
            auth_url,
            target_dir
        ]
        
        logger.debug(f"[CLONE] Running command with branch: {branch}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode != 0:
            logger.warning(f"[CLONE] Clone with branch failed: {result.stderr}")
            
            # Try without branch specification in case branch doesn't exist
            logger.info("[CLONE] Retrying without branch specification")
            cmd_fallback = [
                'git', 'clone',
                '--depth', '1',
                auth_url,
                target_dir
            ]
            result = subprocess.run(
                cmd_fallback,
                capture_output=True,
                text=True,
                timeout=300
            )
            if result.returncode != 0:
                logger.error(f"[CLONE] Clone fallback also failed: {result.stderr}")
                return False
                
        logger.info(f"[CLONE] Successfully cloned repository to {target_dir}")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error("[CLONE] Git clone timed out after 5 minutes")
        return False
    except Exception as e:
        logger.error(f"[CLONE] Git clone error: {e}")
        return False


async def trigger_initial_scan(
    repository_id: int,
    clone_url: str,
    branch: str,
    user_id: int,
    max_retries: int = 3
):
    """
    Trigger an initial scan for a newly added repository.
    Includes retry logic for API rate limits.
    Fetches user's GitHub token from Supabase for private repo access.
    
    Security:
        - Validates repository access before scanning
        - Uses encrypted user token
        - Stops if token becomes invalid
    """
    import asyncio
    import re
    from app.core.database import AsyncSessionLocal
    
    logger.info(f"[INITIAL SCAN] Starting initial scan for repository {repository_id}")
    
    # Fetch user's GitHub token for private repos
    user_github_token = await get_user_github_token(str(user_id))
    
    # Extract owner/repo from clone URL for permission check
    repo_match = re.search(r'github\.com[/:]([^/]+)/([^/\.]+)', clone_url)
    
    if repo_match and user_github_token:
        owner, repo_name = repo_match.groups()
        logger.info(f"[INITIAL SCAN] Verifying access to {owner}/{repo_name}")
        
        # Verify user has permission to scan this repo
        has_access, error = await verify_repository_access(
            user_id=str(user_id),
            owner=owner,
            repo=repo_name,
            token=user_github_token
        )
        
        if not has_access:
            logger.error(f"[INITIAL SCAN] Access denied: {error}")
            # Create failed scan record
            async with AsyncSessionLocal() as db:
                scan = Scan(
                    scan_id=str(uuid.uuid4()),
                    repository_id=repository_id,
                    target_path="auto_scan",
                    branch=branch,
                    user_id=user_id,
                    trigger=ScanTrigger.MANUAL.value,
                    status=ScanStatus.FAILED.value,
                    error_message=f"Access denied: {error}"
                )
                db.add(scan)
                await db.commit()
            return
        
        logger.info("[INITIAL SCAN] Access verified, proceeding with scan")
    elif user_github_token:
        logger.info("[INITIAL SCAN] Using user's GitHub token for authentication")
    
    for attempt in range(max_retries):
        try:
            async with AsyncSessionLocal() as db:
                # Create scan record
                scan = Scan(
                    scan_id=str(uuid.uuid4()),
                    repository_id=repository_id,
                    target_path="auto_scan",
                    branch=branch,
                    user_id=user_id,
                    trigger=ScanTrigger.MANUAL.value,
                    status=ScanStatus.PENDING.value,
                    progress=0
                )
                db.add(scan)
                await db.commit()
                await db.refresh(scan)
                
                logger.info(f"[INITIAL SCAN] Created scan record: {scan.scan_id}")
                
                # Clone and scan
                cloned_dir = tempfile.mkdtemp(prefix=f"initial_scan_{scan.id}_")
                
                try:
                    logger.info(f"[INITIAL SCAN] Cloning repository {clone_url} to {cloned_dir}")
                    
                    # Update status to running
                    scan.status = ScanStatus.RUNNING.value
                    scan.started_at = datetime.utcnow()
                    await db.commit()
                    
                    # Clone with user's token for private repo access
                    if not clone_repository(clone_url, cloned_dir, branch, user_github_token):
                        raise Exception(f"Failed to clone repository: {clone_url}")
                    
                    # Run scan
                    logger.info(f"[INITIAL SCAN] Running scan on {cloned_dir}")
                    scan_result = scanner.scan_directory(Path(cloned_dir))
                    
                    # Save findings
                    for finding in scan_result.findings:
                        secret = Secret(
                            finding_id=finding.finding_id,
                            scan_id=scan.id,
                            type=finding.type,
                            file_path=finding.file_path,
                            line_number=finding.line_number,
                            column_start=finding.column_start,
                            column_end=finding.column_end,
                            secret_value_masked=finding.secret_masked,
                            secret_hash=finding.secret_hash,
                            code_snippet=finding.code_snippet,
                            match_rule=finding.match_rule,
                            risk_level=finding.severity,
                            risk_score=finding.risk_score,
                            entropy_score=finding.entropy_score,
                            is_test_file=finding.is_test_file,
                            status=SecretStatus.OPEN.value
                        )
                        db.add(secret)
                    
                    # Update scan record
                    scan.status = ScanStatus.COMPLETED.value
                    scan.completed_at = datetime.utcnow()
                    scan.files_scanned = scan_result.files_scanned
                    scan.total_findings = scan_result.total_findings
                    scan.high_risk_count = scan_result.high_risk_count
                    scan.medium_risk_count = scan_result.medium_risk_count
                    scan.low_risk_count = scan_result.low_risk_count
                    scan.risk_score = scan_result.risk_score
                    scan.duration_seconds = scan_result.duration_seconds
                    
                    # Update repository stats
                    repo_result = await db.execute(
                        select(Repository).where(Repository.id == repository_id)
                    )
                    repo = repo_result.scalar_one_or_none()
                    if repo:
                        repo.total_scans = (repo.total_scans or 0) + 1
                        repo.secrets_found = (repo.secrets_found or 0) + scan_result.total_findings
                        repo.last_scan_at = datetime.utcnow()
                    
                    await db.commit()
                    logger.info(f"[INITIAL SCAN] Completed: {scan.scan_id}, findings={scan_result.total_findings}")
                    return  # Success, exit retry loop
                    
                finally:
                    # Cleanup
                    if Path(cloned_dir).exists():
                        shutil.rmtree(cloned_dir, ignore_errors=True)
                        logger.info(f"[INITIAL SCAN] Cleaned up: {cloned_dir}")
                        
        except Exception as e:
            logger.error(f"[INITIAL SCAN] Attempt {attempt + 1}/{max_retries} failed: {e}")
            
            # Check if it's a rate limit error
            if "rate limit" in str(e).lower() or "403" in str(e):
                wait_time = (attempt + 1) * 60  # Exponential backoff: 60s, 120s, 180s
                logger.warning(f"[INITIAL SCAN] Rate limit detected, waiting {wait_time}s before retry")
                await asyncio.sleep(wait_time)
            elif attempt < max_retries - 1:
                await asyncio.sleep(5)  # Short wait before retry
            else:
                # Final attempt failed, mark scan as failed
                try:
                    async with AsyncSessionLocal() as db:
                        scan.status = ScanStatus.FAILED.value
                        scan.error_message = str(e)
                        scan.completed_at = datetime.utcnow()
                        await db.commit()
                except:
                    pass
                logger.error(f"[INITIAL SCAN] All {max_retries} attempts failed for repository {repository_id}")


# ============================================
# Background Tasks
# ============================================

async def run_scan_task(
    scan_id: int,
    target_path: str,
    db_url: str,
    clone_url: str = None,
    branch: str = "main"
):
    """Background task to run a scan"""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        cloned_dir = None
        try:
            # Get scan record
            result = await db.execute(select(Scan).where(Scan.id == scan_id))
            scan = result.scalar_one()
            
            # Update scan status
            scan.status = ScanStatus.RUNNING.value
            scan.started_at = datetime.utcnow()
            await db.commit()
            
            # Clone repository if clone_url is provided
            actual_scan_path = target_path
            if clone_url:
                cloned_dir = tempfile.mkdtemp(prefix=f"scan_{scan_id}_")
                logger.info(f"Cloning repository {clone_url} to {cloned_dir}")
                if not clone_repository(clone_url, cloned_dir, branch):
                    raise Exception(f"Failed to clone repository: {clone_url}")
                actual_scan_path = cloned_dir
            
            # Verify path exists
            if not Path(actual_scan_path).exists():
                raise Exception(f"Scan path does not exist: {actual_scan_path}")
            
            # Run the scan
            scan_result = scanner.scan_directory(Path(actual_scan_path))
            
            # Save findings to database
            for finding in scan_result.findings:
                secret = Secret(
                    finding_id=finding.finding_id,
                    scan_id=scan.id,
                    type=finding.type,
                    file_path=finding.file_path,
                    line_number=finding.line_number,
                    column_start=finding.column_start,
                    column_end=finding.column_end,
                    secret_value_masked=finding.secret_masked,
                    secret_hash=finding.secret_hash,
                    code_snippet=finding.code_snippet,
                    match_rule=finding.match_rule,
                    risk_level=finding.severity,
                    risk_score=finding.risk_score,
                    entropy_score=finding.entropy_score,
                    is_test_file=finding.is_test_file,
                    status=SecretStatus.OPEN.value
                )
                db.add(secret)
            
            # Update scan record
            scan.status = ScanStatus.COMPLETED.value
            scan.completed_at = datetime.utcnow()
            scan.files_scanned = scan_result.files_scanned
            scan.total_findings = scan_result.total_findings
            scan.high_risk_count = scan_result.high_risk_count
            scan.medium_risk_count = scan_result.medium_risk_count
            scan.low_risk_count = scan_result.low_risk_count
            scan.risk_score = scan_result.risk_score
            scan.duration_seconds = scan_result.duration_seconds
            
            # Update repository stats if applicable
            if scan.repository_id:
                repo_result = await db.execute(
                    select(Repository).where(Repository.id == scan.repository_id)
                )
                repo = repo_result.scalar_one_or_none()
                if repo:
                    repo.total_scans += 1
                    repo.secrets_found += scan_result.total_findings
                    repo.last_scan_at = datetime.utcnow()
            
            await db.commit()
            logger.info(f"Scan completed: {scan.scan_id}")
            
        except Exception as e:
            logger.error(f"Scan failed: {e}")
            scan.status = ScanStatus.FAILED.value
            scan.error_message = str(e)
            scan.completed_at = datetime.utcnow()
            await db.commit()
        
        finally:
            # Cleanup cloned repository if we created one
            if cloned_dir and Path(cloned_dir).exists():
                try:
                    shutil.rmtree(cloned_dir, ignore_errors=True)
                    logger.info(f"Cleaned up cloned repository: {cloned_dir}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup cloned dir: {e}")
            # Cleanup temporary files if needed
            elif target_path.startswith(tempfile.gettempdir()):
                try:
                    shutil.rmtree(target_path, ignore_errors=True)
                except:
                    pass


async def run_supabase_scan_task(
    scan_id: int,
    repository_id: int,
    repository_url: str,
    branch: str = "main",
    user_access_token: str = None
):
    """
    Background task to run a scan and update Supabase directly.
    Used when Celery is not available.
    """
    from app.core.supabase_client import get_supabase_client
    from supabase import create_client
    from app.core.config import settings as app_settings
    
    # Use the service role client if available, otherwise try user-authenticated client
    supabase = get_supabase_client()
    
    # If we have a user access token, create an authenticated client for RLS-protected inserts
    user_supabase = None
    if user_access_token and app_settings.SUPABASE_URL and app_settings.SUPABASE_KEY:
        try:
            user_supabase = create_client(app_settings.SUPABASE_URL, app_settings.SUPABASE_KEY)
            # Set the user's JWT on the postgrest client to pass RLS
            user_supabase.postgrest.auth(user_access_token)
            logger.info("[SCAN] Using user-authenticated Supabase client for RLS")
        except Exception as e:
            logger.warning(f"[SCAN] Could not create user-authenticated client: {e}")
            user_supabase = None
    
    # Use the authenticated client for inserts (to pass RLS), fall back to service client
    insert_client = user_supabase or supabase
    cloned_dir = None
    
    try:
        # Update scan status to running in Supabase
        insert_client.table('scans').update({
            'status': 'running',
            'started_at': datetime.utcnow().isoformat()
        }).eq('id', scan_id).execute()
        
        # Fetch scan record to get user_id
        scan_record = insert_client.table('scans').select('user_id').eq('id', scan_id).single().execute()
        user_id = scan_record.data.get('user_id') if scan_record.data else None
        
        if not user_id:
            raise Exception(f"Could not find scan record or user_id for scan {scan_id}")
        
        # Clone repository
        cloned_dir = tempfile.mkdtemp(prefix=f"scan_{scan_id}_")
        logger.info(f"Cloning repository {repository_url} to {cloned_dir}")
        
        if not clone_repository(repository_url, cloned_dir, branch):
            raise Exception(f"Failed to clone repository: {repository_url}")
        
        # Run the scan
        scan_result = scanner.scan_directory(Path(cloned_dir))
        
        # Save findings to Supabase — column names must match the Supabase secrets schema
        findings_to_insert = []
        for finding in scan_result.findings:
            findings_to_insert.append({
                'scan_id': scan_id,
                'repository_id': repository_id,
                'user_id': user_id,
                'type': finding.type,
                'file_path': finding.file_path,
                'line_number': finding.line_number,
                'column_start': finding.column_start,
                'column_end': finding.column_end,
                'masked_value': finding.secret_masked,
                'raw_match': finding.secret_hash,
                'description': finding.code_snippet,
                'pattern_name': finding.match_rule,
                'risk_level': finding.severity,
                'entropy_score': float(finding.entropy_score) if finding.entropy_score else None,
                'status': 'active'
            })
        
        if findings_to_insert:
            insert_client.table('secrets').insert(findings_to_insert).execute()
        
        # Update scan record in Supabase — only columns that exist in the scans table
        insert_client.table('scans').update({
            'status': 'completed',
            'completed_at': datetime.utcnow().isoformat(),
            'files_scanned': scan_result.files_scanned,
            'secrets_found': scan_result.total_findings,
            'duration_seconds': int(scan_result.duration_seconds)
        }).eq('id', scan_id).execute()
        
        # Update repository secrets_count and last_scan_at
        insert_client.table('repositories').update({
            'secrets_count': scan_result.total_findings,
            'last_scan_at': datetime.utcnow().isoformat()
        }).eq('id', repository_id).execute()
        
        logger.info(f"Supabase scan completed: scan_id={scan_id}, findings={scan_result.total_findings}")
        
    except Exception as e:
        logger.error(f"Supabase scan failed: {e}")
        try:
            insert_client.table('scans').update({
                'status': 'failed',
                'error_message': str(e),
                'completed_at': datetime.utcnow().isoformat()
            }).eq('id', scan_id).execute()
        except Exception as update_err:
            logger.error(f"Failed to update scan status to failed: {update_err}")
    
    finally:
        # Cleanup cloned repository
        if cloned_dir and Path(cloned_dir).exists():
            try:
                shutil.rmtree(cloned_dir, ignore_errors=True)
                logger.info(f"Cleaned up cloned repository: {cloned_dir}")
            except Exception as e:
                logger.warning(f"Failed to cleanup cloned dir: {e}")


# ============================================
# Endpoints
# ============================================

@router.get("", response_model=ScanListResponse)
async def list_scans(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    repository_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all scans for the current user.
    """
    query = select(Scan).where(Scan.user_id == current_user.id)
    count_query = select(func.count(Scan.id)).where(Scan.user_id == current_user.id)
    
    # Apply filters
    if status:
        query = query.where(Scan.status == status)
        count_query = count_query.where(Scan.status == status)
    
    if repository_id:
        query = query.where(Scan.repository_id == repository_id)
        count_query = count_query.where(Scan.repository_id == repository_id)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Scan.created_at.desc())
    
    result = await db.execute(query)
    scans = result.scalars().all()
    
    return ScanListResponse(
        items=scans,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )


@router.post("", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_scan(
    scan_data: ScanCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initiate a new scan for a repository.
    """
    # Check subscription limits
    can_scan, message = await check_can_run_scan(current_user, db)
    if not can_scan:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )
    
    target_path = None
    clone_url = None
    branch = scan_data.branch or "main"
    
    # Validate repository if specified
    if scan_data.repository_id:
        result = await db.execute(
            select(Repository).where(
                (Repository.id == scan_data.repository_id) &
                (Repository.owner_id == current_user.id)
            )
        )
        repository = result.scalar_one_or_none()
        
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Repository not found"
            )
        
        # Use clone_url from repository for scanning, fall back to url if not set
        clone_url = repository.clone_url or repository.url
        branch = scan_data.branch or repository.default_branch or "main"
        target_path = scan_data.target_path or "cloned_repo"
        
        if not clone_url and not scan_data.target_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Repository does not have a clone URL configured"
            )
    else:
        target_path = scan_data.target_path
    
    if not target_path and not clone_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either repository_id or target_path must be provided"
        )
    
    # Create scan record
    scan = Scan(
        scan_id=str(uuid.uuid4()),
        repository_id=scan_data.repository_id,
        target_path=target_path,
        branch=branch,
        user_id=current_user.id,
        trigger=ScanTrigger.MANUAL.value,
        status=ScanStatus.PENDING.value,
        progress=0
    )
    
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    
    # Increment scan counter for subscription tracking
    await increment_scan_counter(current_user, db)
    
    # Queue background scan task
    background_tasks.add_task(
        run_scan_task,
        scan.id,
        target_path,
        settings.DATABASE_URL,
        clone_url,
        branch
    )
    
    logger.info(f"Scan initiated: {scan.scan_id} by {current_user.email} (clone_url: {clone_url})")
    
    return scan


class ScanTriggerRequest(BaseModel):
    """Request to trigger a scan for a Supabase scan record"""
    scan_id: int
    repository_id: int
    repository_url: str
    branch: str = "main"


@router.post("/trigger", status_code=status.HTTP_202_ACCEPTED)
async def trigger_scan(
    request: ScanTriggerRequest,
    background_tasks: BackgroundTasks,
    http_request: Request = None,
):
    """
    Trigger a scan for an existing Supabase scan record.
    This endpoint is called by the frontend after creating a scan record in Supabase.
    Accepts optional Authorization header with user's Supabase access token for RLS.
    """
    from app.core.supabase_client import is_supabase_configured
    
    if not is_supabase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY."
        )
    
    # Extract user access token from Authorization header if provided
    user_access_token = None
    if http_request:
        auth_header = http_request.headers.get('authorization', '')
        if auth_header.startswith('Bearer '):
            user_access_token = auth_header[7:]
            logger.info("[TRIGGER] User access token received for authenticated scan")
    
    # Try to queue the Celery task, fall back to background task if Celery is not available
    try:
        from app.workers.tasks.scan_tasks import run_repository_scan
        run_repository_scan.delay(
            scan_id=request.scan_id,
            repository_id=request.repository_id,
            repository_url=request.repository_url,
            branch=request.branch,
            scan_type="full",
            options={"entropy_enabled": True}
        )
        logger.info(f"Scan queued via Celery: scan_id={request.scan_id}, repo_id={request.repository_id}")
        return {"status": "queued", "scan_id": request.scan_id}
    except Exception as celery_error:
        logger.warning(f"Celery not available, using background task: {celery_error}")
        # Fallback to FastAPI background task with Supabase
        background_tasks.add_task(
            run_supabase_scan_task,
            request.scan_id,
            request.repository_id,
            request.repository_url,
            request.branch,
            user_access_token
        )
        logger.info(f"Scan triggered via background task: scan_id={request.scan_id}, repo_id={request.repository_id}")
        return {"status": "queued", "scan_id": request.scan_id}


@router.post("/upload", response_model=ScanResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_and_scan(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a zip file and scan its contents.
    """
    # Validate file type
    if not file.filename.endswith(('.zip', '.tar.gz', '.tar')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .zip, .tar.gz, or .tar files are allowed"
        )
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum of {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )
    
    # Create temp directory and extract
    temp_dir = tempfile.mkdtemp(prefix="VaultSentry_")
    try:
        file_path = Path(temp_dir) / file.filename
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        # Extract based on file type
        extract_dir = Path(temp_dir) / "extracted"
        extract_dir.mkdir()
        
        if file.filename.endswith('.zip'):
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)
        else:
            shutil.unpack_archive(file_path, extract_dir)
        
        # Create scan record
        scan = Scan(
            scan_id=str(uuid.uuid4()),
            target_path=str(extract_dir),
            user_id=current_user.id,
            trigger=ScanTrigger.MANUAL.value,
            status=ScanStatus.PENDING.value,
            progress=0
        )
        
        db.add(scan)
        await db.commit()
        await db.refresh(scan)
        
        # Queue background scan task
        background_tasks.add_task(
            run_scan_task,
            scan.id,
            str(extract_dir),
            settings.DATABASE_URL
        )
        
        logger.info(f"Upload scan initiated: {scan.scan_id} by {current_user.email}")
        
        return scan
        
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process upload: {str(e)}"
        )


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific scan by ID.
    """
    result = await db.execute(
        select(Scan).where(
            (Scan.scan_id == scan_id) &
            (Scan.user_id == current_user.id)
        )
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    return scan


@router.get("/{scan_id}/findings", response_model=List[dict])
async def get_scan_findings(
    scan_id: str,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all findings for a specific scan.
    """
    # Get scan
    result = await db.execute(
        select(Scan).where(
            (Scan.scan_id == scan_id) &
            (Scan.user_id == current_user.id)
        )
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    # Query findings
    query = select(Secret).where(Secret.scan_id == scan.id)
    
    if risk_level:
        query = query.where(Secret.risk_level == risk_level)
    if status:
        query = query.where(Secret.status == status)
    
    query = query.order_by(Secret.risk_score.desc())
    
    result = await db.execute(query)
    secrets = result.scalars().all()
    
    return [s.to_dict() for s in secrets]


@router.post("/{scan_id}/cancel")
async def cancel_scan(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a running scan.
    """
    result = await db.execute(
        select(Scan).where(
            (Scan.scan_id == scan_id) &
            (Scan.user_id == current_user.id)
        )
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    if scan.status not in [ScanStatus.PENDING.value, ScanStatus.RUNNING.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scan cannot be cancelled"
        )
    
    scan.status = ScanStatus.CANCELLED.value
    scan.completed_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Scan cancelled successfully"}


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a scan and all its findings.
    """
    result = await db.execute(
        select(Scan).where(
            (Scan.scan_id == scan_id) &
            (Scan.user_id == current_user.id)
        )
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found"
        )
    
    await db.delete(scan)
    await db.commit()
    
    logger.info(f"Scan deleted: {scan_id} by {current_user.email}")
    
    return {"message": "Scan deleted successfully"}
