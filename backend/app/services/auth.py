"""
Firebase Authentication Middleware.
Verifies Firebase ID tokens on protected routes.
Falls back to no-auth mode if Firebase Admin SDK not configured.

Setup:
1. Set FIREBASE_PROJECT_ID env var (or GOOGLE_CLOUD_PROJECT)
2. Optionally set FIREBASE_CREDENTIALS_PATH to a service account JSON
3. Protected routes use Depends(require_auth) or Depends(optional_auth)
"""

import os
import logging
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

_firebase_initialized = False
_auth_enabled = False

security = HTTPBearer(auto_error=False)


def init_firebase():
    """Initialize Firebase Admin SDK."""
    global _firebase_initialized, _auth_enabled
    if _firebase_initialized:
        return

    project_id = os.environ.get("FIREBASE_PROJECT_ID", os.environ.get("GOOGLE_CLOUD_PROJECT"))
    creds_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")

    if not project_id:
        logger.info("Firebase Auth disabled (no FIREBASE_PROJECT_ID set)")
        _firebase_initialized = True
        _auth_enabled = False
        return

    try:
        import firebase_admin
        from firebase_admin import credentials

        if creds_path and os.path.exists(creds_path):
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred, {"projectId": project_id})
        else:
            # Use Application Default Credentials (works on Cloud Run)
            firebase_admin.initialize_app(options={"projectId": project_id})

        _firebase_initialized = True
        _auth_enabled = True
        logger.info(f"Firebase Auth enabled for project {project_id}")
    except Exception as e:
        logger.warning(f"Firebase Auth init failed: {e}. Running without auth.")
        _firebase_initialized = True
        _auth_enabled = False


def verify_token(token: str) -> dict:
    """Verify a Firebase ID token. Returns decoded claims."""
    if not _auth_enabled:
        return {"uid": "anonymous", "email": "anonymous@local", "auth_disabled": True}

    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(token)
        return {
            "uid": decoded.get("uid"),
            "email": decoded.get("email", ""),
            "name": decoded.get("name", ""),
            "picture": decoded.get("picture", ""),
            "email_verified": decoded.get("email_verified", False),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Dependency that requires valid Firebase auth.
    Returns user claims dict.
    In no-auth mode (Firebase not configured), returns anonymous user.
    """
    init_firebase()

    if not _auth_enabled:
        # No-auth mode — allow all requests
        return {"uid": "anonymous", "email": "anonymous@local", "auth_disabled": True}

    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")

    return verify_token(credentials.credentials)


async def optional_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict | None:
    """
    Dependency that optionally verifies auth.
    Returns user claims if token present, None otherwise.
    """
    init_firebase()

    if not _auth_enabled:
        return {"uid": "anonymous", "auth_disabled": True}

    if not credentials:
        return None

    try:
        return verify_token(credentials.credentials)
    except HTTPException:
        return None


def is_auth_enabled() -> bool:
    init_firebase()
    return _auth_enabled
