"""Organization (Club) workspace + Platform Admin provisioning.

- ONE login flow; no role selection. Backend determines capabilities.
- Customers CANNOT self-promote. Only PLATFORM_ADMIN creates clubs & assigns owners.
- Club resources are strictly org-scoped and permission-checked on the backend.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from deps import (
    db, gen_id, utcnow, strip_id, current_user, KuviraError,
    require_platform_admin, require_org_permission,
    ROLE_CLUB_OWNER, ROLE_CLUB_MANAGER, ROLE_CLUB_STAFF, log,
)

router = APIRouter(prefix="/api")

# ===========================================================================
# Models
# ===========================================================================
class ClubCreate(BaseModel):
    name: str
    city: str
    logo: Optional[str] = None
    description: Optional[str] = None
    facility_ids: List[str] = []   # optionally claim existing facilities


class AssignOwner(BaseModel):
    mobile: str
    name: Optional[str] = None


class AddStaff(BaseModel):
    mobile: str
    role: str  # CLUB_MANAGER | CLUB_STAFF


class ClubUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None


# ===========================================================================
# PLATFORM ADMIN — club & owner provisioning
# ===========================================================================
@router.get("/admin/clubs")
async def admin_list_clubs(admin=Depends(require_platform_admin())):
    return await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/clubs")
async def admin_create_club(body: ClubCreate, admin=Depends(require_platform_admin())):
    org = {
        "id": gen_id(),
        "name": body.name,
        "city": body.city,
        "logo": body.logo,
        "description": body.description or "",
        "status": "active",
        "created_by": admin["id"],
        "created_at": utcnow().isoformat(),
    }
    await db.organizations.insert_one(org.copy())
    if body.facility_ids:
        await db.facilities.update_many({"id": {"$in": body.facility_ids}}, {"$set": {"org_id": org["id"]}})
    return strip_id(org)


async def _get_or_invite_user(mobile: str, name: Optional[str]) -> dict:
    user = await db.users.find_one({"mobile": mobile}, {"_id": 0})
    if user:
        return user
    # create an invited (activatable) account — NOT a duplicate; they sign in with this mobile
    user = {
        "id": gen_id(), "mobile": mobile, "name": name, "avatar": None,
        "onboarded": False, "invited": True, "created_at": utcnow().isoformat(),
    }
    await db.users.insert_one(user.copy())
    return strip_id(user)


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
            {"$set": {"role": ROLE_CLUB_OWNER, "status": "active"}},
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


# ===========================================================================
# CLUB WORKSPACE — org-scoped, permission-checked
# ===========================================================================
async def _org_facility_ids(org_id: str) -> List[str]:
    facs = await db.facilities.find({"org_id": org_id}, {"_id": 0, "id": 1}).to_list(200)
    return [f["id"] for f in facs]


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


@router.get("/orgs/{org_id}/facilities")
async def org_facilities(org_id: str, user=Depends(require_org_permission("club.view"))):
    return await db.facilities.find({"org_id": org_id}, {"_id": 0}).to_list(200)


@router.get("/orgs/{org_id}/bookings")
async def org_bookings(org_id: str, user=Depends(require_org_permission("club.bookings.manage"))):
    fids = await _org_facility_ids(org_id)
    return await db.bookings.find({"facility_id": {"$in": fids}}, {"_id": 0}).sort("created_at", -1).to_list(300)


@router.get("/orgs/{org_id}/games")
async def org_games(org_id: str, user=Depends(require_org_permission("club.games.manage"))):
    fids = await _org_facility_ids(org_id)
    return await db.games.find({"facility_id": {"$in": fids}}, {"_id": 0}).to_list(300)


@router.get("/orgs/{org_id}/members")
async def org_members(org_id: str, user=Depends(require_org_permission("club.members.manage"))):
    members = await db.organization_memberships.find({"org_id": org_id, "status": "active"}, {"_id": 0}).to_list(200)
    out = []
    for m in members:
        u = await db.users.find_one({"id": m["user_id"]}, {"_id": 0, "id": 1, "name": 1, "mobile": 1, "avatar": 1})
        out.append({**m, "user": u})
    return out


@router.post("/orgs/{org_id}/staff")
async def add_staff(org_id: str, body: AddStaff, user=Depends(require_org_permission("club.staff.manage"))):
    if body.role not in (ROLE_CLUB_MANAGER, ROLE_CLUB_STAFF):
        raise KuviraError(400, "INVALID_ROLE", "Role must be CLUB_MANAGER or CLUB_STAFF")
    staff_user = await _get_or_invite_user(body.mobile, None)
    existing = await db.organization_memberships.find_one({"user_id": staff_user["id"], "org_id": org_id})
    if existing:
        await db.organization_memberships.update_one(
            {"user_id": staff_user["id"], "org_id": org_id}, {"$set": {"role": body.role, "status": "active"}}
        )
    else:
        await db.organization_memberships.insert_one({
            "id": gen_id(), "user_id": staff_user["id"], "org_id": org_id,
            "role": body.role, "status": "active", "created_at": utcnow().isoformat(),
        })
    return {"added": True, "user_id": staff_user["id"], "role": body.role}


@router.get("/orgs/{org_id}/analytics")
async def org_analytics(org_id: str, user=Depends(require_org_permission("club.analytics.view"))):
    fids = await _org_facility_ids(org_id)
    bookings = await db.bookings.find({"facility_id": {"$in": fids}}, {"_id": 0, "price": 1}).to_list(1000)
    revenue = sum(b.get("price", 0) for b in bookings)
    games = await db.games.count_documents({"facility_id": {"$in": fids}})
    members = await db.organization_memberships.count_documents({"org_id": org_id, "status": "active"})
    return {
        "bookings_count": len(bookings),
        "revenue": revenue,
        "games_count": games,
        "members_count": members,
        "facilities_count": len(fids),
    }
