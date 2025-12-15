"""
Scheduler Service Module
========================
This module provides automatic email fetching and processing on a schedule.

The scheduler runs as a background thread that periodically:
1. Fetches new emails from the IMAP inbox
2. Creates tickets for new emails
3. Processes unprocessed tickets with AI
4. Updates SLA deadlines and sends notifications

WHY A BACKGROUND THREAD:
- Allows the web server to remain responsive
- Emails are fetched automatically without user action
- Configurable interval (1-60 minutes)

ARCHITECTURE:
- _scheduler_thread: Background thread running the fetch loop
- _scheduler_running: Flag to track if scheduler is active
- _scheduler_interval: Minutes between fetch cycles
- _stop_event: Thread-safe event for clean shutdown
- _executor: ThreadPoolExecutor for running sync code

CONFIGURATION:
- Enabled via Settings table: scheduler_enabled = "true"
- Interval via Settings table: scheduler_interval_minutes = "5"

TROUBLESHOOTING:
- Scheduler not starting: Check scheduler_enabled setting is "true"
- Double fetches: Stop scheduler before starting again
- Thread not stopping: May take up to the interval duration to stop
"""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

# Global state for the scheduler
_scheduler_thread: Optional[threading.Thread] = None
_scheduler_running = False
_scheduler_interval = 5  # Minutes between fetches
_stop_event = threading.Event()  # For clean shutdown
_executor = ThreadPoolExecutor(max_workers=2)  # For running sync tasks

# Limits for the fetch interval
MIN_INTERVAL_MINUTES = 1   # Don't fetch more than once per minute
MAX_INTERVAL_MINUTES = 60  # Fetch at least once per hour


def get_scheduler_status():
    """
    Get the current scheduler status.
    
    Returns a dictionary with:
    - running: Boolean indicating if scheduler is active
    - interval_minutes: Current interval between fetches
    
    Used by the Settings page to display scheduler status.
    """
    return {
        "running": _scheduler_running and _scheduler_thread is not None and _scheduler_thread.is_alive(),
        "interval_minutes": _scheduler_interval
    }


def _fetch_and_process_emails_sync():
    """
    Synchronously fetch and process all emails.
    
    This is the main work function called by the scheduler loop.
    It runs in a separate thread to avoid blocking the main server.
    
    Steps:
    1. Fetch unread emails from IMAP
    2. Create tickets for new emails (or add to existing threads)
    3. Process unprocessed tickets with AI
    4. Update SLA deadlines
    5. Send notifications for urgent tickets
    
    Returns:
        Tuple of (emails_fetched, tickets_created, tickets_processed)
    """
    # Import here to avoid circular imports
    from app.database import SessionLocal
    from app.services.imap_service import fetch_unread_emails
    from app.services.ai_service import process_ticket
    from app.services.sla_service import update_ticket_sla
    from app.services.email_notification_service import send_urgent_ticket_notification
    from app.models import Ticket, TicketMessage
    from sqlalchemy import desc
    
    # Create a new database session for this background task
    db = SessionLocal()
    try:
        # Step 1: Fetch emails from IMAP
        emails = fetch_unread_emails(db)
        created = 0
        processed = 0
        
        # Step 2: Create tickets or add to existing threads
        for email_data in emails:
            # Check if this is a reply to an existing ticket
            existing = db.query(Ticket).filter(
                Ticket.sender_email == email_data["sender_email"],
                Ticket.subject == email_data["subject"]
            ).first()
            
            if existing:
                # Add as new message to existing ticket
                message = TicketMessage(
                    ticket_id=existing.id,
                    sender_email=email_data["sender_email"],
                    subject=email_data["subject"],
                    body=email_data["body"],
                    is_incoming=True
                )
                db.add(message)
            else:
                # Create new ticket
                ticket = Ticket(
                    sender_email=email_data["sender_email"],
                    subject=email_data["subject"],
                    thread_id=email_data.get("thread_id"),
                    received_at=email_data.get("received_at", datetime.utcnow())
                )
                db.add(ticket)
                db.flush()  # Get the ticket ID
                
                # Create the initial message
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
        
        # Step 3: Process unprocessed tickets with AI
        unprocessed = db.query(Ticket).filter(Ticket.ai_processed == False).all()
        for ticket in unprocessed:
            # Get the latest incoming message
            latest_message = db.query(TicketMessage).filter(
                TicketMessage.ticket_id == ticket.id,
                TicketMessage.is_incoming == True
            ).order_by(desc(TicketMessage.created_at)).first()
            
            if not latest_message:
                continue
            
            try:
                # Send to AI for processing
                result = process_ticket(
                    ticket_id=ticket.id,
                    sender_email=ticket.sender_email,
                    subject=ticket.subject,
                    body=latest_message.body,
                    received_at=str(ticket.received_at),
                    db=db
                )
                
                if result:
                    # Update ticket with AI results
                    ticket.category = result["category"]
                    ticket.urgency = result["urgency"]
                    ticket.summary = result["summary"]
                    ticket.fix_steps = result["fix_steps"]
                    ticket.draft_response = result["draft_response"]
                    ticket.ai_processed = True
                    processed += 1
                    
                    # Update SLA and send notifications
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
        # Always close the database session
        db.close()


def _scheduler_loop():
    """
    Main scheduler loop running in background thread.
    
    This function:
    1. Runs the fetch/process task
    2. Waits for the configured interval
    3. Repeats until stop_event is set
    
    The loop checks _stop_event during the wait, allowing for
    clean shutdown without waiting for the full interval.
    """
    global _scheduler_running
    
    while not _stop_event.is_set():
        try:
            # Run the fetch/process task in the executor
            future = _executor.submit(_fetch_and_process_emails_sync)
            future.result(timeout=300)  # 5-minute timeout
        except Exception as e:
            print(f"[Scheduler] Error in fetch task: {e}")
        
        # Wait for the interval (or until stop is requested)
        wait_seconds = _scheduler_interval * 60
        if _stop_event.wait(timeout=wait_seconds):
            break  # Stop was requested
    
    _scheduler_running = False
    print("[Scheduler] Loop ended")


def start_scheduler(interval_minutes: int = 5):
    """
    Start the email fetch scheduler.
    
    Starts a background thread that periodically fetches and
    processes emails from the configured IMAP inbox.
    
    Args:
        interval_minutes: Minutes between fetch cycles (1-60)
                         Clamped to MIN_INTERVAL_MINUTES and MAX_INTERVAL_MINUTES
    
    If the scheduler is already running, it will be stopped first.
    
    USAGE:
        # Start with default 5-minute interval
        start_scheduler()
        
        # Start with custom 10-minute interval
        start_scheduler(10)
    """
    global _scheduler_thread, _scheduler_running, _scheduler_interval, _stop_event
    
    # Clamp interval to valid range
    interval_minutes = max(MIN_INTERVAL_MINUTES, min(MAX_INTERVAL_MINUTES, interval_minutes))
    
    # Stop existing scheduler if running
    if _scheduler_running and _scheduler_thread and _scheduler_thread.is_alive():
        print("[Scheduler] Already running, stopping first...")
        stop_scheduler()
    
    # Reset stop event and configure
    _stop_event.clear()
    _scheduler_interval = interval_minutes
    _scheduler_running = True
    
    # Start the background thread
    _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
    _scheduler_thread.start()
    print(f"[Scheduler] Started with interval of {interval_minutes} minutes")


def stop_scheduler():
    """
    Stop the email fetch scheduler.
    
    Signals the scheduler thread to stop and waits up to 5 seconds
    for it to finish. If the thread doesn't stop within the timeout,
    a warning is printed (the thread will eventually stop).
    
    Safe to call even if scheduler is not running.
    """
    global _scheduler_running, _scheduler_thread, _stop_event
    
    if not _scheduler_running:
        print("[Scheduler] Not running")
        return
    
    # Signal the thread to stop
    _stop_event.set()
    _scheduler_running = False
    
    # Wait for the thread to finish
    if _scheduler_thread and _scheduler_thread.is_alive():
        _scheduler_thread.join(timeout=5)
        if _scheduler_thread.is_alive():
            print("[Scheduler] Warning: Thread did not stop within timeout")
    
    _scheduler_thread = None
    print("[Scheduler] Stopped")


def update_scheduler_interval(interval_minutes: int):
    """
    Update the scheduler interval without restarting.
    
    The new interval takes effect after the current wait period.
    
    Args:
        interval_minutes: New interval in minutes (1-60)
        
    Note: To apply immediately, stop and restart the scheduler.
    """
    global _scheduler_interval
    interval_minutes = max(MIN_INTERVAL_MINUTES, min(MAX_INTERVAL_MINUTES, interval_minutes))
    _scheduler_interval = interval_minutes
    print(f"[Scheduler] Interval updated to {interval_minutes} minutes")
