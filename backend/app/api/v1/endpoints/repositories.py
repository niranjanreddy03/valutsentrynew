"""
Vault Sentry - Repository Management Endpoints
"""

import re
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field, HttpUrl, field_validator
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.repository import Repository, RepositoryType, RepositoryStatus
from app.api.v1.endpoints.subscription import check_can_add_repository


router = APIRouter()


# ============================================
# GitHub URL Validation Helper
# ============================================

GITHUB_URL_PATTERNS = [
    r'^https?://github\.com/[\w\-\.]+/[\w\-\.]+(?:\.git)?/?$',
    r'^git@github\.com:[\w\-\.]+/[\w\-\.]+(?:\.git)?$',
    r'^https?://github\.com/[\w\-\.]+/[\w\-\.]+$',
]

GITLAB_URL_PATTERNS = [
    r'^https?://gitlab\.com/[\w\-\.]+/[\w\-\.]+(?:\.git)?/?$',
    r'^git@gitlab\.com:[\w\-\.]+/[\w\-\.]+(?:\.git)?$',
]

BITBUCKET_URL_PATTERNS = [
    r'^https?://bitbucket\.org/[\w\-\.]+/[\w\-\.]+(?:\.git)?/?$',
    r'^git@bitbucket\.org:[\w\-\.]+/[\w\-\.]+(?:\.git)?$',
]


def validate_repository_url(url: str, provider: str) -> tuple[bool, str]:
    """
    Validate repository URL format based on provider.
    Returns (is_valid, error_message)
    """
    if not url:
        return False, "Repository URL is required"
    
    url = url.strip()
    
    if provider == "github":
        for pattern in GITHUB_URL_PATTERNS:
            if re.match(pattern, url, re.IGNORECASE):
                return True, ""
        return False, f"Invalid GitHub URL format. Expected: https://github.com/owner/repo or git@github.com:owner/repo.git"
    
    elif provider == "gitlab":
        for pattern in GITLAB_URL_PATTERNS:
            if re.match(pattern, url, re.IGNORECASE):
                return True, ""
        return False, f"Invalid GitLab URL format. Expected: https://gitlab.com/owner/repo"
    
    elif provider == "bitbucket":
        for pattern in BITBUCKET_URL_PATTERNS:
            if re.match(pattern, url, re.IGNORECASE):
                return True, ""
        return False, f"Invalid Bitbucket URL format. Expected: https://bitbucket.org/owner/repo"
    
    # For other providers, basic URL validation
    if not url.startswith(('http://', 'https://', 'git@')):
        return False, "URL must start with http://, https://, or git@"
    
    return True, ""


def extract_repo_info_from_url(url: str) -> tuple[str, str]:
    """
    Extract owner and repo name from a repository URL.
    Returns (owner, repo_name)
    """
    url = url.strip().rstrip('/').rstrip('.git')
    
    # Handle SSH URLs (git@github.com:owner/repo)
    if url.startswith('git@'):
        match = re.match(r'git@[\w\.]+:([\w\-\.]+)/([\w\-\.]+)', url)
        if match:
            return match.group(1), match.group(2)
    
    # Handle HTTPS URLs
    match = re.match(r'https?://[\w\.]+/([\w\-\.]+)/([\w\-\.]+)', url)
    if match:
        return match.group(1), match.group(2)
    
    return "", ""


def normalize_clone_url(url: str, provider: str) -> str:
    """
    Normalize URL to a clone-friendly HTTPS format.
    """
    url = url.strip().rstrip('/')
    
    # Convert SSH to HTTPS
    if url.startswith('git@'):
        if provider == 'github':
            match = re.match(r'git@github\.com:([\w\-\.]+/[\w\-\.]+)(?:\.git)?', url)
            if match:
                return f"https://github.com/{match.group(1)}.git"
        elif provider == 'gitlab':
            match = re.match(r'git@gitlab\.com:([\w\-\.]+/[\w\-\.]+)(?:\.git)?', url)
            if match:
                return f"https://gitlab.com/{match.group(1)}.git"
        elif provider == 'bitbucket':
            match = re.match(r'git@bitbucket\.org:([\w\-\.]+/[\w\-\.]+)(?:\.git)?', url)
            if match:
                return f"https://bitbucket.org/{match.group(1)}.git"
    
    # Ensure .git extension for cloning
    if not url.endswith('.git'):
        url = url + '.git'
    
    return url


# ============================================
# Pydantic Schemas
# ============================================

class RepositoryCreate(BaseModel):
    """Repository creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    full_name: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    type: str = Field(default=RepositoryType.GITHUB.value)
    url: Optional[str] = Field(None, max_length=1000)
    clone_url: Optional[str] = Field(None, max_length=1000)
    default_branch: str = Field(default="main", max_length=100)
    is_private: bool = False
    auto_scan: bool = True
    access_token: Optional[str] = None


class RepositoryUpdate(BaseModel):
    """Repository update schema"""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    default_branch: Optional[str] = Field(None, max_length=100)
    auto_scan: Optional[bool] = None
    access_token: Optional[str] = None


class RepositoryResponse(BaseModel):
    """Repository response schema"""
    id: int
    name: str
    full_name: str
    description: Optional[str]
    type: str
    url: Optional[str]
    default_branch: str
    status: str
    is_private: bool
    auto_scan: bool
    total_scans: int
    secrets_found: int
    last_scan_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class RepositoryListResponse(BaseModel):
    """Paginated repository list response"""
    items: List[RepositoryResponse]
    total: int
    page: int
    page_size: int
    pages: int


# ============================================
# Endpoints
# ============================================

@router.get("", response_model=RepositoryListResponse)
async def list_repositories(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all repositories for the current user.
    """
    query = select(Repository).where(Repository.owner_id == current_user.id)
    count_query = select(func.count(Repository.id)).where(
        Repository.owner_id == current_user.id
    )
    
    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Repository.name.ilike(search_filter)) |
            (Repository.full_name.ilike(search_filter))
        )
        count_query = count_query.where(
            (Repository.name.ilike(search_filter)) |
            (Repository.full_name.ilike(search_filter))
        )
    
    if type:
        query = query.where(Repository.type == type)
        count_query = count_query.where(Repository.type == type)
    
    if status:
        query = query.where(Repository.status == status)
        count_query = count_query.where(Repository.status == status)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Repository.created_at.desc())
    
    result = await db.execute(query)
    repositories = result.scalars().all()
    
    return RepositoryListResponse(
        items=repositories,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )


@router.post("", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def create_repository(
    repo_data: RepositoryCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a new repository for scanning.
    Validates URL format, saves to database, and optionally triggers initial scan.
    """
    logger.info(f"[REPO CREATE] User {current_user.email} attempting to add repository: {repo_data.name}")
    logger.debug(f"[REPO CREATE] Full data: name={repo_data.name}, url={repo_data.url}, type={repo_data.type}")
    
    # Check subscription limits
    can_add, message = await check_can_add_repository(current_user, db)
    if not can_add:
        logger.warning(f"[REPO CREATE] Subscription limit reached for user {current_user.email}: {message}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )
    
    # Validate repository type
    if repo_data.type not in [t.value for t in RepositoryType]:
        logger.error(f"[REPO CREATE] Invalid repository type: {repo_data.type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid repository type. Must be one of: {[t.value for t in RepositoryType]}"
        )
    
    # Validate repository URL format
    if repo_data.url:
        is_valid, error_message = validate_repository_url(repo_data.url, repo_data.type)
        if not is_valid:
            logger.error(f"[REPO CREATE] Invalid URL format: {repo_data.url} - {error_message}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        logger.info(f"[REPO CREATE] URL validated successfully: {repo_data.url}")
    
    # Extract owner/repo from URL if full_name not provided
    if not repo_data.full_name or repo_data.full_name == repo_data.name:
        if repo_data.url:
            owner, repo_name = extract_repo_info_from_url(repo_data.url)
            if owner and repo_name:
                repo_data.full_name = f"{owner}/{repo_name}"
                logger.info(f"[REPO CREATE] Extracted full_name from URL: {repo_data.full_name}")
    
    # Normalize clone URL
    clone_url = repo_data.clone_url
    if not clone_url and repo_data.url:
        clone_url = normalize_clone_url(repo_data.url, repo_data.type)
        logger.info(f"[REPO CREATE] Normalized clone URL: {clone_url}")
    
    # Check if repository already exists
    result = await db.execute(
        select(Repository).where(
            (Repository.owner_id == current_user.id) &
            (Repository.full_name == repo_data.full_name)
        )
    )
    if result.scalar_one_or_none():
        logger.warning(f"[REPO CREATE] Repository already exists: {repo_data.full_name}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository already exists"
        )
    
    repository = Repository(
        name=repo_data.name,
        full_name=repo_data.full_name,
        description=repo_data.description,
        type=repo_data.type,
        url=repo_data.url,
        clone_url=clone_url,  # Use normalized clone URL
        default_branch=repo_data.default_branch,
        is_private=repo_data.is_private,
        auto_scan=repo_data.auto_scan,
        access_token=repo_data.access_token,  # Should be encrypted in production
        owner_id=current_user.id,
        status=RepositoryStatus.ACTIVE.value
    )
    
    try:
        db.add(repository)
        await db.commit()
        await db.refresh(repository)
        logger.info(f"[REPO CREATE] Repository saved to database: id={repository.id}, full_name={repository.full_name}")
    except Exception as e:
        logger.error(f"[REPO CREATE] Failed to save repository to database: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save repository: {str(e)}"
        )
    
    # Auto-trigger initial scan if auto_scan is enabled
    if repo_data.auto_scan and clone_url:
        logger.info(f"[REPO CREATE] Auto-scan enabled, triggering initial scan for repository {repository.id}")
        try:
            from app.api.v1.endpoints.scans import trigger_initial_scan
            background_tasks.add_task(
                trigger_initial_scan,
                repository.id,
                clone_url,
                repo_data.default_branch,
                current_user.id
            )
            logger.info(f"[REPO CREATE] Initial scan queued for repository {repository.id}")
        except Exception as scan_error:
            logger.warning(f"[REPO CREATE] Failed to queue initial scan: {scan_error}")
            # Don't fail the repository creation if scan fails to queue
    
    logger.info(f"[REPO CREATE] Repository created successfully: {repository.full_name} by {current_user.email}")
    
    return repository


@router.get("/{repo_id}", response_model=RepositoryResponse)
async def get_repository(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific repository by ID.
    """
    result = await db.execute(
        select(Repository).where(
            (Repository.id == repo_id) &
            (Repository.owner_id == current_user.id)
        )
    )
    repository = result.scalar_one_or_none()
    
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )
    
    return repository


@router.put("/{repo_id}", response_model=RepositoryResponse)
async def update_repository(
    repo_id: int,
    repo_data: RepositoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a repository.
    """
    result = await db.execute(
        select(Repository).where(
            (Repository.id == repo_id) &
            (Repository.owner_id == current_user.id)
        )
    )
    repository = result.scalar_one_or_none()
    
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )
    
    if repo_data.name is not None:
        repository.name = repo_data.name
    if repo_data.description is not None:
        repository.description = repo_data.description
    if repo_data.default_branch is not None:
        repository.default_branch = repo_data.default_branch
    if repo_data.auto_scan is not None:
        repository.auto_scan = repo_data.auto_scan
    if repo_data.access_token is not None:
        repository.access_token = repo_data.access_token
    
    repository.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(repository)
    
    return repository


@router.delete("/{repo_id}")
async def delete_repository(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a repository and all associated scans.
    """
    result = await db.execute(
        select(Repository).where(
            (Repository.id == repo_id) &
            (Repository.owner_id == current_user.id)
        )
    )
    repository = result.scalar_one_or_none()
    
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )
    
    await db.delete(repository)
    await db.commit()
    
    logger.info(f"Repository deleted: {repository.full_name} by {current_user.email}")
    
    return {"message": "Repository deleted successfully"}


@router.post("/{repo_id}/sync")
async def sync_repository(
    repo_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sync repository metadata from the source (GitHub, GitLab, etc.).
    """
    result = await db.execute(
        select(Repository).where(
            (Repository.id == repo_id) &
            (Repository.owner_id == current_user.id)
        )
    )
    repository = result.scalar_one_or_none()
    
    if not repository:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found"
        )
    
    # TODO: Implement actual sync logic based on repository type
    # background_tasks.add_task(sync_repo_metadata, repository)
    
    return {"message": "Repository sync initiated"}
