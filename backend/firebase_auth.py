"""Firebase Authentication helpers for Kuvira.

Firebase owns phone-number verification. FastAPI exchanges a verified Firebase
ID token for the application's existing Kuvira JWT and authorization model.
"""
import os
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from deps import KuviraError, log


_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return

    try:
        # Cloud Run uses Application Default Credentials automatically. For local
        # development, GOOGLE_APPLICATION_CREDENTIALS can point at a Firebase
        # service-account JSON file.
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
        _initialized = True
    except ValueError:
        # Another module/test process may already have initialized the SDK.
        _initialized = True
    except Exception:
        log.exception("Firebase Admin initialization failed")
        raise KuviraError(500, "FIREBASE_NOT_CONFIGURED", "Firebase authentication is not configured")


def verify_id_token(id_token: str) -> dict:
    if not id_token or not id_token.strip():
        raise KuviraError(401, "FIREBASE_TOKEN_MISSING", "Firebase ID token is required")

    _ensure_initialized()
    try:
        decoded = firebase_auth.verify_id_token(id_token.strip(), check_revoked=True)
    except firebase_auth.ExpiredIdTokenError:
        raise KuviraError(401, "FIREBASE_TOKEN_EXPIRED", "Firebase session expired. Please sign in again")
    except firebase_auth.RevokedIdTokenError:
        raise KuviraError(401, "FIREBASE_TOKEN_REVOKED", "Firebase session was revoked. Please sign in again")
    except Exception:
        log.exception("Firebase ID token verification failed")
        raise KuviraError(401, "FIREBASE_TOKEN_INVALID", "Invalid Firebase authentication token")

    uid = decoded.get("uid")
    phone_number: Optional[str] = decoded.get("phone_number")
    if not uid or not phone_number:
        raise KuviraError(401, "FIREBASE_PHONE_REQUIRED", "A verified phone number is required")

    return decoded
