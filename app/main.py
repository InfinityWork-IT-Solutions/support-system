import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.database import engine, Base
from app.routes import tickets, settings

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Support Desk",
    description="AI-powered email support ticket system for InfinityWork IT Solutions",
    version="1.0.0"
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
