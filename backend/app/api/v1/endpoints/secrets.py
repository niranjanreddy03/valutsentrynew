"""
Vault Sentry - Secrets Management Endpoints
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.scan import Scan
from app.models.secret import Secret, SecretStatus, RiskLevel


router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================

class SecretUpdate(BaseModel):
    """Secret update schema"""
    status: Optional[str] = None
    resolution_notes: Optional[str] = None


class SecretResponse(BaseModel):
    """Secret response schema"""
    id: int
    finding_id: str
    scan_id: int
    type: str
    file_path: str
    line_number: int
    secret_value_masked: str
    code_snippet: Optional[str]
    match_rule: Optional[str]
    risk_level: str
    risk_score: float
    entropy_score: Optional[float]
    is_test_file: bool
    status: str
    first_detected_at: datetime
    last_seen_at: datetime
    
    class Config:
        from_attributes = True


class SecretListResponse(BaseModel):
    """Paginated secret list response"""
    items: List[SecretResponse]
    total: int
    page: int
    page_size: int
    pages: int


class SecretStats(BaseModel):
    """Secret statistics"""
    total: int
    by_status: dict
    by_risk_level: dict
    by_type: dict


# ============================================
# Endpoints
# ============================================

@router.get("", response_model=SecretListResponse)
async def list_secrets(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    scan_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    secret_type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all secrets/findings for the current user.
    """
    # Build query joining secrets with scans to filter by user
    query = (
        select(Secret)
        .join(Scan, Secret.scan_id == Scan.id)
        .where(Scan.user_id == current_user.id)
    )
    count_query = (
        select(func.count(Secret.id))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(Scan.user_id == current_user.id)
    )
    
    # Apply filters
    if scan_id:
        scan_result = await db.execute(
            select(Scan).where(
                (Scan.scan_id == scan_id) &
                (Scan.user_id == current_user.id)
            )
        )
        scan = scan_result.scalar_one_or_none()
        if scan:
            query = query.where(Secret.scan_id == scan.id)
            count_query = count_query.where(Secret.scan_id == scan.id)
    
    if risk_level:
        query = query.where(Secret.risk_level == risk_level)
        count_query = count_query.where(Secret.risk_level == risk_level)
    
    if status:
        query = query.where(Secret.status == status)
        count_query = count_query.where(Secret.status == status)
    
    if secret_type:
        query = query.where(Secret.type == secret_type)
        count_query = count_query.where(Secret.type == secret_type)
    
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Secret.file_path.ilike(search_filter)) |
            (Secret.match_rule.ilike(search_filter))
        )
        count_query = count_query.where(
            (Secret.file_path.ilike(search_filter)) |
            (Secret.match_rule.ilike(search_filter))
        )
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Secret.risk_score.desc())
    
    result = await db.execute(query)
    secrets = result.scalars().all()
    
    return SecretListResponse(
        items=secrets,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )


@router.get("/stats", response_model=SecretStats)
async def get_secret_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get statistics about secrets/findings.
    """
    # Total count
    total_query = (
        select(func.count(Secret.id))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(Scan.user_id == current_user.id)
    )
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0
    
    # Count by status
    by_status = {}
    for s in SecretStatus:
        status_query = (
            select(func.count(Secret.id))
            .join(Scan, Secret.scan_id == Scan.id)
            .where(
                (Scan.user_id == current_user.id) &
                (Secret.status == s.value)
            )
        )
        result = await db.execute(status_query)
        by_status[s.value] = result.scalar() or 0
    
    # Count by risk level
    by_risk_level = {}
    for r in RiskLevel:
        risk_query = (
            select(func.count(Secret.id))
            .join(Scan, Secret.scan_id == Scan.id)
            .where(
                (Scan.user_id == current_user.id) &
                (Secret.risk_level == r.value)
            )
        )
        result = await db.execute(risk_query)
        by_risk_level[r.value] = result.scalar() or 0
    
    # Count by type (top 10)
    type_query = (
        select(Secret.type, func.count(Secret.id).label('count'))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(Scan.user_id == current_user.id)
        .group_by(Secret.type)
        .order_by(func.count(Secret.id).desc())
        .limit(10)
    )
    type_result = await db.execute(type_query)
    by_type = {row[0]: row[1] for row in type_result.all()}
    
    return SecretStats(
        total=total,
        by_status=by_status,
        by_risk_level=by_risk_level,
        by_type=by_type
    )


@router.get("/{finding_id}", response_model=SecretResponse)
async def get_secret(
    finding_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific secret by finding ID.
    """
    result = await db.execute(
        select(Secret)
        .join(Scan, Secret.scan_id == Scan.id)
        .where(
            (Secret.finding_id == finding_id) &
            (Scan.user_id == current_user.id)
        )
    )
    secret = result.scalar_one_or_none()
    
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Secret not found"
        )
    
    return secret


@router.put("/{finding_id}", response_model=SecretResponse)
async def update_secret(
    finding_id: str,
    secret_data: SecretUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a secret's status (resolve, mark as false positive, etc.).
    """
    result = await db.execute(
        select(Secret)
        .join(Scan, Secret.scan_id == Scan.id)
        .where(
            (Secret.finding_id == finding_id) &
            (Scan.user_id == current_user.id)
        )
    )
    secret = result.scalar_one_or_none()
    
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Secret not found"
        )
    
    if secret_data.status is not None:
        if secret_data.status not in [s.value for s in SecretStatus]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {[s.value for s in SecretStatus]}"
            )
        secret.status = secret_data.status
        
        if secret_data.status == SecretStatus.RESOLVED.value:
            secret.resolved_by = current_user.id
            secret.resolved_at = datetime.utcnow()
    
    if secret_data.resolution_notes is not None:
        secret.resolution_notes = secret_data.resolution_notes
    
    await db.commit()
    await db.refresh(secret)
    
    logger.info(f"Secret updated: {finding_id} by {current_user.email}")
    
    return secret


@router.post("/bulk-update")
async def bulk_update_secrets(
    finding_ids: List[str],
    status: str,
    resolution_notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk update multiple secrets.
    """
    if status not in [s.value for s in SecretStatus]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {[s.value for s in SecretStatus]}"
        )
    
    updated_count = 0
    for finding_id in finding_ids:
        result = await db.execute(
            select(Secret)
            .join(Scan, Secret.scan_id == Scan.id)
            .where(
                (Secret.finding_id == finding_id) &
                (Scan.user_id == current_user.id)
            )
        )
        secret = result.scalar_one_or_none()
        
        if secret:
            secret.status = status
            if resolution_notes:
                secret.resolution_notes = resolution_notes
            if status == SecretStatus.RESOLVED.value:
                secret.resolved_by = current_user.id
                secret.resolved_at = datetime.utcnow()
            updated_count += 1
    
    await db.commit()
    
    return {"message": f"Updated {updated_count} secrets"}
