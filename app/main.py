import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import engine, Base, SessionLocal
from app.routes import tickets, settings, templates
from app.models import Settings as SettingsModel
from app.services.scheduler_service import start_scheduler

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        scheduler_enabled = db.query(SettingsModel).filter(SettingsModel.key == "scheduler_enabled").first()
        scheduler_interval = db.query(SettingsModel).filter(SettingsModel.key == "scheduler_interval_minutes").first()
        
        if scheduler_enabled and scheduler_enabled.value == "true":
            interval = int(scheduler_interval.value) if scheduler_interval else 5
            start_scheduler(interval)
            print(f"[Startup] Auto-fetch scheduler started with {interval} minute interval")
    finally:
        db.close()
    
    yield

app = FastAPI(
    title="AI Support Desk",
    description="AI-powered email support ticket system for InfinityWork IT Solutions",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tickets.router)
app.include_router(settings.router)
app.include_router(templates.router)

if os.path.exists("client/dist"):
    app.mount("/assets", StaticFiles(directory="client/dist/assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return None
        return FileResponse("client/dist/index.html")
else:
    @app.get("/")
    def root():
        return {"message": "AI Support Desk API", "status": "running"}
