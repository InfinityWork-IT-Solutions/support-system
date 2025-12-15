from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import hashlib
import os

from app.database import get_db
from app.models import Settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    role: str


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_default_admin(username: str, password: str) -> Optional[dict]:
    if username == "admin" and password == "admin123":
        return {
            "id": 1,
            "name": "Administrator",
            "username": "admin",
            "role": "admin"
        }
    return None


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    admin_username = db.query(Settings).filter(Settings.key == "admin_username").first()
    admin_password = db.query(Settings).filter(Settings.key == "admin_password").first()
    
    if admin_username and admin_password:
        if request.username == admin_username.value:
            if hash_password(request.password) == admin_password.value:
                return {
                    "user": {
                        "id": 1,
                        "name": admin_username.value,
                        "username": admin_username.value,
                        "role": "admin"
                    }
                }
    
    user = verify_default_admin(request.username, request.password)
    if user:
        return {"user": user}
    
    raise HTTPException(status_code=401, detail="Invalid username or password")


@router.post("/logout")
def logout():
    return {"status": "logged_out"}


@router.get("/me")
def get_current_user():
    return {
        "user": {
            "id": 1,
            "name": "Administrator",
            "username": "admin",
            "role": "admin"
        }
    }
