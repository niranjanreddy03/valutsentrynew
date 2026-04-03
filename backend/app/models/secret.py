"""
Vault Sentry - Secret (Finding) Model
Enhanced with ML scoring, lifecycle tracking, and business impact assessment.
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, Float, Boolean, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class SecretType(str, enum.Enum):
    """Type of secret detected"""
    AWS_ACCESS_KEY = "aws_access_key"
    AWS_SECRET_KEY = "aws_secret_key"
    GOOGLE_API_KEY = "google_api_key"
    GITHUB_TOKEN = "github_token"
    PRIVATE_KEY = "private_key"
    JWT_TOKEN = "jwt_token"
    PASSWORD = "password"
    DATABASE_URL = "database_url"
    API_KEY = "api_key"
    OAUTH_TOKEN = "oauth_token"
    STRIPE_KEY = "stripe_key"
    SENDGRID_KEY = "sendgrid_key"
    SLACK_TOKEN = "slack_token"
    TWILIO_KEY = "twilio_key"
    AZURE_KEY = "azure_key"
    GENERIC_SECRET = "generic_secret"
    HIGH_ENTROPY = "high_entropy"


class RiskLevel(str, enum.Enum):
    """Risk severity level"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class SecretStatus(str, enum.Enum):
    """Secret remediation status"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"
    IGNORED = "ignored"


class Secret(Base):
    """Secret model for storing detected secrets/findings"""
    
    __tablename__ = "secrets"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    finding_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    # Scan reference
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id"), nullable=False)
    
    # Secret details
    type: Mapped[str] = mapped_column(
        SQLEnum(SecretType, values_callable=lambda obj: [e.value for e in obj]),
        default=SecretType.GENERIC_SECRET.value,
        index=True
    )
    
    # Location
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    column_start: Mapped[Optional[int]] = mapped_column(Integer)
    column_end: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Content (masked/truncated for security)
    secret_value_masked: Mapped[str] = mapped_column(Text, nullable=False)  # e.g., "AKIA****WXYZ"
    secret_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA256 hash for deduplication
    
    # Context
    code_snippet: Mapped[Optional[str]] = mapped_column(Text)  # Surrounding code context
    match_rule: Mapped[Optional[str]] = mapped_column(String(255))  # Which rule matched
    
    # Risk assessment
    risk_level: Mapped[str] = mapped_column(
        SQLEnum(RiskLevel, values_callable=lambda obj: [e.value for e in obj]),
        default=RiskLevel.MEDIUM.value,
        index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, default=50.0)  # 0-100
    
    # Additional risk factors
    entropy_score: Mapped[Optional[float]] = mapped_column(Float)
    is_test_file: Mapped[bool] = mapped_column(Boolean, default=False)
    is_example: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # ML-driven scoring
    ml_risk_score: Mapped[Optional[float]] = mapped_column(Float)  # ML model score 0-100
    confidence: Mapped[float] = mapped_column(Float, default=80.0)  # Detection confidence 0-100
    business_impact_score: Mapped[float] = mapped_column(Float, default=50.0)  # Business impact 0-100
    
    # Environment and context
    environment: Mapped[Optional[str]] = mapped_column(String(50))  # production, staging, development, test
    branch: Mapped[Optional[str]] = mapped_column(String(255))
    commit_hash: Mapped[Optional[str]] = mapped_column(String(64))
    commit_author: Mapped[Optional[str]] = mapped_column(String(255))
    commit_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Assignment and workflow
    assigned_team: Mapped[Optional[str]] = mapped_column(String(255))
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    priority: Mapped[int] = mapped_column(Integer, default=50)  # 1-100, higher = more urgent
    sla_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    
    # Lifecycle tracking
    days_open: Mapped[int] = mapped_column(Integer, default=0)
    rotation_count: Mapped[int] = mapped_column(Integer, default=0)
    last_rotated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    auto_rotated: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # External links
    jira_issue_key: Mapped[Optional[str]] = mapped_column(String(50))
    jira_issue_url: Mapped[Optional[str]] = mapped_column(String(500))
    slack_thread_ts: Mapped[Optional[str]] = mapped_column(String(50))
    pr_number: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Metadata JSON for extensibility (renamed from 'metadata' which is reserved in SQLAlchemy)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Status
    status: Mapped[str] = mapped_column(
        SQLEnum(SecretStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=SecretStatus.OPEN.value,
        index=True
    )
    
    # Remediation
    resolved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
    
    # Timestamps
    first_detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    
    # Relationships
    scan: Mapped["Scan"] = relationship("Scan", back_populates="secrets")
    assigned_user: Mapped[Optional["User"]] = relationship(
        "User", 
        foreign_keys=[assigned_user_id],
        backref="assigned_secrets"
    )
    
    def __repr__(self) -> str:
        return f"<Secret {self.type} in {self.file_path}:{self.line_number}>"
    
    def to_dict(self) -> dict:
        """Convert secret to dictionary"""
        return {
            "id": self.id,
            "finding_id": self.finding_id,
            "scan_id": self.scan_id,
            "type": self.type,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "secret_value_masked": self.secret_value_masked,
            "code_snippet": self.code_snippet,
            "match_rule": self.match_rule,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "ml_risk_score": self.ml_risk_score,
            "entropy_score": self.entropy_score,
            "confidence": self.confidence,
            "business_impact_score": self.business_impact_score,
            "environment": self.environment,
            "branch": self.branch,
            "commit_hash": self.commit_hash,
            "assigned_team": self.assigned_team,
            "assigned_user_id": self.assigned_user_id,
            "priority": self.priority,
            "sla_due_at": self.sla_due_at.isoformat() if self.sla_due_at else None,
            "days_open": self.days_open,
            "rotation_count": self.rotation_count,
            "is_test_file": self.is_test_file,
            "status": self.status,
            "jira_issue_key": self.jira_issue_key,
            "pr_number": self.pr_number,
            "first_detected_at": self.first_detected_at.isoformat() if self.first_detected_at else None,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "acknowledged_at": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "metadata": self.meta_data,
        }
    
    def calculate_priority(self) -> int:
        """Calculate dynamic priority based on multiple factors"""
        priority = 50
        
        # Risk score contribution (0-30)
        priority += int((self.risk_score or 50) * 0.3)
        
        # Business impact contribution (0-20)
        priority += int((self.business_impact_score or 50) * 0.2)
        
        # Environment multiplier
        env_multipliers = {
            'production': 1.5,
            'staging': 1.2,
            'development': 1.0,
            'test': 0.5,
        }
        if self.environment:
            priority = int(priority * env_multipliers.get(self.environment.lower(), 1.0))
        
        # Aging factor (older secrets get higher priority)
        if self.days_open > 30:
            priority += min(self.days_open // 10, 20)
        
        return min(max(priority, 1), 100)

