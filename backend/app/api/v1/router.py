"""
Vault Sentry - API v1 Router
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, users, repositories, scans, secrets, alerts, reports, dashboard, cloud, subscription, github_token

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)

api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)

api_router.include_router(
    repositories.router,
    prefix="/repositories",
    tags=["Repositories"]
)

api_router.include_router(
    scans.router,
    prefix="/scans",
    tags=["Scans"]
)

api_router.include_router(
    secrets.router,
    prefix="/secrets",
    tags=["Secrets"]
)

api_router.include_router(
    alerts.router,
    prefix="/alerts",
    tags=["Alerts"]
)

api_router.include_router(
    reports.router,
    prefix="/reports",
    tags=["Reports"]
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"]
)

api_router.include_router(
    cloud.router,
    prefix="/cloud",
    tags=["Cloud Integration"]
)

api_router.include_router(
    subscription.router,
    prefix="/subscription",
    tags=["Subscription"]
)

api_router.include_router(
    github_token.router,
    prefix="/integrations",
    tags=["Integrations"]
)

