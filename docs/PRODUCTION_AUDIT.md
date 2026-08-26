# Kuvira Sports — Production Audit

_Last updated: 2026-08 · Scope: audit of the Emergent-built app before/while hardening for production._

## 1. Current Architecture
- **Frontend:** React Native (Expo Router, SDK 54). Dark + gold design system. Screens under `frontend/app/*`. API client in `frontend/src/api.ts` (uses `EXPO_PUBLIC_BACKEND_URL`).
- **Backend:** FastAPI (`backend/server.py`) + feature modules (`deps.py`, `otp_service.py`, `features.py`, `org_admin.py`). All routes prefixed `/api`.
- **Database:** MongoDB (motor async). Single pooled client in `deps.py`.
- **Auth:** Mobile + OTP → JWT (HS256). Backend-determined capabilities (RBAC).
- **AI:** Claude Sonnet 4.6 via `emergentintegrations` (Emergent LLM key).
- **Payments:** PayU — currently **mocked** (`mock_payu` stub, always paid).

## 2. Development / demo behavior identified
| Item | Location | Status |
|---|---|---|
| Fixed OTP `123456` | `otp_service.py` (mock provider) | Env-gated: only in non-production; prod requires Twilio Verify |
| Demo data seeding | `server.py:seed_if_empty` | Env-gated: skipped when `APP_ENV=production` |
| Mock payments | bookings / orders / coach sessions / tournament reg | Abstracted; documented as MOCK; wire real PayU later |
| Wildcard CORS `*` | `deps.CORS_ALLOWED_ORIGINS` | Env-driven; set explicit origins in prod |

## 3. Security review & fixes applied
- ✅ **RBAC enforced on backend** (roles/permissions/org-scope) — not just frontend.
- ✅ **Org isolation**: `require_org_permission` blocks cross-club access (Club A cannot read Club B by changing `org_id` → 403). Verified.
- ✅ **No role selection at signup**; PLAYER is default; PLATFORM_ADMIN bootstrapped only via `PLATFORM_ADMIN_MOBILES` env (never client-selectable). Club owners provisioned only by platform admin.
- ✅ **JWT** expiry via `JWT_EXPIRY_DAYS`; secret from env/Secret Manager.
- ✅ **OTP** attempt caps + send rate limiting (`otp_service`). NOTE: in-memory (per-instance) — back with Redis for multi-instance prod.
- ✅ **No secrets logged**; structured JSON logs in prod with `request_id`/`user_id`; OTP/JWT/payment data never logged.
- ✅ **Standardized errors** `{error:{code,message}, request_id}`; stack traces not exposed.

## 4. Booking / payment race conditions
- ✅ **Fixed**: unique index `uniq_slot` on `(facility_id, court_number, date, slot)`; insert catches `DuplicateKeyError` → `409 BOOKING_SLOT_UNAVAILABLE`. Two users cannot book the same slot.
- ✅ Coach sessions: unique `uniq_coach_slot`.
- ✅ Game join is atomic + capacity-safe (conditional `$push`); no overbooking/duplicate joins; cancelled games rejected.
- ⚠️ Real payment verification/webhooks still to be wired when PayU goes live (see `docs/SECURITY.md`).

## 5. Indexes (created on startup — `ensure_indexes`)
users(mobile unique, referral_code), bookings(uniq_slot, user_id), coach_sessions(uniq_coach_slot, user_id), organization_memberships((user_id,org_id) unique, org_id), facilities(org_id, city), games(facility_id), orders(user_id), posts(created_at), training_plans(user_id), training_activity((user_id,day) unique).

## 6. Validation & authorization
- Pydantic models validate all request bodies (422 standardized).
- Server-side price for bookings & coach sessions & orders (client never trusted).
- Ownership checks: `/bookings/mine`, `/orders/mine`, training plans scoped by `user_id`.

## 7. Priority backlog
### High
- Wire **real PayU** server-side create + verify + webhook + idempotency (currently mocked).
- Move OTP/auth rate limiting to **Redis** if running >1 Cloud Run instance.
- Provision **MongoDB Atlas** + **Secret Manager**; set explicit **CORS** origins.
### Medium
- GCS media uploads (avatars/product/community) with signed URLs + MIME/size limits.
- FCM push notifications (booking/game/order events).
- Pagination on large list endpoints (facilities/products/posts) for scale.
### Low
- Admin/Club web frontends (`club.` / `admin.` subdomains) using the same auth backend.
- Match history entry, tournament brackets, chat.

## 8. Production readiness
See `docs/PRODUCTION_CHECKLIST.md`. Application code = **READY** pending external infra (Atlas, GCP, PayU/Twilio credentials, DNS) which require your accounts.
