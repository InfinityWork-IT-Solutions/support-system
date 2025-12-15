from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import hashlib
import os
import httpx
import secrets
from urllib.parse import urlencode

from app.database import get_db
from app.models import Settings, User

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("REPLIT_DEV_DOMAIN", "")

oauth_states = {}


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    username: str
    email: str
    role: str
    profile_image_url: Optional[str] = None


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_default_admin(username: str, password: str) -> Optional[dict]:
    if username == "admin" and password == "admin123":
        return {
            "id": 1,
            "name": "Administrator",
            "username": "admin",
            "email": "admin@infinitywork.co.za",
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
                        "email": "admin@infinitywork.co.za",
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
            "email": "admin@infinitywork.co.za",
            "role": "admin"
        }
    }


@router.get("/google/login")
async def google_login(request: Request):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured. Please add GOOGLE_CLIENT_ID.")
    
    state = secrets.token_urlsafe(32)
    oauth_states[state] = datetime.utcnow()
    
    custom_redirect = os.environ.get("GOOGLE_REDIRECT_URI", "")
    if custom_redirect:
        redirect_uri = custom_redirect
    else:
        replit_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
        if replit_domain:
            redirect_uri = f"https://{replit_domain}/api/auth/google/callback"
        else:
            host = request.headers.get("host", "")
            scheme = "https" if "replit" in host else request.url.scheme
            redirect_uri = f"{scheme}://{host}/api/auth/google/callback"
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account"
    }
    
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    print(f"[DEBUG] Google OAuth redirect_uri: {redirect_uri}")
    print(f"[DEBUG] Google OAuth client_id: {GOOGLE_CLIENT_ID[:20]}...")
    print(f"[DEBUG] Full auth URL (without state): {google_auth_url.split('&state=')[0]}")
    return RedirectResponse(url=google_auth_url)


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if error:
        return RedirectResponse(url=f"/?error={error}")
    
    if not code or not state:
        return RedirectResponse(url="/?error=missing_params")
    
    if state not in oauth_states:
        return RedirectResponse(url="/?error=invalid_state")
    
    del oauth_states[state]
    
    custom_redirect = os.environ.get("GOOGLE_REDIRECT_URI", "")
    if custom_redirect:
        redirect_uri = custom_redirect
    else:
        replit_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
        if replit_domain:
            redirect_uri = f"https://{replit_domain}/api/auth/google/callback"
        else:
            host = request.headers.get("host", "")
            scheme = "https" if "replit" in host else request.url.scheme
            redirect_uri = f"{scheme}://{host}/api/auth/google/callback"
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            }
        )
        
        if token_response.status_code != 200:
            return RedirectResponse(url="/?error=token_exchange_failed")
        
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if userinfo_response.status_code != 200:
            return RedirectResponse(url="/?error=userinfo_failed")
        
        userinfo = userinfo_response.json()
    
    google_id = userinfo.get("id")
    email = userinfo.get("email")
    first_name = userinfo.get("given_name", "")
    last_name = userinfo.get("family_name", "")
    profile_image = userinfo.get("picture", "")
    
    user = db.query(User).filter(User.google_id == google_id).first()
    
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_id = google_id
        else:
            user = User(
                email=email,
                google_id=google_id,
                first_name=first_name,
                last_name=last_name,
                profile_image_url=profile_image,
                role="user"
            )
            db.add(user)
    
    user.last_login_at = datetime.utcnow()
    user.first_name = first_name
    user.last_name = last_name
    user.profile_image_url = profile_image
    db.commit()
    db.refresh(user)
    
    user_data = {
        "id": user.id,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
        "email": user.email,
        "username": user.email,
        "role": user.role,
        "profile_image_url": user.profile_image_url
    }
    
    import json
    user_json = json.dumps(user_data)
    escaped_json = user_json.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r')
    
    html_response = f"""
    <!DOCTYPE html>
    <html>
    <head><title>Signing in...</title></head>
    <body>
    <script>
        localStorage.setItem('auth_user', '{escaped_json}');
        window.location.href = '/';
    </script>
    </body>
    </html>
    """
    
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html_response)


@router.get("/google/status")
async def google_oauth_status():
    configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    return {
        "configured": configured,
        "client_id_set": bool(GOOGLE_CLIENT_ID),
        "client_secret_set": bool(GOOGLE_CLIENT_SECRET)
    }
