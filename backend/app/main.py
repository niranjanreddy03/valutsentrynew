"""
Vault Sentry - Main FastAPI Application
Cloud-Native Secret Detection & Security Platform
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
import sys

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import api_router
from app.middleware.rate_limiter import RateLimitMiddleware


# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)
logger.add(
    "logs/secret_sentry.log",
    rotation="500 MB",
    retention="10 days",
    level="INFO"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("[*] Starting Vault Sentry API Server...")
    await init_db()
    logger.info("[+] Database initialized successfully")
    yield
    logger.info("[x] Shutting down Vault Sentry API Server...")


app = FastAPI(
    title="Vault Sentry API",
    description="""
    🛡️ **Vault Sentry** - Cloud-Native Secret Detection & Security Platform
    
    Automatically scan code repositories, cloud storage, and CI/CD pipelines 
    to detect exposed API keys, credentials, secrets, and sensitive configuration files.
    
    ## Features
    
    * 🔍 **Secret Detection** - Regex patterns + Shannon entropy analysis
    * 📊 **Risk Scoring** - High, Medium, Low severity classification
    * 🔐 **JWT Authentication** - Secure role-based access control
    * 📈 **Analytics** - Real-time scanning metrics and trends
    * 📄 **Reports** - Generate PDF compliance reports
    
    ## Authentication
    
    All API endpoints (except auth) require a valid JWT token.
    Include the token in the `Authorization` header: `Bearer <token>`
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


# Include API Router
app.include_router(api_router, prefix="/api/v1")


# Health Check Endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "secret-sentry-api",
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "name": "Vault Sentry API",
        "version": "1.0.0",
        "description": "Cloud-Native Secret Detection & Security Platform",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
