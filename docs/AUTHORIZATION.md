# Authorization & Identity Model

## One login, backend-determined capabilities
There is a **single** authentication flow (mobile + OTP). No screen ever asks whether the
user is a Player, Club, or Admin. After sign-in the app calls `GET /api/capabilities`
(and `/api/me` includes `capabilities`) and the **backend** decides what the user can do.

## Entities
- **User** — the account (one per mobile number, unique).
- **Player Profile** — every user is implicitly a PLAYER (default capability).
- **Organization (Club)** — a club/venue operator.
- **Organization Membership** — links a user to an org with a role.
- **Role / Permission** — see below.

```
User ── (always) ──> PLAYER
User ── OrganizationMembership ──> Org A (CLUB_OWNER)
User ── OrganizationMembership ──> Org B (CLUB_STAFF)
User ── is_platform_admin=true ──> PLATFORM_ADMIN
```
A single user may hold many memberships. **No duplicate accounts per role.**

## Roles
| Role | Scope | Grants |
|---|---|---|
| `PLAYER` | self | default customer capability |
| `CLUB_OWNER` | org | manage club, courts, bookings, games, events, members, staff, analytics |
| `CLUB_MANAGER` | org | operational management (no ownership transfer) |
| `CLUB_STAFF` | org | limited ops (view, bookings, games) |
| `PLATFORM_ADMIN` | platform | everything, all orgs |

Permission catalog and role→permission mapping live in `backend/deps.py` (`PERM`, `ROLE_PERMISSIONS`).

## Enforcement (backend)
- `current_user` — authN (JWT).
- `require_platform_admin()` — platform-only endpoints.
- `require_org_permission(perm)` — checks active membership for the **path `org_id`** and that
  the member's role includes `perm`. Platform admins bypass. Changing `org_id` in the URL to another
  club returns **403 ORG_ACCESS_DENIED** (verified).

## Provisioning (critical rules)
- Customers **cannot** self-promote to Club Owner or create Platform Admins.
- **Only PLATFORM_ADMIN** can: create clubs, assign/invite owners, add staff, grant platform admin.
- Flow: `POST /api/admin/clubs` → `POST /api/admin/clubs/{org_id}/owner {mobile,name}`.
  - If the mobile already has an account → membership attached to the existing user.
  - If not → an **invited** account is created; the owner activates it simply by signing in with that mobile (OTP). No duplicate account.
- Platform admin bootstrap: set `PLATFORM_ADMIN_MOBILES` (comma-separated) in env/Secret Manager.
  On OTP verify, listed mobiles are marked `is_platform_admin`. This is the only non-API way in.

## Workspaces (app UX)
- Everyone lands in the **customer/player** app after login.
- If the user has org memberships, Profile shows a **Workspaces** section → `/club/{orgId}`.
- Switching between personal and club workspace requires **no re-login** (same token/capabilities).
- Admin & Club **web** portals (`admin.` / `club.` subdomains) are future work; they reuse this same
  auth/identity backend and authorization dependencies.
