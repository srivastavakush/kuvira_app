"""Organization (Club) workspace + Platform Admin provisioning.

- ONE login flow; no role selection. Backend determines capabilities.
- Customers CANNOT self-promote. Only PLATFORM_ADMIN creates clubs & assigns owners.
- Club resources are strictly org-scoped and permission-checked on the backend.

Role hierarchy (highest → lowest):
  CLUB_OWNER   — full control including ownership transfer
  CLUB_ADMIN   — full ops control, cannot transfer ownership
  CLUB_MANAGER — day-to-day ops + slot/availability management
  CLUB_STAFF   — view bookings + confirm bookings only

Court/Slot/Booking access matrix:
  Action                   | Owner | Admin | Manager | Staff
  Add/edit/delete courts   |  ✅   |  ✅   |   ❌    |   ❌
  Add/edit/block slots     |  ✅   |  ✅   |   ✅    |   ❌
  View bookings            |  ✅   |  ✅   |   ✅    |   ✅
  Confirm booking          |  ✅   |  ✅   |   ✅    |   ✅
  Cancel booking           |  ✅   |  ✅   |   ✅    |   ❌
  Manage pricing           |  ✅   |  ✅   |   ❌    |   ❌
  Manage staff             |  ✅   |  ✅   |   ❌    |   ❌
  Transfer ownership       |  ✅   |  ❌   |   ❌    |   ❌
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from deps import (
    db, gen_id, utcnow, strip_id, current_user, KuviraError,
    require_platform_admin, require_org_permission,
    ROLE_CLUB_OWNER, ROLE_CLUB_ADMIN, ROLE_CLUB_MANAGER, ROLE_CLUB_STAFF, log,
)

router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Allowed org-level assignable roles (Platform Admin assigns Owner separately)
# ---------------------------------------------------------------------------
ASSIGNABLE_ROLES = (ROLE_CLUB_ADMIN, ROLE_CLUB_MANAGER, ROLE_CLUB_STAFF)

# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class ClubCreate(BaseModel):
    name: str
    city: str
    logo: Optional[str] = None
    description: Optional[str] = None
    facility_ids: List[str] = []

class AssignOwner(BaseModel):
    mobile: str
    name: Optional[str] = None

class AddStaff(BaseModel):
    mobile: str
    role: str   # CLUB_ADMIN | CLUB_MANAGER | CLUB_STAFF

class MemberRoleUpdate(BaseModel):
    role: str

class OwnershipTransfer(BaseModel):
    mobile: str
    name: Optional[str] = None

class ClubUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None
    cover_image: Optional[str] = None
    images: Optional[List[str]] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

class ClubStatusUpdate(BaseModel):
    status: str  # active | inactive

class ClubLocationUpdate(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None

class EventCreate(BaseModel):
    name: str
    date: str
    end_date: Optional[str] = None
    description: Optional[str] = ""
    image: Optional[str] = None
    type: str = "Event"  # Event | Clinic | Tournament | Social Mixer
    sport: str = "sport-pickleball"
    price: int = 0
    max_participants: int = 50
    facility_id: Optional[str] = None
    status: str = "draft"  # draft | published | cancelled

class EventUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    type: Optional[str] = None
    sport: Optional[str] = None
    price: Optional[int] = None
    max_participants: Optional[int] = None
    status: Optional[str] = None  # draft | published | cancelled
    facility_id: Optional[str] = None

class TournamentCreate(BaseModel):
    name: str
    date: str
    end_date: Optional[str] = None
    description: Optional[str] = ""
    image: Optional[str] = None
    format: str = "Doubles"
    sport: str = "sport-pickleball"
    skill_level: str = "All levels"
    entry_fee: int = 0
    prize_pool: int = 0
    max_participants: int = 64
    facility_id: Optional[str] = None
    status: str = "draft"  # draft | published | cancelled

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    end_date: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    format: Optional[str] = None
    sport: Optional[str] = None
    skill_level: Optional[str] = None
    entry_fee: Optional[int] = None
    prize_pool: Optional[int] = None
    max_participants: Optional[int] = None
    status: Optional[str] = None
    facility_id: Optional[str] = None

class FacilityCreate(BaseModel):
    name: str
    city: str
    area: str
    description: Optional[str] = ""
    image: Optional[str] = None
    images: List[str] = []
    sports: List[str] = ["sport-pickleball"]
    courts_count: int = 1
    price_per_hour: int = 500
    rating: float = 5.0
    reviews_count: int = 0
    amenities: List[str] = []
    is_experience_center: bool = False
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class FacilityUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    area: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    sports: Optional[List[str]] = None
    courts_count: Optional[int] = None
    price_per_hour: Optional[int] = None
    rating: Optional[float] = None
    reviews_count: Optional[int] = None
    amenities: Optional[List[str]] = None
    is_experience_center: Optional[bool] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class PricingUpdate(BaseModel):
    price_per_hour: int

class SlotCreate(BaseModel):
    court_number: int
    date: str            # YYYY-MM-DD or "*" for recurring
    slots: List[str]     # ["09:00-10:00", "10:00-11:00", ...]
    status: str = "open" # open | blocked

class SlotUpdate(BaseModel):
    status: str          # open | blocked

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    image: Optional[str] = None
    images: List[str] = []
    category: str
    sport: Optional[str] = None
    price: int
    original_price: Optional[int] = None
    stock: int = 0
    recommended_skill: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    images: Optional[List[str]] = None
    category: Optional[str] = None
    sport: Optional[str] = None
    price: Optional[int] = None
    original_price: Optional[int] = None
    stock: Optional[int] = None
    recommended_skill: Optional[str] = None
    status: Optional[str] = None

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _write_audit_log(
    org_id: str,
    action: str,
    actor_id: str,
    details: Optional[Dict[str, Any]] = None,
    target_id: Optional[str] = None,
    target_type: Optional[str] = None,
):
    """Write an immutable audit log entry for an important club action."""
    try:
        await db.audit_logs.insert_one({
            "id": gen_id(),
            "org_id": org_id,
            "action": action,
            "actor_id": actor_id,
            "target_id": target_id,
            "target_type": target_type,
            "details": details or {},
            "created_at": utcnow().isoformat(),
        })
    except Exception as e:
        log.warning("Audit log write failed: %s", e)

def _norm_mobile(mobile: str) -> str:
    raw = (mobile or "").strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if raw.startswith("+"):
        return "+" + digits
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    return "+" + digits if digits else raw


async def _get_or_invite_user(mobile: str, name: Optional[str]) -> dict:
    mobile = _norm_mobile(mobile)
    user = await db.users.find_one({"mobile": mobile}, {"_id": 0})
    if user:
        return user
    user = {
        "id": gen_id(), "mobile": mobile, "name": name, "avatar": None,
        "onboarded": False, "invited": True, "created_at": utcnow().isoformat(),
    }
    await db.users.insert_one(user.copy())
    return strip_id(user)


async def _org_facility_ids(org_id: str) -> List[str]:
    facs = await db.facilities.find(
        {"org_id": org_id, "status": {"$ne": "inactive"}}, {"_id": 0, "id": 1}
    ).to_list(200)
    return [f["id"] for f in facs]


# ---------------------------------------------------------------------------
# Platform Admin — club provisioning
# ---------------------------------------------------------------------------

@router.get("/admin/clubs")
async def admin_list_clubs(admin=Depends(require_platform_admin())):
    return await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/clubs")
async def admin_create_club(body: ClubCreate, admin=Depends(require_platform_admin())):
    org = {
        "id": gen_id(), "name": body.name, "city": body.city, "logo": body.logo,
        "description": body.description or "", "status": "active",
        "created_by": admin["id"], "created_at": utcnow().isoformat(),
    }
    await db.organizations.insert_one(org.copy())
    if body.facility_ids:
        await db.facilities.update_many(
            {"id": {"$in": body.facility_ids}}, {"$set": {"org_id": org["id"]}}
        )
    return strip_id(org)


@router.post("/admin/clubs/{org_id}/owner")
async def admin_assign_owner(org_id: str, body: AssignOwner, admin=Depends(require_platform_admin())):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    owner = await _get_or_invite_user(body.mobile, body.name)
    existing = await db.organization_memberships.find_one({"user_id": owner["id"], "org_id": org_id})
    if existing:
        await db.organization_memberships.update_one(
            {"user_id": owner["id"], "org_id": org_id},
            {"$set": {"role": ROLE_CLUB_OWNER, "status": "active", "updated_at": utcnow().isoformat()}},
        )
    else:
        await db.organization_memberships.insert_one({
            "id": gen_id(), "user_id": owner["id"], "org_id": org_id,
            "role": ROLE_CLUB_OWNER, "status": "active",
            "created_by": admin["id"], "created_at": utcnow().isoformat(),
        })
    log.info("Assigned CLUB_OWNER user=%s org=%s", owner["id"], org_id)
    return {"assigned": True, "org_id": org_id, "owner_user_id": owner["id"], "invited": owner.get("invited", False)}


@router.post("/admin/users/{user_id}/platform-admin")
async def admin_grant_platform_admin(user_id: str, admin=Depends(require_platform_admin())):
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise KuviraError(404, "USER_NOT_FOUND", "User not found")
    await db.users.update_one({"id": user_id}, {"$set": {"is_platform_admin": True}})
    return {"granted": True}


@router.get("/admin/clubs/{org_id}/facilities")
async def admin_org_facilities(org_id: str, admin=Depends(require_platform_admin())):
    return await db.facilities.find({"org_id": org_id}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/clubs/{org_id}/facilities")
async def admin_create_facility(org_id: str, body: FacilityCreate, admin=Depends(require_platform_admin())):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    if body.courts_count < 1:
        raise KuviraError(400, "INVALID_COURTS_COUNT", "courts_count must be at least 1")
    facility = {
        "id": gen_id(), "org_id": org_id, "name": body.name, "city": body.city,
        "area": body.area, "description": body.description or "", "image": body.image or "",
        "sports": body.sports, "courts_count": body.courts_count,
        "price_per_hour": body.price_per_hour, "rating": body.rating,
        "reviews_count": body.reviews_count, "amenities": body.amenities,
        "is_experience_center": body.is_experience_center, "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(), "status": "active",
    }
    await db.facilities.insert_one(facility.copy())
    return strip_id(facility)


@router.patch("/admin/clubs/{org_id}/facilities/{facility_id}")
async def admin_update_facility(org_id: str, facility_id: str, body: FacilityUpdate, admin=Depends(require_platform_admin())):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "courts_count" in updates and updates["courts_count"] < 1:
        raise KuviraError(400, "INVALID_COURTS_COUNT", "courts_count must be at least 1")
    updates["updated_at"] = utcnow().isoformat()
    result = await db.facilities.update_one({"id": facility_id, "org_id": org_id}, {"$set": updates})
    if result.matched_count == 0:
        raise KuviraError(404, "FACILITY_NOT_FOUND", "Facility not found")
    return await db.facilities.find_one({"id": facility_id}, {"_id": 0})


@router.delete("/admin/clubs/{org_id}/facilities/{facility_id}")
async def admin_delete_facility(org_id: str, facility_id: str, admin=Depends(require_platform_admin())):
    result = await db.facilities.update_one(
        {"id": facility_id, "org_id": org_id},
        {"$set": {"status": "inactive", "updated_at": utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise KuviraError(404, "FACILITY_NOT_FOUND", "Facility not found")
    return {"deleted": True}


async def _admin_catalog_list(collection: str):
    return await db[collection].find({"is_demo": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.get("/admin/events")
async def admin_list_events(admin=Depends(require_platform_admin())):
    return await _admin_catalog_list("events")


@router.post("/admin/events")
async def admin_create_event(body: EventCreate, admin=Depends(require_platform_admin())):
    event = {**body.model_dump(), "id": gen_id(), "is_demo": False, "created_by": admin["id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat()}
    await db.events.insert_one(event.copy())
    return strip_id(event)


@router.patch("/admin/events/{event_id}")
async def admin_update_event(event_id: str, body: EventUpdate, admin=Depends(require_platform_admin())):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = utcnow().isoformat()
    result = await db.events.update_one({"id": event_id, "is_demo": {"$ne": True}}, {"$set": updates})
    if result.matched_count == 0: raise KuviraError(404, "EVENT_NOT_FOUND", "Event not found")
    return await db.events.find_one({"id": event_id}, {"_id": 0})


@router.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str, admin=Depends(require_platform_admin())):
    result = await db.events.update_one({"id": event_id, "is_demo": {"$ne": True}}, {"$set": {"status": "cancelled", "updated_at": utcnow().isoformat()}})
    if result.matched_count == 0: raise KuviraError(404, "EVENT_NOT_FOUND", "Event not found")
    return {"deleted": True}


@router.get("/admin/tournaments")
async def admin_list_tournaments(admin=Depends(require_platform_admin())):
    return await _admin_catalog_list("tournaments")


@router.post("/admin/tournaments")
async def admin_create_tournament(body: TournamentCreate, admin=Depends(require_platform_admin())):
    tournament = {**body.model_dump(), "id": gen_id(), "is_demo": False, "created_by": admin["id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat(), "participants_count": 0}
    await db.tournaments.insert_one(tournament.copy())
    return strip_id(tournament)


@router.patch("/admin/tournaments/{tournament_id}")
async def admin_update_tournament(tournament_id: str, body: TournamentUpdate, admin=Depends(require_platform_admin())):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = utcnow().isoformat()
    result = await db.tournaments.update_one({"id": tournament_id, "is_demo": {"$ne": True}}, {"$set": updates})
    if result.matched_count == 0: raise KuviraError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found")
    return await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})


@router.delete("/admin/tournaments/{tournament_id}")
async def admin_delete_tournament(tournament_id: str, admin=Depends(require_platform_admin())):
    result = await db.tournaments.update_one({"id": tournament_id, "is_demo": {"$ne": True}}, {"$set": {"status": "cancelled", "updated_at": utcnow().isoformat()}})
    if result.matched_count == 0: raise KuviraError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found")
    return {"deleted": True}


@router.get("/admin/products")
async def admin_list_products(admin=Depends(require_platform_admin())):
    return await _admin_catalog_list("products")


@router.post("/admin/products")
async def admin_create_product(body: ProductCreate, admin=Depends(require_platform_admin())):
    product = {**body.model_dump(), "id": gen_id(), "is_demo": False, "status": "active", "created_by": admin["id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat()}
    await db.products.insert_one(product.copy())
    return strip_id(product)


@router.patch("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductUpdate, admin=Depends(require_platform_admin())):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = utcnow().isoformat()
    result = await db.products.update_one({"id": product_id, "is_demo": {"$ne": True}}, {"$set": updates})
    if result.matched_count == 0: raise KuviraError(404, "PRODUCT_NOT_FOUND", "Product not found")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(require_platform_admin())):
    result = await db.products.update_one({"id": product_id, "is_demo": {"$ne": True}}, {"$set": {"status": "inactive", "updated_at": utcnow().isoformat()}})
    if result.matched_count == 0: raise KuviraError(404, "PRODUCT_NOT_FOUND", "Product not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Org workspace — club profile
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}")
async def get_org(org_id: str, user=Depends(require_org_permission("club.view"))):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    return org


@router.patch("/orgs/{org_id}")
async def update_org(org_id: str, body: ClubUpdate, user=Depends(require_org_permission("club.manage"))):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.organizations.update_one({"id": org_id}, {"$set": updates})
    return await db.organizations.find_one({"id": org_id}, {"_id": 0})


# ---------------------------------------------------------------------------
# Courts — Owner + Admin only (club.courts.create / edit / delete)
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/facilities")
async def org_facilities(org_id: str, user=Depends(require_org_permission("club.view"))):
    return await db.facilities.find(
        {"org_id": org_id, "status": {"$ne": "inactive"}}, {"_id": 0}
    ).to_list(200)


@router.post("/orgs/{org_id}/facilities")
async def org_create_facility(
    org_id: str, body: FacilityCreate,
    user=Depends(require_org_permission("club.courts.create"))  # Owner + Admin only
):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    if body.courts_count < 1:
        raise KuviraError(400, "INVALID_COURTS_COUNT", "courts_count must be at least 1")
    facility = {
        "id": gen_id(), "org_id": org_id, "name": body.name, "city": body.city,
        "area": body.area, "description": body.description or "", "image": body.image or "",
        "sports": body.sports, "courts_count": body.courts_count,
        "price_per_hour": body.price_per_hour, "rating": body.rating,
        "reviews_count": body.reviews_count, "amenities": body.amenities,
        "is_experience_center": body.is_experience_center, "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(), "status": "active",
    }
    await db.facilities.insert_one(facility.copy())
    log.info("Court created facility=%s org=%s user=%s", facility["id"], org_id, user["id"])
    return strip_id(facility)


@router.patch("/orgs/{org_id}/facilities/{facility_id}")
async def org_update_facility(
    org_id: str, facility_id: str, body: FacilityUpdate,
    user=Depends(require_org_permission("club.courts.edit"))  # Owner + Admin only
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "courts_count" in updates and updates["courts_count"] < 1:
        raise KuviraError(400, "INVALID_COURTS_COUNT", "courts_count must be at least 1")
    updates["updated_at"] = utcnow().isoformat()
    result = await db.facilities.update_one({"id": facility_id, "org_id": org_id}, {"$set": updates})
    if result.matched_count == 0:
        raise KuviraError(404, "FACILITY_NOT_FOUND", "Facility not found")
    return await db.facilities.find_one({"id": facility_id}, {"_id": 0})


@router.delete("/orgs/{org_id}/facilities/{facility_id}")
async def org_delete_facility(
    org_id: str, facility_id: str,
    user=Depends(require_org_permission("club.courts.delete"))  # Owner + Admin only
):
    result = await db.facilities.update_one(
        {"id": facility_id, "org_id": org_id},
        {"$set": {"status": "inactive", "updated_at": utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise KuviraError(404, "FACILITY_NOT_FOUND", "Facility not found")
    log.info("Court deactivated facility=%s org=%s user=%s", facility_id, org_id, user["id"])
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Court Pricing — Owner + Admin only (club.pricing.manage)
# ---------------------------------------------------------------------------

@router.patch("/orgs/{org_id}/facilities/{facility_id}/pricing")
async def org_update_pricing(
    org_id: str, facility_id: str, body: PricingUpdate,
    user=Depends(require_org_permission("club.pricing.manage"))
):
    if body.price_per_hour < 1:
        raise KuviraError(400, "INVALID_PRICE", "Price must be at least ₹1")
    result = await db.facilities.update_one(
        {"id": facility_id, "org_id": org_id},
        {"$set": {"price_per_hour": body.price_per_hour, "updated_at": utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise KuviraError(404, "FACILITY_NOT_FOUND", "Facility not found")
    log.info("Pricing updated facility=%s price=%s user=%s", facility_id, body.price_per_hour, user["id"])
    return {"updated": True, "price_per_hour": body.price_per_hour}


# ---------------------------------------------------------------------------
# Slot / Availability Management — Owner + Admin + Manager (club.slots.manage)
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/facilities/{facility_id}/slots")
async def org_list_slots(
    org_id: str, facility_id: str, date: Optional[str] = None,
    user=Depends(require_org_permission("club.view"))
):
    """List all slot overrides for a facility (blocked/custom slots)."""
    q: dict = {"facility_id": facility_id, "org_id": org_id}
    if date:
        q["date"] = date
    slots = await db.facility_slots.find(q, {"_id": 0}).to_list(500)
    return {"facility_id": facility_id, "slots": slots}


@router.post("/orgs/{org_id}/facilities/{facility_id}/slots")
async def org_create_slots(
    org_id: str, facility_id: str, body: SlotCreate,
    user=Depends(require_org_permission("club.slots.manage"))  # Owner + Admin + Manager
):
    """Create or override slot availability for a court on a specific date."""
    facility = await db.facilities.find_one({"id": facility_id, "org_id": org_id}, {"_id": 0})
    if not facility:
        raise KuviraError(404, "FACILITY_NOT_FOUND", "Facility not found")
    if body.court_number < 1 or body.court_number > facility.get("courts_count", 1):
        raise KuviraError(400, "INVALID_COURT", "Invalid court number")
    if body.status not in ("open", "blocked"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be 'open' or 'blocked'")

    created = []
    for slot_time in body.slots:
        # Upsert: if slot rule exists for this court/date/slot, update it
        slot_doc = {
            "id": gen_id(),
            "org_id": org_id,
            "facility_id": facility_id,
            "court_number": body.court_number,
            "date": body.date,
            "slot": slot_time,
            "status": body.status,
            "created_by": user["id"],
            "created_at": utcnow().isoformat(),
            "updated_at": utcnow().isoformat(),
        }
        await db.facility_slots.update_one(
            {"facility_id": facility_id, "court_number": body.court_number, "date": body.date, "slot": slot_time},
            {"$set": slot_doc},
            upsert=True,
        )
        created.append(slot_time)

    log.info(
        "Slots %s: facility=%s court=%s date=%s slots=%s user=%s",
        body.status, facility_id, body.court_number, body.date, created, user["id"]
    )
    return {"updated": True, "facility_id": facility_id, "court_number": body.court_number,
            "date": body.date, "slots": created, "status": body.status}


@router.patch("/orgs/{org_id}/facilities/{facility_id}/slots/{slot_id}")
async def org_update_slot(
    org_id: str, facility_id: str, slot_id: str, body: SlotUpdate,
    user=Depends(require_org_permission("club.slots.manage"))
):
    """Block or unblock an individual slot."""
    if body.status not in ("open", "blocked"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be 'open' or 'blocked'")
    result = await db.facility_slots.update_one(
        {"id": slot_id, "facility_id": facility_id, "org_id": org_id},
        {"$set": {"status": body.status, "updated_at": utcnow().isoformat(), "updated_by": user["id"]}}
    )
    if result.matched_count == 0:
        raise KuviraError(404, "SLOT_NOT_FOUND", "Slot override not found")
    return {"updated": True, "slot_id": slot_id, "status": body.status}


@router.delete("/orgs/{org_id}/facilities/{facility_id}/slots/{slot_id}")
async def org_delete_slot(
    org_id: str, facility_id: str, slot_id: str,
    user=Depends(require_org_permission("club.slots.manage"))
):
    """Remove a slot override (reverts to default availability)."""
    result = await db.facility_slots.delete_one(
        {"id": slot_id, "facility_id": facility_id, "org_id": org_id}
    )
    if result.deleted_count == 0:
        raise KuviraError(404, "SLOT_NOT_FOUND", "Slot override not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Bookings — view/confirm/cancel
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/bookings")
async def org_bookings(org_id: str, user=Depends(require_org_permission("club.bookings.manage"))):
    fids = await _org_facility_ids(org_id)
    return await db.bookings.find(
        {"facility_id": {"$in": fids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(300)


@router.post("/orgs/{org_id}/bookings/{booking_id}/confirm")
async def org_confirm_booking(
    org_id: str, booking_id: str,
    user=Depends(require_org_permission("club.bookings.confirm"))  # Owner + Admin + Manager + Staff
):
    """Confirm a pending booking. Staff can use this for walk-in / front-desk confirmations."""
    fids = await _org_facility_ids(org_id)
    booking = await db.bookings.find_one({"id": booking_id, "facility_id": {"$in": fids}}, {"_id": 0})
    if not booking:
        raise KuviraError(404, "BOOKING_NOT_FOUND", "Booking not found in this club")
    if booking.get("status") == "cancelled":
        raise KuviraError(409, "BOOKING_CANCELLED", "Cannot confirm a cancelled booking")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "confirmed",
            "confirmed_by": user["id"],
            "confirmed_at": utcnow().isoformat(),
        }}
    )
    log.info("Booking confirmed booking=%s user=%s", booking_id, user["id"])
    return {"confirmed": True, "booking_id": booking_id}


@router.post("/orgs/{org_id}/bookings/{booking_id}/cancel")
async def org_cancel_booking(
    org_id: str, booking_id: str,
    user=Depends(require_org_permission("club.bookings.cancel"))  # Owner + Admin + Manager only
):
    """Cancel a booking. Only Owner/Admin/Manager can cancel — Staff cannot."""
    fids = await _org_facility_ids(org_id)
    booking = await db.bookings.find_one({"id": booking_id, "facility_id": {"$in": fids}}, {"_id": 0})
    if not booking:
        raise KuviraError(404, "BOOKING_NOT_FOUND", "Booking not found in this club")
    if booking.get("status") == "cancelled":
        raise KuviraError(409, "ALREADY_CANCELLED", "Booking is already cancelled")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": user["id"],
            "cancelled_at": utcnow().isoformat(),
            "cancellation_source": "club_staff",
        }}
    )
    log.info("Booking cancelled booking=%s user=%s", booking_id, user["id"])
    return {"cancelled": True, "booking_id": booking_id}


# ---------------------------------------------------------------------------
# Games & Events
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/games")
async def org_games(org_id: str, user=Depends(require_org_permission("club.games.manage"))):
    fids = await _org_facility_ids(org_id)
    return await db.games.find({"facility_id": {"$in": fids}}, {"_id": 0}).to_list(300)


# ---------------------------------------------------------------------------
# People management — members, staff, roles
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/members")
async def org_members(org_id: str, user=Depends(require_org_permission("club.members.manage"))):
    members = await db.organization_memberships.find(
        {"org_id": org_id, "status": "active"}, {"_id": 0}
    ).to_list(200)
    out = []
    for m in members:
        u = await db.users.find_one(
            {"id": m["user_id"]}, {"_id": 0, "id": 1, "name": 1, "mobile": 1, "avatar": 1}
        )
        out.append({**m, "user": u})
    return out


@router.post("/orgs/{org_id}/staff")
async def add_staff(
    org_id: str, body: AddStaff,
    user=Depends(require_org_permission("club.staff.manage"))  # Owner + Admin only
):
    """Add a staff member. Allowed roles: CLUB_ADMIN, CLUB_MANAGER, CLUB_STAFF.
    Owner role must be assigned via the ownership transfer endpoint."""
    if body.role not in ASSIGNABLE_ROLES:
        raise KuviraError(
            400, "INVALID_ROLE",
            f"Role must be one of: {', '.join(ASSIGNABLE_ROLES)}"
        )
    staff_user = await _get_or_invite_user(body.mobile, None)
    existing = await db.organization_memberships.find_one(
        {"user_id": staff_user["id"], "org_id": org_id}
    )
    if existing:
        await db.organization_memberships.update_one(
            {"user_id": staff_user["id"], "org_id": org_id},
            {"$set": {"role": body.role, "status": "active", "updated_at": utcnow().isoformat()}}
        )
    else:
        await db.organization_memberships.insert_one({
            "id": gen_id(), "user_id": staff_user["id"], "org_id": org_id,
            "role": body.role, "status": "active",
            "created_by": user["id"], "created_at": utcnow().isoformat(),
        })
    log.info("Staff added user=%s role=%s org=%s by=%s", staff_user["id"], body.role, org_id, user["id"])
    return {"added": True, "user_id": staff_user["id"], "role": body.role}


@router.patch("/orgs/{org_id}/members/{member_user_id}/role")
async def update_member_role(
    org_id: str, member_user_id: str, body: MemberRoleUpdate,
    user=Depends(require_org_permission("club.staff.manage"))
):
    if body.role not in ASSIGNABLE_ROLES:
        raise KuviraError(
            400, "INVALID_ROLE",
            f"Role must be one of: {', '.join(ASSIGNABLE_ROLES)}"
        )
    membership = await db.organization_memberships.find_one(
        {"user_id": member_user_id, "org_id": org_id, "status": "active"}, {"_id": 0}
    )
    if not membership:
        raise KuviraError(404, "MEMBER_NOT_FOUND", "Active club member not found")
    if membership.get("role") == ROLE_CLUB_OWNER:
        raise KuviraError(409, "OWNER_ROLE_PROTECTED", "Club ownership must be transferred explicitly")
    await db.organization_memberships.update_one(
        {"user_id": member_user_id, "org_id": org_id, "status": "active"},
        {"$set": {"role": body.role, "updated_at": utcnow().isoformat()}}
    )
    return {"updated": True, "user_id": member_user_id, "role": body.role}


@router.delete("/orgs/{org_id}/members/{member_user_id}")
async def remove_member(
    org_id: str, member_user_id: str,
    user=Depends(require_org_permission("club.staff.manage"))
):
    membership = await db.organization_memberships.find_one(
        {"user_id": member_user_id, "org_id": org_id, "status": "active"}, {"_id": 0}
    )
    if not membership:
        raise KuviraError(404, "MEMBER_NOT_FOUND", "Active club member not found")
    if membership.get("role") == ROLE_CLUB_OWNER:
        raise KuviraError(409, "OWNER_ROLE_PROTECTED", "Club ownership must be transferred explicitly")
    await db.organization_memberships.update_one(
        {"user_id": member_user_id, "org_id": org_id, "status": "active"},
        {"$set": {"status": "inactive", "updated_at": utcnow().isoformat()}}
    )
    return {"removed": True, "user_id": member_user_id}


@router.post("/orgs/{org_id}/ownership/transfer")
async def transfer_ownership(
    org_id: str, body: OwnershipTransfer,
    user=Depends(require_org_permission("club.ownership.transfer"))  # Owner only
):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "id": 1, "name": 1})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    target = await _get_or_invite_user(body.mobile, body.name)
    current_owner = await db.organization_memberships.find_one(
        {"org_id": org_id, "role": ROLE_CLUB_OWNER, "status": "active"}, {"_id": 0}
    )
    existing_target = await db.organization_memberships.find_one(
        {"user_id": target["id"], "org_id": org_id}
    )
    if existing_target:
        await db.organization_memberships.update_one(
            {"user_id": target["id"], "org_id": org_id},
            {"$set": {"role": ROLE_CLUB_OWNER, "status": "active", "updated_at": utcnow().isoformat()}}
        )
    else:
        await db.organization_memberships.insert_one({
            "id": gen_id(), "user_id": target["id"], "org_id": org_id,
            "role": ROLE_CLUB_OWNER, "status": "active", "created_at": utcnow().isoformat()
        })
    # Downgrade previous owner to Admin
    if current_owner and current_owner.get("user_id") != target["id"]:
        await db.organization_memberships.update_one(
            {"user_id": current_owner["user_id"], "org_id": org_id},
            {"$set": {"role": ROLE_CLUB_ADMIN, "status": "active", "updated_at": utcnow().isoformat()}}
        )
    log.info("Ownership transferred org=%s old_owner=%s new_owner=%s", org_id,
             current_owner.get("user_id") if current_owner else None, target["id"])
    return {
        "transferred": True, "org_id": org_id,
        "new_owner_user_id": target["id"],
        "previous_owner_user_id": current_owner.get("user_id") if current_owner else None,
    }


# ---------------------------------------------------------------------------
# Analytics & Reports
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/analytics")
async def org_analytics(org_id: str, user=Depends(require_org_permission("club.analytics.view"))):
    fids = await _org_facility_ids(org_id)
    bookings = await db.bookings.find(
        {"facility_id": {"$in": fids}}, {"_id": 0, "price": 1, "status": 1}
    ).to_list(1000)
    membership = await db.organization_memberships.find_one({"org_id": org_id, "user_id": user["id"], "status": "active"}, {"_id": 0, "role": 1})
    can_finance = user.get("is_platform_admin") or (membership or {}).get("role") in (ROLE_CLUB_OWNER, ROLE_CLUB_ADMIN)
    revenue = sum(b.get("price", 0) for b in bookings if b.get("status") == "confirmed") if can_finance else None
    confirmed = sum(1 for b in bookings if b.get("status") == "confirmed")
    cancelled = sum(1 for b in bookings if b.get("status") == "cancelled")
    games = await db.games.count_documents({"facility_id": {"$in": fids}})
    members = await db.organization_memberships.count_documents({"org_id": org_id, "status": "active"})
    return {
        "bookings_count": len(bookings),
        "confirmed_bookings": confirmed,
        "cancelled_bookings": cancelled,
        "revenue": revenue,
        "games_count": games,
        "members_count": members,
        "facilities_count": len(fids),
    }


@router.get("/orgs/{org_id}/reports/bookings")
async def org_export_bookings(
    org_id: str,
    user=Depends(require_org_permission("club.reports.export"))  # Owner + Admin only
):
    """Export full booking data for the club. Owner + Admin only."""
    fids = await _org_facility_ids(org_id)
    bookings = await db.bookings.find(
        {"facility_id": {"$in": fids}}, {"_id": 0}
    ).sort("created_at", -1).to_list(5000)
    return {
        "exported_at": utcnow().isoformat(),
        "count": len(bookings),
        "bookings": bookings,
    }


# ---------------------------------------------------------------------------
# Club status (active/inactive) — Admin+
# ---------------------------------------------------------------------------

@router.patch("/orgs/{org_id}/status")
async def org_update_status(
    org_id: str, body: ClubStatusUpdate,
    user=Depends(require_org_permission("club.manage"))  # Owner + Admin only
):
    if body.status not in ("active", "inactive"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be 'active' or 'inactive'")
    await db.organizations.update_one(
        {"id": org_id}, {"$set": {"status": body.status, "updated_at": utcnow().isoformat()}}
    )
    # Propagate status to all facilities so booking flow can filter
    await db.facilities.update_many(
        {"org_id": org_id},
        {"$set": {"org_status": body.status, "updated_at": utcnow().isoformat()}}
    )
    await _write_audit_log(org_id, f"club.status.{body.status}", user["id"], {"status": body.status})
    return {"updated": True, "status": body.status}


# ---------------------------------------------------------------------------
# Club location (from geocoding) — Admin+
# ---------------------------------------------------------------------------

@router.patch("/orgs/{org_id}/location")
async def org_update_location(
    org_id: str, body: ClubLocationUpdate,
    user=Depends(require_org_permission("club.manage"))
):
    update: Dict[str, Any] = {
        "lat": body.lat, "lng": body.lng,
        "location": {"type": "Point", "coordinates": [body.lng, body.lat]},
        "updated_at": utcnow().isoformat(),
    }
    if body.address: update["address"] = body.address
    if body.city: update["city"] = body.city
    if body.state: update["state"] = body.state
    if body.area: update["area"] = body.area
    await db.organizations.update_one({"id": org_id}, {"$set": update})
    await _write_audit_log(org_id, "club.location.updated", user["id"], {"lat": body.lat, "lng": body.lng})
    return {"updated": True}


# ---------------------------------------------------------------------------
# Events management — Owner + Admin + Manager (club.events.manage)
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/events")
async def org_list_events(
    org_id: str,
    user=Depends(require_org_permission("club.view"))
):
    """List all org events including drafts (managers can see drafts)."""
    return await db.events.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("date", 1).to_list(200)


@router.post("/orgs/{org_id}/events")
async def org_create_event(
    org_id: str, body: EventCreate,
    user=Depends(require_org_permission("club.events.manage"))  # Owner + Admin + Manager
):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    if body.status not in ("draft", "published", "cancelled"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be draft, published, or cancelled")
    location = None
    city = org.get("city", "")
    state = org.get("state", "")
    if body.facility_id:
        fac = await db.facilities.find_one({"id": body.facility_id}, {"_id": 0})
        if fac:
            city = fac.get("city", city)
            state = fac.get("state", state)
            if fac.get("lat") and fac.get("lng"):
                location = {"type": "Point", "coordinates": [fac["lng"], fac["lat"]]}
    event = {
        "id": gen_id(), "org_id": org_id,
        "name": body.name, "date": body.date, "end_date": body.end_date,
        "description": body.description or "", "image": body.image or "",
        "type": body.type, "sport": body.sport,
        "price": body.price, "max_participants": body.max_participants, "participants_count": 0,
        "facility_id": body.facility_id, "city": city, "state": state,
        "location": location, "status": body.status,
        "created_by": user["id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat(),
    }
    await db.events.insert_one(event.copy())
    await _write_audit_log(org_id, "event.created", user["id"], {"event_id": event["id"], "name": body.name, "status": body.status}, event["id"], "event")
    return strip_id(event)


@router.patch("/orgs/{org_id}/events/{event_id}")
async def org_update_event(
    org_id: str, event_id: str, body: EventUpdate,
    user=Depends(require_org_permission("club.events.manage"))
):
    event = await db.events.find_one({"id": event_id, "org_id": org_id}, {"_id": 0})
    if not event:
        raise KuviraError(404, "EVENT_NOT_FOUND", "Event not found in this club")
    if body.status and body.status not in ("draft", "published", "cancelled"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be draft, published, or cancelled")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = utcnow().isoformat()
    await db.events.update_one({"id": event_id}, {"$set": updates})
    if body.status:
        await _write_audit_log(org_id, f"event.{body.status}", user["id"], {"event_id": event_id}, event_id, "event")
    return await db.events.find_one({"id": event_id}, {"_id": 0})


@router.delete("/orgs/{org_id}/events/{event_id}")
async def org_delete_event(
    org_id: str, event_id: str,
    user=Depends(require_org_permission("club.events.manage"))
):
    result = await db.events.delete_one({"id": event_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise KuviraError(404, "EVENT_NOT_FOUND", "Event not found in this club")
    await _write_audit_log(org_id, "event.deleted", user["id"], {"event_id": event_id}, event_id, "event")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Tournaments management — Owner + Admin + Manager (club.events.manage)
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/tournaments")
async def org_list_tournaments(
    org_id: str,
    user=Depends(require_org_permission("club.view"))
):
    return await db.tournaments.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("date", 1).to_list(200)


@router.post("/orgs/{org_id}/tournaments")
async def org_create_tournament(
    org_id: str, body: TournamentCreate,
    user=Depends(require_org_permission("club.events.manage"))
):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise KuviraError(404, "ORG_NOT_FOUND", "Club not found")
    if body.status not in ("draft", "published", "cancelled"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be draft, published, or cancelled")
    location = None
    city = org.get("city", "")
    state = org.get("state", "")
    if body.facility_id:
        fac = await db.facilities.find_one({"id": body.facility_id}, {"_id": 0})
        if fac:
            city = fac.get("city", city)
            state = fac.get("state", state)
            if fac.get("lat") and fac.get("lng"):
                location = {"type": "Point", "coordinates": [fac["lng"], fac["lat"]]}
    tournament = {
        "id": gen_id(), "org_id": org_id,
        "name": body.name, "date": body.date, "end_date": body.end_date,
        "description": body.description or "", "image": body.image or "",
        "format": body.format, "sport": body.sport,
        "skill_level": body.skill_level, "entry_fee": body.entry_fee, "prize_pool": body.prize_pool,
        "max_participants": body.max_participants, "participants_count": 0,
        "facility_id": body.facility_id, "city": city, "state": state,
        "location": location, "status": body.status,
        "created_by": user["id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat(),
    }
    await db.tournaments.insert_one(tournament.copy())
    await _write_audit_log(org_id, "tournament.created", user["id"], {"tournament_id": tournament["id"], "name": body.name, "status": body.status}, tournament["id"], "tournament")
    return strip_id(tournament)


@router.patch("/orgs/{org_id}/tournaments/{tournament_id}")
async def org_update_tournament(
    org_id: str, tournament_id: str, body: TournamentUpdate,
    user=Depends(require_org_permission("club.events.manage"))
):
    t = await db.tournaments.find_one({"id": tournament_id, "org_id": org_id}, {"_id": 0})
    if not t:
        raise KuviraError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found in this club")
    if body.status and body.status not in ("draft", "published", "cancelled"):
        raise KuviraError(400, "INVALID_STATUS", "Status must be draft, published, or cancelled")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = utcnow().isoformat()
    await db.tournaments.update_one({"id": tournament_id}, {"$set": updates})
    if body.status:
        await _write_audit_log(org_id, f"tournament.{body.status}", user["id"], {"tournament_id": tournament_id}, tournament_id, "tournament")
    return await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})


@router.delete("/orgs/{org_id}/tournaments/{tournament_id}")
async def org_delete_tournament(
    org_id: str, tournament_id: str,
    user=Depends(require_org_permission("club.events.manage"))
):
    result = await db.tournaments.delete_one({"id": tournament_id, "org_id": org_id})
    if result.deleted_count == 0:
        raise KuviraError(404, "TOURNAMENT_NOT_FOUND", "Tournament not found in this club")
    await _write_audit_log(org_id, "tournament.deleted", user["id"], {"tournament_id": tournament_id}, tournament_id, "tournament")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Audit log — Owner + Admin only
# ---------------------------------------------------------------------------

@router.get("/orgs/{org_id}/audit-log")
async def org_audit_log(
    org_id: str,
    user=Depends(require_org_permission("club.manage"))  # Owner + Admin only
):
    logs = await db.audit_logs.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    for entry in logs:
        actor = await db.users.find_one({"id": entry.get("actor_id")}, {"_id": 0, "name": 1, "mobile": 1})
        entry["actor"] = actor
    return {"count": len(logs), "entries": logs}


# Read-only MatchDrome dashboard projections over existing collections.
# No migrations, new storage, or new write permissions are introduced here.
@router.get("/admin/overview")
async def admin_overview(admin=Depends(require_platform_admin())):
    import asyncio
    names = ["users", "bookings", "organizations", "events", "tournaments", "ai_coach_jobs"]
    counts = await asyncio.gather(*(db[name].count_documents({"is_demo": {"$ne": True}}) for name in names))
    payment_groups = await db.payment_transactions.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "amount": {"$sum": {"$convert": {"input": "$amount", "to": "double", "onError": 0, "onNull": 0}}}}}
    ]).to_list(30)
    jobs = await db.ai_coach_jobs.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]).to_list(30)
    return {"counts": dict(zip(names, counts)), "payments": payment_groups, "ai_jobs": jobs, "generated_at": utcnow().isoformat()}


@router.get("/admin/users")
async def admin_users(q: str = "", admin=Depends(require_platform_admin())):
    import re
    query = {"$or": [{"name": {"$regex": re.escape(q[:100]), "$options": "i"}}, {"mobile": {"$regex": re.escape(q[:100])}}]} if q else {}
    return await db.users.find(query, {"_id": 0, "id": 1, "name": 1, "mobile": 1, "city": 1, "avatar": 1, "onboarded": 1, "is_platform_admin": 1}).sort("created_at", -1).to_list(100)


@router.get("/admin/transactions")
async def admin_transactions(admin=Depends(require_platform_admin())):
    # Allowlist deliberately excludes checkout tokens, gateway payloads and signatures.
    return await db.payment_transactions.find({}, {"_id": 0, "id": 1, "txnid": 1, "status": 1, "amount": 1, "resource": 1, "created_at": 1, "provider": 1}).sort("created_at", -1).to_list(100)


@router.get("/admin/system-health")
async def admin_system_health(admin=Depends(require_platform_admin())):
    database = "unavailable"
    try:
        await db.command("ping")
        database = "connected"
    except Exception:
        pass
    heartbeat = await db.ai_coach_jobs.find_one({"heartbeat_at": {"$exists": True}}, {"_id": 0, "heartbeat_at": 1, "status": 1}, sort=[("heartbeat_at", -1)]) if database == "connected" else None
    return {"api": "responding", "database": database, "worker_last_observation": heartbeat, "worker_status": "not monitored", "knowledge_refresh": "not monitored"}
