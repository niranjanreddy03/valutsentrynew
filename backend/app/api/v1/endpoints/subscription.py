"""
Vault Sentry - Subscription Management Endpoints
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from loguru import logger

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.subscription import (
    SubscriptionTier,
    get_tier_limits,
    get_tier_display_name,
    get_tier_price,
    get_all_plans,
    TierLimits,
)
from app.models.user import User
from app.models.repository import Repository
from app.models.scan import Scan


router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================

class SubscriptionStatusResponse(BaseModel):
    """Current subscription status"""
    tier: str
    tier_display_name: str
    is_trial: bool
    trial_ends_at: Optional[datetime]
    subscription_started_at: Optional[datetime]
    subscription_expires_at: Optional[datetime]
    
    # Usage
    repositories_used: int
    repositories_limit: int
    scans_this_week: int
    scans_week_limit: int
    scans_today: int
    scans_day_limit: int
    
    # Computed
    can_add_repository: bool
    can_run_scan: bool
    usage_percentage: float


class SubscriptionLimitsResponse(BaseModel):
    """Subscription limits for current tier"""
    max_repositories: int
    scans_per_week: int
    max_scans_per_day: int
    history_retention_days: int
    
    # Features
    slack_integration: bool
    jira_integration: bool
    github_app_integration: bool
    aws_integration: bool
    auto_rotation: bool
    ml_risk_scoring: bool
    custom_patterns: bool
    api_access: bool
    webhook_notifications: bool
    scheduled_scans: bool
    team_management: bool
    priority_support: bool
    export_reports: bool
    audit_logs: bool
    sso_enabled: bool
    custom_branding: bool
    deep_scan: bool
    entropy_analysis: bool
    pr_scanning: bool
    realtime_alerts: bool


class PlanInfo(BaseModel):
    """Plan information for display"""
    id: str
    name: str
    tier: str
    price: dict
    limits: dict
    features: dict


class UpgradeRequest(BaseModel):
    """Upgrade subscription request"""
    tier: str
    payment_method_id: Optional[str] = None


# ============================================
# Helper Functions
# ============================================

async def get_user_repository_count(user_id: int, db: AsyncSession) -> int:
    """Get the count of repositories for a user"""
    result = await db.execute(
        select(func.count(Repository.id)).where(Repository.owner_id == user_id)
    )
    return result.scalar() or 0


async def reset_user_scan_counters(user: User, db: AsyncSession) -> User:
    """Reset scan counters if needed based on date"""
    now = datetime.utcnow()
    
    # Reset daily counter
    if user.last_scan_reset_date is None or user.last_scan_reset_date.date() < now.date():
        user.scans_today = 0
        user.last_scan_reset_date = now
    
    # Reset weekly counter (reset on Monday)
    if user.last_weekly_reset_date is None:
        user.last_weekly_reset_date = now
        user.scans_this_week = 0
    else:
        # Check if we've crossed into a new week
        days_since_reset = (now - user.last_weekly_reset_date).days
        if days_since_reset >= 7:
            user.scans_this_week = 0
            user.last_weekly_reset_date = now
    
    await db.commit()
    await db.refresh(user)
    return user


async def check_can_run_scan(user: User, db: AsyncSession) -> tuple[bool, str]:
    """Check if user can run a scan based on their tier limits"""
    user = await reset_user_scan_counters(user, db)
    
    tier = SubscriptionTier(user.subscription_tier) if user.subscription_tier else SubscriptionTier.BASIC
    limits = get_tier_limits(tier)
    
    # Check daily limit
    if user.scans_today >= limits.max_scans_per_day:
        return False, f"Daily scan limit reached ({limits.max_scans_per_day} scans/day). Upgrade to increase your limit."
    
    # Check weekly limit
    if user.scans_this_week >= limits.scans_per_week:
        return False, f"Weekly scan limit reached ({limits.scans_per_week} scans/week). Upgrade to increase your limit."
    
    return True, "OK"


async def check_can_add_repository(user: User, db: AsyncSession) -> tuple[bool, str]:
    """Check if user can add a new repository based on their tier limits"""
    tier = SubscriptionTier(user.subscription_tier) if user.subscription_tier else SubscriptionTier.BASIC
    limits = get_tier_limits(tier)
    
    repo_count = await get_user_repository_count(user.id, db)
    
    if repo_count >= limits.max_repositories:
        return False, f"Repository limit reached ({limits.max_repositories} repositories). Upgrade to add more repositories."
    
    return True, "OK"


async def increment_scan_counter(user: User, db: AsyncSession):
    """Increment scan counters for user"""
    user = await reset_user_scan_counters(user, db)
    user.scans_today += 1
    user.scans_this_week += 1
    await db.commit()


def check_feature_access(user: User, feature: str) -> tuple[bool, str]:
    """Check if user has access to a specific feature"""
    tier = SubscriptionTier(user.subscription_tier) if user.subscription_tier else SubscriptionTier.BASIC
    limits = get_tier_limits(tier)
    
    feature_map = {
        "slack_integration": limits.slack_integration,
        "jira_integration": limits.jira_integration,
        "github_app_integration": limits.github_app_integration,
        "aws_integration": limits.aws_integration,
        "auto_rotation": limits.auto_rotation,
        "ml_risk_scoring": limits.ml_risk_scoring,
        "custom_patterns": limits.custom_patterns,
        "api_access": limits.api_access,
        "webhook_notifications": limits.webhook_notifications,
        "scheduled_scans": limits.scheduled_scans,
        "team_management": limits.team_management,
        "priority_support": limits.priority_support,
        "export_reports": limits.export_reports,
        "audit_logs": limits.audit_logs,
        "sso_enabled": limits.sso_enabled,
        "custom_branding": limits.custom_branding,
        "deep_scan": limits.deep_scan,
        "entropy_analysis": limits.entropy_analysis,
        "pr_scanning": limits.pr_scanning,
        "realtime_alerts": limits.realtime_alerts,
    }
    
    has_access = feature_map.get(feature, False)
    if not has_access:
        tier_name = get_tier_display_name(tier)
        return False, f"Feature '{feature}' is not available in {tier_name} plan. Please upgrade to access this feature."
    
    return True, "OK"


# ============================================
# Endpoints
# ============================================

@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's subscription status and usage"""
    # Reset counters if needed
    current_user = await reset_user_scan_counters(current_user, db)
    
    tier = SubscriptionTier(current_user.subscription_tier) if current_user.subscription_tier else SubscriptionTier.BASIC
    limits = get_tier_limits(tier)
    
    repo_count = await get_user_repository_count(current_user.id, db)
    
    # Calculate usage percentage
    max_repos = limits.max_repositories if limits.max_repositories < 999999 else 999999
    max_scans = limits.scans_per_week if limits.scans_per_week < 999999 else 999999
    
    repo_usage = (repo_count / max_repos * 100) if max_repos > 0 else 0
    scan_usage = (current_user.scans_this_week / max_scans * 100) if max_scans > 0 else 0
    usage_percentage = max(repo_usage, scan_usage)
    
    can_add_repo, _ = await check_can_add_repository(current_user, db)
    can_scan, _ = await check_can_run_scan(current_user, db)
    
    return SubscriptionStatusResponse(
        tier=tier.value,
        tier_display_name=get_tier_display_name(tier),
        is_trial=current_user.is_trial,
        trial_ends_at=current_user.trial_ends_at,
        subscription_started_at=current_user.subscription_started_at,
        subscription_expires_at=current_user.subscription_expires_at,
        repositories_used=repo_count,
        repositories_limit=limits.max_repositories if limits.max_repositories < 999999 else -1,
        scans_this_week=current_user.scans_this_week,
        scans_week_limit=limits.scans_per_week if limits.scans_per_week < 999999 else -1,
        scans_today=current_user.scans_today,
        scans_day_limit=limits.max_scans_per_day if limits.max_scans_per_day < 999999 else -1,
        can_add_repository=can_add_repo,
        can_run_scan=can_scan,
        usage_percentage=min(usage_percentage, 100),
    )


@router.get("/limits", response_model=SubscriptionLimitsResponse)
async def get_subscription_limits(
    current_user: User = Depends(get_current_user),
):
    """Get current user's subscription limits and available features"""
    tier = SubscriptionTier(current_user.subscription_tier) if current_user.subscription_tier else SubscriptionTier.BASIC
    limits = get_tier_limits(tier)
    
    return SubscriptionLimitsResponse(
        max_repositories=limits.max_repositories,
        scans_per_week=limits.scans_per_week,
        max_scans_per_day=limits.max_scans_per_day,
        history_retention_days=limits.history_retention_days,
        slack_integration=limits.slack_integration,
        jira_integration=limits.jira_integration,
        github_app_integration=limits.github_app_integration,
        aws_integration=limits.aws_integration,
        auto_rotation=limits.auto_rotation,
        ml_risk_scoring=limits.ml_risk_scoring,
        custom_patterns=limits.custom_patterns,
        api_access=limits.api_access,
        webhook_notifications=limits.webhook_notifications,
        scheduled_scans=limits.scheduled_scans,
        team_management=limits.team_management,
        priority_support=limits.priority_support,
        export_reports=limits.export_reports,
        audit_logs=limits.audit_logs,
        sso_enabled=limits.sso_enabled,
        custom_branding=limits.custom_branding,
        deep_scan=limits.deep_scan,
        entropy_analysis=limits.entropy_analysis,
        pr_scanning=limits.pr_scanning,
        realtime_alerts=limits.realtime_alerts,
    )


@router.get("/plans", response_model=list)
async def get_available_plans():
    """Get all available subscription plans"""
    return get_all_plans()


@router.post("/upgrade")
async def upgrade_subscription(
    request: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade user's subscription tier.
    In production, this would integrate with a payment provider like Stripe.
    """
    try:
        new_tier = SubscriptionTier(request.tier)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid tier: {request.tier}"
        )
    
    current_tier = SubscriptionTier(current_user.subscription_tier) if current_user.subscription_tier else SubscriptionTier.BASIC
    
    # Check if it's actually an upgrade
    tier_order = {
        SubscriptionTier.BASIC: 0,
        SubscriptionTier.PREMIUM: 1,
        SubscriptionTier.PREMIUM_PLUS: 2,
    }
    
    if tier_order[new_tier] <= tier_order[current_tier]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only upgrade to a higher tier. Use /downgrade for downgrades."
        )
    
    # In production, process payment here via Stripe or other provider
    # For now, we'll just update the tier directly
    
    current_user.subscription_tier = new_tier.value
    current_user.subscription_started_at = datetime.utcnow()
    current_user.subscription_expires_at = datetime.utcnow() + timedelta(days=30)  # 1 month
    current_user.is_trial = False
    current_user.trial_ends_at = None
    
    await db.commit()
    await db.refresh(current_user)
    
    logger.info(f"User {current_user.email} upgraded to {new_tier.value}")
    
    return {
        "success": True,
        "message": f"Successfully upgraded to {get_tier_display_name(new_tier)}",
        "tier": new_tier.value,
        "expires_at": current_user.subscription_expires_at.isoformat(),
    }


@router.post("/start-trial")
async def start_trial(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a 14-day trial of Premium Plus"""
    if current_user.is_trial:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active trial"
        )
    
    current_tier = SubscriptionTier(current_user.subscription_tier) if current_user.subscription_tier else SubscriptionTier.BASIC
    if current_tier != SubscriptionTier.BASIC:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trial is only available for Basic tier users"
        )
    
    # Check if user has used trial before (could add a has_used_trial field)
    if current_user.trial_ends_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already used your free trial"
        )
    
    trial_end = datetime.utcnow() + timedelta(days=14)
    
    current_user.subscription_tier = SubscriptionTier.PREMIUM_PLUS.value
    current_user.is_trial = True
    current_user.trial_ends_at = trial_end
    current_user.subscription_started_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(current_user)
    
    logger.info(f"User {current_user.email} started Premium Plus trial")
    
    return {
        "success": True,
        "message": "Your 14-day Premium Plus trial has started!",
        "trial_ends_at": trial_end.isoformat(),
    }


@router.get("/check-feature/{feature}")
async def check_feature(
    feature: str,
    current_user: User = Depends(get_current_user),
):
    """Check if user has access to a specific feature"""
    has_access, message = check_feature_access(current_user, feature)
    
    return {
        "feature": feature,
        "has_access": has_access,
        "message": message,
        "tier": current_user.subscription_tier,
    }
