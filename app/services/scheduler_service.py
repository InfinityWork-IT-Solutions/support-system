import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

_scheduler_thread: Optional[threading.Thread] = None
_scheduler_running = False
_scheduler_interval = 5
_stop_event = threading.Event()
_executor = ThreadPoolExecutor(max_workers=2)

MIN_INTERVAL_MINUTES = 1
MAX_INTERVAL_MINUTES = 60


def get_scheduler_status():
    return {
        "running": _scheduler_running and _scheduler_thread is not None and _scheduler_thread.is_alive(),
        "interval_minutes": _scheduler_interval
    }


def _fetch_and_process_emails_sync():
    from app.database import SessionLocal
    from app.services.imap_service import fetch_unread_emails
    from app.services.ai_service import process_ticket
    from app.services.sla_service import update_ticket_sla
    from app.services.email_notification_service import send_urgent_ticket_notification
    from app.models import Ticket, TicketMessage
    from sqlalchemy import desc
    
    db = SessionLocal()
    try:
        emails = fetch_unread_emails(db)
        created = 0
        processed = 0
        
        for email_data in emails:
            existing = db.query(Ticket).filter(
                Ticket.sender_email == email_data["sender_email"],
                Ticket.subject == email_data["subject"]
            ).first()
            
            if existing:
                message = TicketMessage(
                    ticket_id=existing.id,
                    sender_email=email_data["sender_email"],
                    subject=email_data["subject"],
                    body=email_data["body"],
                    is_incoming=True
                )
                db.add(message)
            else:
                ticket = Ticket(
                    sender_email=email_data["sender_email"],
                    subject=email_data["subject"],
                    thread_id=email_data.get("thread_id"),
                    received_at=email_data.get("received_at", datetime.utcnow())
                )
                db.add(ticket)
                db.flush()
                
                message = TicketMessage(
                    ticket_id=ticket.id,
                    sender_email=email_data["sender_email"],
                    subject=email_data["subject"],
                    body=email_data["body"],
                    is_incoming=True
                )
                db.add(message)
                created += 1
        
        db.commit()
        
        unprocessed = db.query(Ticket).filter(Ticket.ai_processed == False).all()
        for ticket in unprocessed:
            latest_message = db.query(TicketMessage).filter(
                TicketMessage.ticket_id == ticket.id,
                TicketMessage.is_incoming == True
            ).order_by(desc(TicketMessage.created_at)).first()
            
            if not latest_message:
                continue
            
            try:
                result = process_ticket(
                    ticket_id=ticket.id,
                    sender_email=ticket.sender_email,
                    subject=ticket.subject,
                    body=latest_message.body,
                    received_at=str(ticket.received_at),
                    db=db
                )
                
                if result:
                    ticket.category = result["category"]
                    ticket.urgency = result["urgency"]
                    ticket.summary = result["summary"]
                    ticket.fix_steps = result["fix_steps"]
                    ticket.draft_response = result["draft_response"]
                    ticket.ai_processed = True
                    processed += 1
                    
                    update_ticket_sla(db, ticket)
                    send_urgent_ticket_notification(db, ticket)
            except Exception as e:
                print(f"[Scheduler] Error processing ticket {ticket.id}: {e}")
        
        db.commit()
        print(f"[Scheduler] Fetched {len(emails)} emails, created {created} tickets, processed {processed} at {datetime.now()}")
        return len(emails), created, processed
    except Exception as e:
        print(f"[Scheduler] Error in fetch/process: {e}")
        db.rollback()
        return 0, 0, 0
    finally:
        db.close()


def _scheduler_loop():
    global _scheduler_running
    
    while not _stop_event.is_set():
        try:
            future = _executor.submit(_fetch_and_process_emails_sync)
            future.result(timeout=300)
        except Exception as e:
            print(f"[Scheduler] Error in fetch task: {e}")
        
        wait_seconds = _scheduler_interval * 60
        if _stop_event.wait(timeout=wait_seconds):
            break
    
    _scheduler_running = False
    print("[Scheduler] Loop ended")


def start_scheduler(interval_minutes: int = 5):
    global _scheduler_thread, _scheduler_running, _scheduler_interval, _stop_event
    
    interval_minutes = max(MIN_INTERVAL_MINUTES, min(MAX_INTERVAL_MINUTES, interval_minutes))
    
    if _scheduler_running and _scheduler_thread and _scheduler_thread.is_alive():
        print("[Scheduler] Already running, stopping first...")
        stop_scheduler()
    
    _stop_event.clear()
    _scheduler_interval = interval_minutes
    _scheduler_running = True
    
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    print(f"[Scheduler] Started with interval of {interval_minutes} minutes")


def stop_scheduler():
    global _scheduler_running, _scheduler_thread, _stop_event
    
    if not _scheduler_running:
        print("[Scheduler] Not running")
        return
    
    _stop_event.set()
    _scheduler_running = False
    
    if _scheduler_thread and _scheduler_thread.is_alive():
        _scheduler_thread.join(timeout=5)
        if _scheduler_thread.is_alive():
            print("[Scheduler] Warning: Thread did not stop within timeout")
    
    _scheduler_thread = None
    print("[Scheduler] Stopped")


def update_scheduler_interval(interval_minutes: int):
    global _scheduler_interval
    interval_minutes = max(MIN_INTERVAL_MINUTES, min(MAX_INTERVAL_MINUTES, interval_minutes))
    _scheduler_interval = interval_minutes
    print(f"[Scheduler] Interval updated to {interval_minutes} minutes")
