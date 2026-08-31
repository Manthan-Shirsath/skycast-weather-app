"""
User Alert Subscription Model
Stores location-based alert subscriptions for proactive notifications.
"""

import uuid
import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    JSON,
    DateTime,
    Index,
    ForeignKey
)
from sqlalchemy.orm import relationship
from backend.app.models.weather_snapshot import Base


class AlertSubscription(Base):
    """
    User alert subscription for a location.
    Enables proactive alerts when risk tier crosses a threshold.
    """
    __tablename__ = "alert_subscriptions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(100), nullable=True, index=True)  # Optional: session-based
    session_id = Column(String(100), nullable=True, index=True)  # WebSocket session for push
    location = Column(String(100), nullable=False, index=True)
    latitude = Column(Integer, nullable=True)  # Optional: for coordinate-based subscriptions
    longitude = Column(Integer, nullable=True)

    # User role for role-adaptive alert formatting
    user_role = Column(String(50), nullable=False, default="general_public")

    # Preferred language for alerts
    language = Column(String(20), nullable=False, default="en")

    # Alert channel preferences (which channels to use)
    channels = Column(JSON, nullable=False, default={
        "websocket": True,
        "sms": False,
        "ivr": False,
        "email": False
    })

    # Minimum risk tier to trigger alerts (Green, Yellow, Orange, Red)
    min_risk_tier = Column(String(20), nullable=False, default="Yellow")

    # Risk tiers to monitor (comma-separated or JSON array)
    alert_types = Column(JSON, nullable=False, default=[
        "rainfall",
        "wind",
        "temperature",
        "thunderstorm",
        "fog",
        "visibility"
    ])

    # Phone number for SMS/IVR (if enabled)
    phone_number = Column(String(15), nullable=True)

    # Email for email channel (if enabled)
    email = Column(String(100), nullable=True)

    # Is subscription active?
    active = Column(Boolean, nullable=False, default=True)

    # Track last alert time to avoid spam
    last_alert_sent_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    # Alert cooldown period in seconds (default: 30 minutes)
    alert_cooldown_seconds = Column(Integer, nullable=False, default=1800)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    __table_args__ = (
        Index("idx_alert_subs_session_location", "session_id", "location"),
        Index("idx_alert_subs_user_location", "user_id", "location"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "sessionId": self.session_id,
            "location": self.location,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "userRole": self.user_role,
            "language": self.language,
            "channels": self.channels,
            "minRiskTier": self.min_risk_tier,
            "alertTypes": self.alert_types,
            "phoneNumber": self.phone_number,
            "email": self.email,
            "active": self.active,
            "lastAlertSentAt": self.last_alert_sent_at.isoformat() if self.last_alert_sent_at else None,
            "alertCooldownSeconds": self.alert_cooldown_seconds,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class AlertDeliveryLog(Base):
    """
    Log of alert deliveries for debugging and audit trail.
    """
    __tablename__ = "alert_delivery_logs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    subscription_id = Column(String(64), ForeignKey("alert_subscriptions.id"), nullable=False, index=True)
    location = Column(String(100), nullable=False)
    hazard_type = Column(String(50), nullable=False)  # e.g., "rainfall", "heat"
    risk_tier = Column(String(20), nullable=False)  # Green, Yellow, Orange, Red
    channel = Column(String(50), nullable=False)  # websocket, sms, ivr, email
    status = Column(String(20), nullable=False, default="pending")  # pending, sent, failed
    message = Column(String(500), nullable=True)
    error_reason = Column(String(255), nullable=True)

    delivered_at = Column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        index=True
    )

    __table_args__ = (
        Index("idx_delivery_logs_subscription", "subscription_id", "created_at"),
        Index("idx_delivery_logs_location", "location", "created_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "subscriptionId": self.subscription_id,
            "location": self.location,
            "hazardType": self.hazard_type,
            "riskTier": self.risk_tier,
            "channel": self.channel,
            "status": self.status,
            "message": self.message,
            "errorReason": self.error_reason,
            "deliveredAt": self.delivered_at.isoformat() if self.delivered_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
