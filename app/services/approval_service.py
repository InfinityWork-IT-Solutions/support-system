from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Ticket, TicketMessage, ApprovalStatus
from app.services.smtp_service import send_email


def approve_ticket(db: Session, ticket_id: int, approved_by: str = "admin") -> bool:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        return False
    
    ticket.approval_status = ApprovalStatus.APPROVED.value
    ticket.approved_by = approved_by
    ticket.approved_at = datetime.utcnow()
    db.commit()
    return True


def reject_ticket(db: Session, ticket_id: int, approved_by: str = "admin") -> bool:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        return False
    
    ticket.approval_status = ApprovalStatus.REJECTED.value
    ticket.approved_by = approved_by
    ticket.approved_at = datetime.utcnow()
    db.commit()
    return True


def send_approved_response(db: Session, ticket_id: int) -> bool:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        return False
    
    if ticket.approval_status != ApprovalStatus.APPROVED.value:
        return False
    
    if not ticket.draft_response:
        return False
    
    subject = f"Re: {ticket.subject}"
    
    success = send_email(
        to_email=ticket.sender_email,
        subject=subject,
        body=ticket.draft_response,
        in_reply_to=ticket.message_id,
        references=ticket.message_id
    )
    
    if success:
        ticket.sent_at = datetime.utcnow()
        
        outgoing_message = TicketMessage(
            ticket_id=ticket.id,
            sender_email="support@infinityworkitsolutions.com",
            subject=subject,
            body=ticket.draft_response,
            is_incoming=False,
            in_reply_to=ticket.message_id
        )
        db.add(outgoing_message)
        db.commit()
    
    return success
