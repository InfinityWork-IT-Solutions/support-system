# AI Support Desk

## Overview

AI Support Desk is an enterprise-grade, AI-powered email support ticket management system designed for InfinityWork IT Solutions. The system automates email ingestion from IMAP inboxes, uses OpenAI to classify, summarize, and draft responses to support tickets, and requires explicit human approval before sending any responses to customers.

Key capabilities:
- Automated email fetching from IMAP servers
- AI-powered ticket classification, urgency assessment, and summarization
- Draft response generation with human approval workflow
- SMTP integration for sending approved responses
- Conversation threading and ticket management dashboard
- Bulk actions for approving/rejecting/sending multiple tickets
- Analytics dashboard with category and urgency charts
- Response templates for quick replies
- Auto-fetch scheduler for periodic email ingestion
- Slack webhook integration for real-time notifications
- Knowledge base with suggested solutions based on ticket category
- CSV export for ticket data
- Customer satisfaction surveys with ratings and feedback
- Customer history view (previous tickets from same sender)
- Auto-responder for ticket acknowledgment emails
- Team member management and ticket assignment
- SLA tracking with priority queue and breach alerts
- Email notifications for urgent tickets
- Quick filters and saved views for efficient ticket management
- Beautiful animated login page with particle effects and glass-morphism design
- Enterprise UI styling with consistent design patterns across all sections

## Recent Changes

### Dual Authentication System (December 2025)
- **Email/Password Registration**: Users can create accounts with email, password, first name, last name, optional position/role, and optional organization/company
- **Email/Password Login**: Registered users can log in with their email and password
- **Admin Login**: Preserved original username/password login for admin access (admin/admin123)
- **Google SSO**: Kept Google OAuth Single Sign-On alongside new auth methods
- **User Profile Display**: Position/role and organization now shown in dashboard header below user name
- **Login UI**: Tabbed interface with Sign In/Register toggle, plus Email/Admin sub-toggle for login
- **Organization Field**: New optional field added to registration form for company/organization name

### UI Enhancements (December 2025)
- **Settings Page**: Redesigned with sidebar navigation and 4 grouped sections (Email Infrastructure, Automation, Notifications, Operations)
- **Templates Section**: Enhanced with enterprise styling matching Knowledge Base design (violet/purple gradient theme)
- **Knowledge Base Section**: Enhanced with enterprise styling (emerald/teal gradient theme)
- **Design System**: Consistent use of enterprise-header, detail-section, enterprise-btn, and enterprise-card CSS classes across all sections

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI with Uvicorn server running on port 8000
- **Database**: PostgreSQL with SQLAlchemy ORM
- **ORM Pattern**: Declarative base with session-based dependency injection via `get_db()`
- **API Structure**: RESTful routes under `/api/` prefix, organized in `app/routes/`

### Frontend (React/TypeScript)
- **Framework**: React 18 with TypeScript, built using Vite
- **Styling**: Tailwind CSS with custom primary color palette
- **State Management**: TanStack React Query for server state
- **Development**: Runs on port 5000 with proxy to backend API
- **Build Output**: Compiled to `client/dist/`, served by FastAPI in production

### Service Layer
- **Email Ingestion**: `imap_service.py` - Fetches unread emails via IMAP
- **AI Processing**: `ai_service.py` - OpenAI integration for ticket analysis
- **Approval Workflow**: `approval_service.py` - Human approval before sending
- **Email Sending**: `smtp_service.py` - SMTP integration for responses
- **Scheduler**: `scheduler_service.py` - Background task for periodic email fetching
- **Slack Notifications**: `slack_service.py` - Webhook notifications for new/urgent/processed tickets

### Data Models
- **Ticket**: Main entity with sender, subject, AI-generated fields (category, urgency, summary, fix_steps, draft_response), and approval status
- **TicketMessage**: Individual messages in conversation threads
- **Settings**: Key-value store for runtime configuration (email credentials, API keys, scheduler settings)
- **Template**: Reusable response templates with name, category, and content
- **KnowledgeArticle**: Help guides and solution articles with title, category, keywords, and content for suggested solutions

### Approval Workflow
Critical design decision: No automated sending. All AI-generated responses require explicit human approval through the dashboard before being sent to customers.

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database (DATABASE_URL environment variable required)
- **OpenAI API**: GPT integration for ticket processing (OPENAI_API_KEY)
- **IMAP Server**: Email ingestion (configurable via settings or environment)
- **SMTP Server**: Email sending (configurable via settings or environment)

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - Session encryption key
- `OPENAI_API_KEY` - OpenAI API authentication
- `IMAP_HOST`, `IMAP_PORT`, `IMAP_USERNAME`, `IMAP_PASSWORD` - Email ingestion
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` - Email sending

### Python Dependencies
- FastAPI, Uvicorn (web framework)
- SQLAlchemy (database ORM)
- OpenAI (AI processing)
- imaplib, smtplib (email protocols - standard library)

### Frontend Dependencies
- React, React DOM
- TanStack React Query
- React Router DOM
- Lucide React (icons)
- Tailwind CSS, PostCSS, Autoprefixer