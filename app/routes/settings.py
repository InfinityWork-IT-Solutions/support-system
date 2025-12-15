from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import Settings
from app.services.scheduler_service import (
    start_scheduler, stop_scheduler, get_scheduler_status, update_scheduler_interval
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTING_KEYS = [
    "imap_host", "imap_port", "imap_username", "imap_password",
    "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email",
    "openai_api_key", "scheduler_enabled", "scheduler_interval_minutes",
    "slack_webhook_url", "slack_notify_on_new", "slack_notify_on_urgent", "slack_notify_on_process"
]


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]


def get_setting(db: Session, key: str) -> Optional[str]:
    setting = db.query(Settings).filter(Settings.key == key).first()
    return setting.value if setting else None


def set_setting(db: Session, key: str, value: str):
    setting = db.query(Settings).filter(Settings.key == key).first()
    if setting:
        setting.value = value
    else:
        setting = Settings(key=key, value=value)
        db.add(setting)
    db.commit()


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(Settings).all()
    result = {s.key: s.value for s in settings}
    
    safe_result = {}
    for key in SETTING_KEYS:
        value = result.get(key, "")
        if key in ["imap_password", "smtp_password", "openai_api_key"] and value:
            safe_result[key] = "********"
        else:
            safe_result[key] = value or ""
    
    return safe_result


@router.put("/")
def update_settings(request: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in request.settings.items():
        if key in SETTING_KEYS:
            if value and value != "********":
                set_setting(db, key, value)
    return {"status": "updated"}


@router.post("/test-imap")
def test_imap_connection(db: Session = Depends(get_db)):
    import imaplib
    
    host = get_setting(db, "imap_host")
    port = int(get_setting(db, "imap_port") or "993")
    username = get_setting(db, "imap_username")
    password = get_setting(db, "imap_password")
    
    if not all([host, username, password]):
        return {"success": False, "message": "IMAP settings not configured"}
    
    try:
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(username, password)
        mail.logout()
        return {"success": True, "message": "IMAP connection successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/test-smtp")
def test_smtp_connection(db: Session = Depends(get_db)):
    import smtplib
    
    host = get_setting(db, "smtp_host")
    port = int(get_setting(db, "smtp_port") or "587")
    username = get_setting(db, "smtp_username")
    password = get_setting(db, "smtp_password")
    
    if not all([host, username, password]):
        return {"success": False, "message": "SMTP settings not configured"}
    
    try:
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(username, password)
        return {"success": True, "message": "SMTP connection successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}


class SchedulerUpdate(BaseModel):
    enabled: bool
    interval_minutes: int = 5


@router.get("/scheduler")
def get_scheduler(db: Session = Depends(get_db)):
    enabled = get_setting(db, "scheduler_enabled") == "true"
    interval = int(get_setting(db, "scheduler_interval_minutes") or "5")
    status = get_scheduler_status()
    return {
        "enabled": enabled,
        "interval_minutes": interval,
        "running": status["running"]
    }


@router.post("/scheduler")
def update_scheduler(request: SchedulerUpdate, db: Session = Depends(get_db)):
    set_setting(db, "scheduler_enabled", "true" if request.enabled else "false")
    set_setting(db, "scheduler_interval_minutes", str(request.interval_minutes))
    
    if request.enabled:
        stop_scheduler()
        start_scheduler(request.interval_minutes)
    else:
        stop_scheduler()
    
    return {"status": "updated", "enabled": request.enabled, "interval_minutes": request.interval_minutes}


@router.post("/scheduler/start")
def start_scheduler_endpoint(db: Session = Depends(get_db)):
    interval = int(get_setting(db, "scheduler_interval_minutes") or "5")
    set_setting(db, "scheduler_enabled", "true")
    start_scheduler(interval)
    return {"status": "started", "interval_minutes": interval}


@router.post("/scheduler/stop")
def stop_scheduler_endpoint(db: Session = Depends(get_db)):
    set_setting(db, "scheduler_enabled", "false")
    stop_scheduler()
    return {"status": "stopped"}


class SlackSettings(BaseModel):
    webhook_url: str
    notify_on_new: bool = True
    notify_on_urgent: bool = True
    notify_on_process: bool = False


@router.get("/slack")
def get_slack_settings(db: Session = Depends(get_db)):
    webhook_url = get_setting(db, "slack_webhook_url") or ""
    return {
        "webhook_url": "********" if webhook_url else "",
        "notify_on_new": get_setting(db, "slack_notify_on_new") == "true",
        "notify_on_urgent": get_setting(db, "slack_notify_on_urgent") != "false",
        "notify_on_process": get_setting(db, "slack_notify_on_process") == "true",
        "configured": bool(webhook_url)
    }


@router.post("/slack")
def update_slack_settings(request: SlackSettings, db: Session = Depends(get_db)):
    if request.webhook_url and request.webhook_url != "********":
        set_setting(db, "slack_webhook_url", request.webhook_url)
    set_setting(db, "slack_notify_on_new", "true" if request.notify_on_new else "false")
    set_setting(db, "slack_notify_on_urgent", "true" if request.notify_on_urgent else "false")
    set_setting(db, "slack_notify_on_process", "true" if request.notify_on_process else "false")
    return {"status": "updated"}


@router.post("/slack/test")
def test_slack(db: Session = Depends(get_db)):
    from app.services.slack_service import test_slack_webhook, get_slack_webhook_url
    
    webhook_url = get_slack_webhook_url(db)
    if not webhook_url:
        return {"success": False, "message": "Slack webhook URL not configured"}
    
    return test_slack_webhook(webhook_url)


class AutoResponderSettings(BaseModel):
    enabled: bool = False
    template: Optional[str] = None


@router.get("/auto-responder")
def get_auto_responder_settings(db: Session = Depends(get_db)):
    from app.services.auto_responder_service import DEFAULT_AUTO_RESPONSE_TEMPLATE
    enabled = get_setting(db, "auto_responder_enabled") == "true"
    template = get_setting(db, "auto_responder_template") or DEFAULT_AUTO_RESPONSE_TEMPLATE
    return {
        "enabled": enabled,
        "template": template
    }


@router.post("/auto-responder")
def update_auto_responder_settings(request: AutoResponderSettings, db: Session = Depends(get_db)):
    set_setting(db, "auto_responder_enabled", "true" if request.enabled else "false")
    if request.template:
        set_setting(db, "auto_responder_template", request.template)
    return {"status": "updated"}


class EmailNotificationSettings(BaseModel):
    enabled: bool = False
    urgent_only: bool = True
    recipients: str = "all"


@router.get("/email-notifications")
def get_email_notification_settings(db: Session = Depends(get_db)):
    from app.services.email_notification_service import get_email_notification_settings as get_settings
    settings = get_settings(db)
    return settings


@router.post("/email-notifications")
def update_email_notification_settings(request: EmailNotificationSettings, db: Session = Depends(get_db)):
    set_setting(db, "email_notify_enabled", "true" if request.enabled else "false")
    set_setting(db, "email_notify_urgent_only", "true" if request.urgent_only else "false")
    set_setting(db, "email_notify_recipients", request.recipients)
    return {"status": "updated"}


@router.post("/email-notifications/test")
def test_email_notification(db: Session = Depends(get_db)):
    from app.services.smtp_service import get_smtp_config
    from app.services.email_notification_service import get_notification_recipients, get_email_notification_settings as get_settings
    
    config = get_smtp_config(db)
    if not all(config[:4]):
        return {"success": False, "message": "SMTP not configured"}
    
    settings = get_settings(db)
    if not settings["enabled"]:
        return {"success": False, "message": "Email notifications are disabled"}
    
    recipients = get_notification_recipients(db, settings)
    if not recipients:
        return {"success": False, "message": "No recipients configured"}
    
    from app.services.smtp_service import send_email
    success = send_email(
        to_email=recipients[0],
        subject="[TEST] AI Support Desk Email Notification",
        body="This is a test email from AI Support Desk email notifications.\n\nIf you received this, email notifications are working correctly.",
        db=db
    )
    
    if success:
        return {"success": True, "message": f"Test email sent to {recipients[0]}"}
    else:
        return {"success": False, "message": "Failed to send test email"}
