"""Kuvira Sports — backend API.

MVP scope:
- Mobile+OTP auth (mock: any number, OTP=123456), JWT
- Users, Player profiles, Sports, Facilities, Courts, Bookings (mock payment)
- Games (open games), Player matching (rule-based scoring, upgradeable to ML)
- Community posts, Products, Cart, Orders (mock payment)
- AI Coach chat (Claude Sonnet 4.6 via emergentintegrations)
- Coaches, Events, Tournaments discovery
- Seeder for demo data
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import jwt
import uuid
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from seed_data import (
    SPORTS, SKILL_LEVELS, FACILITIES, PLAYERS, COACHES,
    EVENTS, TOURNAMENTS, GAMES, PRODUCTS, COMMUNITY_POSTS,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Kuvira Sports API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("kuvira")

# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def gen_id() -> str:
    return str(uuid.uuid4())

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def strip_id(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc

def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": int(utcnow().timestamp()), "exp": int((utcnow() + timedelta(days=30)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization:
        return None
    try:
        return await current_user(authorization)
    except HTTPException:
        return None

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

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
    qty: int = 1

class OrderCreate(BaseModel):
    address: Dict[str, str]

class ChatMessage(BaseModel):
    text: str
    session_id: Optional[str] = None

# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------

async def seed_if_empty():
    if await db.sports.count_documents({}) == 0:
        await db.sports.insert_many([s.copy() for s in SPORTS])
    if await db.facilities.count_documents({}) == 0:
        await db.facilities.insert_many([f.copy() for f in FACILITIES])
    if await db.players.count_documents({}) == 0:
        await db.players.insert_many([p.copy() for p in PLAYERS])
    if await db.coaches.count_documents({}) == 0:
        await db.coaches.insert_many([c.copy() for c in COACHES])
    if await db.events.count_documents({}) == 0:
        await db.events.insert_many([e.copy() for e in EVENTS])
    if await db.tournaments.count_documents({}) == 0:
        await db.tournaments.insert_many([t.copy() for t in TOURNAMENTS])
    if await db.games.count_documents({}) == 0:
        await db.games.insert_many([g.copy() for g in GAMES])
    if await db.products.count_documents({}) == 0:
        await db.products.insert_many([p.copy() for p in PRODUCTS])
    if await db.posts.count_documents({}) == 0:
        await db.posts.insert_many([p.copy() for p in COMMUNITY_POSTS])
    log.info("Seed complete.")

@app.on_event("startup")
async def _startup():
    await seed_if_empty()

@app.on_event("shutdown")
async def _shutdown():
    client.close()

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api.get("/")
async def root():
    return {"app": "Kuvira Sports", "status": "ok"}

@api.get("/health")
async def health():
    return {"status": "ok", "time": utcnow().isoformat()}

# ---------------------------------------------------------------------------
# Auth — mobile + OTP (mock: any mobile, OTP = 123456)
# ---------------------------------------------------------------------------
FIXED_OTP = "123456"

@api.post("/auth/otp/start")
async def otp_start(body: OTPStart):
    mobile = body.mobile.strip()
    if len(mobile) < 6:
        raise HTTPException(400, "Invalid mobile number")
    # In production we'd send SMS; for MVP we return demo OTP for UX hint
    return {"sent": True, "demo_otp": FIXED_OTP, "message": f"OTP sent to {mobile} (demo: {FIXED_OTP})"}

@api.post("/auth/otp/verify")
async def otp_verify(body: OTPVerify):
    if body.otp != FIXED_OTP:
        raise HTTPException(400, "Invalid OTP. For demo, use 123456.")
    user = await db.users.find_one({"mobile": body.mobile}, {"_id": 0})
    is_new = False
    if not user:
        user = {
            "id": gen_id(),
            "mobile": body.mobile,
            "name": None,
            "avatar": None,
            "city": None,
            "area": None,
            "primary_sport": None,
            "sports": [],
            "skill_level": None,
            "onboarded": False,
            "created_at": utcnow().isoformat(),
        }
        await db.users.insert_one(user.copy())
        is_new = True
    token = make_token(user["id"])
    return {"token": token, "user": strip_id(user), "is_new": is_new}

@api.get("/me")
async def me(user=Depends(current_user)):
    return user

@api.post("/onboarding")
async def onboarding(body: OnboardingPayload, user=Depends(current_user)):
    update = body.model_dump()
    update["onboarded"] = True
    update["updated_at"] = utcnow().isoformat()
    if not update.get("avatar"):
        # Deterministic avatar
        idx = abs(hash(user["id"])) % 70
        update["avatar"] = f"https://i.pravatar.cc/300?img={idx}"
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return fresh

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
# Facilities & courts
# ---------------------------------------------------------------------------

@api.get("/facilities")
async def list_facilities(city: Optional[str] = None, sport: Optional[str] = None):
    q: Dict[str, Any] = {}
    if city:
        q["city"] = city
    if sport:
        q["sports"] = sport
    items = await db.facilities.find(q, {"_id": 0}).to_list(200)
    return items

@api.get("/facilities/{fid}")
async def get_facility(fid: str):
    f = await db.facilities.find_one({"id": fid}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Facility not found")
    return f

@api.get("/facilities/{fid}/availability")
async def facility_availability(fid: str, date: str):
    """Return time slots with availability for a court on a given date (mocked)."""
    f = await db.facilities.find_one({"id": fid}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Facility not found")
    slots = [f"{h:02d}:00-{h+1:02d}:00" for h in range(6, 23)]
    # Find already booked
    booked = await db.bookings.find({"facility_id": fid, "date": date}, {"_id": 0}).to_list(200)
    booked_set = {(b["court_number"], b["slot"]) for b in booked}
    courts = []
    for court_num in range(1, f["courts_count"] + 1):
        court_slots = []
        for s in slots:
            court_slots.append({
                "slot": s,
                "available": (court_num, s) not in booked_set,
                "price": f["price_per_hour"],
            })
        courts.append({"court_number": court_num, "slots": court_slots})
    return {"facility_id": fid, "date": date, "courts": courts}

# ---------------------------------------------------------------------------
# Bookings (mock payment)
# ---------------------------------------------------------------------------

@api.post("/bookings")
async def create_booking(body: BookingCreate, user=Depends(current_user)):
    f = await db.facilities.find_one({"id": body.facility_id}, {"_id": 0})
    if not f:
        raise HTTPException(404, "Facility not found")
    booking = {
        "id": gen_id(),
        "user_id": user["id"],
        "facility_id": body.facility_id,
        "facility_name": f["name"],
        "facility_image": f["image"],
        "court_number": body.court_number,
        "date": body.date,
        "slot": body.slot,
        "duration_min": body.duration_min,
        "price": f["price_per_hour"],
        "status": "confirmed",
        "payment": {"provider": "mock_payu", "status": "paid", "amount": f["price_per_hour"]},
        "created_at": utcnow().isoformat(),
    }
    await db.bookings.insert_one(booking.copy())
    return strip_id(booking)

@api.get("/bookings/mine")
async def my_bookings(user=Depends(current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

# ---------------------------------------------------------------------------
# Games (open games)
# ---------------------------------------------------------------------------

async def _enrich_game(g: dict) -> dict:
    f = await db.facilities.find_one({"id": g["facility_id"]}, {"_id": 0, "name": 1, "area": 1, "city": 1, "image": 1})
    g["facility"] = f
    host = await db.players.find_one({"id": g["host_id"]}, {"_id": 0})
    if not host:
        host = await db.users.find_one({"id": g["host_id"]}, {"_id": 0})
    g["host"] = host
    g["slots_remaining"] = g["max_players"] - len(g.get("current_players", []))
    return g

@api.get("/games")
async def list_games(
    sport: Optional[str] = None,
    skill: Optional[str] = None,
    city: Optional[str] = None,
):
    q: Dict[str, Any] = {}
    if sport:
        q["sport"] = sport
    if skill:
        q["skill_level"] = skill
    games = await db.games.find(q, {"_id": 0}).to_list(200)
    if city:
        facility_ids = [f["id"] for f in await db.facilities.find({"city": city}, {"_id": 0, "id": 1}).to_list(100)]
        games = [g for g in games if g["facility_id"] in facility_ids]
    return [await _enrich_game(g) for g in games]

@api.get("/games/{gid}")
async def get_game(gid: str):
    g = await db.games.find_one({"id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Game not found")
    return await _enrich_game(g)

@api.post("/games")
async def create_game(body: GameCreate, user=Depends(current_user)):
    game = {
        "id": gen_id(),
        "sport": body.sport,
        "facility_id": body.facility_id,
        "host_id": user["id"],
        "date": body.date,
        "duration_min": body.duration_min,
        "skill_level": body.skill_level,
        "format": body.format,
        "max_players": body.max_players,
        "current_players": [user["id"]],
        "price_per_person": body.price_per_person,
        "notes": body.notes or "",
        "created_at": utcnow().isoformat(),
    }
    await db.games.insert_one(game.copy())
    return await _enrich_game(strip_id(game))

@api.post("/games/{gid}/join")
async def join_game(gid: str, user=Depends(current_user)):
    g = await db.games.find_one({"id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Game not found")
    if user["id"] in g.get("current_players", []):
        return await _enrich_game(g)
    if len(g["current_players"]) >= g["max_players"]:
        raise HTTPException(400, "Game is full")
    await db.games.update_one({"id": gid}, {"$push": {"current_players": user["id"]}})
    g = await db.games.find_one({"id": gid}, {"_id": 0})
    return await _enrich_game(g)

# ---------------------------------------------------------------------------
# Players & matching
# ---------------------------------------------------------------------------

_SKILL_ORDER = {"Beginner": 1, "Intermediate": 2, "Advanced": 3, "Pro": 4}

def _match_score(player: dict, user: dict) -> int:
    """Rule-based Player Match Engine (deterministic, upgradeable to ML)."""
    score = 60
    # Skill closeness
    ps, us = _SKILL_ORDER.get(player.get("skill_level", "Beginner"), 1), _SKILL_ORDER.get(user.get("skill_level") or "Beginner", 1)
    gap = abs(ps - us)
    score += {0: 25, 1: 15, 2: 5, 3: -10}.get(gap, -10)
    # Same city
    if player.get("city") and user.get("city") and player["city"] == user["city"]:
        score += 8
    # Same area
    if player.get("area") and user.get("area") and player["area"] == user["area"]:
        score += 5
    # Sport match
    if player.get("primary_sport") == user.get("primary_sport"):
        score += 5
    return max(20, min(99, score))

@api.get("/players")
async def list_players(user=Depends(current_user)):
    players = await db.players.find({}, {"_id": 0}).to_list(200)
    for p in players:
        p["match_score"] = _match_score(p, user)
    players.sort(key=lambda x: -x["match_score"])
    return players

@api.get("/players/{pid}")
async def get_player(pid: str, user=Depends(optional_user)):
    p = await db.players.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Player not found")
    if user:
        p["match_score"] = _match_score(p, user)
    return p

# ---------------------------------------------------------------------------
# Coaches / Events / Tournaments
# ---------------------------------------------------------------------------

@api.get("/coaches")
async def list_coaches(city: Optional[str] = None):
    q = {"city": city} if city else {}
    return await db.coaches.find(q, {"_id": 0}).to_list(100)

@api.get("/coaches/{cid}")
async def get_coach(cid: str):
    c = await db.coaches.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Coach not found")
    return c

@api.get("/events")
async def list_events(city: Optional[str] = None):
    q = {"city": city} if city else {}
    return await db.events.find(q, {"_id": 0}).sort("date", 1).to_list(100)

@api.get("/events/{eid}")
async def get_event(eid: str):
    e = await db.events.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Event not found")
    return e

@api.get("/tournaments")
async def list_tournaments(city: Optional[str] = None):
    q = {"city": city} if city else {}
    return await db.tournaments.find(q, {"_id": 0}).sort("date", 1).to_list(100)

@api.get("/tournaments/{tid}")
async def get_tournament(tid: str):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Tournament not found")
    return t

@api.post("/tournaments/{tid}/register")
async def register_tournament(tid: str, user=Depends(current_user)):
    t = await db.tournaments.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Tournament not found")
    reg = {
        "id": gen_id(),
        "user_id": user["id"],
        "tournament_id": tid,
        "payment": {"provider": "mock_payu", "status": "paid", "amount": t["entry_fee"]},
        "created_at": utcnow().isoformat(),
    }
    await db.tournament_registrations.insert_one(reg.copy())
    await db.tournaments.update_one({"id": tid}, {"$inc": {"participants_count": 1}})
    return strip_id(reg)

# ---------------------------------------------------------------------------
# Community
# ---------------------------------------------------------------------------

async def _enrich_post(p: dict, user_id: Optional[str]) -> dict:
    author = await db.players.find_one({"id": p["author_id"]}, {"_id": 0})
    if not author:
        author = await db.users.find_one({"id": p["author_id"]}, {"_id": 0})
    p["author"] = author
    if user_id:
        p["liked"] = await db.post_likes.find_one({"post_id": p["id"], "user_id": user_id}) is not None
    else:
        p["liked"] = False
    return p

@api.get("/posts")
async def list_posts(user=Depends(optional_user)):
    items = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [await _enrich_post(p, user["id"] if user else None) for p in items]

@api.post("/posts")
async def create_post(body: PostCreate, user=Depends(current_user)):
    post = {
        "id": gen_id(),
        "author_id": user["id"],
        "content": body.content,
        "image": body.image,
        "likes": 0,
        "comments_count": 0,
        "created_at": utcnow().isoformat(),
    }
    await db.posts.insert_one(post.copy())
    return await _enrich_post(strip_id(post), user["id"])

@api.post("/posts/{pid}/like")
async def toggle_like(pid: str, user=Depends(current_user)):
    existing = await db.post_likes.find_one({"post_id": pid, "user_id": user["id"]})
    if existing:
        await db.post_likes.delete_one({"post_id": pid, "user_id": user["id"]})
        await db.posts.update_one({"id": pid}, {"$inc": {"likes": -1}})
        return {"liked": False}
    else:
        await db.post_likes.insert_one({"post_id": pid, "user_id": user["id"], "created_at": utcnow().isoformat()})
        await db.posts.update_one({"id": pid}, {"$inc": {"likes": 1}})
        return {"liked": True}

# ---------------------------------------------------------------------------
# Marketplace
# ---------------------------------------------------------------------------

@api.get("/products")
async def list_products(category: Optional[str] = None, sport: Optional[str] = None):
    q: Dict[str, Any] = {}
    if category:
        q["category"] = category
    if sport:
        q["sport"] = sport
    return await db.products.find(q, {"_id": 0}).to_list(200)

@api.get("/products/{pid}")
async def get_product(pid: str):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    return p

@api.get("/products/recommend/for-me")
async def recommend_products(user=Depends(current_user)):
    """Rule-based equipment intelligence — swap for ML later."""
    products = await db.products.find({}, {"_id": 0}).to_list(200)
    skill = user.get("skill_level", "Beginner")
    # Score
    for p in products:
        s = 50
        if skill in (p.get("recommended_skill") or ""):
            s += 20
        if p["category"] == "Paddles":
            s += 15
        s += int(p.get("rating", 0) * 5)
        p["reco_score"] = s
    products.sort(key=lambda x: -x["reco_score"])
    return products[:6]

# Cart
@api.get("/cart")
async def get_cart(user=Depends(current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": []}
    items = []
    total = 0
    for it in cart.get("items", []):
        prod = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if prod:
            items.append({"product": prod, "qty": it["qty"], "subtotal": prod["price"] * it["qty"]})
            total += prod["price"] * it["qty"]
    return {"items": items, "total": total, "count": sum(i["qty"] for i in cart.get("items", []))}

@api.post("/cart/add")
async def cart_add(body: CartAdd, user=Depends(current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart:
        cart = {"user_id": user["id"], "items": [{"product_id": body.product_id, "qty": body.qty}]}
        await db.carts.insert_one(cart.copy())
    else:
        items = cart["items"]
        found = False
        for it in items:
            if it["product_id"] == body.product_id:
                it["qty"] += body.qty
                found = True
                break
        if not found:
            items.append({"product_id": body.product_id, "qty": body.qty})
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    return await get_cart(user)

@api.post("/cart/remove")
async def cart_remove(body: CartAdd, user=Depends(current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if cart:
        items = [it for it in cart["items"] if it["product_id"] != body.product_id]
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": items}})
    return await get_cart(user)

@api.post("/orders")
async def create_order(body: OrderCreate, user=Depends(current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(400, "Cart is empty")
    line_items = []
    total = 0
    for it in cart["items"]:
        prod = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if prod:
            line_items.append({"product": prod, "qty": it["qty"], "subtotal": prod["price"] * it["qty"]})
            total += prod["price"] * it["qty"]
    order = {
        "id": gen_id(),
        "user_id": user["id"],
        "items": line_items,
        "total": total,
        "address": body.address,
        "status": "confirmed",
        "payment": {"provider": "mock_payu", "status": "paid", "amount": total},
        "created_at": utcnow().isoformat(),
    }
    await db.orders.insert_one(order.copy())
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    return strip_id(order)

@api.get("/orders/mine")
async def my_orders(user=Depends(current_user)):
    return await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)

# ---------------------------------------------------------------------------
# AI Coach — Claude Sonnet 4.6
# ---------------------------------------------------------------------------

AI_COACH_SYSTEM = """You are Kuvira AI Coach — a world-class pickleball & racket-sports coach.

You know the player's profile: sport, skill level, city, playing style, goals.
Be concise (2-4 short paragraphs max), specific, and actionable.
Structure advice as: (1) quick insight, (2) 2-3 concrete drills or steps, (3) motivating close.
When suggesting equipment, always tie it to the player's playing style and skill.
When suggesting a training plan, keep it realistic (2-4 weeks, 3-4 sessions per week).
NEVER claim to have analyzed video or camera data unless the user explicitly provides that data.
Speak like a confident, warm coach — never robotic. Use short sentences."""

def _build_user_context(user: dict) -> str:
    parts = [f"Player name: {user.get('name') or 'Athlete'}"]
    if user.get("primary_sport"):
        parts.append(f"Primary sport: {user['primary_sport'].replace('sport-', '')}")
    if user.get("skill_level"):
        parts.append(f"Skill level: {user['skill_level']}")
    if user.get("city"):
        parts.append(f"City: {user['city']}")
    if user.get("goals"):
        parts.append(f"Goals: {', '.join(user['goals'])}")
    if user.get("playing_frequency"):
        parts.append(f"Frequency: {user['playing_frequency']}")
    return "\n".join(parts)

@api.post("/ai/coach/chat")
async def ai_coach_chat(body: ChatMessage, user=Depends(current_user)):
    """Non-streaming chat for MVP simplicity."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    session_id = body.session_id or f"coach-{user['id']}"
    # Load history
    history = await db.ai_chat.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(50)
    system = AI_COACH_SYSTEM + "\n\nPlayer profile:\n" + _build_user_context(user)
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-6")
    # Replay history for context (library manages internal state per instance)
    try:
        for h in history:
            if h["role"] == "user":
                # We only need to send the newest — the library retains its own history per instance.
                pass
        # Simpler: prepend brief history as context in the new message if long history exists
        prefix = ""
        if history:
            recent = history[-6:]
            prefix = "Recent conversation:\n" + "\n".join(
                f"{h['role'].capitalize()}: {h['text']}" for h in recent
            ) + "\n\nNow the player says:\n"
        response = await chat.send_message(UserMessage(text=prefix + body.text))
    except Exception as e:
        log.exception("AI coach error")
        raise HTTPException(500, f"AI Coach unavailable: {str(e)[:100]}")

    now = utcnow().isoformat()
    await db.ai_chat.insert_one({"session_id": session_id, "user_id": user["id"], "role": "user", "text": body.text, "created_at": now})
    await db.ai_chat.insert_one({"session_id": session_id, "user_id": user["id"], "role": "assistant", "text": response, "created_at": utcnow().isoformat()})
    return {"session_id": session_id, "reply": response}

@api.get("/ai/coach/history")
async def ai_coach_history(session_id: Optional[str] = None, user=Depends(current_user)):
    sid = session_id or f"coach-{user['id']}"
    msgs = await db.ai_chat.find({"session_id": sid}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"session_id": sid, "messages": msgs}

@api.get("/ai/insights")
async def ai_insights(user=Depends(current_user)):
    """Rule-based performance insights (upgradeable to real analytics)."""
    matches = user.get("matches_played", 0) or 12
    win_rate = 62
    return {
        "performance_score": 74,
        "trend": "+6%",
        "strongest": "Net play & third-shot drops",
        "needs_improvement": "Backhand consistency & endurance",
        "recommendation": "Complete a 20-minute backhand drill 3x this week and add 2 conditioning sessions.",
        "stats": {
            "matches_played": matches,
            "win_rate": win_rate,
            "avg_rally_length": 4.8,
            "training_streak_days": 6,
        },
        "chart": [58, 62, 60, 65, 68, 70, 74],
    }

@api.get("/ai/recommendations")
async def ai_recommendations(user=Depends(current_user)):
    """Combined home recommendations."""
    products = await db.products.find({}, {"_id": 0}).to_list(6)
    games = await db.games.find({}, {"_id": 0}).to_list(4)
    return {
        "insight": "Your playing frequency is up 20% this month. Focus on backhand this week.",
        "products": products[:3],
        "games": [await _enrich_game(g) for g in games[:3]],
    }

# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@api.get("/search")
async def search(q: str):
    q_lower = q.lower()
    facilities = [f for f in await db.facilities.find({}, {"_id": 0}).to_list(200)
                  if q_lower in f["name"].lower() or q_lower in f["area"].lower()]
    players = [p for p in await db.players.find({}, {"_id": 0}).to_list(200)
               if q_lower in p["name"].lower()]
    products = [p for p in await db.products.find({}, {"_id": 0}).to_list(200)
                if q_lower in p["name"].lower() or q_lower in p["category"].lower()]
    events = [e for e in await db.events.find({}, {"_id": 0}).to_list(100)
              if q_lower in e["name"].lower()]
    return {
        "facilities": facilities[:8],
        "players": players[:8],
        "products": products[:8],
        "events": events[:8],
    }

# ---------------------------------------------------------------------------
# Wire router & CORS
# ---------------------------------------------------------------------------

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
