import os
import json
from typing import Optional
import urllib.request
import urllib.error


def get_slack_webhook_url(db=None) -> Optional[str]:
    if db:
        from app.models import Settings
        setting = db.query(Settings).filter(Settings.key == "slack_webhook_url").first()
        if setting and setting.value:
            return setting.value
    
    return os.environ.get("SLACK_WEBHOOK_URL")


def send_slack_notification(
    webhook_url: str,
    title: str,
    message: str,
    urgency: Optional[str] = None,
    ticket_id: Optional[int] = None,
    sender: Optional[str] = None,
    category: Optional[str] = None
) -> bool:
    if not webhook_url:
        return False
    
    urgency_emoji = {
        "High": ":rotating_light:",
        "Medium": ":warning:",
        "Low": ":information_source:"
    }.get(urgency, ":ticket:")
    
    urgency_color = {
        "High": "#ef4444",
        "Medium": "#eab308",
        "Low": "#22c55e"
    }.get(urgency, "#3b82f6")
    
    fields = []
    if sender:
        fields.append({"title": "From", "value": sender, "short": True})
    if category:
        fields.append({"title": "Category", "value": category, "short": True})
    if urgency:
        fields.append({"title": "Urgency", "value": f"{urgency_emoji} {urgency}", "short": True})
    if ticket_id:
        fields.append({"title": "Ticket ID", "value": f"#{ticket_id}", "short": True})
    
    payload = {
        "attachments": [
            {
                "color": urgency_color,
                "title": title,
                "text": message[:500] + "..." if len(message) > 500 else message,
                "fields": fields,
                "footer": "AI Support Desk",
                "ts": int(__import__("time").time())
            }
        ]
    }
    
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status == 200
    except Exception as e:
        print(f"[Slack] Error sending notification: {e}")
        return False


def notify_new_ticket(db, ticket) -> bool:
    webhook_url = get_slack_webhook_url(db)
    if not webhook_url:
        return False
    
    return send_slack_notification(
        webhook_url=webhook_url,
        title=f"New Support Ticket: {ticket.subject}",
        message=f"A new support ticket has been received and is awaiting processing.",
        urgency=ticket.urgency,
        ticket_id=ticket.id,
        sender=ticket.sender_email,
        category=ticket.category
    )


def notify_urgent_ticket(db, ticket) -> bool:
    webhook_url = get_slack_webhook_url(db)
    if not webhook_url:
        return False
    
    return send_slack_notification(
        webhook_url=webhook_url,
        title=f":rotating_light: URGENT: {ticket.subject}",
        message=f"A high-urgency ticket requires immediate attention!\n\n*Summary:* {ticket.summary or 'Processing...'}",
        urgency="High",
        ticket_id=ticket.id,
        sender=ticket.sender_email,
        category=ticket.category
    )


def notify_ticket_processed(db, ticket) -> bool:
    webhook_url = get_slack_webhook_url(db)
    if not webhook_url:
        return False
    
    from app.models import Settings
    notify_on_process = db.query(Settings).filter(Settings.key == "slack_notify_on_process").first()
    if not notify_on_process or notify_on_process.value != "true":
        return False
    
    return send_slack_notification(
        webhook_url=webhook_url,
        title=f"Ticket Processed: {ticket.subject}",
        message=f"AI has analyzed this ticket and generated a draft response.\n\n*Summary:* {ticket.summary}",
        urgency=ticket.urgency,
        ticket_id=ticket.id,
        sender=ticket.sender_email,
        category=ticket.category
    )


def test_slack_webhook(webhook_url: str) -> dict:
    success = send_slack_notification(
        webhook_url=webhook_url,
        title="Test Notification",
        message="This is a test message from AI Support Desk. If you see this, your Slack integration is working correctly!",
        urgency="Low"
    )
    
    if success:
        return {"success": True, "message": "Test message sent successfully!"}
    else:
        return {"success": False, "message": "Failed to send test message. Please check your webhook URL."}
