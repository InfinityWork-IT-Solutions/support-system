"""
Authentication Routes Module
============================
This module handles all authentication-related API endpoints for the AI Support Desk.

It provides two authentication methods:
1. Traditional username/password login (for admin access)
2. Google OAuth 2.0 Single Sign-On (SSO) for users

IMPORTANT SECURITY NOTES:
- Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables
- The redirect URI must be registered in Google Cloud Console
- OAuth state tokens are stored in memory to prevent CSRF attacks

TROUBLESHOOTING:
- If Google login fails with 403: Check that the redirect URI in Google Console matches exactly
- If "missing_params" error: The OAuth callback didn't receive the authorization code
- If "invalid_state" error: The OAuth state token expired or was already used
- If login opens in iframe but fails: Open the login URL in a new browser tab instead
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import hashlib
import os
import httpx
import secrets
from urllib.parse import urlencode
import bcrypt

from app.database import get_db
from app.models import Settings, User

# Create a router for all authentication endpoints
# All routes in this file will be prefixed with /api/auth
router = APIRouter(prefix="/api/auth", tags=["auth"])

# ============================================================================
# GOOGLE OAUTH CONFIGURATION
# ============================================================================
# These values come from Google Cloud Console > APIs & Services > Credentials
# You must create an "OAuth 2.0 Client ID" in the Google Cloud Console
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("REPLIT_DEV_DOMAIN", "")

# In-memory storage for OAuth state tokens
# State tokens prevent Cross-Site Request Forgery (CSRF) attacks
# Each token is used once and then deleted
# Note: In a production multi-server environment, this should be stored in Redis or database
oauth_states = {}


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class LoginRequest(BaseModel):
    """
    Model for traditional username/password login requests.
    
    Attributes:
        username: The admin username
        password: The admin password (sent in plain text, hashed server-side)
    """
    username: str
    password: str


class RegisterRequest(BaseModel):
    """
    Model for email/password registration requests.
    
    Attributes:
        email: User's email address (must be unique)
        password: Password (min 6 characters)
        first_name: User's first name
        last_name: User's last name
        position: Job title/role (e.g., "IT Manager", "Support Lead")
        organization: Company/organization name
    """
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    position: Optional[str] = None
    organization: Optional[str] = None


class EmailLoginRequest(BaseModel):
    """
    Model for email/password login requests.
    
    Attributes:
        email: User's registered email address
        password: User's password
    """
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """
    Model for user data returned after successful authentication.
    
    Attributes:
        id: Unique user identifier from database
        name: Display name (first + last name, or email if not available)
        username: Login username (email for Google OAuth users)
        email: User's email address
        role: User's permission level ('admin' or 'user')
        position: Job title/role (e.g., "IT Manager", "Support Lead")
        organization: Company/organization name
        profile_image_url: URL to user's profile picture (from Google for OAuth users)
    """
    id: int
    name: str
    username: str
    email: str
    role: str
    position: Optional[str] = None
    organization: Optional[str] = None
    profile_image_url: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using SHA-256.
    
    This is a one-way hash - you cannot recover the original password.
    When a user logs in, we hash their input and compare it to the stored hash.
    
    Security Note: SHA-256 is used for simplicity. For production systems,
    consider using bcrypt or argon2 which include salt and are designed for passwords.
    
    Args:
        password: The plain text password to hash
        
    Returns:
        The SHA-256 hash of the password as a hexadecimal string
    """
    return hashlib.sha256(password.encode()).hexdigest()


def verify_default_admin(username: str, password: str) -> Optional[dict]:
    """
    Check if the provided credentials match the default admin account.
    
    This is a fallback for initial setup before custom admin credentials are configured.
    
    Default credentials:
        Username: admin
        Password: admin123
    
    SECURITY WARNING: Change these credentials immediately after first login!
    Go to Settings and update the admin password.
    
    Args:
        username: The provided username
        password: The provided password
        
    Returns:
        User data dictionary if credentials match, None otherwise
    """
    if username == "admin" and password == "admin123":
        return {
            "id": 1,
            "name": "Administrator",
            "username": "admin",
            "email": "admin@infinitywork.co.za",
            "role": "admin"
        }
    return None


# ============================================================================
# TRADITIONAL LOGIN ENDPOINTS
# ============================================================================

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Traditional username/password login endpoint.
    
    This endpoint is used by the login form for admin access.
    It checks credentials in this order:
    1. Custom admin credentials stored in the Settings table
    2. Default admin credentials (admin/admin123)
    
    The custom admin credentials can be set in the Settings page of the dashboard.
    
    Args:
        request: LoginRequest containing username and password
        db: Database session (injected by FastAPI)
        
    Returns:
        JSON with user data on success
        
    Raises:
        HTTPException 401: If credentials are invalid
        
    TROUBLESHOOTING:
    - If login fails with correct password: Check if password was changed in Settings
    - If default admin doesn't work: Someone may have changed the admin credentials
    """
    # First, check if custom admin credentials have been set in Settings
    admin_username = db.query(Settings).filter(Settings.key == "admin_username").first()
    admin_password = db.query(Settings).filter(Settings.key == "admin_password").first()
    
    # If custom credentials exist, verify against them
    if admin_username and admin_password:
        if request.username == admin_username.value:
            # Compare hashed passwords (stored password is already hashed)
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
    
    # Fall back to default admin credentials
    user = verify_default_admin(request.username, request.password)
    if user:
        return {"user": user}
    
    # No valid credentials found
    raise HTTPException(status_code=401, detail="Invalid username or password")


@router.post("/logout")
def logout():
    """
    Logout endpoint.
    
    Currently this just returns a success status.
    The actual logout is handled on the frontend by clearing localStorage.
    
    In a session-based auth system, this would destroy the session.
    Since we use localStorage-based auth, the frontend handles token removal.
    
    Returns:
        JSON with logout confirmation
    """
    return {"status": "logged_out"}


@router.post("/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user with email/password.
    
    Creates a new user account with hashed password using bcrypt.
    Used for demo clients or users who don't have Google accounts.
    
    Args:
        request: RegisterRequest with email, password, name, and position
        db: Database session
        
    Returns:
        JSON with user data on success
        
    Raises:
        HTTPException 400: If email already exists or password too short
    """
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user = User(
        email=request.email,
        password_hash=hashed,
        first_name=request.first_name,
        last_name=request.last_name,
        position=request.position,
        organization=request.organization,
        role="user",
        is_active=True,
        email_verified=True,
        last_login_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {
        "user": {
            "id": user.id,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "username": user.email,
            "role": user.role,
            "position": user.position,
            "organization": user.organization,
            "profile_image_url": user.profile_image_url
        }
    }


@router.post("/email-login")
def email_login(request: EmailLoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password.
    
    Verifies password using bcrypt and returns user data on success.
    
    Args:
        request: EmailLoginRequest with email and password
        db: Database session
        
    Returns:
        JSON with user data on success
        
    Raises:
        HTTPException 401: If credentials are invalid
        HTTPException 403: If account is inactive
    """
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not bcrypt.checkpw(request.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    return {
        "user": {
            "id": user.id,
            "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "email": user.email,
            "username": user.email,
            "role": user.role,
            "position": user.position,
            "organization": user.organization,
            "profile_image_url": user.profile_image_url
        }
    }


@router.get("/me")
def get_current_user():
    """
    Get the currently logged-in user's information.
    
    Note: This is a simplified implementation that always returns the admin user.
    In a full implementation, this would:
    1. Read the session/token from the request
    2. Look up the user in the database
    3. Return their actual data
    
    The frontend currently manages user state via localStorage instead of
    calling this endpoint on each request.
    
    Returns:
        JSON with current user data
    """
    return {
        "user": {
            "id": 1,
            "name": "Administrator",
            "username": "admin",
            "email": "admin@infinitywork.co.za",
            "role": "admin"
        }
    }


# ============================================================================
# GOOGLE OAUTH 2.0 ENDPOINTS
# ============================================================================

@router.get("/google/login")
async def google_login(request: Request):
    """
    Initiate Google OAuth 2.0 login flow.
    
    This endpoint redirects the user to Google's login page.
    After the user logs in with Google, they're redirected back to /google/callback.
    
    OAuth Flow:
    1. User clicks "Sign in with Google" on the login page
    2. Frontend opens this endpoint in a new tab (required due to iframe restrictions)
    3. This endpoint redirects to Google's OAuth consent screen
    4. User logs in with their Google account
    5. Google redirects back to /google/callback with an authorization code
    6. The callback endpoint exchanges the code for user info
    
    Security Features:
    - State token: A random string that prevents CSRF attacks
    - HTTPS redirect URI: Required by Google for security
    
    Args:
        request: The incoming HTTP request (used to determine redirect URI)
        
    Returns:
        RedirectResponse to Google's OAuth page
        
    Raises:
        HTTPException 500: If Google OAuth is not configured
        
    TROUBLESHOOTING:
    - 403 error from Google: The redirect URI doesn't match Google Console exactly
    - "OAuth not configured": Add GOOGLE_CLIENT_ID environment variable
    - Login works in new tab but not iframe: This is expected; Google blocks iframe login
    """
    # Check if Google OAuth is configured
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured. Please add GOOGLE_CLIENT_ID.")
    
    # Generate a random state token for CSRF protection
    # This token must be returned by Google in the callback
    state = secrets.token_urlsafe(32)
    oauth_states[state] = datetime.utcnow()
    
    # Determine the redirect URI
    # Priority: Custom env var > Replit domain > Request host
    custom_redirect = os.environ.get("GOOGLE_REDIRECT_URI", "")
    if custom_redirect:
        # Use explicitly configured redirect URI
        redirect_uri = custom_redirect
    else:
        # On Replit, use the REPLIT_DEV_DOMAIN environment variable
        replit_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
        if replit_domain:
            redirect_uri = f"https://{replit_domain}/api/auth/google/callback"
        else:
            # Fallback: construct URI from request headers
            host = request.headers.get("host", "")
            scheme = "https" if "replit" in host else request.url.scheme
            redirect_uri = f"{scheme}://{host}/api/auth/google/callback"
    
    # Build the Google OAuth authorization URL
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",  # We want an authorization code
        "scope": "openid email profile",  # Request access to basic profile info
        "state": state,  # CSRF protection token
        "access_type": "offline",  # Get a refresh token (for future use)
        "prompt": "select_account"  # Always show account picker
    }
    
    google_auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    
    # Debug logging (helpful for troubleshooting OAuth issues)
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
    """
    Handle the OAuth callback from Google.
    
    After the user logs in with Google, Google redirects here with:
    - code: An authorization code to exchange for tokens
    - state: The CSRF token we sent (must match)
    - error: Set if the user denied access or an error occurred
    
    This endpoint:
    1. Validates the state token (CSRF protection)
    2. Exchanges the authorization code for an access token
    3. Fetches the user's profile information from Google
    4. Creates or updates the user in our database
    5. Returns an HTML page that stores user data in localStorage and redirects to home
    
    Args:
        request: The incoming HTTP request
        code: Authorization code from Google
        state: CSRF protection state token
        error: Error message if auth failed
        db: Database session
        
    Returns:
        HTMLResponse that stores user data in localStorage and redirects
        
    TROUBLESHOOTING:
    - "missing_params": Google didn't return the authorization code
    - "invalid_state": State token mismatch (possible CSRF attack or token expired)
    - "token_exchange_failed": Could not exchange code for tokens (check client secret)
    - "userinfo_failed": Could not fetch user profile from Google
    """
    # Check if Google returned an error
    if error:
        return RedirectResponse(url=f"/?error={error}")
    
    # Verify we have the required parameters
    if not code or not state:
        return RedirectResponse(url="/?error=missing_params")
    
    # Validate the state token (CSRF protection)
    # The state must match one we generated in google_login
    if state not in oauth_states:
        return RedirectResponse(url="/?error=invalid_state")
    
    # Remove the used state token (one-time use only)
    del oauth_states[state]
    
    # Reconstruct the redirect URI (must match exactly what we sent to Google)
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
    
    # Exchange the authorization code for tokens
    async with httpx.AsyncClient() as client:
        # Step 1: Exchange authorization code for access token
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
        
        # Step 2: Use the access token to fetch user information
        userinfo_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if userinfo_response.status_code != 200:
            return RedirectResponse(url="/?error=userinfo_failed")
        
        userinfo = userinfo_response.json()
    
    # Extract user information from Google's response
    google_id = userinfo.get("id")  # Unique Google user ID
    email = userinfo.get("email")
    first_name = userinfo.get("given_name", "")
    last_name = userinfo.get("family_name", "")
    profile_image = userinfo.get("picture", "")
    
    # Truncate very long profile image URLs (some Google URLs are extremely long)
    # The database column is limited to 500 characters
    if profile_image and len(profile_image) > 500:
        profile_image = profile_image[:500]
    
    # Find or create the user in our database
    # First, try to find by Google ID (for returning users)
    user = db.query(User).filter(User.google_id == google_id).first()
    
    if not user:
        # User not found by Google ID - check if they exist by email
        # (They might have been created via another method)
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link their existing account to Google
            user.google_id = google_id
        else:
            # Create a new user account
            user = User(
                email=email,
                google_id=google_id,
                first_name=first_name,
                last_name=last_name,
                profile_image_url=profile_image,
                role="user"  # New users get 'user' role by default
            )
            db.add(user)
    
    # Update user's profile with latest info from Google
    user.last_login_at = datetime.utcnow()
    user.first_name = first_name
    user.last_name = last_name
    user.profile_image_url = profile_image
    db.commit()
    db.refresh(user)
    
    # Prepare user data to send to the frontend
    user_data = {
        "id": user.id,
        "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
        "email": user.email,
        "username": user.email,  # Email serves as username for OAuth users
        "role": user.role,
        "position": user.position,
        "organization": user.organization,
        "profile_image_url": user.profile_image_url
    }
    
    # Convert user data to JSON and escape it for embedding in JavaScript
    import json
    user_json = json.dumps(user_data)
    # Escape special characters to prevent JavaScript injection
    escaped_json = user_json.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r')
    
    # Return an HTML page that stores user data in localStorage and redirects
    # This approach is needed because:
    # 1. We can't set localStorage from a redirect
    # 2. The OAuth callback happens in a new tab (due to Google's iframe restrictions)
    # 3. We need to store the user data before redirecting to the app
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
    """
    Check if Google OAuth is configured.
    
    This endpoint is used by the frontend to determine whether
    to show the "Sign in with Google" button.
    
    Returns:
        JSON with configuration status:
        - configured: True if both client ID and secret are set
        - client_id_set: True if GOOGLE_CLIENT_ID is set
        - client_secret_set: True if GOOGLE_CLIENT_SECRET is set
        
    TROUBLESHOOTING:
    - If "configured" is false, check that both environment variables are set
    - Get credentials from Google Cloud Console > APIs & Services > Credentials
    """
    configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
    return {
        "configured": configured,
        "client_id_set": bool(GOOGLE_CLIENT_ID),
        "client_secret_set": bool(GOOGLE_CLIENT_SECRET)
    }
