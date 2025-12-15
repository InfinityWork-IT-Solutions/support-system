import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os


def get_smtp_config(db=None):
    if db:
        from app.models import Settings
        settings = {s.key: s.value for s in db.query(Settings).all()}
        host = settings.get("smtp_host")
        port = int(settings.get("smtp_port") or "587")
        username = settings.get("smtp_username")
        password = settings.get("smtp_password")
        from_email = settings.get("smtp_from_email")
        if all([host, username, password, from_email]):
            return host, port, username, password, from_email
    
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    username = os.environ.get("SMTP_USERNAME", "")
    password = os.environ.get("SMTP_PASSWORD", "")
    from_email = os.environ.get("SMTP_FROM_EMAIL", "")
    return host, port, username, password, from_email


def send_email(
    to_email: str,
    subject: str,
    body: str,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
    db=None
) -> bool:
    host, port, username, password, from_email = get_smtp_config(db)
    
    if not all([host, username, password, from_email]):
        print("SMTP not configured")
        return False
    
    try:
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        
        if in_reply_to:
            msg['In-Reply-To'] = f"<{in_reply_to}>"
        if references:
            msg['References'] = references
        
        msg.attach(MIMEText(body, 'plain'))
        
        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(username, password)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False
