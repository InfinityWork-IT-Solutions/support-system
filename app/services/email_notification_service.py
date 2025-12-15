import re
from sqlalchemy.orm import Session
from app.models import Ticket, TeamMember, Settings
from app.services.smtp_service import send_email


def is_valid_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))


def get_email_notification_settings(db: Session) -> dict:
    settings = db.query(Settings).filter(
        Settings.key.in_([
            "email_notify_enabled",
            "email_notify_urgent_only",
            "email_notify_recipients"
        ])
    ).all()
    settings_dict = {s.key: s.value for s in settings}
    
    return {
        "enabled": settings_dict.get("email_notify_enabled", "false") == "true",
        "urgent_only": settings_dict.get("email_notify_urgent_only", "true") == "true",
        "recipients": settings_dict.get("email_notify_recipients", "all")
    }


def get_notification_recipients(db: Session, settings: dict) -> list:
    recipients_setting = settings.get("recipients", "all")
    
    if recipients_setting == "none":
        return []
    
    if recipients_setting == "all":
        members = db.query(TeamMember).filter(TeamMember.is_active == True).all()
        emails = [m.email for m in members if m.email and is_valid_email(m.email)]
        return list(set(emails))
    
    custom_emails = [e.strip() for e in recipients_setting.split(",") if e.strip() and is_valid_email(e.strip())]
    return list(set(custom_emails))


def send_urgent_ticket_notification(db: Session, ticket: Ticket) -> dict:
    settings = get_email_notification_settings(db)
    
    if not settings["enabled"]:
        return {"sent": 0, "reason": "notifications_disabled"}
    
    if settings["urgent_only"] and ticket.urgency != "High":
        return {"sent": 0, "reason": "not_urgent"}
    
    recipients = get_notification_recipients(db, settings)
    
    if not recipients:
        return {"sent": 0, "reason": "no_recipients"}
    
    subject = f"[URGENT] New Support Ticket: {ticket.subject}"
    if ticket.urgency != "High":
        subject = f"[{ticket.urgency or 'New'}] Support Ticket: {ticket.subject}"
    
    body = f"""A new support ticket requires attention.

Ticket ID: #{ticket.id}
Subject: {ticket.subject}
From: {ticket.sender_email}
Urgency: {ticket.urgency or 'Not classified'}
Category: {ticket.category or 'Not classified'}

Summary:
{ticket.summary or 'Not yet processed by AI'}

---
View and respond to this ticket in the AI Support Desk dashboard.
"""
    
    sent_count = 0
    failed = []
    for recipient in recipients:
        try:
            success = send_email(
                to_email=recipient,
                subject=subject,
                body=body,
                db=db
            )
            if success:
                sent_count += 1
            else:
                failed.append(recipient)
        except Exception as e:
            failed.append(recipient)
            print(f"Email notification failed for {recipient}: {e}")
    
    return {"sent": sent_count, "total_recipients": len(recipients), "failed": len(failed)}


def send_sla_breach_notification(db: Session, ticket: Ticket) -> dict:
    settings = get_email_notification_settings(db)
    
    if not settings["enabled"]:
        return {"sent": 0, "reason": "notifications_disabled"}
    
    recipients = get_notification_recipients(db, settings)
    
    if not recipients:
        return {"sent": 0, "reason": "no_recipients"}
    
    subject = f"[SLA BREACH] Ticket #{ticket.id}: {ticket.subject}"
    
    body = f"""ALERT: A ticket has breached its SLA deadline.

Ticket ID: #{ticket.id}
Subject: {ticket.subject}
From: {ticket.sender_email}
Urgency: {ticket.urgency or 'Not classified'}
Category: {ticket.category or 'Not classified'}
SLA Deadline: {ticket.sla_deadline.strftime('%Y-%m-%d %H:%M UTC') if ticket.sla_deadline else 'Not set'}

This ticket requires immediate attention.

---
View and respond to this ticket in the AI Support Desk dashboard.
"""
    
    sent_count = 0
    failed = []
    for recipient in recipients:
        try:
            success = send_email(
                to_email=recipient,
                subject=subject,
                body=body,
                db=db
            )
            if success:
                sent_count += 1
            else:
                failed.append(recipient)
        except Exception as e:
            failed.append(recipient)
            print(f"Email notification failed for {recipient}: {e}")
    
    return {"sent": sent_count, "total_recipients": len(recipients), "failed": len(failed)}
