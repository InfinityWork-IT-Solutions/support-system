from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import Ticket, Settings


SLA_HOURS = {
    "High": 4,
    "Medium": 8,
    "Low": 24
}

PRIORITY_WEIGHTS = {
    "High": 100,
    "Medium": 50,
    "Low": 10
}


def get_sla_hours(db: Session) -> dict:
    settings_keys = ["sla_hours_high", "sla_hours_medium", "sla_hours_low"]
    settings = db.query(Settings).filter(Settings.key.in_(settings_keys)).all()
    settings_dict = {s.key: s.value for s in settings}
    
    return {
        "High": int(settings_dict.get("sla_hours_high", SLA_HOURS["High"])),
        "Medium": int(settings_dict.get("sla_hours_medium", SLA_HOURS["Medium"])),
        "Low": int(settings_dict.get("sla_hours_low", SLA_HOURS["Low"]))
    }


def calculate_sla_deadline(db: Session, urgency: str, received_at: datetime) -> datetime:
    sla_hours = get_sla_hours(db)
    hours = sla_hours.get(urgency, 24)
    return received_at + timedelta(hours=hours)


def calculate_priority_score(ticket: Ticket) -> int:
    base_score = PRIORITY_WEIGHTS.get(ticket.urgency, 10) if ticket.urgency else 10
    
    if ticket.received_at:
        hours_waiting = (datetime.utcnow() - ticket.received_at).total_seconds() / 3600
        time_bonus = int(hours_waiting * 2)
        base_score += time_bonus
    
    if ticket.sla_deadline:
        hours_until_deadline = (ticket.sla_deadline - datetime.utcnow()).total_seconds() / 3600
        if hours_until_deadline < 0:
            base_score += 200
        elif hours_until_deadline < 2:
            base_score += 100
        elif hours_until_deadline < 4:
            base_score += 50
    
    if ticket.escalation_required:
        base_score += 75
    
    return base_score


def update_ticket_sla(db: Session, ticket: Ticket):
    if ticket.urgency and ticket.received_at:
        ticket.sla_deadline = calculate_sla_deadline(db, ticket.urgency, ticket.received_at)
    
    ticket.priority_score = calculate_priority_score(ticket)
    
    if ticket.sla_deadline and datetime.utcnow() > ticket.sla_deadline:
        if not ticket.sent_at:
            ticket.sla_breached = True
    
    db.commit()


def update_all_sla_status(db: Session):
    pending_tickets = db.query(Ticket).filter(
        Ticket.sent_at.is_(None),
        Ticket.approval_status != "REJECTED"
    ).all()
    
    breached_count = 0
    recalculated_count = 0
    now = datetime.utcnow()
    
    for ticket in pending_tickets:
        if ticket.urgency and ticket.received_at:
            new_deadline = calculate_sla_deadline(db, ticket.urgency, ticket.received_at)
            if ticket.sla_deadline != new_deadline:
                ticket.sla_deadline = new_deadline
                recalculated_count += 1
            
            if now > ticket.sla_deadline:
                if not ticket.sla_breached:
                    ticket.sla_breached = True
                    breached_count += 1
            else:
                if ticket.sla_breached:
                    ticket.sla_breached = False
        
        ticket.priority_score = calculate_priority_score(ticket)
    
    db.commit()
    return {"updated": len(pending_tickets), "recalculated": recalculated_count, "newly_breached": breached_count}


def get_priority_queue(db: Session, limit: int = 20):
    update_all_sla_status(db)
    
    tickets = db.query(Ticket).filter(
        Ticket.sent_at.is_(None),
        Ticket.approval_status != "REJECTED"
    ).order_by(desc(Ticket.priority_score)).limit(limit).all()
    
    return tickets


def get_sla_summary(db: Session):
    now = datetime.utcnow()
    
    active_tickets = db.query(Ticket).filter(
        Ticket.sent_at.is_(None),
        Ticket.approval_status != "REJECTED"
    )
    
    total_active = active_tickets.count()
    breached = active_tickets.filter(Ticket.sla_breached == True).count()
    
    at_risk = active_tickets.filter(
        Ticket.sla_deadline.isnot(None),
        Ticket.sla_breached == False,
        Ticket.sla_deadline < now + timedelta(hours=2)
    ).count()
    
    on_track = total_active - breached - at_risk
    
    high_priority = active_tickets.filter(Ticket.urgency == "High").count()
    medium_priority = active_tickets.filter(Ticket.urgency == "Medium").count()
    low_priority = active_tickets.filter(Ticket.urgency == "Low").count()
    
    return {
        "total_active": total_active,
        "breached": breached,
        "at_risk": at_risk,
        "on_track": on_track,
        "by_urgency": {
            "high": high_priority,
            "medium": medium_priority,
            "low": low_priority
        }
    }
