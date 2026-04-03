"""
Vault Sentry - Alert Model
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, Boolean, Enum as SQLEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.core.database import Base


class AlertType(str, enum.Enum):
    """Type of alert"""
    SECRET_DETECTED = "secret_detected"
    HIGH_RISK_FINDING = "high_risk_finding"
    SCAN_COMPLETED = "scan_completed"
    SCAN_FAILED = "scan_failed"
    NEW_REPOSITORY = "new_repository"
    THRESHOLD_EXCEEDED = "threshold_exceeded"
    SYSTEM = "system"


class AlertSeverity(str, enum.Enum):
    """Alert severity level"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class AlertChannel(str, enum.Enum):
    """Notification channel"""
    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"
    IN_APP = "in_app"


class Alert(Base):
    """Alert model for notifications"""
    
    __tablename__ = "alerts"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    alert_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    # User reference
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # Alert details
    type: Mapped[str] = mapped_column(
        SQLEnum(AlertType, values_callable=lambda obj: [e.value for e in obj]),
        default=AlertType.SECRET_DETECTED.value,
        index=True
    )
    severity: Mapped[str] = mapped_column(
        SQLEnum(AlertSeverity, values_callable=lambda obj: [e.value for e in obj]),
        default=AlertSeverity.INFO.value
    )
    
    # Content
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Related entities
    repository_id: Mapped[Optional[int]] = mapped_column(ForeignKey("repositories.id"))
    scan_id: Mapped[Optional[int]] = mapped_column(Integer)
    secret_id: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Extra data
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON)
    
    # Notification status
    channels: Mapped[Optional[list]] = mapped_column(JSON)  # List of channels notified
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Delivery tracking
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    slack_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    webhook_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="alerts")
    
    def __repr__(self) -> str:
        return f"<Alert {self.type} - {self.title}>"
    
    def to_dict(self) -> dict:
        """Convert alert to dictionary"""
        return {
            "id": self.id,
            "alert_id": self.alert_id,
            "user_id": self.user_id,
            "type": self.type,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "repository_id": self.repository_id,
            "scan_id": self.scan_id,
            "secret_id": self.secret_id,
            "extra_data": self.extra_data,
            "is_read": self.is_read,
            "is_dismissed": self.is_dismissed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None
        }
