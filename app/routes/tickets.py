"""
Ticket Management Routes Module
===============================
This is the main module for all ticket-related API endpoints.

This module handles:
- Fetching emails from IMAP inbox and creating tickets
- Listing, filtering, and searching tickets
- AI processing (classification, summarization, draft response generation)
- Human approval workflow (approve/reject draft responses)
- Sending approved responses via SMTP
- Bulk actions (approve, reject, send multiple tickets at once)
- Team member assignment
- SLA (Service Level Agreement) tracking
- Analytics and statistics
- CSV export

KEY CONCEPTS:

1. TICKET LIFECYCLE:
   Fetch → Create → AI Process → Human Review → Approve → Send
   
2. APPROVAL WORKFLOW:
   The AI generates draft responses, but a human MUST approve before sending.
   This is a critical safety feature to prevent AI from sending inappropriate responses.

3. THREADING:
   Emails in the same conversation are linked via thread_id and in_reply_to.
   Follow-up emails become new TicketMessages on an existing Ticket.

TROUBLESHOOTING:
- Fetch returns 0 emails: Check IMAP settings in the Settings page
- AI processing fails: Check OPENAI_API_KEY is set correctly
- Send fails: Check SMTP settings in the Settings page
- Duplicate tickets: The system checks message_id to prevent duplicates
"""

import csv
import io
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from pydantic import BaseModel

from app.database import get_db
from app.models import Ticket, TicketMessage, ApprovalStatus, Settings, TeamMember
from app.services.imap_service import fetch_unread_emails
from app.services.ai_service import process_ticket
from app.services.approval_service import approve_ticket, reject_ticket, send_approved_response
from app.services.slack_service import notify_new_ticket, notify_urgent_ticket, notify_ticket_processed
from app.services.auto_responder_service import send_acknowledgment
from app.services.sla_service import update_ticket_sla, get_priority_queue, get_sla_summary, update_all_sla_status
from app.services.email_notification_service import send_urgent_ticket_notification

# Create router with /api/tickets prefix
router = APIRouter(prefix="/api/tickets", tags=["tickets"])


# ============================================================================
# RESPONSE MODELS (Pydantic)
# ============================================================================
# These models define the structure of API responses.
# They ensure consistent data format and provide automatic documentation.

class AssigneeResponse(BaseModel):
    """
    Response model for team member assignment info.
    Used when returning ticket data that includes assignee details.
    """
    id: int
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True  # Allow creating from SQLAlchemy model


class TicketResponse(BaseModel):
    """
    Response model for ticket data in list views.
    Contains all ticket fields except the full message history.
    """
    id: int
    sender_email: str
    subject: str
    received_at: datetime
    category: Optional[str]          # AI-assigned category
    urgency: Optional[str]           # AI-assigned urgency level
    summary: Optional[str]           # AI-generated summary
    fix_steps: Optional[str]         # AI-suggested resolution steps
    draft_response: Optional[str]    # AI-generated response for approval
    approval_status: str             # PENDING, APPROVED, or REJECTED
    approved_by: Optional[str]       # Who approved the response
    approved_at: Optional[datetime]  # When it was approved
    sent_at: Optional[datetime]      # When response was sent to customer
    ai_processed: bool               # Has AI analyzed this ticket?
    escalation_required: bool        # Flagged for escalation?
    assigned_to: Optional[int]       # Team member ID
    assigned_at: Optional[datetime]  # When it was assigned
    assignee: Optional[AssigneeResponse]  # Full assignee details
    sla_deadline: Optional[datetime] # When response is due
    sla_breached: bool               # Has SLA been breached?
    priority_score: int              # For priority queue sorting
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """
    Response model for individual messages in a ticket conversation.
    """
    id: int
    sender_email: str
    subject: Optional[str]
    body: str                        # The actual email content
    is_incoming: bool                # True = from customer, False = from agent
    created_at: datetime

    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    """
    Extended ticket response that includes the full message history.
    Used for the ticket detail view.
    """
    messages: List[MessageResponse]


class UpdateDraftRequest(BaseModel):
    """Request model for updating a ticket's draft response."""
    draft_response: str


class BulkActionRequest(BaseModel):
    """Request model for bulk operations on multiple tickets."""
    ticket_ids: List[int]


class AssignTicketRequest(BaseModel):
    """
    Request model for assigning a ticket to a team member.
    Set team_member_id to None to unassign.
    """
    team_member_id: Optional[int] = None


# ============================================================================
# STATISTICS AND ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/stats/summary")
def get_stats(db: Session = Depends(get_db)):
    """
    Get summary statistics for the dashboard overview.
    
    Returns counts of tickets by approval status:
    - total: All tickets in the system
    - pending: Awaiting human review
    - approved: Approved but not yet sent
    - rejected: Draft response was rejected
    
    Used by the main dashboard to show the current workload.
    """
    total = db.query(Ticket).count()
    pending = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.PENDING.value).count()
    approved = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.APPROVED.value).count()
    rejected = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.REJECTED.value).count()
    
    return {
        "total": total,
        "pending": pending,
        "approved": approved,
        "rejected": rejected
    }


@router.get("/stats/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """
    Get detailed analytics for charts and reports.
    
    Returns:
    - by_category: Ticket counts grouped by category (for pie chart)
    - by_urgency: Ticket counts grouped by urgency (for bar chart)
    - Various rate calculations (approval rate, send rate, etc.)
    
    Used by the Analytics section of the dashboard.
    """
    # Count tickets by category
    categories = db.query(
        Ticket.category,
        func.count(Ticket.id).label('count')
    ).filter(Ticket.category.isnot(None)).group_by(Ticket.category).all()
    
    # Count tickets by urgency
    urgencies = db.query(
        Ticket.urgency,
        func.count(Ticket.id).label('count')
    ).filter(Ticket.urgency.isnot(None)).group_by(Ticket.urgency).all()
    
    # Calculate totals and rates
    total = db.query(Ticket).count()
    approved = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.APPROVED.value).count()
    rejected = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.REJECTED.value).count()
    sent = db.query(Ticket).filter(Ticket.sent_at.isnot(None)).count()
    ai_processed = db.query(Ticket).filter(Ticket.ai_processed == True).count()
    
    # Calculate percentages (avoid division by zero)
    approval_rate = round((approved / total * 100) if total > 0 else 0, 1)
    rejection_rate = round((rejected / total * 100) if total > 0 else 0, 1)
    send_rate = round((sent / approved * 100) if approved > 0 else 0, 1)
    
    return {
        "by_category": [{"name": c[0] or "Uncategorized", "value": c[1]} for c in categories],
        "by_urgency": [{"name": u[0] or "Unassigned", "value": u[1]} for u in urgencies],
        "total_tickets": total,
        "approved_count": approved,
        "rejected_count": rejected,
        "sent_count": sent,
        "ai_processed_count": ai_processed,
        "approval_rate": approval_rate,
        "rejection_rate": rejection_rate,
        "send_rate": send_rate
    }


@router.get("/stats/performance")
def get_performance_metrics(db: Session = Depends(get_db)):
    """
    Get performance metrics for team efficiency tracking.
    
    Calculates average times for:
    - AI processing time (received to processed)
    - Approval time (received to approved)
    - Resolution time (received to response sent)
    
    Also includes today's activity metrics and approval by team member.
    """
    tickets = db.query(Ticket).filter(Ticket.ai_processed == True).all()
    
    # Calculate time deltas for processed tickets
    processing_times = []  # Time for AI to process
    approval_times = []    # Time to get human approval
    resolution_times = []  # Time to send final response
    
    for ticket in tickets:
        # AI processing time (in hours)
        if ticket.received_at and ticket.updated_at and ticket.ai_processed:
            processing_times.append((ticket.updated_at - ticket.received_at).total_seconds() / 3600)
        
        # Human approval time (in hours)
        if ticket.received_at and ticket.approved_at:
            approval_times.append((ticket.approved_at - ticket.received_at).total_seconds() / 3600)
        
        # Total resolution time (in hours)
        if ticket.received_at and ticket.sent_at:
            resolution_times.append((ticket.sent_at - ticket.received_at).total_seconds() / 3600)
    
    # Calculate averages
    avg_processing_time = round(sum(processing_times) / len(processing_times), 2) if processing_times else 0
    avg_approval_time = round(sum(approval_times) / len(approval_times), 2) if approval_times else 0
    avg_resolution_time = round(sum(resolution_times) / len(resolution_times), 2) if resolution_times else 0
    
    # Count approvals by team member
    approved_by_counts = db.query(
        Ticket.approved_by,
        func.count(Ticket.id).label('count')
    ).filter(
        Ticket.approved_by.isnot(None)
    ).group_by(Ticket.approved_by).all()
    
    # Today's metrics
    today_tickets = db.query(Ticket).filter(
        func.date(Ticket.received_at) == func.current_date()
    ).count()
    
    today_processed = db.query(Ticket).filter(
        func.date(Ticket.received_at) == func.current_date(),
        Ticket.ai_processed == True
    ).count()
    
    today_sent = db.query(Ticket).filter(
        func.date(Ticket.sent_at) == func.current_date()
    ).count()
    
    return {
        "avg_processing_time_hours": avg_processing_time,
        "avg_approval_time_hours": avg_approval_time,
        "avg_resolution_time_hours": avg_resolution_time,
        "total_processed": len(processing_times),
        "total_approved": len(approval_times),
        "total_resolved": len(resolution_times),
        "by_approver": [{"name": a[0] or "System", "count": a[1]} for a in approved_by_counts],
        "today_tickets": today_tickets,
        "today_processed": today_processed,
        "today_sent": today_sent
    }


@router.get("/stats/trends")
def get_volume_trends(days: int = Query(30, ge=7, le=90), db: Session = Depends(get_db)):
    """
    Get ticket volume trends over time.
    
    Args:
        days: Number of days to include (7-90, default 30)
    
    Returns daily ticket counts for trend charts.
    Includes dates with zero tickets for continuous chart data.
    """
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days - 1)
    
    # Generate all dates in range (to include zeros)
    date_range = []
    current = start_date
    while current <= end_date:
        date_range.append(current)
        current += timedelta(days=1)
    
    # Get actual counts from database
    daily_counts = db.query(
        func.date(Ticket.received_at).label('date'),
        func.count(Ticket.id).label('count')
    ).filter(
        func.date(Ticket.received_at) >= start_date,
        func.date(Ticket.received_at) <= end_date
    ).group_by(func.date(Ticket.received_at)).all()
    
    count_dict = {str(row[0]): row[1] for row in daily_counts}
    
    # Build complete dataset with zeros for missing dates
    trends = []
    for date in date_range:
        date_str = str(date)
        trends.append({
            "date": date_str,
            "count": count_dict.get(date_str, 0)
        })
    
    return {
        "trends": trends,
        "total": sum(t["count"] for t in trends),
        "average": round(sum(t["count"] for t in trends) / len(trends), 1) if trends else 0
    }


# ============================================================================
# EXPORT ENDPOINT
# ============================================================================

@router.get("/export")
def export_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Export tickets to CSV file.
    
    Supports the same filters as list_tickets so users can export
    a specific subset of tickets (e.g., only High urgency, or only Billing).
    
    Returns a downloadable CSV file with all ticket data.
    """
    query = db.query(Ticket)
    
    # Apply filters
    if status:
        query = query.filter(Ticket.approval_status == status)
    if category:
        query = query.filter(Ticket.category == category)
    if urgency:
        query = query.filter(Ticket.urgency == urgency)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Ticket.sender_email.ilike(search_term),
                Ticket.subject.ilike(search_term),
                Ticket.summary.ilike(search_term)
            )
        )
    
    tickets = query.order_by(desc(Ticket.received_at)).all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header row
    writer.writerow([
        "ID", "Sender Email", "Subject", "Received At", "Category", "Urgency",
        "Summary", "Fix Steps", "Draft Response", "Status", "AI Processed", 
        "Escalation Required", "Approved By", "Approved At", "Sent At", 
        "Created At", "Updated At"
    ])
    
    # Write data rows
    for ticket in tickets:
        writer.writerow([
            ticket.id,
            ticket.sender_email,
            ticket.subject,
            ticket.received_at.strftime("%Y-%m-%d %H:%M:%S") if ticket.received_at else "",
            ticket.category or "",
            ticket.urgency or "",
            ticket.summary or "",
            ticket.fix_steps or "",
            ticket.draft_response or "",
            ticket.approval_status,
            "Yes" if ticket.ai_processed else "No",
            "Yes" if ticket.escalation_required else "No",
            ticket.approved_by or "",
            ticket.approved_at.strftime("%Y-%m-%d %H:%M:%S") if ticket.approved_at else "",
            ticket.sent_at.strftime("%Y-%m-%d %H:%M:%S") if ticket.sent_at else "",
            ticket.created_at.strftime("%Y-%m-%d %H:%M:%S") if ticket.created_at else "",
            ticket.updated_at.strftime("%Y-%m-%d %H:%M:%S") if ticket.updated_at else ""
        ])
    
    output.seek(0)
    filename = f"tickets_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    # Return as streaming response for download
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================================================
# TICKET LISTING AND DETAIL ENDPOINTS
# ============================================================================

@router.get("/", response_model=List[TicketResponse])
def list_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sla_breached: Optional[bool] = Query(None),
    assigned_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List all tickets with optional filters.
    
    This is the main endpoint for the ticket list in the dashboard.
    Supports filtering by:
    - status: Approval status (PENDING, APPROVED, REJECTED)
    - category: AI-assigned category
    - urgency: AI-assigned urgency level
    - search: Text search in email, subject, and summary
    - sla_breached: Only show breached or non-breached tickets
    - assigned_to: Filter by team member ID or "unassigned"
    
    Returns tickets ordered by received_at (newest first).
    """
    query = db.query(Ticket)
    
    # Apply filters
    if status:
        query = query.filter(Ticket.approval_status == status)
    if category:
        query = query.filter(Ticket.category == category)
    if urgency:
        query = query.filter(Ticket.urgency == urgency)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Ticket.sender_email.ilike(search_term),
                Ticket.subject.ilike(search_term),
                Ticket.summary.ilike(search_term)
            )
        )
    if sla_breached is not None:
        query = query.filter(Ticket.sla_breached == sla_breached)
    if assigned_to is not None:
        if assigned_to == "unassigned":
            query = query.filter(Ticket.assigned_to.is_(None))
        else:
            try:
                member_id = int(assigned_to)
                query = query.filter(Ticket.assigned_to == member_id)
            except ValueError:
                pass  # Invalid ID, ignore filter
    
    tickets = query.order_by(desc(Ticket.received_at)).all()
    return tickets


@router.get("/customer/{email}", response_model=List[TicketResponse])
def get_customer_history(
    email: str,
    exclude_ticket_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get ticket history for a specific customer.
    
    Used to show previous tickets from the same sender when viewing
    a ticket, helping agents understand customer history.
    
    Args:
        email: Customer email address
        exclude_ticket_id: Current ticket ID to exclude from results
    
    Returns up to 10 most recent tickets from this customer.
    """
    query = db.query(Ticket).filter(Ticket.sender_email == email)
    if exclude_ticket_id:
        query = query.filter(Ticket.id != exclude_ticket_id)
    tickets = query.order_by(desc(Ticket.received_at)).limit(10).all()
    return tickets


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a single ticket.
    
    Returns full ticket data including all messages in the conversation.
    Used for the ticket detail/edit view.
    
    Raises HTTPException 404 if ticket not found.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


# ============================================================================
# EMAIL FETCHING AND AI PROCESSING
# ============================================================================

@router.post("/fetch")
def fetch_emails(db: Session = Depends(get_db)):
    """
    Fetch unread emails from IMAP inbox and create tickets.
    
    This endpoint:
    1. Connects to the configured IMAP server
    2. Fetches all unread emails
    3. For each email:
       a. If it's part of an existing thread, adds as new TicketMessage
       b. If it's a new conversation, creates a new Ticket
    4. Sends auto-acknowledgment emails to customers (if enabled)
    5. Triggers Slack notifications (if enabled)
    
    Duplicate prevention: Uses message_id to skip already-imported emails.
    
    Returns:
        fetched: Number of emails retrieved from IMAP
        created: Number of new tickets created
    """
    # Fetch emails from IMAP server
    emails = fetch_unread_emails(db)
    created_count = 0
    
    for email_data in emails:
        # Skip if we already have this email
        existing = db.query(Ticket).filter(
            Ticket.message_id == email_data["message_id"]
        ).first()
        
        if existing:
            continue
        
        # Check if this is a reply to an existing ticket
        existing_thread = None
        if email_data.get("in_reply_to"):
            existing_thread = db.query(Ticket).filter(
                or_(
                    Ticket.message_id == email_data["in_reply_to"],
                    Ticket.thread_id == email_data["thread_id"]
                )
            ).first()
        
        if existing_thread:
            # Add as new message to existing ticket
            message = TicketMessage(
                ticket_id=existing_thread.id,
                sender_email=email_data["sender_email"],
                subject=email_data["subject"],
                body=email_data["body"],
                is_incoming=True,
                message_id=email_data["message_id"],
                in_reply_to=email_data.get("in_reply_to")
            )
            db.add(message)
            # Reset ticket for re-processing with new message
            existing_thread.approval_status = ApprovalStatus.PENDING.value
            existing_thread.ai_processed = False
        else:
            # Create new ticket
            ticket = Ticket(
                sender_email=email_data["sender_email"],
                subject=email_data["subject"],
                received_at=email_data["received_at"],
                message_id=email_data["message_id"],
                in_reply_to=email_data.get("in_reply_to"),
                thread_id=email_data.get("thread_id") or email_data["message_id"],
            )
            db.add(ticket)
            db.flush()  # Get the ticket ID
            
            # Create initial message
            message = TicketMessage(
                ticket_id=ticket.id,
                sender_email=email_data["sender_email"],
                subject=email_data["subject"],
                body=email_data["body"],
                is_incoming=True,
                message_id=email_data["message_id"],
            )
            db.add(message)
            db.flush()
            created_count += 1
            
            # Send automatic acknowledgment to customer
            send_acknowledgment(
                to_email=email_data["sender_email"],
                ticket_id=ticket.id,
                subject=email_data["subject"],
                db=db
            )
            
            # Send Slack notification if enabled
            notify_on_new = db.query(Settings).filter(Settings.key == "slack_notify_on_new").first()
            if notify_on_new and notify_on_new.value == "true":
                notify_new_ticket(db, ticket)
    
    db.commit()
    return {"fetched": len(emails), "created": created_count}


@router.post("/{ticket_id}/process")
def process_single_ticket(ticket_id: int, db: Session = Depends(get_db)):
    """
    Process a single ticket with AI.
    
    Sends the ticket to OpenAI for analysis. The AI:
    1. Classifies the ticket category (Billing, Technical, etc.)
    2. Assesses urgency (Low, Medium, High)
    3. Generates a summary of the issue
    4. Suggests resolution steps
    5. Drafts a response for human review
    
    After processing:
    - Updates SLA deadline based on urgency
    - Sends notifications for urgent tickets (Slack and email)
    
    Returns the AI processing result on success.
    Raises HTTPException on failure.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get the latest incoming message for processing
    latest_message = db.query(TicketMessage).filter(
        TicketMessage.ticket_id == ticket_id,
        TicketMessage.is_incoming == True
    ).order_by(desc(TicketMessage.created_at)).first()
    
    if not latest_message:
        raise HTTPException(status_code=400, detail="No messages to process")
    
    # Send to AI for analysis
    result = process_ticket(
        ticket_id=ticket.id,
        sender_email=ticket.sender_email,
        subject=ticket.subject,
        body=latest_message.body,
        received_at=str(ticket.received_at),
        db=db
    )
    
    if result:
        # Update ticket with AI results
        ticket.category = result["category"]
        ticket.urgency = result["urgency"]
        ticket.summary = result["summary"]
        ticket.fix_steps = result["fix_steps"]
        ticket.draft_response = result["draft_response"]
        ticket.ai_processed = True
        db.commit()
        
        # Update SLA deadline based on urgency
        update_ticket_sla(db, ticket)
        
        # Send notifications for urgent tickets
        notify_on_urgent = db.query(Settings).filter(Settings.key == "slack_notify_on_urgent").first()
        if ticket.urgency == "High" and (not notify_on_urgent or notify_on_urgent.value != "false"):
            notify_urgent_ticket(db, ticket)
        else:
            notify_ticket_processed(db, ticket)
        
        # Send email notification for urgent tickets
        send_urgent_ticket_notification(db, ticket)
        
        return {"status": "processed", "result": result}
    else:
        raise HTTPException(status_code=500, detail="AI processing failed")


@router.post("/process-all")
def process_all_tickets(db: Session = Depends(get_db)):
    """
    Process all unprocessed tickets with AI.
    
    Convenience endpoint to batch-process multiple tickets.
    Useful after fetching new emails or for initial setup.
    
    Returns the count of successfully processed tickets.
    """
    unprocessed = db.query(Ticket).filter(Ticket.ai_processed == False).all()
    processed_count = 0
    
    for ticket in unprocessed:
        # Get the latest incoming message
        latest_message = db.query(TicketMessage).filter(
            TicketMessage.ticket_id == ticket.id,
            TicketMessage.is_incoming == True
        ).order_by(desc(TicketMessage.created_at)).first()
        
        if not latest_message:
            continue
        
        # Send to AI for analysis
        result = process_ticket(
            ticket_id=ticket.id,
            sender_email=ticket.sender_email,
            subject=ticket.subject,
            body=latest_message.body,
            received_at=str(ticket.received_at),
            db=db
        )
        
        if result:
            ticket.category = result["category"]
            ticket.urgency = result["urgency"]
            ticket.summary = result["summary"]
            ticket.fix_steps = result["fix_steps"]
            ticket.draft_response = result["draft_response"]
            ticket.ai_processed = True
            processed_count += 1
            
            update_ticket_sla(db, ticket)
            send_urgent_ticket_notification(db, ticket)
    
    db.commit()
    return {"processed": processed_count}


# ============================================================================
# DRAFT EDITING AND APPROVAL WORKFLOW
# ============================================================================

@router.put("/{ticket_id}/draft")
def update_draft(ticket_id: int, request: UpdateDraftRequest, db: Session = Depends(get_db)):
    """
    Update a ticket's draft response.
    
    Allows agents to edit the AI-generated response before approval.
    Common uses:
    - Fix AI mistakes or inappropriate content
    - Add personal touches
    - Include additional information
    
    Note: This only updates the draft, not the approval status.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.draft_response = request.draft_response
    db.commit()
    return {"status": "updated"}


@router.post("/{ticket_id}/approve")
def approve(ticket_id: int, db: Session = Depends(get_db)):
    """
    Approve a ticket's draft response.
    
    This marks the response as ready to send.
    The actual sending happens via a separate /send endpoint.
    
    This two-step process allows for:
    1. Batch approval of multiple tickets
    2. Scheduled sending
    3. Final review before sending
    """
    success = approve_ticket(db, ticket_id)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"status": "approved"}


@router.post("/{ticket_id}/reject")
def reject(ticket_id: int, db: Session = Depends(get_db)):
    """
    Reject a ticket's draft response.
    
    Use this when the AI-generated response is not acceptable.
    After rejection, the agent should:
    1. Edit the draft response manually
    2. Re-process with AI (if appropriate)
    3. Approve the revised response
    """
    success = reject_ticket(db, ticket_id)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"status": "rejected"}


@router.post("/{ticket_id}/send")
def send_response(ticket_id: int, db: Session = Depends(get_db)):
    """
    Send an approved response to the customer via SMTP.
    
    Requirements:
    - Ticket must be in APPROVED status
    - SMTP settings must be configured
    - Draft response must exist
    
    On success, updates the ticket's sent_at timestamp.
    Creates an outgoing TicketMessage to record the sent response.
    """
    success = send_approved_response(db, ticket_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not send response")
    return {"status": "sent"}


# ============================================================================
# BULK ACTIONS
# ============================================================================

@router.post("/bulk-approve")
def bulk_approve(request: BulkActionRequest, db: Session = Depends(get_db)):
    """
    Approve multiple tickets at once.
    
    Useful for quickly clearing a queue of reviewed tickets.
    Returns the count of successfully approved tickets.
    """
    approved_count = 0
    for ticket_id in request.ticket_ids:
        if approve_ticket(db, ticket_id):
            approved_count += 1
    return {"approved": approved_count}


@router.post("/bulk-reject")
def bulk_reject(request: BulkActionRequest, db: Session = Depends(get_db)):
    """
    Reject multiple tickets at once.
    
    Returns the count of successfully rejected tickets.
    """
    rejected_count = 0
    for ticket_id in request.ticket_ids:
        if reject_ticket(db, ticket_id):
            rejected_count += 1
    return {"rejected": rejected_count}


@router.post("/bulk-send")
def bulk_send(request: BulkActionRequest, db: Session = Depends(get_db)):
    """
    Send approved responses for multiple tickets.
    
    Only sends responses for tickets that are already approved.
    Skips tickets that aren't ready to send.
    
    Returns the count of successfully sent responses.
    """
    sent_count = 0
    for ticket_id in request.ticket_ids:
        if send_approved_response(db, ticket_id):
            sent_count += 1
    return {"sent": sent_count}


# ============================================================================
# TEAM ASSIGNMENT
# ============================================================================

@router.post("/{ticket_id}/assign")
def assign_ticket(ticket_id: int, request: AssignTicketRequest, db: Session = Depends(get_db)):
    """
    Assign a ticket to a team member.
    
    Set team_member_id to None to unassign the ticket.
    
    Assignment helps with:
    - Workload distribution
    - Ownership and accountability
    - Filtering tickets by assignee
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if request.team_member_id is not None:
        # Verify the team member exists
        member = db.query(TeamMember).filter(TeamMember.id == request.team_member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Team member not found")
        ticket.assigned_to = request.team_member_id
        ticket.assigned_at = datetime.now()
    else:
        # Unassign the ticket
        ticket.assigned_to = None
        ticket.assigned_at = None
    
    db.commit()
    db.refresh(ticket)
    return {"status": "assigned", "assigned_to": ticket.assigned_to}


# ============================================================================
# SLA (SERVICE LEVEL AGREEMENT) ENDPOINTS
# ============================================================================

@router.get("/sla/summary")
def get_sla_stats(db: Session = Depends(get_db)):
    """
    Get SLA summary statistics.
    
    Returns counts of tickets approaching deadline, breached, and on-track.
    Used by the SLA dashboard widget.
    """
    return get_sla_summary(db)


@router.get("/sla/priority-queue", response_model=List[TicketResponse])
def get_tickets_priority_queue(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    """
    Get tickets ordered by priority for the priority queue view.
    
    Returns tickets sorted by:
    1. SLA breach status (breached first)
    2. SLA deadline (soonest first)
    3. Priority score
    
    Args:
        limit: Maximum number of tickets to return (1-100, default 20)
    """
    tickets = get_priority_queue(db, limit)
    return tickets


@router.post("/sla/refresh")
def refresh_sla_status(db: Session = Depends(get_db)):
    """
    Refresh SLA status for all tickets.
    
    Checks each ticket against its deadline and updates:
    - sla_breached flag
    - priority_score
    
    Call this periodically or on-demand to ensure accurate SLA tracking.
    """
    result = update_all_sla_status(db)
    return result


class SlaSettingsRequest(BaseModel):
    """Request model for SLA time settings."""
    high_hours: int    # Hours allowed for High urgency tickets
    medium_hours: int  # Hours allowed for Medium urgency tickets
    low_hours: int     # Hours allowed for Low urgency tickets


@router.get("/sla/settings")
def get_sla_settings(db: Session = Depends(get_db)):
    """
    Get current SLA time settings.
    
    Returns the number of hours allowed for each urgency level.
    Defaults: High=4 hours, Medium=8 hours, Low=24 hours
    """
    settings = db.query(Settings).filter(
        Settings.key.in_(["sla_hours_high", "sla_hours_medium", "sla_hours_low"])
    ).all()
    settings_dict = {s.key: s.value for s in settings}
    
    return {
        "high_hours": int(settings_dict.get("sla_hours_high", 4)),
        "medium_hours": int(settings_dict.get("sla_hours_medium", 8)),
        "low_hours": int(settings_dict.get("sla_hours_low", 24))
    }


@router.post("/sla/settings")
def update_sla_settings(request: SlaSettingsRequest, db: Session = Depends(get_db)):
    """
    Update SLA time settings.
    
    Sets the number of hours allowed for each urgency level.
    Affects SLA deadline calculation for newly processed tickets.
    """
    for key, value in [
        ("sla_hours_high", request.high_hours),
        ("sla_hours_medium", request.medium_hours),
        ("sla_hours_low", request.low_hours)
    ]:
        setting = db.query(Settings).filter(Settings.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            db.add(Settings(key=key, value=str(value)))
    
    db.commit()
    return {"status": "updated"}
