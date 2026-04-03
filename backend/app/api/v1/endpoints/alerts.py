"""
Vault Sentry - Alert Management Endpoints
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from pydantic import BaseModel
from loguru import logger
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.alert import Alert, AlertType, AlertSeverity


router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================

class AlertResponse(BaseModel):
    """Alert response schema"""
    id: int
    alert_id: str
    type: str
    severity: str
    title: str
    message: str
    repository_id: Optional[int]
    scan_id: Optional[int]
    secret_id: Optional[int]
    is_read: bool
    is_dismissed: bool
    created_at: datetime
    read_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """Paginated alert list response"""
    items: List[AlertResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    pages: int


# ============================================
# Endpoints
# ============================================

@router.get("", response_model=AlertListResponse)
async def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    severity: Optional[str] = None,
    is_read: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all alerts for the current user.
    """
    query = select(Alert).where(
        (Alert.user_id == current_user.id) &
        (Alert.is_dismissed == False)
    )
    count_query = select(func.count(Alert.id)).where(
        (Alert.user_id == current_user.id) &
        (Alert.is_dismissed == False)
    )
    
    # Apply filters
    if type:
        query = query.where(Alert.type == type)
        count_query = count_query.where(Alert.type == type)
    
    if severity:
        query = query.where(Alert.severity == severity)
        count_query = count_query.where(Alert.severity == severity)
    
    if is_read is not None:
        query = query.where(Alert.is_read == is_read)
        count_query = count_query.where(Alert.is_read == is_read)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Get unread count
    unread_query = select(func.count(Alert.id)).where(
        (Alert.user_id == current_user.id) &
        (Alert.is_read == False) &
        (Alert.is_dismissed == False)
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Alert.created_at.desc())
    
    result = await db.execute(query)
    alerts = result.scalars().all()
    
    return AlertListResponse(
        items=alerts,
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the count of unread alerts.
    """
    result = await db.execute(
        select(func.count(Alert.id)).where(
            (Alert.user_id == current_user.id) &
            (Alert.is_read == False) &
            (Alert.is_dismissed == False)
        )
    )
    count = result.scalar()
    
    return {"unread_count": count}


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific alert.
    """
    result = await db.execute(
        select(Alert).where(
            (Alert.alert_id == alert_id) &
            (Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    return alert


@router.post("/{alert_id}/read")
async def mark_alert_read(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark an alert as read.
    """
    result = await db.execute(
        select(Alert).where(
            (Alert.alert_id == alert_id) &
            (Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    alert.is_read = True
    alert.read_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Alert marked as read"}


@router.post("/mark-all-read")
async def mark_all_alerts_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark all alerts as read.
    """
    await db.execute(
        update(Alert)
        .where(
            (Alert.user_id == current_user.id) &
            (Alert.is_read == False)
        )
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()
    
    return {"message": "All alerts marked as read"}


@router.post("/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Dismiss an alert.
    """
    result = await db.execute(
        select(Alert).where(
            (Alert.alert_id == alert_id) &
            (Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    alert.is_dismissed = True
    await db.commit()
    
    return {"message": "Alert dismissed"}


@router.delete("/{alert_id}")
async def delete_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete an alert.
    """
    result = await db.execute(
        select(Alert).where(
            (Alert.alert_id == alert_id) &
            (Alert.user_id == current_user.id)
        )
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
    
    await db.delete(alert)
    await db.commit()
    
    return {"message": "Alert deleted"}


# Helper function to create alerts (used internally)
async def create_alert(
    db: AsyncSession,
    user_id: int,
    type: AlertType,
    severity: AlertSeverity,
    title: str,
    message: str,
    repository_id: int = None,
    scan_id: int = None,
    secret_id: int = None,
    metadata: dict = None
) -> Alert:
    """
    Create a new alert.
    """
    alert = Alert(
        alert_id=str(uuid.uuid4()),
        user_id=user_id,
        type=type.value,
        severity=severity.value,
        title=title,
        message=message,
        repository_id=repository_id,
        scan_id=scan_id,
        secret_id=secret_id,
        metadata=metadata
    )
    
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    
    return alert
