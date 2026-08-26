# Environment Variables

Backend (`backend/.env` in dev; **Google Secret Manager** in production). See `backend/.env.example`.

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | yes | `development` \| `staging` \| `production`. Gates demo seed & mock OTP. |
| `MONGO_URL` | yes | MongoDB connection string (Atlas SRV in prod). |
| `DB_NAME` | yes | Database name. |
| `MONGO_MAX_POOL` | no | Connection pool size (default 50). |
| `MONGO_TIMEOUT_MS` | no | Server selection timeout (default 8000). |
| `JWT_SECRET` | yes | Strong random secret for HS256 tokens. |
| `JWT_EXPIRY_DAYS` | no | Token lifetime (default 30). |
| `PLATFORM_ADMIN_MOBILES` | no | Comma-separated mobiles auto-granted PLATFORM_ADMIN on login. |
| `OTP_PROVIDER` | yes | `mock` (dev/staging) \| `twilio` (production). |
| `TWILIO_ACCOUNT_SID` | prod | Twilio SID. |
| `TWILIO_AUTH_TOKEN` | prod | Twilio auth token. |
| `TWILIO_VERIFY_SERVICE` | prod | Twilio Verify service SID (`VA...`). |
| `EMERGENT_LLM_KEY` | yes | Universal LLM key (Claude Sonnet 4.6 for AI Coach). |
| `CORS_ALLOWED_ORIGINS` | yes | Comma-separated origins; avoid `*` in prod. |
| `STORAGE_BUCKET` | media | GCS bucket for uploads (when enabled). |
| `PAYU_MERCHANT_KEY` / `PAYU_MERCHANT_SALT` / `PAYU_MODE` | payments | PayU creds when un-mocking payments. |

Frontend (`frontend/.env`):
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | Base URL of the API (e.g. `https://api.kuvirasports.com`). App appends `/api`. **Do not** modify Emergent-managed `EXPO_PACKAGER_*` vars. |

### Secrets policy
- Never commit real secrets. `.env.example` documents keys with empty values.
- Production secrets live in **Google Secret Manager** and are injected as env vars into Cloud Run.
- Preview → production: newly added keys are copied to the deployment secret store on first deploy; edit values later in the deployment panel and re-deploy.
