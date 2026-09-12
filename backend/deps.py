"""Kuvira Sports — shared dependencies: config, db, auth, RBAC, errors, logging.

Single source of truth imported by server.py and all feature routers.
"""
import os
import uuid
import json
import time
import logging
import contextvars
from urllib.parse import parse_qsl, urlencode, urlsplit
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
APP_ENV = os.environ.get("APP_ENV", "development")
IS_PROD = APP_ENV == "production"
def _mongo_connection_url() -> str:
    """Use explicit Atlas hosts only when a local DNS resolver cannot serve SRV.

    Credentials remain in ``MONGO_URL``. ``MONGO_DIRECT_HOSTS`` contains only
    public Atlas hostnames and is useful for development networks that block
    DNS SRV records while still allowing ordinary A/AAAA lookups.
    """
    uri = os.environ["MONGO_URL"]
    direct_hosts = os.environ.get("MONGO_DIRECT_HOSTS", "").strip()
    if not direct_hosts or not uri.startswith("mongodb+srv://"):
        return uri
    parsed = urlsplit(uri)
    if "@" not in parsed.netloc:
        return uri
    userinfo = parsed.netloc.rsplit("@", 1)[0]
    options = dict(parse_qsl(parsed.query, keep_blank_values=True))
    options.setdefault("authSource", os.environ.get("MONGO_AUTH_SOURCE", "admin"))
    options.setdefault("replicaSet", os.environ.get("MONGO_REPLICA_SET", ""))
    options.setdefault("tls", "true")
    options = {key: value for key, value in options.items() if value}
    return f"mongodb://{userinfo}@{direct_hosts}/?{urlencode(options)}"


MONGO_URL = _mongo_connection_url()
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRY_DAYS = int(os.environ.get("JWT_EXPIRY_DAYS", "30"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
OTP_PROVIDER = os.environ.get("OTP_PROVIDER", "mock")
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE = os.environ.get("TWILIO_VERIFY_SERVICE", "")
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "*").split(",") if o.strip()]
PAYMENT_PROVIDER = os.environ.get("PAYMENT_PROVIDER", "mock").strip().lower()


def validate_runtime_config() -> None:
    """Stop an unsafe production process before it accepts traffic.

    Development keeps the current mock flows deliberately. Production must name
    every external provider explicitly, so an omitted environment variable can
    never silently enable local disk, mock OTP, or process-local rate limits.
    """
    if os.environ.get("K_SERVICE") and not os.environ.get("APP_ENV"):
        raise RuntimeError("APP_ENV must be explicitly set for Cloud Run")
    if APP_ENV not in {"development", "staging", "production"}:
        raise RuntimeError("APP_ENV must be development, staging, or production")
    if not IS_PROD:
        return

    errors: list[str] = []
    if len(JWT_SECRET) < 32 or JWT_SECRET.lower() in {"secret", "changeme", "change-me"}:
        errors.append("JWT_SECRET must be a unique 32+ character secret")
    if OTP_PROVIDER not in {"firebase", "twilio"}:
        errors.append("OTP_PROVIDER must be firebase or twilio in production")
    if OTP_PROVIDER == "twilio" and not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE):
        errors.append("Twilio Verify credentials are required when OTP_PROVIDER=twilio")
    if not CORS_ALLOWED_ORIGINS or "*" in CORS_ALLOWED_ORIGINS or any(not origin.startswith("https://") for origin in CORS_ALLOWED_ORIGINS):
        errors.append("CORS_ALLOWED_ORIGINS must contain explicit https origins in production")
    if PAYMENT_PROVIDER in {"", "mock", "mock_payu"}:
        errors.append("PAYMENT_PROVIDER must be a real configured provider in production")
    if PAYMENT_PROVIDER == "payu":
        if not os.environ.get("PAYU_MERCHANT_KEY") or not os.environ.get("PAYU_MERCHANT_SALT"):
            errors.append("PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT are required for PayU")
        callback_base = os.environ.get("PAYU_CALLBACK_BASE_URL", "")
        if not callback_base.startswith("https://"):
            errors.append("PAYU_CALLBACK_BASE_URL must be a public https URL")
    if os.environ.get("AI_COACH_STORAGE_BACKEND", "local").lower() != "gcs" or not os.environ.get("AI_COACH_STORAGE_BUCKET"):
        errors.append("AI Coach production requires AI_COACH_STORAGE_BACKEND=gcs and AI_COACH_STORAGE_BUCKET")
    if os.environ.get("AI_PROVIDER", "openai").lower() != "vertex" or not os.environ.get("GOOGLE_CLOUD_PROJECT"):
        errors.append("AI Coach production requires AI_PROVIDER=vertex and GOOGLE_CLOUD_PROJECT")
    if os.environ.get("AI_COACH_ANALYZER", "lightweight").lower() != "vertex_gemini":
        errors.append("AI Coach production requires AI_COACH_ANALYZER=vertex_gemini")
    if os.environ.get("AI_COACH_RATE_LIMIT_BACKEND", "process").lower() != "mongo":
        errors.append("AI_COACH_RATE_LIMIT_BACKEND must be mongo in production")
    if os.environ.get("AI_COACH_RATE_LIMIT_FAIL_CLOSED", "false").lower() != "true":
        errors.append("AI_COACH_RATE_LIMIT_FAIL_CLOSED must be true in production")
    if os.environ.get("AI_COACH_QUEUE_BACKEND", "local").lower() not in {"worker", "sqs"}:
        errors.append("AI_COACH_QUEUE_BACKEND must be worker or sqs in production")
    if errors:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(errors))
client = AsyncIOMotorClient(MONGO_URL, maxPoolSize=int(os.environ.get("MONGO_MAX_POOL", "50")), serverSelectionTimeoutMS=int(os.environ.get("MONGO_TIMEOUT_MS", "8000")), retryWrites=True)
db = client[DB_NAME]
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
user_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar("user_id", default="-")

class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"ts": datetime.now(timezone.utc).isoformat(), "level": record.levelname, "logger": record.name, "msg": record.getMessage(), "request_id": request_id_ctx.get(), "user_id": user_id_ctx.get()}
        if record.exc_info: payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)

def configure_logging():
    handler = logging.StreamHandler(); handler.setFormatter(JsonLogFormatter() if IS_PROD else logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")); root = logging.getLogger(); root.handlers = [handler]; root.setLevel(logging.INFO)
log = logging.getLogger("kuvira")

def gen_id() -> str: return str(uuid.uuid4())
def utcnow() -> datetime: return datetime.now(timezone.utc)
def strip_id(doc: dict) -> dict:
    if doc and "_id" in doc: doc.pop("_id", None)
    return doc

class KuviraError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail={"code": code, "message": message}); self.code = code; self.message = message

ROLE_PLAYER = "PLAYER"
ROLE_PLATFORM_ADMIN = "PLATFORM_ADMIN"
ROLE_CLUB_OWNER = "CLUB_OWNER"
ROLE_CLUB_ADMIN = "CLUB_ADMIN"
ROLE_CLUB_MANAGER = "CLUB_MANAGER"
ROLE_CLUB_STAFF = "CLUB_STAFF"

# ---------------------------------------------------------------------------
# Permission registry
# Each key is a permission code; value is a human-readable description.
# ---------------------------------------------------------------------------
PERM = {
    # Workspace
    "club.view":               "View club workspace",
    "club.manage":             "Edit club profile & settings",
    # Courts (facility-level — structural changes; Owner + Admin only)
    "club.courts.create":      "Add new courts / facilities",
    "club.courts.edit":        "Edit court details & pricing",
    "club.courts.delete":      "Remove / deactivate courts",
    # Slots / availability (day-to-day ops; Manager+)
    "club.slots.manage":       "Add, edit, block and release slots",
    # Bookings
    "club.bookings.manage":    "View all club bookings",
    "club.bookings.confirm":   "Confirm pending bookings",
    "club.bookings.cancel":    "Cancel bookings",
    # Operations
    "club.games.manage":       "Manage club games",
    "club.events.manage":      "Manage club events & tournaments",
    "club.pricing.manage":     "Set / override court pricing",
    # People
    "club.members.manage":     "Manage club members",
    "club.staff.manage":       "Add/remove Admins, Managers & Staff",
    # Reporting
    "club.analytics.view":     "View club analytics dashboard",
    "club.reports.export":     "Export business data & reports",
    # Ownership
    "club.ownership.transfer": "Transfer club ownership",
    # Platform-level (Platform Admin only)
    "platform.clubs.manage":   "Create/approve clubs, assign owners",
    "platform.users.manage":   "Manage platform users",
    "platform.analytics.view": "View platform-wide analytics",
}

# ---------------------------------------------------------------------------
# Role → Permission mapping
# Hierarchy: OWNER > ADMIN > MANAGER > STAFF
# ---------------------------------------------------------------------------
_OWNER_PERMS = [
    "club.view", "club.manage",
    "club.courts.create", "club.courts.edit", "club.courts.delete",
    "club.slots.manage",
    "club.bookings.manage", "club.bookings.confirm", "club.bookings.cancel",
    "club.games.manage", "club.events.manage",
    "club.pricing.manage",
    "club.members.manage", "club.staff.manage",
    "club.analytics.view", "club.reports.export",
    "club.ownership.transfer",
]

_ADMIN_PERMS = [
    "club.view", "club.manage",
    "club.courts.create", "club.courts.edit", "club.courts.delete",
    "club.slots.manage",
    "club.bookings.manage", "club.bookings.confirm", "club.bookings.cancel",
    "club.games.manage", "club.events.manage",
    "club.pricing.manage",
    "club.members.manage", "club.staff.manage",
    "club.analytics.view", "club.reports.export",
    # NOTE: ownership.transfer is intentionally excluded — Owner only
]

_MANAGER_PERMS = [
    "club.view", "club.manage",
    # courts: read via club.view; no structural changes
    "club.slots.manage",
    "club.bookings.manage", "club.bookings.confirm", "club.bookings.cancel",
    "club.games.manage", "club.events.manage",
    "club.members.manage",
    "club.analytics.view",
    # No: courts.create/edit/delete, pricing.manage, staff.manage, reports.export, ownership.transfer
]

_STAFF_PERMS = [
    "club.view",
    "club.bookings.manage", "club.bookings.confirm",
    "club.games.manage",
    # No: courts, slots, pricing, members, staff, analytics, reports, events
]

ROLE_PERMISSIONS: Dict[str, List[str]] = {
    ROLE_CLUB_OWNER:   _OWNER_PERMS,
    ROLE_CLUB_ADMIN:   _ADMIN_PERMS,
    ROLE_CLUB_MANAGER: _MANAGER_PERMS,
    ROLE_CLUB_STAFF:   _STAFF_PERMS,
    ROLE_PLATFORM_ADMIN: list(PERM.keys()),
}

def make_token(user_id: str) -> str:
    now = utcnow(); return jwt.encode({"sub": user_id, "iat": int(now.timestamp()), "exp": int((now + timedelta(days=JWT_EXPIRY_DAYS)).timestamp())}, JWT_SECRET, algorithm="HS256")
def decode_token(token: str) -> dict: return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

async def _load_capabilities(user: dict) -> dict:
    memberships = await db.organization_memberships.find({"user_id": user["id"], "status": "active"}, {"_id": 0}).to_list(100)
    is_platform_admin = bool(user.get("is_platform_admin")); perms = set(); orgs = []
    for m in memberships:
        role = m.get("role")
        perms.update(ROLE_PERMISSIONS.get(role, []))
        org = await db.organizations.find_one({"id": m["org_id"]}, {"_id": 0, "id": 1, "name": 1, "city": 1, "logo": 1})
        if org: orgs.append({"org_id": org["id"], "name": org["name"], "city": org.get("city"), "logo": org.get("logo"), "role": role})
    roles = [ROLE_PLAYER] + [m["role"] for m in memberships]
    if is_platform_admin: roles.append(ROLE_PLATFORM_ADMIN); perms |= set(PERM.keys())
    return {"roles": sorted(set(roles)), "is_platform_admin": is_platform_admin, "organizations": orgs, "permissions": sorted(perms)}

async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "): raise KuviraError(401, "UNAUTHENTICATED", "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try: payload = decode_token(token)
    except jwt.ExpiredSignatureError: raise KuviraError(401, "TOKEN_EXPIRED", "Session expired, please sign in again")
    except jwt.PyJWTError: raise KuviraError(401, "TOKEN_INVALID", "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user: raise KuviraError(401, "USER_NOT_FOUND", "User not found")
    user_id_ctx.set(user["id"]); return user

async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization: return None
    try: return await current_user(authorization)
    except HTTPException: return None

async def current_capabilities(user: dict = Depends(current_user)) -> dict: return await _load_capabilities(user)

def require_platform_admin():
    async def _dep(user: dict = Depends(current_user)) -> dict:
        if not user.get("is_platform_admin"): raise KuviraError(403, "FORBIDDEN", "Platform admin access required")
        return user
    return _dep
async def get_membership(user_id: str, org_id: str) -> Optional[dict]:
    return await db.organization_memberships.find_one({"user_id": user_id, "org_id": org_id, "status": "active"}, {"_id": 0})

def require_org_permission(permission: str):
    async def _dep(org_id: str, user: dict = Depends(current_user)) -> dict:
        if user.get("is_platform_admin"): return user
        m = await get_membership(user["id"], org_id)
        if not m: raise KuviraError(403, "ORG_ACCESS_DENIED", "You are not a member of this organization")
        allowed = ROLE_PERMISSIONS.get(m.get("role"), [])
        if permission not in allowed: raise KuviraError(403, "PERMISSION_DENIED", f"Missing permission: {permission}")
        return user
    return _dep
