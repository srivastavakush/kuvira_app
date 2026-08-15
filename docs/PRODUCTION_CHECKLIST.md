# Production Readiness Checklist

## Code (in this repo) — DONE
- [x] Unified identity + RBAC (User/PlayerProfile/Org/Membership/Role/Permission)
- [x] Single login, no role selection, backend-determined capabilities
- [x] Platform-admin-only club & owner provisioning (no self-promotion)
- [x] Org-scoped authorization + cross-tenant isolation (403) — tested
- [x] Env-gated OTP (mock dev / Twilio prod) + OTP attempt & rate limits
- [x] JWT expiry + secret from env; no secrets logged
- [x] Standardized error responses + request_id + structured logging
- [x] Booking concurrency (unique index + 409); atomic capacity-safe game join
- [x] Server-side price validation (bookings, coach sessions, orders)
- [x] Indexes created on startup; demo seed disabled in production
- [x] Features: Coach Booking, Training Plans (+streak), Rankings & Badges, Refer & Earn
- [x] Docker + Cloud Build + GitHub Actions + `.env.example`
- [x] Docs: AUDIT, SETUP, ENV, DEPLOYMENT, SECURITY, AUTHORIZATION, CLUB_WORKSPACE

## Requires your accounts/credentials — TODO (manual)
- [ ] MongoDB Atlas cluster + `MONGO_URL` + backups
- [ ] Twilio Verify service + credentials (`OTP_PROVIDER=twilio`)
- [ ] GCP: Artifact Registry, Secret Manager, Cloud Run deploy, monitoring alerts
- [ ] DNS: map `api.kuvirasports.com`
- [ ] Real PayU integration (server create + hash + webhook) to replace mock
- [ ] GCS bucket + media upload wiring (avatars/products/community)
- [ ] FCM push notifications (native build required)
- [ ] Expo EAS production builds + App Store / Play Store submission
- [ ] Set `CORS_ALLOWED_ORIGINS`, `JWT_SECRET`, `PLATFORM_ADMIN_MOBILES` in Secret Manager
- [ ] Redis for OTP/rate-limit counters if running >1 instance

## App Store / Play Store
- [ ] App icons/splash, privacy policy URL, data-safety form
- [ ] iOS: bundle id, App Store Connect, TestFlight
- [ ] Android: package name, Play Console, signing (EAS-managed)
- [ ] Camera/location/notification usage strings (already scaffolded in `app.json` as features are added)

## Verdict
**Application code: READY.** **Overall: NEEDS CONFIGURATION** — external infra & third-party
credentials (Atlas, GCP, Twilio, PayU, DNS, EAS) must be provisioned with your accounts.
