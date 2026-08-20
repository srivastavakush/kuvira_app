# Kuvira RBAC

## Roles

- `PLAYER` — default consumer role.
- `CLUB_STAFF` — club operations: view club, bookings, games.
- `CLUB_MANAGER` — club workspace management, courts, bookings, games/events, members, analytics. Cannot manage staff or transfer ownership.
- `CLUB_OWNER` — all club-manager capabilities plus staff management and ownership transfer.
- `PLATFORM_ADMIN` — platform-wide administration and all catalogued permissions.

There is intentionally no frontend role selector. Roles are determined by backend authentication and active organization memberships.

## Permission source of truth

Backend permissions are defined in `backend/deps.py` via `PERM` and `ROLE_PERMISSIONS`. The authenticated `/api/me` and `/api/capabilities` responses expose the backend-computed roles, permissions, and organization memberships.

The frontend mirrors the role-permission map only for UX decisions in `frontend/src/capabilities.ts`. It is never a security boundary; every protected API still enforces authorization in the backend.

## Organization scoping

A user's permission is evaluated against the specific organization membership. Frontend helpers use `canForOrg()` so a manager/owner permission from one club cannot make controls appear for another club where the user has a lower role.

## Management actions

- Platform admin creates clubs and assigns owners.
- Club owner/authorized manager can add managers/staff according to `club.staff.manage`.
- Owner can change manager/staff roles or remove active non-owner members.
- Owner can transfer ownership; the previous owner becomes `CLUB_MANAGER`.
- A club owner cannot be removed or demoted through the generic staff endpoint.

## Frontend enforcement

- `useSession()` exposes backend capabilities globally.
- `useCapabilities()` provides `can`, `hasRole`, `roleForOrg`, and `canForOrg` helpers.
- Admin UI hides platform controls unless the backend reports platform-admin capability.
- Club workspace hides analytics, bookings, member management, staff controls, and ownership transfer unless the current organization role permits them.

## Security rule

Frontend visibility is convenience only. The backend remains authoritative and returns `403` for unauthorized organization or platform actions.
