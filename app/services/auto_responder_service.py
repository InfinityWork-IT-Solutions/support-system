from typing import Optional
from app.services.smtp_service import send_email


DEFAULT_AUTO_RESPONSE_TEMPLATE = """Dear Customer,

Thank you for contacting InfinityWork IT Solutions. We have received your support request and a ticket has been created.

Your Ticket Reference: #{ticket_id}
Subject: {subject}

Our support team will review your request and respond as soon as possible. For urgent matters, please include "URGENT" in your subject line.

Thank you for your patience.

Best regards,
InfinityWork IT Solutions Support Team"""


def get_auto_responder_settings(db) -> dict:
    from app.models import Settings
    settings = {s.key: s.value for s in db.query(Settings).all()}
    return {
        "enabled": settings.get("auto_responder_enabled", "false").lower() == "true",
        "template": settings.get("auto_responder_template") or DEFAULT_AUTO_RESPONSE_TEMPLATE
    }


def send_acknowledgment(
    to_email: str,
    ticket_id: int,
    subject: str,
    db=None
) -> bool:
    if not db:
        return False
    
    settings = get_auto_responder_settings(db)
    if not settings["enabled"]:
        return False
    
    safe_subject = subject or "(no subject)"
    
    template = settings["template"]
    body = template.format(
        ticket_id=ticket_id,
        subject=safe_subject
    )
    
    if safe_subject.lower().startswith("re:"):
        reply_subject = safe_subject
    else:
        reply_subject = f"Re: {safe_subject}"
    
    return send_email(
        to_email=to_email,
        subject=reply_subject,
        body=body,
        db=db
    )
