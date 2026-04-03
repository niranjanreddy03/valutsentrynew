"""
Vault Sentry - Scan Model
Enhanced with external scanner support and ML scoring.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, Float, Enum as SQLEnum, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class ScanStatus(str, enum.Enum):
    """Scan execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PARTIAL = "partial"  # Completed with some errors


class ScanTrigger(str, enum.Enum):
    """What triggered the scan"""
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    WEBHOOK = "webhook"
    CI_CD = "ci_cd"
    API = "api"
    PULL_REQUEST = "pull_request"


class Scan(Base):
    """Scan model for tracking repository scans"""
    
    __tablename__ = "scans"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scan_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    # Scan target
    repository_id: Mapped[Optional[int]] = mapped_column(ForeignKey("repositories.id"))
    target_path: Mapped[Optional[str]] = mapped_column(String(1000))
    branch: Mapped[Optional[str]] = mapped_column(String(100))
    commit_hash: Mapped[Optional[str]] = mapped_column(String(64))
    
    # User who initiated
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Scan configuration
    trigger: Mapped[str] = mapped_column(
        SQLEnum(ScanTrigger, values_callable=lambda obj: [e.value for e in obj]),
        default=ScanTrigger.MANUAL.value
    )
    scan_config: Mapped[Optional[dict]] = mapped_column(JSON)  # Custom scan rules
    
    # Status
    status: Mapped[str] = mapped_column(
        SQLEnum(ScanStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=ScanStatus.PENDING.value
    )
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    
    # Results summary
    files_scanned: Mapped[int] = mapped_column(Integer, default=0)
    total_findings: Mapped[int] = mapped_column(Integer, default=0)
    high_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    medium_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    low_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Risk score (0-100, higher = more risk)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float)
    
    # Scanner information
    scanners_used: Mapped[Optional[List[str]]] = mapped_column(JSON)  # ['builtin', 'trufflehog', 'gitleaks']
    scanner_versions: Mapped[Optional[Dict[str, str]]] = mapped_column(JSON)
    
    # ML scoring
    ml_scored: Mapped[bool] = mapped_column(Boolean, default=False)
    ml_model_version: Mapped[Optional[str]] = mapped_column(String(50))
    
    # PR integration
    pr_number: Mapped[Optional[int]] = mapped_column(Integer)
    pr_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    check_run_id: Mapped[Optional[int]] = mapped_column(Integer)  # GitHub Check Run ID
    
    # Metadata for extensibility (renamed from 'metadata' which is reserved in SQLAlchemy)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    
    # Relationships
    repository: Mapped[Optional["Repository"]] = relationship(
        "Repository",
        back_populates="scans"
    )
    user: Mapped["User"] = relationship("User", back_populates="scans")
    secrets: Mapped[List["Secret"]] = relationship(
        "Secret",
        back_populates="scan",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Scan {self.scan_id} - {self.status}>"
    
    def to_dict(self) -> dict:
        """Convert scan to dictionary"""
        return {
            "id": self.id,
            "scan_id": self.scan_id,
            "repository_id": self.repository_id,
            "target_path": self.target_path,
            "branch": self.branch,
            "commit_hash": self.commit_hash,
            "trigger": self.trigger,
            "status": self.status,
            "progress": self.progress,
            "files_scanned": self.files_scanned,
            "total_findings": self.total_findings,
            "high_risk_count": self.high_risk_count,
            "medium_risk_count": self.medium_risk_count,
            "low_risk_count": self.low_risk_count,
            "risk_score": self.risk_score,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_seconds": self.duration_seconds,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
