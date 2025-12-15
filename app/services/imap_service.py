import imaplib
import email
from email.header import decode_header
from datetime import datetime
from typing import List, Optional, Dict, Any
import re
from app.config import IMAP_HOST, IMAP_PORT, IMAP_USERNAME, IMAP_PASSWORD


def decode_mime_header(header_value: str) -> str:
    if not header_value:
        return ""
    decoded_parts = decode_header(header_value)
    result = []
    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result.append(part.decode(encoding or 'utf-8', errors='replace'))
        else:
            result.append(part)
    return ''.join(result)


def extract_email_body(msg) -> str:
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    body = payload.decode(charset, errors='replace')
                    break
            elif content_type == "text/html" and not body and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or 'utf-8'
                    html_body = payload.decode(charset, errors='replace')
                    body = re.sub('<[^<]+?>', '', html_body)
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or 'utf-8'
            body = payload.decode(charset, errors='replace')
    return body.strip()


def extract_thread_id(msg) -> Optional[str]:
    references = msg.get("References", "")
    if references:
        ref_list = references.split()
        if ref_list:
            return ref_list[0].strip("<>")
    in_reply_to = msg.get("In-Reply-To", "")
    if in_reply_to:
        return in_reply_to.strip("<>")
    return None


def fetch_unread_emails() -> List[Dict[str, Any]]:
    if not all([IMAP_HOST, IMAP_USERNAME, IMAP_PASSWORD]):
        return []
    
    emails_data = []
    
    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        mail.login(IMAP_USERNAME, IMAP_PASSWORD)
        mail.select("INBOX")
        
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            return []
        
        email_ids = messages[0].split()
        
        for email_id in email_ids:
            status, msg_data = mail.fetch(email_id, "(RFC822)")
            if status != "OK":
                continue
            
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            sender = decode_mime_header(msg.get("From", ""))
            sender_email = ""
            if "<" in sender and ">" in sender:
                sender_email = sender.split("<")[1].split(">")[0]
            else:
                sender_email = sender
            
            subject = decode_mime_header(msg.get("Subject", ""))
            message_id = msg.get("Message-ID", "").strip("<>")
            in_reply_to = msg.get("In-Reply-To", "").strip("<>") if msg.get("In-Reply-To") else None
            thread_id = extract_thread_id(msg)
            body = extract_email_body(msg)
            
            date_str = msg.get("Date", "")
            try:
                received_at = email.utils.parsedate_to_datetime(date_str)
            except:
                received_at = datetime.utcnow()
            
            emails_data.append({
                "sender_email": sender_email,
                "subject": subject,
                "body": body,
                "message_id": message_id,
                "in_reply_to": in_reply_to,
                "thread_id": thread_id or message_id,
                "received_at": received_at,
            })
        
        mail.logout()
    except Exception as e:
        print(f"IMAP Error: {e}")
    
    return emails_data
