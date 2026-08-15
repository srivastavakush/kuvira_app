"""Kuvira feature routers: Coach Booking, Training Plans, Rankings & Badges, Referrals.

All authorization is enforced on the backend. Prices/availability/rewards are
validated server-side; the client is never trusted for money or state.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from pymongo.errors import DuplicateKeyError

from deps import db, gen_id, utcnow, strip_id, current_user, KuviraError, log

router = APIRouter(prefix="/api")

# ===========================================================================
# COACH BOOKING
# ===========================================================================

class CoachBookingCreate(BaseModel):
    coach_id: str
    date: str          # YYYY-MM-DD
    slot: str          # "18:00-19:00"


def _coach_slots():
    return [f"{h:02d}:00-{h+1:02d}:00" for h in range(7, 21)]


@router.get("/coaches/{coach_id}/availability")
async def coach_availability(coach_id: str, date: str):
    coach = await db.coaches.find_one({"id": coach_id}, {"_id": 0})
    if not coach:
        raise KuviraError(404, "COACH_NOT_FOUND", "Coach not found")
    booked = await db.coach_sessions.find(
        {"coach_id": coach_id, "date": date, "status": {"$ne": "cancelled"}}, {"_id": 0}
    ).to_list(100)
    taken = {b["slot"] for b in booked}
    slots = [{"slot": s, "available": s not in taken, "price": coach["price_per_session"]} for s in _coach_slots()]
    return {"coach_id": coach_id, "date": date, "price_per_session": coach["price_per_session"], "slots": slots}


@router.post("/coach-sessions")
async def book_coach_session(body: CoachBookingCreate, user=Depends(current_user)):
    coach = await db.coaches.find_one({"id": body.coach_id}, {"_id": 0})
    if not coach:
        raise KuviraError(404, "COACH_NOT_FOUND", "Coach not found")
    if body.slot not in _coach_slots():
        raise KuviraError(400, "INVALID_SLOT", "Invalid time slot")
    session = {
        "id": gen_id(),
        "user_id": user["id"],
        "coach_id": body.coach_id,
        "coach_name": coach["name"],
        "coach_avatar": coach.get("avatar"),
        "date": body.date,
        "slot": body.slot,
        "price": coach["price_per_session"],   # server-side price, never from client
        "status": "confirmed",
        "payment": {"provider": "mock_payu", "status": "paid", "amount": coach["price_per_session"]},
        "created_at": utcnow().isoformat(),
    }
    try:
        await db.coach_sessions.insert_one(session.copy())
    except DuplicateKeyError:
        raise KuviraError(409, "SLOT_UNAVAILABLE", "This slot was just booked. Please pick another.")
    return strip_id(session)


@router.get("/coach-sessions/mine")
async def my_coach_sessions(user=Depends(current_user)):
    return await db.coach_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", 1).to_list(100)


# ===========================================================================
# TRAINING PLANS (AI-assisted, persisted; tick drills + streak)
# ===========================================================================

class PlanCreate(BaseModel):
    goal: str
    weeks: int = 4


_GOAL_DRILLS = {
    "backhand": ["Wall backhand reps (10 min)", "Cross-court backhand rally", "Backhand dink control", "Shadow swings x50"],
    "serve": ["Target serve practice (20 serves)", "Deep serve drill", "Spin serve reps", "Serve + third shot combo"],
    "endurance": ["20-min conditioning circuit", "Court sprints x10", "Skipping 5 min", "Long rally endurance sets"],
    "net": ["Dink rally 5 min", "Volley reflex drill", "Poach positioning", "Reset from mid-court"],
    "default": ["Warm-up footwork ladder", "Third-shot drop x30", "Dink consistency rally", "Match-play simulation"],
}


def _drills_for(goal: str):
    g = goal.lower()
    for key, drills in _GOAL_DRILLS.items():
        if key in g:
            return drills
    return _GOAL_DRILLS["default"]


@router.post("/training/plans")
async def create_plan(body: PlanCreate, user=Depends(current_user)):
    drills_base = _drills_for(body.goal)
    weeks = max(1, min(8, body.weeks))
    plan = {
        "id": gen_id(),
        "user_id": user["id"],
        "goal": body.goal,
        "title": f"{body.weeks}-Week Plan: {body.goal.title()}",
        "skill_level": user.get("skill_level", "Intermediate"),
        "weeks": [],
        "created_at": utcnow().isoformat(),
        "active": True,
    }
    for w in range(1, weeks + 1):
        drills = [
            {"id": gen_id(), "text": d, "done": False, "week": w}
            for d in drills_base
        ]
        plan["weeks"].append({"week": w, "focus": f"Week {w} · {body.goal.title()}", "drills": drills})
    await db.training_plans.insert_one(plan.copy())
    return strip_id(plan)


@router.get("/training/plans")
async def list_plans(user=Depends(current_user)):
    return await db.training_plans.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.post("/training/plans/{plan_id}/drills/{drill_id}/toggle")
async def toggle_drill(plan_id: str, drill_id: str, user=Depends(current_user)):
    plan = await db.training_plans.find_one({"id": plan_id, "user_id": user["id"]}, {"_id": 0})
    if not plan:
        raise KuviraError(404, "PLAN_NOT_FOUND", "Training plan not found")
    changed = False
    now_done = False
    for wk in plan["weeks"]:
        for d in wk["drills"]:
            if d["id"] == drill_id:
                d["done"] = not d["done"]
                now_done = d["done"]
                changed = True
    if not changed:
        raise KuviraError(404, "DRILL_NOT_FOUND", "Drill not found")
    await db.training_plans.update_one({"id": plan_id}, {"$set": {"weeks": plan["weeks"]}})
    if now_done:
        await _log_training_activity(user["id"])
    return strip_id(plan)


async def _log_training_activity(user_id: str):
    today = utcnow().date().isoformat()
    await db.training_activity.update_one(
        {"user_id": user_id, "day": today},
        {"$setOnInsert": {"user_id": user_id, "day": today, "created_at": utcnow().isoformat()}},
        upsert=True,
    )


@router.get("/training/streak")
async def training_streak(user=Depends(current_user)):
    days = await db.training_activity.find({"user_id": user["id"]}, {"_id": 0, "day": 1}).to_list(400)
    day_set = {d["day"] for d in days}
    streak = 0
    cursor = utcnow().date()
    # allow today or yesterday to start the streak
    from datetime import date as _date
    if cursor.isoformat() not in day_set and (cursor - timedelta(days=1)).isoformat() in day_set:
        cursor = cursor - timedelta(days=1)
    while cursor.isoformat() in day_set:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return {"streak_days": streak, "total_active_days": len(day_set)}


# ===========================================================================
# RANKINGS & LEADERBOARDS
# ===========================================================================

async def _user_points(user_id: str) -> int:
    games = await db.games.count_documents({"current_players": user_id})
    bookings = await db.bookings.count_documents({"user_id": user_id})
    sessions = await db.coach_sessions.count_documents({"user_id": user_id})
    active = await db.training_activity.count_documents({"user_id": user_id})
    return games * 30 + bookings * 10 + sessions * 15 + active * 8


@router.get("/rankings")
async def rankings(scope: str = "city", user=Depends(current_user)):
    players = await db.players.find({}, {"_id": 0}).to_list(200)
    board = []
    for p in players:
        if scope == "city" and user.get("city") and p.get("city") != user.get("city"):
            continue
        pts = p["wins"] * 10 + p["matches_played"] * 2
        board.append({
            "id": p["id"], "name": p["name"], "avatar": p["avatar"], "city": p["city"],
            "skill_level": p["skill_level"], "points": pts,
            "matches_played": p["matches_played"], "wins": p["wins"], "is_me": False,
        })
    # inject current user
    me_points = await _user_points(user["id"])
    board.append({
        "id": user["id"], "name": (user.get("name") or "You") + " (You)", "avatar": user.get("avatar"),
        "city": user.get("city"), "skill_level": user.get("skill_level", "Beginner"),
        "points": me_points, "matches_played": 0, "wins": 0, "is_me": True,
    })
    board.sort(key=lambda x: -x["points"])
    for i, row in enumerate(board):
        row["rank"] = i + 1
    return {"scope": scope, "leaderboard": board}


# ===========================================================================
# ACHIEVEMENTS / BADGES
# ===========================================================================
ACHIEVEMENTS = [
    {"id": "first_booking", "title": "First Court", "desc": "Book your first court", "icon": "calendar"},
    {"id": "first_game", "title": "Game On", "desc": "Join your first open game", "icon": "tennisball"},
    {"id": "social_butterfly", "title": "Community Builder", "desc": "Post in the community", "icon": "people"},
    {"id": "gear_up", "title": "Geared Up", "desc": "Place your first order", "icon": "bag"},
    {"id": "coached", "title": "Student of the Game", "desc": "Book a coaching session", "icon": "school"},
    {"id": "streak_3", "title": "On a Streak", "desc": "3-day training streak", "icon": "flame"},
    {"id": "early_adopter", "title": "Early Adopter", "desc": "Join Kuvira", "icon": "star"},
]


@router.get("/achievements")
async def achievements(user=Depends(current_user)):
    uid = user["id"]
    bookings = await db.bookings.count_documents({"user_id": uid})
    games = await db.games.count_documents({"current_players": uid})
    posts = await db.posts.count_documents({"author_id": uid})
    orders = await db.orders.count_documents({"user_id": uid})
    sessions = await db.coach_sessions.count_documents({"user_id": uid})
    streak = (await training_streak(user))["streak_days"]
    earned_map = {
        "first_booking": bookings > 0,
        "first_game": games > 0,
        "social_butterfly": posts > 0,
        "gear_up": orders > 0,
        "coached": sessions > 0,
        "streak_3": streak >= 3,
        "early_adopter": True,
    }
    result = []
    for a in ACHIEVEMENTS:
        result.append({**a, "earned": earned_map.get(a["id"], False)})
    return {"earned_count": sum(1 for r in result if r["earned"]), "total": len(result), "achievements": result}


# ===========================================================================
# REFERRALS ("Refer & Earn")
# ===========================================================================
REFERRAL_REWARD = 200  # credits to each side after referred user's first game


class ApplyReferral(BaseModel):
    code: str


def _referral_code(user: dict) -> str:
    base = (user.get("name") or "PLAYER").split(" ")[0].upper()[:6]
    return f"{base}{user['id'][:4].upper()}"


@router.get("/referrals/me")
async def my_referral(user=Depends(current_user)):
    code = user.get("referral_code")
    if not code:
        code = _referral_code(user)
        await db.users.update_one({"id": user["id"]}, {"$set": {"referral_code": code}})
    referred = await db.users.count_documents({"referred_by": user["id"]})
    rewarded = await db.referral_rewards.count_documents({"referrer_id": user["id"]})
    return {
        "code": code,
        "share_message": f"Join me on Kuvira Sports! Use my code {code} and we both earn ₹{REFERRAL_REWARD} in credits.",
        "referrals": referred,
        "rewards_earned": rewarded * REFERRAL_REWARD,
        "credits": user.get("credits", 0),
        "reward_per_referral": REFERRAL_REWARD,
    }


@router.post("/referrals/apply")
async def apply_referral(body: ApplyReferral, user=Depends(current_user)):
    if user.get("referred_by"):
        raise KuviraError(400, "REFERRAL_ALREADY_APPLIED", "You already used a referral code")
    referrer = await db.users.find_one({"referral_code": body.code}, {"_id": 0})
    if not referrer:
        raise KuviraError(404, "REFERRAL_CODE_INVALID", "Invalid referral code")
    if referrer["id"] == user["id"]:
        raise KuviraError(400, "REFERRAL_SELF", "You can't refer yourself")
    await db.users.update_one({"id": user["id"]}, {"$set": {"referred_by": referrer["id"]}})
    return {"applied": True, "message": f"Code applied! Play your first game to unlock ₹{REFERRAL_REWARD} for both of you."}


async def award_first_game_referral(user_id: str):
    """Called after a user joins their first game. Credits both sides once."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("referred_by"):
        return
    already = await db.referral_rewards.find_one({"referred_user_id": user_id})
    if already:
        return
    games = await db.games.count_documents({"current_players": user_id})
    if games < 1:
        return
    referrer_id = user["referred_by"]
    await db.referral_rewards.insert_one({
        "id": gen_id(), "referrer_id": referrer_id, "referred_user_id": user_id,
        "amount": REFERRAL_REWARD, "created_at": utcnow().isoformat(),
    })
    await db.users.update_one({"id": referrer_id}, {"$inc": {"credits": REFERRAL_REWARD}})
    await db.users.update_one({"id": user_id}, {"$inc": {"credits": REFERRAL_REWARD}})
    log.info("Referral reward granted referrer=%s referred=%s", referrer_id, user_id)
