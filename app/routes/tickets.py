import csv
import io
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from pydantic import BaseModel

from app.database import get_db
from app.models import Ticket, TicketMessage, ApprovalStatus, Settings
from app.services.imap_service import fetch_unread_emails
from app.services.ai_service import process_ticket
from app.services.approval_service import approve_ticket, reject_ticket, send_approved_response
from app.services.slack_service import notify_new_ticket, notify_urgent_ticket, notify_ticket_processed

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


class TicketResponse(BaseModel):
    id: int
    sender_email: str
    subject: str
    received_at: datetime
    category: Optional[str]
    urgency: Optional[str]
    summary: Optional[str]
    fix_steps: Optional[str]
    draft_response: Optional[str]
    approval_status: str
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    sent_at: Optional[datetime]
    ai_processed: bool
    escalation_required: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    sender_email: str
    subject: Optional[str]
    body: str
    is_incoming: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    messages: List[MessageResponse]


class UpdateDraftRequest(BaseModel):
    draft_response: str


class BulkActionRequest(BaseModel):
    ticket_ids: List[int]


@router.get("/stats/summary")
def get_stats(db: Session = Depends(get_db)):
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
    categories = db.query(
        Ticket.category,
        func.count(Ticket.id).label('count')
    ).filter(Ticket.category.isnot(None)).group_by(Ticket.category).all()
    
    urgencies = db.query(
        Ticket.urgency,
        func.count(Ticket.id).label('count')
    ).filter(Ticket.urgency.isnot(None)).group_by(Ticket.urgency).all()
    
    total = db.query(Ticket).count()
    approved = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.APPROVED.value).count()
    rejected = db.query(Ticket).filter(Ticket.approval_status == ApprovalStatus.REJECTED.value).count()
    sent = db.query(Ticket).filter(Ticket.sent_at.isnot(None)).count()
    ai_processed = db.query(Ticket).filter(Ticket.ai_processed == True).count()
    
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


@router.get("/export")
def export_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    
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
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "Sender Email", "Subject", "Received At", "Category", "Urgency",
        "Summary", "Fix Steps", "Draft Response", "Status", "AI Processed", 
        "Escalation Required", "Approved By", "Approved At", "Sent At", 
        "Created At", "Updated At"
    ])
    
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
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/", response_model=List[TicketResponse])
def list_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Ticket)
    
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
    return tickets


@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.post("/fetch")
def fetch_emails(db: Session = Depends(get_db)):
    emails = fetch_unread_emails(db)
    created_count = 0
    
    for email_data in emails:
        existing = db.query(Ticket).filter(
            Ticket.message_id == email_data["message_id"]
        ).first()
        
        if existing:
            continue
        
        existing_thread = None
        if email_data.get("in_reply_to"):
            existing_thread = db.query(Ticket).filter(
                or_(
                    Ticket.message_id == email_data["in_reply_to"],
                    Ticket.thread_id == email_data["thread_id"]
                )
            ).first()
        
        if existing_thread:
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
            existing_thread.approval_status = ApprovalStatus.PENDING.value
            existing_thread.ai_processed = False
        else:
            ticket = Ticket(
                sender_email=email_data["sender_email"],
                subject=email_data["subject"],
                received_at=email_data["received_at"],
                message_id=email_data["message_id"],
                in_reply_to=email_data.get("in_reply_to"),
                thread_id=email_data.get("thread_id") or email_data["message_id"],
            )
            db.add(ticket)
            db.flush()
            
            message = TicketMessage(
                ticket_id=ticket.id,
                sender_email=email_data["sender_email"],
                subject=email_data["subject"],
                body=email_data["body"],
                is_incoming=True,
                message_id=email_data["message_id"],
            )
            db.add(message)
            created_count += 1
            
            notify_on_new = db.query(Settings).filter(Settings.key == "slack_notify_on_new").first()
            if notify_on_new and notify_on_new.value == "true":
                notify_new_ticket(db, ticket)
    
    db.commit()
    return {"fetched": len(emails), "created": created_count}


@router.post("/{ticket_id}/process")
def process_single_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    latest_message = db.query(TicketMessage).filter(
        TicketMessage.ticket_id == ticket_id,
        TicketMessage.is_incoming == True
    ).order_by(desc(TicketMessage.created_at)).first()
    
    if not latest_message:
        raise HTTPException(status_code=400, detail="No messages to process")
    
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
        db.commit()
        
        notify_on_urgent = db.query(Settings).filter(Settings.key == "slack_notify_on_urgent").first()
        if ticket.urgency == "High" and (not notify_on_urgent or notify_on_urgent.value != "false"):
            notify_urgent_ticket(db, ticket)
        else:
            notify_ticket_processed(db, ticket)
        
        return {"status": "processed", "result": result}
    else:
        raise HTTPException(status_code=500, detail="AI processing failed")


@router.post("/process-all")
def process_all_tickets(db: Session = Depends(get_db)):
    unprocessed = db.query(Ticket).filter(Ticket.ai_processed == False).all()
    processed_count = 0
    
    for ticket in unprocessed:
        latest_message = db.query(TicketMessage).filter(
            TicketMessage.ticket_id == ticket.id,
            TicketMessage.is_incoming == True
        ).order_by(desc(TicketMessage.created_at)).first()
        
        if not latest_message:
            continue
        
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
    
    db.commit()
    return {"processed": processed_count}


@router.put("/{ticket_id}/draft")
def update_draft(ticket_id: int, request: UpdateDraftRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    ticket.draft_response = request.draft_response
    db.commit()
    return {"status": "updated"}


@router.post("/{ticket_id}/approve")
def approve(ticket_id: int, db: Session = Depends(get_db)):
    success = approve_ticket(db, ticket_id)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"status": "approved"}


@router.post("/{ticket_id}/reject")
def reject(ticket_id: int, db: Session = Depends(get_db)):
    success = reject_ticket(db, ticket_id)
    if not success:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {"status": "rejected"}


@router.post("/{ticket_id}/send")
def send_response(ticket_id: int, db: Session = Depends(get_db)):
    success = send_approved_response(db, ticket_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not send response")
    return {"status": "sent"}


@router.post("/bulk-approve")
def bulk_approve(request: BulkActionRequest, db: Session = Depends(get_db)):
    approved_count = 0
    for ticket_id in request.ticket_ids:
        if approve_ticket(db, ticket_id):
            approved_count += 1
    return {"approved": approved_count}


@router.post("/bulk-reject")
def bulk_reject(request: BulkActionRequest, db: Session = Depends(get_db)):
    rejected_count = 0
    for ticket_id in request.ticket_ids:
        if reject_ticket(db, ticket_id):
            rejected_count += 1
    return {"rejected": rejected_count}


@router.post("/bulk-send")
def bulk_send(request: BulkActionRequest, db: Session = Depends(get_db)):
    sent_count = 0
    for ticket_id in request.ticket_ids:
        if send_approved_response(db, ticket_id):
            sent_count += 1
    return {"sent": sent_count}