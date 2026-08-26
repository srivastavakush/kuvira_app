# Club Workspace

## What a Club Owner sees
After a PLATFORM_ADMIN provisions a club and assigns the owner, that user — on their **normal**
login — sees a **Workspaces** section in Profile listing their clubs. Tapping opens
`/club/{orgId}` (no re-login). They remain a player everywhere else.

## Capabilities by role (org-scoped)
- **CLUB_OWNER**: club profile, courts & availability, bookings, games, events/tournaments,
  members, staff (add managers/staff), analytics.
- **CLUB_MANAGER**: all operational management except ownership transfer / platform actions.
- **CLUB_STAFF**: limited ops (view, bookings, games).

## Backend endpoints (all require org permission)
| Method | Path | Permission |
|---|---|---|
| GET | `/api/orgs/{org_id}` | club.view |
| PATCH | `/api/orgs/{org_id}` | club.manage |
| GET | `/api/orgs/{org_id}/facilities` | club.view |
| GET | `/api/orgs/{org_id}/bookings` | club.bookings.manage |
| GET | `/api/orgs/{org_id}/games` | club.games.manage |
| GET | `/api/orgs/{org_id}/members` | club.members.manage |
| POST | `/api/orgs/{org_id}/staff` | club.staff.manage |
| GET | `/api/orgs/{org_id}/analytics` | club.analytics.view |

## Platform Admin provisioning
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/clubs` | list all clubs |
| POST | `/api/admin/clubs` | create club (optionally `facility_ids` to claim venues) |
| POST | `/api/admin/clubs/{org_id}/owner` | assign/invite owner by mobile |
| POST | `/api/admin/users/{user_id}/platform-admin` | grant platform admin |

Resources are scoped to the org via `facilities.org_id`; bookings/games are derived from the
club's facility ids. A club can never see another club's data.
