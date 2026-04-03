"""
Vault Sentry - Repository Model
Enhanced with criticality tiers, environment mapping, and team assignment.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, Text, Float, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class RepositoryType(str, enum.Enum):
    """Repository source type"""
    GITHUB = "github"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    LOCAL = "local"
    S3 = "s3"
    AZURE_DEVOPS = "azure_devops"


class RepositoryStatus(str, enum.Enum):
    """Repository connection status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    PENDING = "pending"
    ARCHIVED = "archived"


class CriticalityTier(str, enum.Enum):
    """Repository criticality tier for prioritization"""
    TIER_1 = "tier_1"  # Mission critical
    TIER_2 = "tier_2"  # Business critical
    TIER_3 = "tier_3"  # Important
    TIER_4 = "tier_4"  # Standard
    TIER_5 = "tier_5"  # Low priority


class Repository(Base):
    """Repository model for tracking scanned repositories"""
    
    __tablename__ = "repositories"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(500), nullable=False)  # e.g., "org/repo"
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Repository source
    type: Mapped[str] = mapped_column(
        SQLEnum(RepositoryType, values_callable=lambda obj: [e.value for e in obj]),
        default=RepositoryType.GITHUB.value
    )
    url: Mapped[Optional[str]] = mapped_column(String(1000))
    clone_url: Mapped[Optional[str]] = mapped_column(String(1000))
    default_branch: Mapped[str] = mapped_column(String(100), default="main")
    
    # Status
    status: Mapped[str] = mapped_column(
        SQLEnum(RepositoryStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=RepositoryStatus.PENDING.value
    )
    
    # Scanning configuration
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_scan: Mapped[bool] = mapped_column(Boolean, default=True)
    scan_frequency: Mapped[str] = mapped_column(String(50), default="on_push")  # on_push, daily, weekly
    
    # Criticality and environment
    criticality_tier: Mapped[str] = mapped_column(
        SQLEnum(CriticalityTier, values_callable=lambda obj: [e.value for e in obj]),
        default=CriticalityTier.TIER_4.value
    )
    environment: Mapped[Optional[str]] = mapped_column(String(50))  # production, staging, development
    data_classification: Mapped[Optional[str]] = mapped_column(String(50))  # pii, pci, hipaa, public
    
    # Team assignment
    assigned_team: Mapped[Optional[str]] = mapped_column(String(255))
    team_lead_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    
    # Risk aggregation
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)  # Aggregate risk 0-100
    open_findings_count: Mapped[int] = mapped_column(Integer, default=0)
    critical_findings_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Metrics
    total_scans: Mapped[int] = mapped_column(Integer, default=0)
    secrets_found: Mapped[int] = mapped_column(Integer, default=0)
    last_scan_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Access token (encrypted)
    access_token: Mapped[Optional[str]] = mapped_column(Text)
    
    # External integrations
    github_installation_id: Mapped[Optional[int]] = mapped_column(Integer)
    webhook_secret: Mapped[Optional[str]] = mapped_column(String(255))
    slack_channel: Mapped[Optional[str]] = mapped_column(String(100))
    jira_project_key: Mapped[Optional[str]] = mapped_column(String(20))
    
    # Metadata JSON for extensibility (renamed from 'metadata' which is reserved in SQLAlchemy)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    
    # Owner
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="repositories")
    scans: Mapped[List["Scan"]] = relationship(
        "Scan",
        back_populates="repository",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Repository {self.full_name}>"
    
    def to_dict(self) -> dict:
        """Convert repository to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "full_name": self.full_name,
            "description": self.description,
            "type": self.type,
            "url": self.url,
            "default_branch": self.default_branch,
            "status": self.status,
            "is_private": self.is_private,
            "auto_scan": self.auto_scan,
            "criticality_tier": self.criticality_tier,
            "environment": self.environment,
            "data_classification": self.data_classification,
            "assigned_team": self.assigned_team,
            "risk_score": self.risk_score,
            "open_findings_count": self.open_findings_count,
            "critical_findings_count": self.critical_findings_count,
            "total_scans": self.total_scans,
            "secrets_found": self.secrets_found,
            "last_scan_at": self.last_scan_at.isoformat() if self.last_scan_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "metadata": self.meta_data,
        }
