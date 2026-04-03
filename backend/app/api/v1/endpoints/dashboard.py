"""
Vault Sentry - Dashboard Endpoints
Provides data for the dashboard UI
"""

from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from pydantic import BaseModel
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.repository import Repository
from app.models.scan import Scan, ScanStatus
from app.models.secret import Secret, SecretStatus
from app.models.alert import Alert


router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================

class DashboardStats(BaseModel):
    """Dashboard statistics cards data"""
    total_scans: int
    secrets_found: int
    high_risk_issues: int
    repositories_monitored: int
    scans_this_week: int
    secrets_resolved: int
    average_risk_score: float
    scan_success_rate: float


class RiskDistribution(BaseModel):
    """Risk level distribution for pie chart"""
    critical: int
    high: int
    medium: int
    low: int
    info: int


class ScanActivity(BaseModel):
    """Scan activity data point"""
    date: str
    scans: int
    findings: int


class RecentScan(BaseModel):
    """Recent scan summary"""
    scan_id: str
    repository_name: Optional[str]
    status: str
    findings_count: int
    high_risk_count: int
    created_at: datetime
    duration_seconds: Optional[float]


class TopSecret(BaseModel):
    """Top secret finding"""
    id: int
    finding_id: str
    type: str
    file_path: str
    risk_level: str
    risk_score: float
    status: str
    created_at: datetime


class DashboardData(BaseModel):
    """Complete dashboard data response"""
    stats: DashboardStats
    risk_distribution: RiskDistribution
    scan_activity: List[ScanActivity]
    recent_scans: List[RecentScan]
    top_secrets: List[TopSecret]
    recent_alerts_count: int


# ============================================
# Endpoints
# ============================================

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get dashboard statistics for the stat cards.
    """
    # Total scans
    total_scans_result = await db.execute(
        select(func.count(Scan.id)).where(Scan.user_id == current_user.id)
    )
    total_scans = total_scans_result.scalar() or 0
    
    # Total secrets found
    secrets_result = await db.execute(
        select(func.count(Secret.id))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(Scan.user_id == current_user.id)
    )
    secrets_found = secrets_result.scalar() or 0
    
    # High risk issues (critical + high)
    high_risk_result = await db.execute(
        select(func.count(Secret.id))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(
            (Scan.user_id == current_user.id) &
            (Secret.risk_level.in_(['critical', 'high'])) &
            (Secret.status == 'open')
        )
    )
    high_risk_issues = high_risk_result.scalar() or 0
    
    # Repositories monitored
    repos_result = await db.execute(
        select(func.count(Repository.id)).where(Repository.owner_id == current_user.id)
    )
    repositories_monitored = repos_result.scalar() or 0
    
    # Scans this week
    week_ago = datetime.utcnow() - timedelta(days=7)
    scans_week_result = await db.execute(
        select(func.count(Scan.id)).where(
            (Scan.user_id == current_user.id) &
            (Scan.created_at >= week_ago)
        )
    )
    scans_this_week = scans_week_result.scalar() or 0
    
    # Secrets resolved
    resolved_result = await db.execute(
        select(func.count(Secret.id))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(
            (Scan.user_id == current_user.id) &
            (Secret.status == 'resolved')
        )
    )
    secrets_resolved = resolved_result.scalar() or 0
    
    # Average risk score
    avg_risk_result = await db.execute(
        select(func.avg(Secret.risk_score))
        .join(Scan, Secret.scan_id == Scan.id)
        .where(
            (Scan.user_id == current_user.id) &
            (Secret.status == 'open')
        )
    )
    average_risk_score = avg_risk_result.scalar() or 0
    
    # Scan success rate
    completed_scans = await db.execute(
        select(func.count(Scan.id)).where(
            (Scan.user_id == current_user.id) &
            (Scan.status == ScanStatus.COMPLETED.value)
        )
    )
    completed = completed_scans.scalar() or 0
    scan_success_rate = (completed / total_scans * 100) if total_scans > 0 else 100
    
    return DashboardStats(
        total_scans=total_scans,
        secrets_found=secrets_found,
        high_risk_issues=high_risk_issues,
        repositories_monitored=repositories_monitored,
        scans_this_week=scans_this_week,
        secrets_resolved=secrets_resolved,
        average_risk_score=float(average_risk_score),
        scan_success_rate=float(scan_success_rate)
    )


@router.get("/risk-distribution", response_model=RiskDistribution)
async def get_risk_distribution(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get risk level distribution for pie chart.
    """
    distribution = {}
    
    for level in ['critical', 'high', 'medium', 'low', 'info']:
        result = await db.execute(
            select(func.count(Secret.id))
            .join(Scan, Secret.scan_id == Scan.id)
            .where(
                (Scan.user_id == current_user.id) &
                (Secret.risk_level == level) &
                (Secret.status == 'open')
            )
        )
        distribution[level] = result.scalar() or 0
    
    return RiskDistribution(**distribution)


@router.get("/scan-activity", response_model=List[ScanActivity])
async def get_scan_activity(
    days: int = Query(30, ge=7, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get scan activity over time for line chart.
    """
    activity = []
    start_date = datetime.utcnow() - timedelta(days=days)
    
    for i in range(days):
        date = start_date + timedelta(days=i)
        date_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        date_end = date_start + timedelta(days=1)
        
        # Count scans
        scans_result = await db.execute(
            select(func.count(Scan.id)).where(
                (Scan.user_id == current_user.id) &
                (Scan.created_at >= date_start) &
                (Scan.created_at < date_end)
            )
        )
        scans_count = scans_result.scalar() or 0
        
        # Count findings
        findings_result = await db.execute(
            select(func.count(Secret.id))
            .join(Scan, Secret.scan_id == Scan.id)
            .where(
                (Scan.user_id == current_user.id) &
                (Secret.first_detected_at >= date_start) &
                (Secret.first_detected_at < date_end)
            )
        )
        findings_count = findings_result.scalar() or 0
        
        activity.append(ScanActivity(
            date=date_start.strftime('%Y-%m-%d'),
            scans=scans_count,
            findings=findings_count
        ))
    
    return activity


@router.get("/recent-scans", response_model=List[RecentScan])
async def get_recent_scans(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent scans list.
    """
    result = await db.execute(
        select(Scan)
        .where(Scan.user_id == current_user.id)
        .order_by(desc(Scan.created_at))
        .limit(limit)
    )
    scans = result.scalars().all()
    
    recent_scans = []
    for scan in scans:
        # Get repository name if available
        repo_name = None
        if scan.repository_id:
            repo_result = await db.execute(
                select(Repository.name).where(Repository.id == scan.repository_id)
            )
            repo_name = repo_result.scalar_one_or_none()
        
        recent_scans.append(RecentScan(
            scan_id=scan.scan_id,
            repository_name=repo_name or scan.target_path,
            status=scan.status,
            findings_count=scan.total_findings,
            high_risk_count=scan.high_risk_count,
            created_at=scan.created_at,
            duration_seconds=scan.duration_seconds
        ))
    
    return recent_scans


@router.get("/top-secrets", response_model=List[TopSecret])
async def get_top_secrets(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get top secrets by risk score.
    """
    result = await db.execute(
        select(Secret)
        .join(Scan, Secret.scan_id == Scan.id)
        .where(
            (Scan.user_id == current_user.id) &
            (Secret.status == 'open')
        )
        .order_by(desc(Secret.risk_score))
        .limit(limit)
    )
    secrets = result.scalars().all()
    
    return [
        TopSecret(
            id=s.id,
            finding_id=s.finding_id,
            type=s.type,
            file_path=s.file_path,
            risk_level=s.risk_level,
            risk_score=s.risk_score,
            status=s.status,
            created_at=s.first_detected_at
        )
        for s in secrets
    ]


@router.get("", response_model=DashboardData)
async def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all dashboard data in a single request.
    """
    # Get all data
    stats = await get_dashboard_stats(current_user, db)
    risk_distribution = await get_risk_distribution(current_user, db)
    scan_activity = await get_scan_activity(30, current_user, db)
    recent_scans = await get_recent_scans(10, current_user, db)
    top_secrets = await get_top_secrets(10, current_user, db)
    
    # Get recent alerts count
    alerts_result = await db.execute(
        select(func.count(Alert.id)).where(
            (Alert.user_id == current_user.id) &
            (Alert.is_read == False) &
            (Alert.is_dismissed == False)
        )
    )
    recent_alerts_count = alerts_result.scalar() or 0
    
    return DashboardData(
        stats=stats,
        risk_distribution=risk_distribution,
        scan_activity=scan_activity,
        recent_scans=recent_scans,
        top_secrets=top_secrets,
        recent_alerts_count=recent_alerts_count
    )
