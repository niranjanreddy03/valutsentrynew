"""
Vault Sentry - Subscription Tier Management
Defines subscription plans and their limits
"""

from enum import Enum
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel


class SubscriptionTier(str, Enum):
    """Subscription tier enumeration"""
    BASIC = "basic"
    PREMIUM = "premium"
    PREMIUM_PLUS = "premium_plus"


class TierLimits(BaseModel):
    """Limits for each subscription tier"""
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
    
    # Scan features
    deep_scan: bool
    entropy_analysis: bool
    pr_scanning: bool
    realtime_alerts: bool


# Tier configurations
TIER_LIMITS: Dict[SubscriptionTier, TierLimits] = {
    SubscriptionTier.BASIC: TierLimits(
        # Limits
        max_repositories=1,
        scans_per_week=1,
        max_scans_per_day=1,
        history_retention_days=7,
        
        # Features - Basic has minimal features
        slack_integration=False,
        jira_integration=False,
        github_app_integration=False,
        aws_integration=False,
        auto_rotation=False,
        ml_risk_scoring=False,
        custom_patterns=False,
        api_access=False,
        webhook_notifications=False,
        scheduled_scans=False,
        team_management=False,
        priority_support=False,
        export_reports=False,
        audit_logs=False,
        sso_enabled=False,
        custom_branding=False,
        
        # Scan features
        deep_scan=False,
        entropy_analysis=True,
        pr_scanning=False,
        realtime_alerts=False,
    ),
    
    SubscriptionTier.PREMIUM: TierLimits(
        # Limits
        max_repositories=10,
        scans_per_week=50,
        max_scans_per_day=10,
        history_retention_days=30,
        
        # Features - Premium has most features
        slack_integration=True,
        jira_integration=False,
        github_app_integration=True,
        aws_integration=False,
        auto_rotation=False,
        ml_risk_scoring=True,
        custom_patterns=True,
        api_access=True,
        webhook_notifications=True,
        scheduled_scans=True,
        team_management=False,
        priority_support=False,
        export_reports=True,
        audit_logs=True,
        sso_enabled=False,
        custom_branding=False,
        
        # Scan features
        deep_scan=True,
        entropy_analysis=True,
        pr_scanning=True,
        realtime_alerts=True,
    ),
    
    SubscriptionTier.PREMIUM_PLUS: TierLimits(
        # Limits - Unlimited for premium plus
        max_repositories=999999,
        scans_per_week=999999,
        max_scans_per_day=999999,
        history_retention_days=365,
        
        # Features - All features included
        slack_integration=True,
        jira_integration=True,
        github_app_integration=True,
        aws_integration=True,
        auto_rotation=True,
        ml_risk_scoring=True,
        custom_patterns=True,
        api_access=True,
        webhook_notifications=True,
        scheduled_scans=True,
        team_management=True,
        priority_support=True,
        export_reports=True,
        audit_logs=True,
        sso_enabled=True,
        custom_branding=True,
        
        # Scan features
        deep_scan=True,
        entropy_analysis=True,
        pr_scanning=True,
        realtime_alerts=True,
    ),
}


class SubscriptionInfo(BaseModel):
    """User subscription information"""
    tier: SubscriptionTier
    limits: TierLimits
    started_at: datetime
    expires_at: Optional[datetime]
    is_trial: bool
    trial_ends_at: Optional[datetime]
    
    # Usage tracking
    repositories_used: int
    scans_this_week: int
    scans_today: int


def get_tier_limits(tier: SubscriptionTier) -> TierLimits:
    """Get limits for a specific tier"""
    return TIER_LIMITS.get(tier, TIER_LIMITS[SubscriptionTier.BASIC])


def get_tier_display_name(tier: SubscriptionTier) -> str:
    """Get human-readable tier name"""
    names = {
        SubscriptionTier.BASIC: "Basic",
        SubscriptionTier.PREMIUM: "Premium",
        SubscriptionTier.PREMIUM_PLUS: "Premium Plus",
    }
    return names.get(tier, "Basic")


def get_tier_price(tier: SubscriptionTier) -> Dict[str, Any]:
    """Get pricing information for a tier"""
    prices = {
        SubscriptionTier.BASIC: {
            "monthly": 0,
            "yearly": 0,
            "currency": "USD",
            "label": "Free"
        },
        SubscriptionTier.PREMIUM: {
            "monthly": 29,
            "yearly": 290,
            "currency": "USD",
            "label": "$29/month"
        },
        SubscriptionTier.PREMIUM_PLUS: {
            "monthly": 99,
            "yearly": 990,
            "currency": "USD",
            "label": "$99/month"
        },
    }
    return prices.get(tier, prices[SubscriptionTier.BASIC])


def get_all_plans() -> list:
    """Get all subscription plans with details"""
    plans = []
    for tier in SubscriptionTier:
        limits = get_tier_limits(tier)
        price = get_tier_price(tier)
        plans.append({
            "id": tier.value,
            "name": get_tier_display_name(tier),
            "tier": tier.value,
            "price": price,
            "limits": {
                "max_repositories": limits.max_repositories if limits.max_repositories < 999999 else "Unlimited",
                "scans_per_week": limits.scans_per_week if limits.scans_per_week < 999999 else "Unlimited",
                "max_scans_per_day": limits.max_scans_per_day if limits.max_scans_per_day < 999999 else "Unlimited",
                "history_retention_days": limits.history_retention_days,
            },
            "features": {
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
        })
    return plans
