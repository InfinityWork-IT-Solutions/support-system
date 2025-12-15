# AI Support Desk - InfinityWork IT Solutions

## Overview
An AI-powered email support ticket system that automates customer support workflows while maintaining human oversight through an approval system.

## Architecture

### Backend (FastAPI)
- **Location**: `app/`
- **Main entry**: `app/main.py`
- **Services**:
  - `app/services/imap_service.py` - Email ingestion via IMAP
  - `app/services/ai_service.py` - OpenAI-powered ticket processing
  - `app/services/smtp_service.py` - Email sending via SMTP
  - `app/services/approval_service.py` - Human approval workflow
- **Routes**: `app/routes/tickets.py` - All ticket-related API endpoints

### Frontend (React + Vite)
- **Location**: `client/`
- **Tech**: React 18, Tailwind CSS, React Query, Lucide Icons
- **Main entry**: `client/src/main.tsx`

### Database
- PostgreSQL with SQLAlchemy ORM
- Models: `Ticket`, `TicketMessage`
- Connection via `DATABASE_URL` environment variable

## Key Features
1. Email ingestion from IMAP inbox
2. AI-powered ticket classification and response drafting
3. Human approval workflow (approve/reject)
4. Conversation threading
5. Search and filtering

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `OPENAI_API_KEY` - For AI processing
- `IMAP_HOST`, `IMAP_PORT`, `IMAP_USERNAME`, `IMAP_PASSWORD` - Email ingestion
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` - Email sending

## Running the Application
- Backend runs on port 8000
- Frontend (Vite dev server) runs on port 5000
- Frontend proxies `/api` requests to backend

## Workflow
1. Fetch emails (IMAP) -> Creates tickets
2. Process with AI -> Generates category, urgency, summary, draft response
3. Human review -> Approve or reject draft
4. Send response (SMTP) -> Only after approval
