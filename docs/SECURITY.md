# Security

## Authentication
- Mobile + OTP. Dev/staging use a mock code; **production uses Twilio Verify** (`OTP_PROVIDER=twilio`).
  Mock OTP is hard-disabled when `APP_ENV=production`.
- OTP send rate limit (5/hour/mobile) and verify attempt cap (5/issued code) in `otp_service.py`.
  > Multi-instance production: move these counters to Redis (per-process today).
- JWT HS256, expiry via `JWT_EXPIRY_DAYS`, secret from Secret Manager. Logout = client drops token
  (stored in secure storage `kuvira_auth_token`).

## Authorization
- Every protected endpoint depends on `current_user`; org endpoints add `require_org_permission`.
- Backend enforces: authN → identity → permission → org scope → resource ownership.
- Cross-tenant access blocked (Club A ↛ Club B) — verified via test.

## Data protection
- Never log OTPs, JWTs, passwords, API keys, or payment credentials. Structured logs carry only
  `request_id` and `user_id`.
- MongoDB responses always exclude `_id` (projections `{_id:0}`).
- No card data stored. Payment status is server-authoritative (never trust client).

## Payments (when un-mocking PayU)
1. Create transaction server-side (amount computed from DB, not client).
2. Redirect/collect via PayU; verify the response **hash** server-side.
3. Handle the PayU **webhook**; verify signature; idempotent by transaction id.
4. Only then flip booking/order to `confirmed`. Support `failed`/`refunded` states.

## Transport & CORS
- HTTPS only (Cloud Run + custom domain TLS).
- `CORS_ALLOWED_ORIGINS` explicit in production (no `*`).

## Abuse / privacy
- Report/block architecture is planned for community content.
- Precise user location is not exposed; only city/area are surfaced.

## Reporting
Security issues → security@kuvirasports.com (set up mailbox) or support@emergent.sh for platform.
