from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Category(str, enum.Enum):
    BILLING = "Billing"
    TECHNICAL = "Technical"
    LOGIN_ACCESS = "Login / Access"
    FEATURE_REQUEST = "Feature Request"
    GENERAL_INQUIRY = "General Inquiry"
    OTHER = "Other"


class Urgency(str, enum.Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    sender_email = Column(String(255), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    category = Column(String(50), nullable=True)
    urgency = Column(String(20), nullable=True)
    summary = Column(Text, nullable=True)
    fix_steps = Column(Text, nullable=True)
    draft_response = Column(Text, nullable=True)
    
    approval_status = Column(String(20), default=ApprovalStatus.PENDING.value, index=True)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    
    thread_id = Column(String(255), nullable=True, index=True)
    message_id = Column(String(255), nullable=True, unique=True)
    in_reply_to = Column(String(255), nullable=True)
    
    ai_processed = Column(Boolean, default=False)
    escalation_required = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    messages = relationship("TicketMessage", back_populates="ticket", order_by="TicketMessage.created_at")


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    
    sender_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    is_incoming = Column(Boolean, default=True)
    
    message_id = Column(String(255), nullable=True)
    in_reply_to = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    ticket = relationship("Ticket", back_populates="messages")


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True, index=True)
    keywords = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
