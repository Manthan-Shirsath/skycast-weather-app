"""
Chat Session & Message Persistence Models for PostgreSQL
Stores persistent multi-turn conversational history and tool execution logs.
"""

import uuid
import datetime
from enum import Enum
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    DateTime,
    JSON,
    ForeignKey,
    Index
)
from sqlalchemy.orm import relationship
from backend.app.models.weather_snapshot import Base



class UserRole(str, Enum):
    """User persona/role for role-adaptive response formatting."""
    GENERAL_PUBLIC = "general_public"
    FARMER = "farmer"
    DISASTER_MANAGER = "disaster_manager"
    AVIATION = "aviation"
    RESEARCHER = "researcher"
    MARINE = "marine"
    URBAN_PLANNER = "urban_planner"


class ChatSession(Base):
    """
    Persistent conversational session for WeatherGPT.
    Maintains location context, session metadata, and links to message history.
    """
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(100), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    location_context = Column(String(100), nullable=True)
    language = Column(String(20), nullable=False, default="en")
    user_role = Column(String(50), nullable=False, default=UserRole.GENERAL_PUBLIC.value)
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

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "title": self.title,
            "locationContext": self.location_context,
            "language": self.language,
            "userRole": self.user_role,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class ChatMessage(Base):
    """
    Individual message turn or tool invocation log in a WeatherGPT conversation.
    """
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user', 'model', 'tool', 'system'
    content = Column(Text, nullable=True)
    tool_name = Column(String(100), nullable=True)
    tool_arguments = Column(JSON, nullable=True)
    tool_result = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        index=True
    )

    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        Index("idx_chat_messages_session_created", "session_id", "created_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "sessionId": self.session_id,
            "role": self.role,
            "content": self.content,
            "toolName": self.tool_name,
            "toolArguments": self.tool_arguments,
            "toolResult": self.tool_result,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }
