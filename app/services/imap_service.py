"""
IMAP Email Service Module
=========================
This module handles fetching unread emails from an IMAP mailbox.

IMAP (Internet Message Access Protocol) is used to read emails from a mail server.
This service connects to the configured IMAP server, fetches unread emails,
and extracts the relevant data for creating support tickets.

WORKFLOW:
1. Connect to IMAP server using SSL (port 993)
2. Log in with username/password
3. Search for unread (UNSEEN) emails
4. For each email, extract:
   - Sender email address
   - Subject line
   - Body content (plain text preferred over HTML)
   - Message threading information
   - Received timestamp

CONFIGURATION:
Settings can be provided via database (Settings table) or environment variables:
- IMAP_HOST: Mail server hostname (e.g., imap.gmail.com)
- IMAP_PORT: Server port (default 993 for SSL)
- IMAP_USERNAME: Email account username
- IMAP_PASSWORD: Email account password or app-specific password

TROUBLESHOOTING:
- "IMAP not configured": Set IMAP environment variables or database settings
- Connection errors: Check hostname and port; ensure firewall allows access
- Login failures: For Gmail, use an App Password (not your regular password)
- No emails found: Check if emails are already marked as read
"""

import imaplib
import email
from email.header import decode_header
from datetime import datetime
from typing import List, Optional, Dict, Any
import re
import os


def get_imap_config(db=None):
    """
    Get IMAP configuration from database settings or environment variables.
    
    Checks database settings first (if db session provided), then falls
    back to environment variables. This allows users to configure IMAP
    through the Settings UI without restarting the application.
    
    Args:
        db: Optional SQLAlchemy database session
        
    Returns:
        Tuple of (host, port, username, password)
        
    CONFIGURATION PRIORITY:
    1. Database Settings (user-configured via Settings page)
    2. Environment Variables (set at deployment time)
    """
    # Try database settings first
    if db:
        from app.models import Settings
        settings = {s.key: s.value for s in db.query(Settings).all()}
        host = settings.get("imap_host")
        port = int(settings.get("imap_port") or "993")
        username = settings.get("imap_username")
        password = settings.get("imap_password")
        if all([host, username, password]):
            return host, port, username, password
    
    # Fall back to environment variables
    host = os.environ.get("IMAP_HOST", "")
    port = int(os.environ.get("IMAP_PORT", "993"))
    username = os.environ.get("IMAP_USERNAME", "")
    password = os.environ.get("IMAP_PASSWORD", "")
    return host, port, username, password


def decode_mime_header(header_value: str) -> str:
    """
    Decode a MIME-encoded email header value.
    
    Email headers can contain encoded characters (for non-ASCII text).
    This function decodes them to regular Python strings.
    
    Examples:
    - "=?utf-8?q?Hello_World?=" -> "Hello World"
    - "=?iso-8859-1?q?Caf=E9?=" -> "Café"
    
    Args:
        header_value: The raw MIME-encoded header value
        
    Returns:
        Decoded string, or empty string if header is None
    """
    if not header_value:
        return ""
    
    decoded_parts = decode_header(header_value)
    result = []
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            # Decode bytes using specified encoding (or UTF-8 as fallback)
            result.append(part.decode(encoding or 'utf-8', errors='replace'))
        else:
            result.append(part)
    return ''.join(result)


def extract_email_body(msg) -> str:
    """
    Extract the text body from an email message.
    
    Emails can be:
    - Plain text only
    - HTML only
    - Multipart (containing both text and HTML versions)
    
    This function prefers plain text for easier processing.
    For HTML-only emails, it strips the HTML tags to get text.
    
    Args:
        msg: Email message object (from email.message_from_bytes)
        
    Returns:
        The email body as plain text
    """
    body = ""
    
    if msg.is_multipart():
        # Walk through all parts of the multipart message
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            # Prefer plain text, skip attachments
            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    body = payload.decode(charset, errors='replace')
                    break  # Found plain text, stop looking
            # Fall back to HTML if no plain text found yet
            elif content_type == "text/html" and not body and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    html_body = payload.decode(charset, errors='replace')
                    # Strip HTML tags to get plain text
                    body = re.sub('<[^<]+?>', '', html_body)
    else:
        # Simple non-multipart message
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
    
    return body.strip()


def extract_thread_id(msg) -> Optional[str]:
    """
    Extract the thread ID from an email's headers.
    
    Email threading is tracked using:
    - References: List of message IDs in the thread
    - In-Reply-To: The message ID this email is replying to
    
    The first message ID in References is typically the thread root.
    
    Args:
        msg: Email message object
        
    Returns:
        Thread ID string, or None if this is a new thread
    """
    # Check References header first (more reliable for threads)
    references = msg.get("References", "")
    if references:
        ref_list = references.split()
        if ref_list:
            return ref_list[0].strip("<>")
    
    # Fall back to In-Reply-To
    in_reply_to = msg.get("In-Reply-To", "")
    if in_reply_to:
        return in_reply_to.strip("<>")
    
    return None


def fetch_unread_emails(db=None) -> List[Dict[str, Any]]:
    """
    Fetch all unread emails from the configured IMAP inbox.
    
    Connects to the IMAP server, retrieves unread emails, and extracts
    the relevant data for ticket creation. Emails are marked as read
    by the IMAP server after being fetched (UNSEEN -> SEEN).
    
    Args:
        db: Optional database session for getting IMAP config from Settings
        
    Returns:
        List of dictionaries, each containing:
        - sender_email: Customer's email address
        - subject: Email subject line
        - body: Email body text
        - message_id: Unique email identifier
        - in_reply_to: ID of parent message (for replies)
        - thread_id: ID of the email thread
        - received_at: DateTime when email was received
        
    Example return value:
    [
        {
            "sender_email": "customer@example.com",
            "subject": "Help with billing",
            "body": "I have a question about my invoice...",
            "message_id": "abc123@mail.example.com",
            "in_reply_to": None,
            "thread_id": "abc123@mail.example.com",
            "received_at": datetime(2025, 12, 15, 10, 30, 0)
        }
    ]
    
    TROUBLESHOOTING:
    - Returns empty list if IMAP is not configured
    - Connection errors are logged to console
    - Gmail requires App Password, not regular password
    """
    host, port, username, password = get_imap_config(db)
    
    # Check if IMAP is properly configured
    if not all([host, username, password]):
        print("IMAP not configured")
        return []
    
    emails_data = []
    
    try:
        # Connect to IMAP server using SSL
        mail = imaplib.IMAP4_SSL(host, port)
        mail.login(username, password)
        mail.select("INBOX")
        
        # Search for unread emails
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            return []
        
        email_ids = messages[0].split()
        
        # Process each unread email
        for email_id in email_ids:
            # Fetch the full email (RFC822 format)
            status, msg_data = mail.fetch(email_id, "(RFC822)")
            if status != "OK":
                continue
            
            # Parse the raw email data
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            # Extract sender email address
            sender = decode_mime_header(msg.get("From", ""))
            sender_email = ""
            if "<" in sender and ">" in sender:
                # Format: "Name <email@example.com>"
                sender_email = sender.split("<")[1].split(">")[0]
            else:
                # Format: "email@example.com"
                sender_email = sender
            
            # Extract other fields
            subject = decode_mime_header(msg.get("Subject", ""))
            message_id = msg.get("Message-ID", "").strip("<>")
            in_reply_to = msg.get("In-Reply-To", "").strip("<>") if msg.get("In-Reply-To") else None
            thread_id = extract_thread_id(msg)
            body = extract_email_body(msg)
            
            # Parse the date header
            date_str = msg.get("Date", "")
            try:
                received_at = email.utils.parsedate_to_datetime(date_str)
            except:
                received_at = datetime.utcnow()
            
            # Add to results
            emails_data.append({
                "sender_email": sender_email,
                "subject": subject,
                "body": body,
                "message_id": message_id,
                "in_reply_to": in_reply_to,
                "thread_id": thread_id or message_id,  # Use message_id if no thread
                "received_at": received_at,
            })
        
        # Disconnect cleanly
        mail.logout()
    except Exception as e:
        print(f"IMAP Error: {e}")
    
    return emails_data
