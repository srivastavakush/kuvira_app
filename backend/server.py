"""MatchDrome — backend API.

MVP scope:
- Mobile+OTP auth (mock: any number, OTP=123456), JWT
- Users, Player profiles, Sports, Facilities, Courts, Bookings (mock payment)
- Games (open games), Player matching (rule-based scoring, upgradeable to ML)
- Community posts, Products, Cart, Orders (mock payment)
- AI Coach chat (Claude Sonnet 4.6 via emergentintegrations)
- Coaches, Events, Tournaments discovery
- Seeder for demo data
"""
import os
import html
import asyncio
from demo_records import real_records
from io import BytesIO
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pymongo.errors import DuplicateKeyError

from seed_data import (
    SPORTS, SKILL_LEVELS, FACILITIES, PLAYERS, COACHES,
    EVENTS, TOURNAMENTS, GAMES, PRODUCTS, COMMUNITY_POSTS, INDIA_CITIES,
)
from deps import (
    db, client, gen_id, utcnow, strip_id, make_token, current_user, optional_user,
    current_capabilities, _load_capabilities, KuviraError, log, configure_logging,
    request_id_ctx, EMERGENT_LLM_KEY, CORS_ALLOWED_ORIGINS, APP_ENV, IS_PROD, PAYMENT_PROVIDER, validate_runtime_config,
)
import otp_service
import features
import org_admin
import trust
from public_profiles import public_player
from payments import PayU, checkout_html, create_checkout, process_callback, reconcile_payment
from reservations import reserve_order, reserve_tournament, reserve_booking
from profile_media import ProfileMediaStorage

PLATFORM_ADMIN_MOBILES = [m.strip() for m in os.environ.get("PLATFORM_ADMIN_MOBILES", "").split(",") if m.strip()]

configure_logging()

app = FastAPI(title="MatchDrome API")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def normalize_mobile(mobile: str) -> str:
    """Canonicalize a phone number so the same person always maps to one account.

    Indian-first (10-digit -> +91), but preserves any explicit country code.
    Storing a single canonical form is what lets a returning user's profile be
    fetched from the DB on every subsequent login.
    """
    raw = (mobile or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if raw.startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    return "+" + digits if digits else raw

class OTPStart(BaseModel):
    mobile: str

class OTPVerify(BaseModel):
    mobile: str
    otp: str

class OnboardingPayload(BaseModel):
    name: str
    city: Optional[str] = "Bangalore"
    area: Optional[str] = None
    primary_sport: str = "sport-pickleball"
    sports: List[str] = ["sport-pickleball"]
    skill_level: str = "Beginner"
    playing_frequency: Optional[str] = "1-2x per week"
    competitive: Optional[str] = "Recreational"
    preferred_times: Optional[List[str]] = None
    radius_km: Optional[int] = 5
    goals: Optional[List[str]] = None

class BookingCreate(BaseModel):
    facility_id: str
    court_number: int = 1
    date: str  # ISO date
    slot: str  # "18:00-19:00"
    duration_min: int = 60
    customer_email: Optional[str] = None

class GameCreate(BaseModel):
    sport: str = "sport-pickleball"
    facility_id: str
    date: str
    duration_min: int = 60
    skill_level: str
    format: str = "Doubles"
    max_players: int = 4
    price_per_person: int = 200
    notes: Optional[str] = ""

class PostCreate(BaseModel):
    content: str
    image: Optional[str] = None

class CartAdd(BaseModel):
    product_id: str
    qty: int = Field(default=1, ge=1, le=100)

class OrderCreate(BaseModel):
    address: Dict[str, str]
    customer_email: Optional[str] = None

class PaymentContact(BaseModel):
    customer_email: Optional[str] = None

class ChatMessage(BaseModel):
    text: str
    session_id: Optional[str] = None

# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

async def seed_if_empty():
    """Ensure core reference catalog (sports) is present. No fake demo data is ever seeded."""
    if await db.sports.count_documents({}) == 0:
        await db.sports.insert_many([s.copy() for s in SPORTS])
        log.info("Sports catalog initialized.")

async def ensure_indexes():
    await db.users.create_index("mobile", unique=True)
    await db.users.create_index("referral_code", sparse=True)
    await db.users.create_index([("location", "2dsphere")], sparse=True)
    # Keep historical cancelled records while allowing the same slot to be booked again.
    for collection, owner, old_name in [(db.bookings, "facility_id", "uniq_slot"), (db.coach_sessions,"coach_id","uniq_coach_slot")]:
        await collection.update_many({"status":{"$in":["cancelled","expired","failed"]}}, {"$set":{"slot_active":False}})
        await collection.update_many({"status":{"$nin":["cancelled","expired","failed"]}}, {"$set":{"slot_active":True}})
        keys=[(owner,1)] + ([("court_number",1)] if owner=="facility_id" else []) + [("date",1),("slot",1)]
        await collection.create_index(keys,unique=True,name=old_name+"_active",partialFilterExpression={"slot_active":True})
        if old_name in await collection.index_information(): await collection.drop_index(old_name)
    await db.bookings.create_index("user_id")
    await db.coach_sessions.create_index("user_id")
    await db.organization_memberships.create_index([("user_id", 1), ("org_id", 1)], unique=True)
    await db.organization_memberships.create_index("org_id")
    await db.facilities.create_index("org_id", sparse=True)
    await db.facilities.create_index("city")
    await db.facilities.create_index([("location", "2dsphere")], sparse=True)
    await db.games.create_index("facility_id")
    await db.orders.create_index("user_id")
    await db.payment_transactions.create_index("txnid", unique=True)
    await db.payment_transactions.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
    await db.user_blocks.create_index([("user_id", 1), ("target_id", 1)], unique=True)
    await db.community_reports.create_index([("user_id", 1), ("post_id", 1)], unique=True)
    await db.account_deletions.create_index("user_id", unique=True)
    await db.posts.create_index("created_at")
    await db.training_plans.create_index("user_id")
    await db.training_activity.create_index([("user_id", 1), ("day", 1)], unique=True)
    await db.events.create_index([("location", "2dsphere")], sparse=True)
    await db.events.create_index("status")
    await db.tournaments.create_index([("location", "2dsphere")], sparse=True)
    await db.tournaments.create_index("status")
    await db.audit_logs.create_index("org_id")
    await db.audit_logs.create_index("created_at")
    log.info("Indexes ensured.")


@app.on_event("startup")
async def _startup():
    validate_runtime_config()
    await ensure_indexes()
    if not IS_PROD:
        await seed_if_empty()
    else:
        log.info("Production mode: demo seeding skipped.")

@app.on_event("shutdown")
async def _shutdown():
    client.close()


# ---------------------------------------------------------------------------
# Request-id middleware + standardized error handlers
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    rid = request.headers.get("X-Request-ID") or gen_id()
    request_id_ctx.set(rid)
    start = utcnow()
    response = await call_next(request)
    ms = int((utcnow() - start).total_seconds() * 1000)
    response.headers["X-Request-ID"] = rid
    log.info("%s %s -> %s (%dms)", request.method, request.url.path, response.status_code, ms)
    return response


@app.exception_handler(KuviraError)
async def kuvira_error_handler(request: Request, exc: KuviraError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}, "request_id": request_id_ctx.get()},
    )


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        content = {"error": detail, "request_id": request_id_ctx.get()}
    else:
        content = {"error": {"code": "HTTP_ERROR", "message": str(detail)}, "request_id": request_id_ctx.get()}
    return JSONResponse(status_code=exc.status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request", "details": exc.errors()[:5]}, "request_id": request_id_ctx.get()},
    )

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api.get("/")
async def root():
    return {"app": "MatchDrome", "status": "ok", "env": APP_ENV}

@api.get("/health")
async def health():
    return {"status": "ok", "time": utcnow().isoformat()}

@api.get("/readiness")
async def readiness():
    try:
        await db.command("ping")
        return {"ready": True}
    except Exception:
        raise KuviraError(503, "NOT_READY", "Database not reachable")

# ---------------------------------------------------------------------------
# Auth — mobile + OTP (env-gated: mock in dev, Twilio Verify in prod)
# ---------------------------------------------------------------------------

@api.post("/auth/otp/start")
async def otp_start(body: OTPStart):
    mobile = normalize_mobile(body.mobile)
    if len(mobile) < 6:
        raise KuviraError(400, "INVALID_MOBILE", "Invalid mobile number")
    return await otp_service.send_otp(mobile)

@api.post("/auth/otp/verify")
async def otp_verify(body: OTPVerify):
    mobile = normalize_mobile(body.mobile)
    ok = await otp_service.verify_otp(mobile, body.otp)
    if not ok:
        raise KuviraError(400, "OTP_INVALID", "Invalid or expired OTP")
    user = await db.users.find_one({"mobile": mobile}, {"_id": 0})
    is_new = False
    if not user or user.get("invited"):
        if user and user.get("invited"):
            # activate invited account (e.g. club owner provisioned by admin)
            await db.users.update_one({"id": user["id"]}, {"$set": {"invited": False}})
            user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
            is_new = not user.get("onboarded")
        else:
            user = {
                "id": gen_id(), "mobile": mobile, "name": None, "avatar": None,
                "city": None, "area": None, "primary_sport": None, "sports": [],
                "skill_level": None, "onboarded": False, "credits": 0,
                "created_at": utcnow().isoformat(),
            }
            await db.users.insert_one(user.copy())
            is_new = True
    # Backend-controlled platform admin bootstrap (never client-selectable)
    if mobile in PLATFORM_ADMIN_MOBILES and not user.get("is_platform_admin"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_platform_admin": True}})
        user["is_platform_admin"] = True
    token = make_token(user["id"])
    return {"token": token, "user": strip_id(user), "is_new": is_new}

@api.get("/me")
async def me(user=Depends(current_user)):
    caps = await _load_capabilities(user)
    return {**user, "capabilities": caps}

@api.post("/onboarding")
async def onboarding(body: OnboardingPayload, user=Depends(current_user)):
    update = body.model_dump()
    update["onboarded"] = True
    update["updated_at"] = utcnow().isoformat()
    # No stock/placeholder avatar — a profile photo is only ever what the user provides.
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return fresh

def _avatar_url(request: Request, user_id: str, asset_id: str) -> str:
    base = os.environ.get("PROFILE_MEDIA_PUBLIC_BASE_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")
    return f"{base}/api/users/{user_id}/avatar?v={asset_id}"


@api.post("/users/me/avatar")
async def upload_my_avatar(request: Request, file: UploadFile = File(...), user=Depends(current_user)):
    """Replace the signed-in user's profile photo with a validated image."""
    try:
        storage = ProfileMediaStorage()
        reference = await asyncio.to_thread(storage.put, file.file, user["id"])
    except ValueError as exc:
        raise KuviraError(400, "INVALID_AVATAR", str(exc))
    except Exception:
        log.exception("profile avatar upload failed")
        raise KuviraError(503, "AVATAR_UPLOAD_UNAVAILABLE", "Could not save your profile photo. Try again.")
    finally:
        await file.close()

    previous = user.get("avatar_storage")
    avatar = _avatar_url(request, user["id"], reference["asset_id"])
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"avatar": avatar, "avatar_storage": reference, "avatar_updated_at": utcnow().isoformat()}},
    )
    try:
        await asyncio.to_thread(storage.delete, previous)
    except Exception:
        log.warning("old profile avatar could not be removed", extra={"user_id": user["id"]})
    return {"avatar": avatar}


@api.get("/users/{user_id}/avatar")
async def get_user_avatar(user_id: str):
    """Serve public profile photos without making the backing object bucket public."""
    record = await db.users.find_one({"id": user_id}, {"_id": 0, "avatar_storage": 1})
    reference = (record or {}).get("avatar_storage")
    if not reference:
        raise KuviraError(404, "AVATAR_NOT_FOUND", "Profile photo not found")
    try:
        content = await asyncio.to_thread(ProfileMediaStorage().read, reference)
    except FileNotFoundError:
        raise KuviraError(404, "AVATAR_NOT_FOUND", "Profile photo not found")
    except Exception:
        log.exception("profile avatar read failed")
        raise KuviraError(503, "AVATAR_UNAVAILABLE", "Profile photo is temporarily unavailable")
    return StreamingResponse(BytesIO(content), media_type=reference.get("content_type", "image/jpeg"), headers={"Cache-Control": "public, max-age=86400"})

# ---------------------------------------------------------------------------
# Sports / catalog
# ---------------------------------------------------------------------------

@api.get("/sports")
async def list_sports():
    items = await db.sports.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return items

@api.get("/skill-levels")
async def list_skills():
    return SKILL_LEVELS

# ---------------------------------------------------------------------------
# Location & Nearby
# ---------------------------------------------------------------------------

class LocationUpdate(BaseModel):
    lat: float
    lng: float
    city: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None

@api.get("/cities")
async def list_cities():
    """Return the full India cities list for manual city selection."""
    return {"cities": INDIA_CITIES}

@api.post("/users/me/location")
async def update_my_location(body: LocationUpdate, user=Depends(current_user)):
    """Store the user's last known location (one-shot, no background tracking)."""
    update = {
        "location": {"type": "Point", "coordinates": [body.lng, body.lat]},
        "lat": body.lat, "lng": body.lng,
        "location_updated_at": utcnow().isoformat(),
    }
    if body.city: update["city"] = body.city
    if body.state: update["state"] = body.state
    if body.area: update["area"] = body.area
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"updated": True}

@api.get("/facilities/nearby")
async def facilities_nearby(
    lat: float, lng: float, radius_km: float = 25,
    sport: Optional[str] = None
):
    """Find active facilities within radius_km using MongoDB 2dsphere geospatial query."""
    radius_meters = radius_km * 1000
    q: Dict[str, Any] = {
        "location": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                "$maxDistance": radius_meters,
            }
        },
        "status": {"$ne": "inactive"}, "is_demo": {"$ne": True},
        "org_status": {"$ne": "inactive"},
    }
    if sport: q["sports"] = sport
    facilities = await db.facilities.find(real_records('facilities', q), {"_id": 0}).to_list(50)
    # Attach distance_km
    for f in facilities:
        flat, flng = f.get("lat"), f.get("lng")
        if flat and flng:
            # Haversine distance (no external Maps API needed)
            import math
            R = 6371
            dlat = math.radians(flat - lat)
            dlng = math.radians(flng - lng)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(flat)) * math.sin(dlng/2)**2
            f["distance_km"] = round(R * 2 * math.asin(math.sqrt(a)), 1)
    return facilities

# ---------------------------------------------------------------------------
# Facilities & courts
# ---------------------------------------------------------------------------

@api.get("/facilities")
async def list_facilities(city: Optional[str] = None, sport: Optional[str] = None):
    q: Dict[str, Any] = {"is_demo": {"$ne": True}, "status": {"$ne": "inactive"}}
    if city:
        q["city"] = city
    if sport:
        q["sports"] = sport
    items = await db.facilities.find(real_records('facilities', q), {"_id": 0}).to_list(200)
    org_ids = list({item.get("org_id") for item in items if item.get("org_id")})
    orgs = await db.organizations.find(real_records('organizations', {"id": {"$in": org_ids}}), {"_id": 0, "id": 1, "name": 1}).to_list(200)
    names = {org["id"]: org.get("name") for org in orgs}
    for item in items:
        if item.get("org_id") in names:
            item["org_name"] = names[item["org_id"]]
    return items

@api.get("/facilities/{fid}")
async def get_facility(fid: str):
    f = await db.facilities.find_one(real_records('facilities', {"id": fid, "is_demo": {"$ne": True}, "status": {"$ne": "inactive"}}), {"_id": 0})
    if not f:
        raise HTTPException(404, "Facility not found")
    return f

@api.get("/facilities/{fid}/availability")
async def facility_availability(fid: str, date: str):
    """Return time slots with availability for a court on a given date.

    Availability is computed from three sources (in priority order):
      1. Slot overrides set by Manager/Admin via /orgs/{id}/facilities/{id}/slots
         - status=blocked => unavailable regardless of bookings
         - status=open    => available (explicit override)
      2. Existing confirmed bookings (a booked slot is unavailable)
      3. Default: all slots in operating hours (06:00-23:00) are available
    """
    f = await db.facilities.find_one(real_records('facilities', {"id": fid, "is_demo": {"$ne": True}, "status": {"$ne": "inactive"}}), {"_id": 0})
    if not f:
        raise HTTPException(404, "Facility not found")
    slots = [f"{h:02d}:00-{h+1:02d}:00" for h in range(6, 23)]

    # Confirmed bookings (cancelled bookings free the slot)
    booked = await db.bookings.find(
        {"facility_id": fid, "date": date, "status": {"$nin": ["cancelled", "expired", "failed"]}}, {"_id": 0}
    ).to_list(200)
    booked_set = {(b["court_number"], b["slot"]) for b in booked}

    # Slot overrides created by Manager/Admin (block or explicit open)
    overrides_raw = await db.facility_slots.find(
        real_records('facility_slots', {"facility_id": fid, "date": {"$in": [date, "*"]}}), {"_id": 0}
    ).to_list(500)
    # Map (court_number, slot) -> status
    # A recurring or dated closure must agree with the booking write check.
    slot_overrides = {(o["court_number"], o["slot"]): "blocked"
                      for o in overrides_raw if o["status"] == "blocked"}

    courts = []
    for court_num in range(1, f["courts_count"] + 1):
        court_slots = []
        for s in slots:
            key = (court_num, s)
            override = slot_overrides.get(key)
            if override == "blocked":
                available = False
                reason = "blocked"
            elif key in booked_set:
                available = False
                reason = "booked"
            else:
                available = True
                reason = None
            entry = {"slot": s, "available": available, "price": f["price_per_hour"]}
            if reason:
                entry["reason"] = reason
            court_slots.append(entry)
        courts.append({"court_number": court_num, "slots": court_slots})
    return {"facility_id": fid, "date": date, "courts": courts}

# ---------------------------------------------------------------------------
# Bookings / payments
# ---------------------------------------------------------------------------

@api.post("/bookings")
async def create_booking(body: BookingCreate, user=Depends(current_user)):
    return await reserve_booking(db,body,user)

@api.get("/bookings/mine")
async def my_bookings(user=Depends(current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.get("/payments/checkout/{payment_id}")
async def payu_checkout(payment_id: str, token: str):
    """Public, opaque one-time checkout page that auto-posts to PayU."""
    txn = await db.payment_transactions.find_one({"id": payment_id, "checkout_token": token}, {"_id": 0})
    if not txn or txn.get("status") != "initiated":
        raise HTTPException(404, "Payment checkout is no longer available")
    if txn.get("expires_at") and txn["expires_at"] < utcnow().isoformat():
        raise HTTPException(410, "Checkout expired; please make a new booking")
    payu = PayU()
    return HTMLResponse(checkout_html(payu.checkout_endpoint, payu.checkout_fields(txn)))


@api.get("/payments/{payment_id}")
async def payment_status(payment_id: str, user=Depends(current_user)):
    txn = await db.payment_transactions.find_one({"id": payment_id, "user_id": user["id"]}, {"_id": 0, "checkout_token": 0, "payu_response": 0})
    if not txn:
        raise HTTPException(404, "Payment not found")
    if txn.get("status") != "succeeded":
        await reconcile_payment(db, txn)
        txn = await db.payment_transactions.find_one({"id": payment_id}, {"_id":0,"checkout_token":0,"payu_response":0,"verification":0})
    resource = txn.get("resource") or {}
    collection = {"booking": db.bookings, "coach_session": db.coach_sessions, "tournament_registration": db.tournament_registrations, "order": db.orders}.get(resource.get("kind"))
    item = await collection.find_one({"id": resource.get("id")}, {"_id": 0}) if collection is not None else None
    return {"payment": txn, "resource": item}


async def _payu_callback_response(request: Request):
    form = await request.form()
    result = await process_callback(db, {str(key): str(value) for key, value in form.items()})
    status = result["payment"]["status"]
    return HTMLResponse(f"<html><body><h2>Payment {html.escape(status)}</h2><p>You may return to MatchDrome.</p></body></html>")


@api.post("/payments/payu/return")
async def payu_return(request: Request):
    return await _payu_callback_response(request)


@api.post("/payments/payu/webhook")
async def payu_webhook(request: Request):
    return await _payu_callback_response(request)

# ---------------------------------------------------------------------------
# Games (open games)
# ---------------------------------------------------------------------------

async def _enrich_game(g: dict) -> dict:
    f = await db.facilities.find_one(real_records('facilities', {"id": g["facility_id"]}), {"_id": 0, "name": 1, "area": 1, "city": 1, "image": 1})
    g["facility"] = f
    host = await db.players.find_one(real_records('players', {"id": g["host_id"]}), {"_id": 0})
    if not host:
        host = await db.users.find_one(real_records('users', {"id": g["host_id"]}), {"_id": 0})
    g["host"] = public_player(host)
    g["slots_remaining"] = g["max_players"] - len(g.get("current_players", []))
    return g

@api.get("/games")
async def list_games(sport: Optional[str] = None, skill: Optional[str] = None, city: Optional[str] = None):
    q: Dict[str, Any] = {}
    if sport: q["sport"] = sport
    if skill: q["skill_level"] = skill
    q["is_demo"] = {"$ne": True}
    games = await db.games.find(real_records('games', q), {"_id": 0}).to_list(200)
    if city:
        facility_ids = [f["id"] for f in await db.facilities.find(real_records('facilities', {"city": city}), {"_id": 0, "id": 1}).to_list(100)]
        games = [g for g in games if g["facility_id"] in facility_ids]
    return [await _enrich_game(g) for g in games]

@api.get("/games/{gid}")
async def get_game(gid: str):
    g = await db.games.find_one(real_records('games', {"id": gid, "is_demo": {"$ne": True}}), {"_id": 0})
    if not g: raise HTTPException(404, "Game not found")
    return await _enrich_game(g)

@api.post("/games")
async def create_game(body: GameCreate, user=Depends(current_user)):
    game = {"id": gen_id(), "sport": body.sport, "facility_id": body.facility_id, "host_id": user["id"], "date": body.date, "duration_min": body.duration_min, "skill_level": body.skill_level, "format": body.format, "max_players": body.max_players, "current_players": [user["id"]], "price_per_person": body.price_per_person, "notes": body.notes or "", "created_at": utcnow().isoformat()}
    await db.games.insert_one(game.copy())
    return await _enrich_game(strip_id(game))

@api.post("/games/{gid}/join")
async def join_game(gid: str, user=Depends(current_user)):
    g = await db.games.find_one(real_records('games', {"id": gid}), {"_id": 0})
    if not g: raise KuviraError(404, "GAME_NOT_FOUND", "Game not found")
    if g.get("status") == "cancelled": raise KuviraError(400, "GAME_CANCELLED", "This game was cancelled")
    if user["id"] in g.get("current_players", []): return await _enrich_game(g)
    res = await db.games.update_one({"id": gid, "current_players": {"$ne": user["id"]}, f"current_players.{g['max_players'] - 1}": {"$exists": False}}, {"$push": {"current_players": user["id"]}})
    if res.modified_count == 0: raise KuviraError(409, "GAME_FULL", "Game is full")
    try: await features.award_first_game_referral(user["id"])
    except Exception: log.exception("referral reward failed")
    g = await db.games.find_one(real_records('games', {"id": gid}), {"_id": 0}); return await _enrich_game(g)

# ---------------------------------------------------------------------------
# Players & matching
# ---------------------------------------------------------------------------

_SKILL_ORDER = {"Beginner": 1, "Intermediate": 2, "Advanced": 3, "Pro": 4}
def _match_score(player: dict, user: dict) -> int:
    score = 60; ps = _SKILL_ORDER.get(player.get("skill_level", "Beginner"), 1); us = _SKILL_ORDER.get(user.get("skill_level") or "Beginner", 1); gap = abs(ps-us); score += {0:25,1:15,2:5,3:-10}.get(gap,-10)
    if player.get("city") and user.get("city") and player["city"] == user["city"]: score += 8
    if player.get("area") and user.get("area") and player["area"] == user["area"]: score += 5
    if player.get("primary_sport") == user.get("primary_sport"): score += 5
    return max(20,min(99,score))

@api.get("/players")
async def list_players(user=Depends(optional_user)):
    """Return real onboarded users as player cards for 'Players Near You'.
    Guest-safe public profile fields only; excludes demonstration data."""
    real_users = await db.users.find(
        real_records('users', {"onboarded": True, "is_demo": {"$ne": True}, "id": {"$ne": user["id"] if user else None}}),
        {"_id": 0, "id": 1, "name": 1, "avatar": 1, "city": 1, "state": 1,
         "area": 1, "primary_sport": 1, "skill_level": 1, "bio": 1,
         "playing_style": 1, "sports": 1}
    ).to_list(200)
    for p in real_users:
        if user:
            p["match_score"] = _match_score(p, user)
        p["matches_played"] = await db.games.count_documents(real_records('games', {"current_players": p["id"]}))
        p["is_real_user"] = True
    real_users.sort(key=lambda x: -x.get("match_score", 0))
    return real_users
@api.get("/players/{pid}")
async def get_player(pid: str, user=Depends(optional_user)):
    p = await db.users.find_one(real_records('users', {"id": pid, "onboarded": True, "is_demo": {"$ne": True}}), {"_id": 0})
    if not p:
        p = await db.players.find_one(real_records('players', {"id": pid, "is_demo": {"$ne": True}}), {"_id": 0})
    if not p:
        raise HTTPException(404, "Player not found")
    if user:
        p["match_score"] = _match_score(p, user)
    return public_player(p)

@api.get("/coaches")
async def list_coaches(city:Optional[str]=None): return await db.coaches.find(real_records('coaches', {'city':city, 'is_demo': {'$ne': True}} if city else {'is_demo': {'$ne': True}}),{'_id':0}).to_list(100)
@api.get("/coaches/{cid}")
async def get_coach(cid:str):
    c=await db.coaches.find_one(real_records('coaches', {'id':cid, 'is_demo': {'$ne': True}}),{'_id':0});
    if not c: raise HTTPException(404,'Coach not found')
    return c
@api.get('/events')
async def list_events(city: Optional[str] = None, published_only: bool = True):
    """List events. By default only returns published events (hides drafts from public)."""
    q: Dict[str, Any] = {}
    if city: q["city"] = city
    q["is_demo"] = {"$ne": True}
    q["status"] = "published"
    return await db.events.find(real_records('events', q), {'_id': 0}).sort('date', 1).to_list(100)

@api.get('/events/{eid}')
async def get_event(eid: str):
    e = await db.events.find_one(real_records('events', {'id': eid, 'is_demo': {'$ne': True}, 'status': 'published'}), {'_id': 0})
    if not e: raise HTTPException(404, 'Event not found')
    return e

@api.get('/tournaments')
async def list_tournaments(city: Optional[str] = None, published_only: bool = True):
    """List tournaments. By default only returns published tournaments."""
    q: Dict[str, Any] = {}
    if city: q["city"] = city
    q["is_demo"] = {"$ne": True}
    q["status"] = "published"
    return await db.tournaments.find(real_records('tournaments', q), {'_id': 0}).sort('date', 1).to_list(100)
@api.get('/tournaments/{tid}')
async def get_tournament(tid:str):
    t=await db.tournaments.find_one(real_records('tournaments', {'id':tid, 'is_demo': {'$ne': True}, 'status': 'published'}),{'_id':0});
    if not t: raise HTTPException(404,'Tournament not found')
    return t
@api.post('/tournaments/{tid}/register')
async def register_tournament(tid: str, body: Optional[PaymentContact] = None, user=Depends(current_user)):
    if PAYMENT_PROVIDER == "payu":
        return await reserve_tournament(db,tid,user,body.customer_email if body else None)
    t = await db.tournaments.find_one(real_records('tournaments', {'id': tid}), {'_id': 0})
    if not t: raise HTTPException(404, 'Tournament not found')
    reg = {'id': gen_id(), 'user_id': user['id'], 'tournament_id': tid, 'status': 'pending_payment' if PAYMENT_PROVIDER == 'payu' else 'confirmed', 'payment': {'provider': 'payu', 'status': 'initiated', 'amount': t['entry_fee']} if PAYMENT_PROVIDER == 'payu' else {'provider': 'mock_payu', 'status': 'paid', 'amount': t['entry_fee']}, 'created_at': utcnow().isoformat()}
    await db.tournament_registrations.insert_one(reg.copy())
    if PAYMENT_PROVIDER != 'payu':
        await db.tournaments.update_one({'id': tid}, {'$inc': {'participants_count': 1}})
        return strip_id(reg)
    try:
        checkout = await create_checkout(db, user=user, resource={'kind': 'tournament_registration', 'id': reg['id']}, amount=t['entry_fee'], productinfo=f"Tournament registration - {t['name']}", customer_email=(body.customer_email if body else None))
        await db.tournament_registrations.update_one({'id': reg['id']}, {'$set': {'payment': {**checkout['payment'], 'provider': 'payu'}}})
        return {'registration': strip_id(reg), **checkout}
    except Exception:
        await db.tournament_registrations.delete_one({'id': reg['id'], 'status': 'pending_payment'})
        raise

async def _enrich_post(p:dict,user_id:Optional[str])->dict:
    author=await db.players.find_one(real_records('players', {'id':p['author_id']}),{'_id':0}) or await db.users.find_one(real_records('users', {'id':p['author_id']}),{'_id':0}); p['author']=public_player(author); p['liked']=bool(user_id and await db.post_likes.find_one({'post_id':p['id'],'user_id':user_id})); return p
@api.get('/posts')
async def list_posts(user=Depends(optional_user)):
    blocked=[]
    if user:
        blocks=await db.user_blocks.find({'$or':[{'user_id':user['id']},{'target_id':user['id']}]},{'_id':0}).to_list(1000)
        blocked=[b['target_id'] if b['user_id']==user['id'] else b['user_id'] for b in blocks]
    items=await db.posts.find(real_records('posts', {'is_demo':{'$ne':True},'moderation_status':{'$ne':'hidden'},'author_id':{'$nin':blocked}}),{'_id':0}).sort('created_at',-1).to_list(100)
    return [await _enrich_post(p,user['id'] if user else None) for p in items]
@api.post('/posts')
async def create_post(body:PostCreate,user=Depends(current_user)):
    if user.get('community_policy_version') != trust.POLICY_VERSION:
        raise KuviraError(409,'CONSENT_REQUIRED','Please accept the community rules before posting')
    if not body.content.strip() or len(body.content)>4000:raise KuviraError(400,'INVALID_CONTENT','Write between 1 and 4000 characters')
    post={'id':gen_id(),'author_id':user['id'],'content':body.content,'image':body.image,'likes':0,'comments_count':0,'created_at':utcnow().isoformat()}; await db.posts.insert_one(post.copy()); return await _enrich_post(strip_id(post),user['id'])
@api.post('/posts/{pid}/like')
async def toggle_like(pid:str,user=Depends(current_user)):
    existing=await db.post_likes.find_one({'post_id':pid,'user_id':user['id']})
    if existing: await db.post_likes.delete_one({'post_id':pid,'user_id':user['id']}); await db.posts.update_one({'id':pid},{'$inc':{'likes':-1}}); return {'liked':False}
    await db.post_likes.insert_one({'post_id':pid,'user_id':user['id'],'created_at':utcnow().isoformat()}); await db.posts.update_one({'id':pid},{'$inc':{'likes':1}}); return {'liked':True}

@api.get('/products')
async def list_products(category:Optional[str]=None,sport:Optional[str]=None):
    q={};
    if category:q['category']=category
    if sport:q['sport']=sport
    q["is_demo"] = {"$ne": True}; q["status"] = "active"
    return await db.products.find(real_records('products', q),{'_id':0}).to_list(200)
@api.get('/products/{pid}')
async def get_product(pid:str):
    p=await db.products.find_one(real_records('products', {'id':pid, 'is_demo': {'$ne': True}, 'status': 'active'}),{'_id':0});
    if not p: raise HTTPException(404,'Product not found')
    return p
@api.get('/products/recommend/for-me')
async def recommend_products(user=Depends(current_user)):
    products=await db.products.find(real_records('products', {'is_demo': {'$ne': True}, 'status': 'active'}), {'_id':0}).to_list(200); skill=user.get('skill_level','Beginner')
    for p in products:
        s=50
        if skill in (p.get('recommended_skill') or ''): s+=20
        if p['category']=='Paddles': s+=15
        s+=int(p.get('rating',0)*5); p['reco_score']=s
    products.sort(key=lambda x:-x['reco_score']); return products[:6]
@api.get('/cart')
async def get_cart(user=Depends(current_user)):
    cart=await db.carts.find_one({'user_id':user['id']},{'_id':0}) or {'user_id':user['id'],'items':[]}; items=[]; total=0
    for it in cart.get('items',[]):
        prod=await db.products.find_one(real_records('products', {'id':it['product_id']}),{'_id':0})
        if prod: items.append({'product':prod,'qty':it['qty'],'subtotal':prod['price']*it['qty']}); total+=prod['price']*it['qty']
    return {'items':items,'total':total,'count':sum(i['qty'] for i in cart.get('items',[]))}
@api.post('/cart/add')
async def cart_add(body:CartAdd,user=Depends(current_user)):
    cart=await db.carts.find_one({'user_id':user['id']},{'_id':0})
    if not cart: await db.carts.insert_one({'user_id':user['id'],'items':[{'product_id':body.product_id,'qty':body.qty}]})
    else:
        items=cart['items']; found=False
        for it in items:
            if it['product_id']==body.product_id: it['qty']+=body.qty; found=True; break
        if not found: items.append({'product_id':body.product_id,'qty':body.qty})
        await db.carts.update_one({'user_id':user['id']},{'$set':{'items':items}})
    return await get_cart(user)
@api.post('/cart/remove')
async def cart_remove(body:CartAdd,user=Depends(current_user)):
    cart=await db.carts.find_one({'user_id':user['id']},{'_id':0})
    if cart: await db.carts.update_one({'user_id':user['id']},{'$set':{'items':[it for it in cart['items'] if it['product_id']!=body.product_id]}})
    return await get_cart(user)
@api.post('/orders')
async def create_order(body: OrderCreate, user=Depends(current_user)):
    if PAYMENT_PROVIDER == "payu":
        return await reserve_order(db,user,body.address,body.customer_email)
    cart = await db.carts.find_one({'user_id': user['id']}, {'_id': 0})
    if not cart or not cart.get('items'): raise HTTPException(400, 'Cart is empty')
    line_items=[]; total=0
    for it in cart['items']:
        prod=await db.products.find_one(real_records('products', {'id':it['product_id']}),{'_id':0})
        if prod: line_items.append({'product':prod,'qty':it['qty'],'subtotal':prod['price']*it['qty']}); total+=prod['price']*it['qty']
    order={'id':gen_id(),'user_id':user['id'],'items':line_items,'total':total,'address':body.address,'status':'pending_payment' if PAYMENT_PROVIDER == 'payu' else 'confirmed','payment':{'provider':'payu','status':'initiated','amount':total} if PAYMENT_PROVIDER == 'payu' else {'provider':'mock_payu','status':'paid','amount':total},'created_at':utcnow().isoformat()}
    await db.orders.insert_one(order.copy())
    if PAYMENT_PROVIDER != 'payu':
        await db.carts.update_one({'user_id':user['id']},{'$set':{'items':[]}})
        return strip_id(order)
    try:
        checkout = await create_checkout(db, user=user, resource={'kind': 'order', 'id': order['id']}, amount=total, productinfo=f"MatchDrome order ({len(line_items)} item{'s' if len(line_items) != 1 else ''})", customer_email=body.customer_email)
        await db.orders.update_one({'id': order['id']}, {'$set': {'payment': {**checkout['payment'], 'provider': 'payu'}}})
        return {'order': strip_id(order), **checkout}
    except Exception:
        await db.orders.delete_one({'id': order['id'], 'status': 'pending_payment'})
        raise
@api.get('/orders/mine')
async def my_orders(user=Depends(current_user)): return await db.orders.find({'user_id':user['id']},{'_id':0}).sort('created_at',-1).to_list(100)

AI_COACH_SYSTEM = """You are MatchDrome AI Coach — a world-class multi-sport coach for badminton, cricket, football, tennis and pickleball.

You know the player's profile: sport, skill level, city, playing style, goals.
Be concise (2-4 short paragraphs max), specific, and actionable.
Structure advice as: (1) quick insight, (2) 2-3 concrete drills or steps, (3) motivating close.
When suggesting equipment, always tie it to the player's playing style and skill.
When suggesting a training plan, keep it realistic (2-4 weeks, 3-4 sessions per week).
NEVER claim to have analyzed video or camera data unless the user explicitly provides that data.
Speak like a confident, warm coach — never robotic. Use short sentences."""
def _build_user_context(user:dict)->str:
    parts=[f"Player name: {user.get('name') or 'Athlete'}"]
    if user.get('primary_sport'): parts.append(f"Primary sport: {user['primary_sport'].replace('sport-','')}")
    if user.get('skill_level'): parts.append(f"Skill level: {user['skill_level']}")
    if user.get('city'): parts.append(f"City: {user['city']}")
    if user.get('goals'): parts.append(f"Goals: {', '.join(user['goals'])}")
    if user.get('playing_frequency'): parts.append(f"Frequency: {user['playing_frequency']}")
    return '\n'.join(parts)
@api.post('/ai/coach/chat')
async def ai_coach_chat(body:ChatMessage,user=Depends(current_user)):
    # Compatibility route for older app builds. It deliberately uses the same
    # configured provider as the agentic AI Coach, including Vertex in prod.
    from ai_coach.providers import get_default_provider
    session_id=body.session_id or f"coach-{user['id']}"; history=await db.ai_chat.find({'session_id':session_id},{'_id':0}).sort('created_at',1).to_list(50); system=AI_COACH_SYSTEM+'\n\nPlayer profile:\n'+_build_user_context(user)
    try:
        messages=[{"role": h["role"], "content": h["text"]} for h in history[-8:] if h.get("role") in {"user", "assistant"}]
        messages.append({"role": "user", "content": body.text})
        response=await get_default_provider().generate_coaching_response(system, messages)
    except Exception as e:
        log.exception('AI coach error'); raise HTTPException(502,f'AI Coach unavailable: {str(e)[:100]}')
    now=utcnow().isoformat(); await db.ai_chat.insert_one({'session_id':session_id,'user_id':user['id'],'role':'user','text':body.text,'created_at':now}); await db.ai_chat.insert_one({'session_id':session_id,'user_id':user['id'],'role':'assistant','text':response,'created_at':utcnow().isoformat()}); return {'session_id':session_id,'reply':response}
@api.get('/ai/coach/history')
async def ai_coach_history(session_id:Optional[str]=None,user=Depends(current_user)):
    sid=session_id or f"coach-{user['id']}"; msgs=await db.ai_chat.find({'session_id':sid},{'_id':0}).sort('created_at',1).to_list(200); return {'session_id':sid,'messages':msgs}
@api.get('/ai/insights')
async def ai_insights(user=Depends(current_user)):
    """Real, per-user activity — never fabricated. Qualitative AI fields stay
    null until the user has actual analyzed-match data (AI Coach video reports)."""
    uid = user["id"]
    matches_played = await db.games.count_documents(real_records('games', {"current_players": uid}))
    bookings_count = await db.bookings.count_documents({"user_id": uid})
    sessions_count = await db.coach_sessions.count_documents({"user_id": uid})
    try:
        streak = (await features.training_streak(user)).get("streak_days", 0)
    except Exception:
        streak = 0
    # Performance score/chart come only from analyzed AI Coach matches.
    analyzed = await db.ai_coach_analytics.count_documents({"user_id": uid})
    return {
        "performance_score": None,
        "trend": None,
        "strongest": None,
        "needs_improvement": None,
        "recommendation": None,
        "has_analysis": analyzed > 0,
        "stats": {
            "matches_played": matches_played,
            "win_rate": None,
            "bookings": bookings_count,
            "coach_sessions": sessions_count,
            "training_streak_days": streak,
        },
        "chart": [],
    }
@api.get('/ai/recommendations')
async def ai_recommendations(user=Depends(current_user)):
    products=await db.products.find(real_records('products', {'is_demo': {'$ne': True}, 'status': 'active'}), {'_id':0}).to_list(6); games=await db.games.find(real_records('games', {'is_demo': {'$ne': True}}), {'_id':0}).to_list(4); return {'insight':None,'products':products[:3],'games':[await _enrich_game(g) for g in games[:3]]}

@api.get('/search')
async def search(q: str):
    q_lower = q.lower()
    facilities = [f for f in await db.facilities.find(real_records('facilities', {'is_demo': {'$ne': True}, 'status': {'$ne': 'inactive'}}), {'_id': 0}).to_list(200) if q_lower in f['name'].lower() or q_lower in f.get('area', '').lower() or q_lower in f.get('city', '').lower()]
    players = [p for p in await db.users.find(real_records('users', {'onboarded': True, 'is_demo': {'$ne': True}}), {'_id': 0, 'id': 1, 'name': 1, 'avatar': 1, 'city': 1, 'area': 1, 'skill_level': 1, 'primary_sport': 1}).to_list(200) if q_lower in (p.get('name') or '').lower()]
    products = [p for p in await db.products.find(real_records('products', {'is_demo': {'$ne': True}, 'status': 'active'}), {'_id': 0}).to_list(200) if q_lower in p['name'].lower() or q_lower in p.get('category', '').lower()]
    events = [e for e in await db.events.find(real_records('events', {'is_demo': {'$ne': True}, 'status': 'published'}), {'_id': 0}).to_list(100) if q_lower in e['name'].lower()]
    return {'facilities': facilities[:8], 'players': players[:8], 'products': products[:8], 'events': events[:8]}

# ---------------------------------------------------------------------------
# Capabilities (backend-determined; drives workspace switching in the app)
# ---------------------------------------------------------------------------
@api.get('/capabilities')
async def capabilities(caps=Depends(current_capabilities)): return caps

app.include_router(api)
app.include_router(features.router)
app.include_router(org_admin.router)
app.include_router(trust.router)
from ai_coach.router import router as ai_coach_router
app.include_router(ai_coach_router)
app.add_middleware(
    CORSMiddleware,
    # Browsers reject wildcard origins with credentials. Development may use
    # the wildcard without credentials; production validates explicit origins.
    allow_credentials='*' not in CORS_ALLOWED_ORIGINS,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_methods=['*'],
    allow_headers=['*'],
)
