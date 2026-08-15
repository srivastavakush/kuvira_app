# Production Setup

End-to-end steps to run Kuvira on your own infrastructure.

## 1. MongoDB Atlas
1. Create a project + cluster (region close to Cloud Run, e.g. Mumbai `ap-south-1`).
2. Create DB user + password. Network access: allow Cloud Run egress (VPC connector or `0.0.0.0/0` with strong auth for a start).
3. Copy the SRV connection string → `MONGO_URL`. Set `DB_NAME=kuvira_sports`.
4. Enable **automated backups** (see `docs/PRODUCTION_CHECKLIST.md`).
5. Indexes are created automatically by the app on startup (`ensure_indexes`).

## 2. Twilio Verify (OTP)
1. Create a Twilio account → Verify → create a Service (get `VA...` SID).
2. Set `OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE`.
3. Numbers must be E.164 (e.g. `+9198...`). Frontend currently sends the raw number — prefix `+91` in production or accept E.164 input.

## 3. GCP
- **Artifact Registry**: docker repo for images.
- **Secret Manager**: store `JWT_SECRET`, `MONGO_URL`, `EMERGENT_LLM_KEY`, Twilio + PayU secrets.
- **Cloud Run**: deploy `backend/` (see `docs/DEPLOYMENT.md`), port `8001`.
- **Cloud Storage**: bucket for media (`STORAGE_BUCKET`) when uploads are enabled.
- **Cloud Logging/Monitoring/Error Reporting**: automatic for Cloud Run; add uptime check on `/api/health` and alerts on 5xx rate & latency.
- **Custom domain**: map `api.kuvirasports.com` to the Cloud Run service; add DNS records.

## 4. AI (Claude Sonnet 4.6)
Set `EMERGENT_LLM_KEY`. Top up balance via Profile → Manage plan → Universal Key.

## 5. Payments (PayU)
Currently mocked. To go live, implement server-side create + hash verify + webhook (see `docs/SECURITY.md`) and set `PAYU_*` secrets.

## 6. Frontend / EAS
Set `EXPO_PUBLIC_BACKEND_URL=https://api.kuvirasports.com`. Build/submit via EAS (`docs/DEPLOYMENT.md`).

## 7. Platform admin
Set `PLATFORM_ADMIN_MOBILES` to your admin mobile(s). Sign in → you can create clubs & assign owners.
