"""
Vault Sentry - Application Configuration
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
import secrets


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    APP_NAME: str = "Vault Sentry"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database - Use SQLite for local development, PostgreSQL for production
    DATABASE_URL: str = "sqlite+aiosqlite:///./secret_sentry.db"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Supabase (primary data store)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None  # anon key for frontend, service role for backend
    SUPABASE_SERVICE_KEY: Optional[str] = None  # service role key for bypassing RLS
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    # File Upload
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS: List[str] = [".zip", ".tar.gz", ".tar"]
    
    # Scanning
    SCAN_TIMEOUT: int = 3600  # 1 hour
    MAX_FILE_SIZE_SCAN: int = 10 * 1024 * 1024  # 10MB per file
    EXCLUDED_DIRS: List[str] = [
        "node_modules", ".git", "__pycache__", "venv", 
        ".venv", "dist", "build", ".next", "coverage"
    ]
    EXCLUDED_EXTENSIONS: List[str] = [
        ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg",
        ".woff", ".woff2", ".ttf", ".eot",
        ".mp3", ".mp4", ".avi", ".mov",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx"
    ]
    
    # GitHub Integration
    GITHUB_TOKEN: Optional[str] = None  # Personal Access Token for cloning private repos
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: Optional[str] = None
    
    # AWS Integration
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    
    # Email (for alerts)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "alerts@VaultSentry.io"
    
    # Slack Integration
    SLACK_WEBHOOK_URL: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
