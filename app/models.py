"""
Database Models Module
======================
This module defines all the database tables (models) for the AI Support Desk.

SQLAlchemy ORM is used to map Python classes to database tables.
Each class represents a table, and each attribute represents a column.

TABLES OVERVIEW:
- Settings: Key-value store for app configuration (email credentials, etc.)
- Ticket: Main support tickets created from incoming emails
- TicketMessage: Individual messages in a ticket conversation thread
- Template: Reusable response templates for quick replies
- KnowledgeArticle: Help articles for suggested solutions
- TeamMember: Support team members who can be assigned tickets
- SatisfactionSurvey: Customer feedback surveys linked to tickets
- SavedView: Saved filter/search configurations for quick access
- User: System users who log in (admin, support agents)

HOW RELATIONSHIPS WORK:
- ForeignKey: Links a column to another table's primary key
- relationship(): Creates navigation between related objects
- back_populates: Makes the relationship work in both directions

TROUBLESHOOTING:
- "Table already exists": The table was created before; this is usually fine
- "Column not found": A migration may be needed if you added new columns
- IntegrityError: You're trying to violate a constraint (unique, foreign key, etc.)
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from app.database import Base


# ============================================================================
# ENUM TYPES
# ============================================================================
# These enums define the allowed values for certain fields.
# Using enums helps prevent typos and makes the code self-documenting.

class ApprovalStatus(str, enum.Enum):
    """
    Status of a ticket's draft response approval.
    
    Workflow:
    1. PENDING: AI generated a response, waiting for human review
    2. APPROVED: Human approved the response, ready to send
    3. REJECTED: Human rejected the response, needs revision
    """
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Category(str, enum.Enum):
    """
    Ticket categories as classified by the AI.
    
    The AI automatically assigns one of these categories based on
    the email content. Used for filtering, routing, and analytics.
    """
    BILLING = "Billing"              # Payment, invoice, subscription issues
    TECHNICAL = "Technical"          # Software bugs, errors, technical problems
    LOGIN_ACCESS = "Login / Access"  # Password reset, account access issues
    FEATURE_REQUEST = "Feature Request"  # Requests for new features
    GENERAL_INQUIRY = "General Inquiry"  # General questions
    OTHER = "Other"                  # Anything that doesn't fit above


class Urgency(str, enum.Enum):
    """
    Ticket urgency levels as classified by the AI.
    
    The AI assesses urgency based on:
    - Language used (urgent, ASAP, critical)
    - Business impact mentioned
    - Customer tier/history
    """
    LOW = "Low"       # Can wait, no immediate impact
    MEDIUM = "Medium" # Should address soon, moderate impact
    HIGH = "High"     # Needs immediate attention, significant impact


# ============================================================================
# SETTINGS TABLE
# ============================================================================

class Settings(Base):
    """
    Key-value store for application settings.
    
    This table stores all configurable settings like:
    - Email server credentials (IMAP/SMTP)
    - Admin username and password
    - Scheduler settings (auto-fetch interval)
    - Slack webhook URL for notifications
    - SLA timing configurations
    
    Using a key-value store allows adding new settings without
    database migrations.
    
    Example entries:
        key: "imap_host", value: "imap.gmail.com"
        key: "scheduler_enabled", value: "true"
        key: "admin_password", value: "(hashed password)"
    """
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# TICKET TABLE
# ============================================================================

class Ticket(Base):
    """
    Main support ticket table.
    
    Each ticket represents an email conversation with a customer.
    Tickets are created when emails are fetched from the IMAP inbox.
    
    LIFECYCLE:
    1. Email arrives, ticket created with PENDING status
    2. AI processes ticket (category, urgency, summary, draft response)
    3. Human reviews and approves/rejects the draft response
    4. If approved, response is sent via SMTP
    5. Customer can reply, creating more TicketMessages in the thread
    
    KEY FIELDS:
    - sender_email: Customer's email address
    - subject: Email subject line
    - category/urgency: AI-classified values
    - summary: AI-generated summary of the issue
    - fix_steps: AI-suggested steps to resolve the issue
    - draft_response: AI-generated response for review
    - approval_status: PENDING/APPROVED/REJECTED
    - assigned_to: Which team member is handling this ticket
    - sla_deadline: When the ticket must be resolved by
    """
    __tablename__ = "tickets"

    # Primary identifier
    id = Column(Integer, primary_key=True, index=True)
    
    # Customer and email information
    sender_email = Column(String(255), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # AI-generated analysis fields
    # These are populated by ai_service.py when processing the ticket
    category = Column(String(50), nullable=True)       # e.g., "Technical", "Billing"
    urgency = Column(String(20), nullable=True)        # e.g., "High", "Medium", "Low"
    summary = Column(Text, nullable=True)              # Brief summary of the issue
    fix_steps = Column(Text, nullable=True)            # Suggested resolution steps
    draft_response = Column(Text, nullable=True)       # AI-generated response to customer
    
    # Approval workflow fields
    # No response is sent without human approval
    approval_status = Column(String(20), default=ApprovalStatus.PENDING.value, index=True)
    approved_by = Column(String(255), nullable=True)   # Email/name of approver
    approved_at = Column(DateTime, nullable=True)      # When approval was given
    sent_at = Column(DateTime, nullable=True)          # When response was sent
    
    # Email threading fields
    # Used to link related emails in a conversation
    thread_id = Column(String(255), nullable=True, index=True)  # Groups related emails
    message_id = Column(String(255), nullable=True, unique=True)  # Unique email identifier
    in_reply_to = Column(String(255), nullable=True)  # References parent message
    
    # Processing flags
    ai_processed = Column(Boolean, default=False)      # Has AI analyzed this ticket?
    escalation_required = Column(Boolean, default=False)  # Needs manager attention?
    
    # Team assignment
    # Links to TeamMember table for ticket routing
    assigned_to = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    
    # SLA (Service Level Agreement) tracking
    # Used to ensure timely responses
    sla_deadline = Column(DateTime, nullable=True, index=True)  # Must respond by this time
    sla_breached = Column(Boolean, default=False)      # Did we miss the deadline?
    priority_score = Column(Integer, default=0, index=True)  # For sorting by priority
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # messages: All messages in this ticket's conversation
    # assignee: The TeamMember this ticket is assigned to
    messages = relationship("TicketMessage", back_populates="ticket", order_by="TicketMessage.created_at")
    assignee = relationship("TeamMember", foreign_keys=[assigned_to])


# ============================================================================
# TICKET MESSAGE TABLE
# ============================================================================

class TicketMessage(Base):
    """
    Individual messages in a ticket conversation.
    
    A ticket can have multiple messages:
    - Initial customer email (is_incoming=True)
    - Agent responses (is_incoming=False)
    - Customer follow-up replies (is_incoming=True)
    
    This table stores the actual email content while the Ticket table
    stores the metadata and AI analysis.
    """
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    
    sender_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)  # The actual email content
    is_incoming = Column(Boolean, default=True)  # True=from customer, False=from agent
    
    # Email headers for threading
    message_id = Column(String(255), nullable=True)
    in_reply_to = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Back-reference to parent ticket
    ticket = relationship("Ticket", back_populates="messages")


# ============================================================================
# TEMPLATE TABLE
# ============================================================================

class Template(Base):
    """
    Reusable response templates for quick replies.
    
    Templates allow agents to quickly respond to common issues
    without typing the same text repeatedly.
    
    Example templates:
    - "Password Reset Instructions" (category: Login / Access)
    - "Refund Process" (category: Billing)
    - "Known Bug Acknowledgment" (category: Technical)
    
    Templates can include placeholders like {customer_name} that
    get filled in when applied.
    """
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)      # Template name for selection
    category = Column(String(50), nullable=True)    # Category it applies to
    content = Column(Text, nullable=False)          # The template text
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# KNOWLEDGE ARTICLE TABLE
# ============================================================================

class KnowledgeArticle(Base):
    """
    Knowledge base articles for suggested solutions.
    
    When viewing a ticket, the system can suggest relevant articles
    based on the ticket's category and keywords.
    
    Articles contain:
    - Title: Descriptive name (e.g., "How to Reset Your Password")
    - Category: Matching ticket category for relevance
    - Keywords: Comma-separated terms for matching
    - Content: The full article text with solution steps
    """
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True, index=True)  # Matches ticket categories
    keywords = Column(Text, nullable=True)  # Comma-separated keywords for search
    content = Column(Text, nullable=False)  # Full article content
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# TEAM MEMBER TABLE
# ============================================================================

class TeamMember(Base):
    """
    Support team members who can be assigned tickets.
    
    Team members are separate from Users because:
    - Not all users handle tickets (some are admin-only)
    - Team members might not have login accounts yet
    
    Tickets can be assigned to team members for workload distribution.
    The assignee's name appears on ticket cards in the dashboard.
    """
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)      # Display name
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(50), default="agent")      # "agent", "supervisor", etc.
    is_active = Column(Boolean, default=True)       # Inactive members can't be assigned
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# SATISFACTION SURVEY TABLE
# ============================================================================

class SatisfactionSurvey(Base):
    """
    Customer satisfaction surveys linked to resolved tickets.
    
    After a ticket is resolved, a survey can be sent to the customer.
    The survey includes a unique token that allows the customer to
    submit feedback without logging in.
    
    Survey responses help track support quality and identify issues.
    """
    __tablename__ = "satisfaction_surveys"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1-5 stars
    feedback = Column(Text, nullable=True)    # Optional written feedback
    customer_email = Column(String(255), nullable=False, index=True)
    
    # Token for anonymous survey submission
    # Customers click a link with this token to submit feedback
    survey_token = Column(String(100), unique=True, nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)      # When survey email was sent
    completed_at = Column(DateTime, nullable=True)  # When customer responded
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# SAVED VIEW TABLE
# ============================================================================

class SavedView(Base):
    """
    Saved filter/search configurations for quick access.
    
    Agents can save commonly used filter combinations for quick access.
    For example:
    - "My High Priority": urgency=High, assigned_to=current_user
    - "Unassigned Billing": category=Billing, assigned_to=null
    - "SLA Breached": sla_breached=True
    
    Saved views appear in a quick-access menu in the dashboard.
    """
    __tablename__ = "saved_views"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # Display name in menu
    
    # Filter criteria - any combination can be saved
    status = Column(String(50), nullable=True)      # Approval status filter
    category = Column(String(50), nullable=True)    # Category filter
    urgency = Column(String(50), nullable=True)     # Urgency filter
    search = Column(String(255), nullable=True)     # Text search term
    sla_breached = Column(Boolean, nullable=True)   # SLA breach filter
    assigned_to = Column(Integer, nullable=True)    # Team member filter
    
    is_default = Column(Boolean, default=False)     # Show by default on load?
    sort_order = Column(Integer, default=0)         # Order in the menu
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# USER TABLE
# ============================================================================

class User(Base):
    """
    System users who can log into the dashboard.
    
    Users can authenticate via:
    1. Email/password registration (for demos and external clients)
    2. Google OAuth SSO (for team members)
    3. Traditional admin login (legacy fallback)
    
    When a user registers with email/password:
    - password_hash stores the bcrypt-hashed password
    - position stores their job title/role description
    
    When a user logs in with Google:
    - A new User record is created if they don't exist
    - Their Google profile info is stored and updated on each login
    - google_id links their account to their Google identity
    
    Roles:
    - "admin": Full access to all features and settings
    - "user": Standard access to ticket management
    
    Position: User's job title (e.g., "IT Manager", "Support Lead", "Developer")
    This is displayed in the profile header.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    
    # Password authentication (for email/password login)
    # password_hash is null for Google OAuth-only users
    password_hash = Column(String(255), nullable=True)
    
    # Google OAuth fields
    # google_id is the unique identifier from Google
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    
    # Profile information (from Google or manually set)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    profile_image_url = Column(String(500), nullable=True)  # Google profile picture
    
    # Position/Job title (e.g., "IT Manager", "Support Lead", "Developer")
    # Displayed in profile header and team views
    position = Column(String(100), nullable=True)
    
    # Organization/Company name
    organization = Column(String(200), nullable=True)
    
    # Access control
    role = Column(String(50), default="user")  # "admin" or "user"
    is_active = Column(Boolean, default=True)  # Inactive users can't log in
    
    # Email verification (for email/password registration)
    email_verified = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)  # Track user activity
