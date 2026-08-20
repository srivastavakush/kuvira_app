"""Kuvira Sports — shared dependencies: config, db, auth, RBAC, errors, logging.

Single source of truth imported by server.py and all feature routers.
"""
import os
import uuid
import json
import time
import logging
import contextvars
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
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_EXPIRY_DAYS = int(os.environ.get("JWT_EXPIRY_DAYS", "30"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
OTP_PROVIDER = os.environ.get("OTP_PROVIDER", "mock")
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_VERIFY_SERVICE = os.environ.get("TWILIO_VERIFY_SERVICE", "")
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "*").split(",") if o.strip()]
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
ROLE_CLUB_MANAGER = "CLUB_MANAGER"
ROLE_CLUB_STAFF = "CLUB_STAFF"
PERM = {
    "club.view": "View club workspace", "club.manage": "Edit club profile", "club.courts.manage": "Manage courts & availability", "club.bookings.manage": "Manage club bookings", "club.games.manage": "Manage club games", "club.events.manage": "Manage club events & tournaments", "club.members.manage": "Manage club members", "club.staff.manage": "Add/remove managers & staff", "club.ownership.transfer": "Transfer club ownership", "club.analytics.view": "View club analytics",
    "platform.clubs.manage": "Create/approve clubs, assign owners", "platform.users.manage": "Manage platform users", "platform.analytics.view": "View platform-wide analytics",
}
ROLE_PERMISSIONS: Dict[str, List[str]] = {
    ROLE_CLUB_OWNER: ["club.view", "club.manage", "club.courts.manage", "club.bookings.manage", "club.games.manage", "club.events.manage", "club.members.manage", "club.staff.manage", "club.ownership.transfer", "club.analytics.view"],
    ROLE_CLUB_MANAGER: ["club.view", "club.manage", "club.courts.manage", "club.bookings.manage", "club.games.manage", "club.events.manage", "club.members.manage", "club.analytics.view"],
    ROLE_CLUB_STAFF: ["club.view", "club.bookings.manage", "club.games.manage"],
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

# Mounted here intentionally: server.py already imports org_admin, which is the
# platform-admin router mounted by the application. The catalog module attaches
# its router to that existing router without requiring a server.py rewrite.
try:
    import catalog_seed as _catalog_seed  # noqa: F401,E402
except Exception as exc:
    log.warning("catalog seed router unavailable: %s", exc)
