"""
FastAPI Application Entry Point
===============================
This is the main entry point for the AI Support Desk backend application.

This file:
1. Creates and configures the FastAPI application
2. Sets up database tables on startup
3. Registers all API routes
4. Configures CORS middleware for frontend communication
5. Starts the background scheduler for auto-fetching emails
6. Serves the React frontend in production mode

HOW THE APP STARTS:
1. run_backend.py imports this module
2. Base.metadata.create_all() creates any missing database tables
3. lifespan() runs on startup (checks if scheduler should start)
4. Routes are registered and the server starts listening

ARCHITECTURE:
- Backend runs on port 8000 (via Uvicorn)
- Frontend dev server runs on port 5000 (Vite)
- In production, FastAPI serves the built React app from client/dist/

TROUBLESHOOTING:
- "Table not found": Check DATABASE_URL and ensure the database exists
- Routes returning 404: Check that the router is included below
- CORS errors in browser: The middleware below should handle this
- Scheduler not running: Check Settings table for scheduler_enabled=true
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import engine, Base, SessionLocal
from app.routes import tickets, settings, templates, knowledge, surveys, team, views, auth
from app.models import Settings as SettingsModel
from app.services.scheduler_service import start_scheduler
from app.init_data import init_default_data

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================
# Create all database tables defined in models.py
# This is safe to run multiple times - it only creates tables that don't exist
# Note: This does NOT handle migrations; new columns require manual handling
Base.metadata.create_all(bind=engine)


# ============================================================================
# APPLICATION LIFESPAN
# ============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for the FastAPI application.
    
    This function runs:
    - On startup: Before the code block (before yield)
    - On shutdown: After the code block (after yield, not implemented here)
    
    Currently used to:
    - Check if the email auto-fetch scheduler should be started
    - Start the scheduler with the configured interval
    
    The scheduler runs in a background thread and periodically
    fetches new emails from the configured IMAP inbox.
    """
    db = SessionLocal()
    try:
        # Initialize default data (Templates & Knowledge Base)
        init_default_data(db)

        # Check if scheduler is enabled in settings
        scheduler_enabled = db.query(SettingsModel).filter(SettingsModel.key == "scheduler_enabled").first()
        scheduler_interval = db.query(SettingsModel).filter(SettingsModel.key == "scheduler_interval_minutes").first()
        
        # Start scheduler if enabled
        if scheduler_enabled and scheduler_enabled.value == "true":
            interval = int(scheduler_interval.value) if scheduler_interval else 5
            start_scheduler(interval)
            print(f"[Startup] Auto-fetch scheduler started with {interval} minute interval")
    finally:
        db.close()
    
    # Yield control to the application
    # Everything after this would run on shutdown
    yield


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================
# Create the main FastAPI application instance
app = FastAPI(
    title="AI Support Desk",
    description="AI-powered email support ticket system for InfinityWork IT Solutions",
    version="1.0.0",
    lifespan=lifespan  # Use our lifecycle manager
)

# ============================================================================
# CORS MIDDLEWARE
# ============================================================================
# CORS (Cross-Origin Resource Sharing) allows the frontend to make
# requests to the backend even when running on different ports.
# 
# During development:
#   - Frontend: http://localhost:5000
#   - Backend: http://localhost:8000
# 
# Without CORS, browsers block cross-origin requests for security.
# This configuration allows all origins ("*") for simplicity.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Allow requests from any origin
    allow_credentials=True,    # Allow cookies/auth headers
    allow_methods=["*"],       # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],       # Allow all headers
)

# ============================================================================
# API ROUTES
# ============================================================================
# Each router handles a specific group of endpoints.
# Routes are prefixed with /api/ (defined in each router file).
#
# Route files and their purposes:
# - auth: Login, logout, Google OAuth (/api/auth/*)
# - tickets: Ticket CRUD, processing, sending (/api/tickets/*)
# - settings: App configuration (/api/settings/*)
# - templates: Response templates (/api/templates/*)
# - knowledge: Knowledge base articles (/api/knowledge/*)
# - surveys: Customer satisfaction surveys (/api/surveys/*)
# - team: Team member management (/api/team/*)
# - views: Saved filter views (/api/views/*)
app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(settings.router)
app.include_router(templates.router)
app.include_router(knowledge.router)
app.include_router(surveys.router)
app.include_router(team.router)
app.include_router(views.router)

# ============================================================================
# STATIC FILE SERVING (PRODUCTION MODE)
# ============================================================================
# In production, we serve the built React frontend from client/dist/
# The Vite build process creates this directory.
#
# How it works:
# 1. Mount /assets to serve JavaScript, CSS, and other static files
# 2. For all other routes (except /api/*), serve index.html
# 3. React Router then handles client-side routing
#
# This is called "SPA (Single Page Application) mode" because
# the same HTML file handles all frontend routes.
if os.path.exists("client/dist"):
    # Serve static assets (JS, CSS, images) from the Vite build
    app.mount("/assets", StaticFiles(directory="client/dist/assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """
        Serve the React SPA for all non-API routes.
        
        This enables client-side routing:
        - /tickets, /settings, etc. all load index.html
        - React Router reads the URL and shows the right component
        - /api/* routes are handled by the API routers above
        """
        # Don't intercept API routes
        if full_path.startswith("api/"):
            return None
        # Return the React app's entry point
        return FileResponse("client/dist/index.html")
else:
    # Development mode: just show a simple API status message
    # The frontend runs separately on its own dev server
    @app.get("/")
    def root():
        """
        Root endpoint for development mode.
        
        When the built frontend doesn't exist, just return
        a JSON message confirming the API is running.
        """
        return {"message": "AI Support Desk API", "status": "running"}
