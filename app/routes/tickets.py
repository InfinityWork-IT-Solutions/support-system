from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from pydantic import BaseModel

from app.database import get_db
from app.models import Ticket, TicketMessage, ApprovalStatus
from app.services.imap_service import fetch_unread_emails
from app.services.ai_service import process_ticket
from app.services.approval_service import approve_ticket, reject_ticket, send_approved_response

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