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
    "openai_api_key", "scheduler_enabled", "scheduler_interval_minutes"
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
