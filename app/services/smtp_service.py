"""
SMTP Email Service Module
=========================
This module handles sending emails via SMTP.

SMTP (Simple Mail Transfer Protocol) is used to send emails to customers.
When a support agent approves a response, this service sends it to the customer.

WORKFLOW:
1. Get SMTP configuration from database or environment
2. Create email message with proper headers
3. Connect to SMTP server using TLS encryption
4. Authenticate and send the email

CONFIGURATION:
Settings can be provided via database (Settings table) or environment variables:
- SMTP_HOST: Mail server hostname (e.g., smtp.gmail.com)
- SMTP_PORT: Server port (default 587 for TLS)
- SMTP_USERNAME: Email account username
- SMTP_PASSWORD: Email account password or app-specific password
- SMTP_FROM_EMAIL: Sender email address (shown as "From")

THREADING:
To maintain email threads (conversation grouping in email clients),
we set In-Reply-To and References headers when responding to tickets.

TROUBLESHOOTING:
- "SMTP not configured": Set SMTP environment variables or database settings
- Connection errors: Check hostname and port; ensure firewall allows access
- Authentication failures: For Gmail, use an App Password
- Emails going to spam: Check DKIM/SPF settings for your domain
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os


def get_smtp_config(db=None):
    """
    Get SMTP configuration from database settings or environment variables.
    
    Checks database settings first (if db session provided), then falls
    back to environment variables. This allows users to configure SMTP
    through the Settings UI without restarting the application.
    
    Args:
        db: Optional SQLAlchemy database session
        
    Returns:
        Tuple of (host, port, username, password, from_email)
        
    CONFIGURATION PRIORITY:
    1. Database Settings (user-configured via Settings page)
    2. Environment Variables (set at deployment time)
    """
    # Try database settings first
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
    
    # Fall back to environment variables
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
    """
    Send an email via SMTP.
    
    This function handles all the details of connecting to the SMTP server,
    building the email message with proper headers, and sending it.
    
    Args:
        to_email: Recipient's email address
        subject: Email subject line
        body: Email body content (plain text)
        in_reply_to: Optional message ID this email is replying to
                    (enables email threading in recipient's client)
        references: Optional chain of message IDs for thread tracking
        db: Optional database session for getting SMTP config from Settings
        
    Returns:
        True if email was sent successfully, False otherwise
        
    EMAIL THREADING:
    When replying to a customer's email, set in_reply_to to their message ID.
    This causes the response to appear in the same thread in their email client.
    
    Example:
        send_email(
            to_email="customer@example.com",
            subject="Re: Help with billing",
            body="Thank you for contacting us...",
            in_reply_to="original-message-id@customer.com"
        )
        
    TROUBLESHOOTING:
    - Returns False if SMTP is not configured
    - Connection and auth errors are logged to console
    - Check spam folder if recipient doesn't receive email
    """
    host, port, username, password, from_email = get_smtp_config(db)
    
    # Check if SMTP is properly configured
    if not all([host, username, password, from_email]):
        print("SMTP not configured")
        return False
    
    try:
        # Build the email message
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Set threading headers if this is a reply
        if in_reply_to:
            # In-Reply-To: The message this is replying to
            msg['In-Reply-To'] = f"<{in_reply_to}>"
        if references:
            # References: Chain of all message IDs in the thread
            msg['References'] = references
        
        # Attach the body as plain text
        msg.attach(MIMEText(body, 'plain'))
        
        # Connect and send
        with smtplib.SMTP(host, port) as server:
            # Upgrade to TLS for security
            server.starttls()
            # Authenticate
            server.login(username, password)
            # Send the message
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        return False
