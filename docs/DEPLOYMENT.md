# Deployment

## Two supported paths

### A) Emergent-managed (fastest)
Click **Publish** (top-right) → Deploy. Emergent hosts the FastAPI backend, manages secrets,
serves the Expo app, and can generate iOS/Android builds (no external Expo/GCP account needed).
Test the deployed app by scanning the Expo Go QR in the deployment panel.
> Note: custom API domains and your own GCP/EAS pipeline are **not** part of this path.

### B) Your own GCP + EAS (this repo is ready for it)
Requires your GCP project, MongoDB Atlas, DNS for `api.kuvirasports.com`, and an Expo account.

#### Backend → Cloud Run
```bash
# 1. Build & push image to Artifact Registry
gcloud artifacts repositories create kuvira --repository-format=docker --location=asia-south1
gcloud builds submit backend --tag asia-south1-docker.pkg.dev/$PROJECT/kuvira/api:latest

# 2. Create secrets (once)
for K in JWT_SECRET MONGO_URL EMERGENT_LLM_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_VERIFY_SERVICE; do
  gcloud secrets create $K --replication-policy=automatic 2>/dev/null || true
done
# add versions: echo -n "value" | gcloud secrets versions add JWT_SECRET --data-file=-

# 3. Deploy
gcloud run deploy kuvira-api \
  --image asia-south1-docker.pkg.dev/$PROJECT/kuvira/api:latest \
  --region asia-south1 --allow-unauthenticated \
  --port 8001 --cpu 1 --memory 512Mi --concurrency 40 --timeout 60 \
  --min-instances 0 --max-instances 10 \
  --set-env-vars APP_ENV=production,DB_NAME=kuvira_sports,OTP_PROVIDER=twilio,CORS_ALLOWED_ORIGINS=https://app.kuvirasports.com \
  --set-secrets JWT_SECRET=JWT_SECRET:latest,MONGO_URL=MONGO_URL:latest,EMERGENT_LLM_KEY=EMERGENT_LLM_KEY:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_VERIFY_SERVICE=TWILIO_VERIFY_SERVICE:latest

# 4. Map domain
gcloud run domain-mappings create --service kuvira-api --domain api.kuvirasports.com --region asia-south1
# then add the shown CNAME/A records at your DNS provider.
```
Health checks: liveness `GET /api/health`, readiness `GET /api/readiness` (pings Mongo).

#### Frontend → Expo EAS
```bash
cd frontend
# set EXPO_PUBLIC_BACKEND_URL=https://api.kuvirasports.com for production profile
eas build --platform all --profile production   # requires eas.json (Emergent-managed) & Expo login
eas submit --platform ios && eas submit --platform android
```

## CI/CD
`.github/workflows/ci.yml` runs lint + typecheck + backend tests on PRs, and (on `main`)
builds & pushes the image and deploys to Cloud Run using `GCP_SA_KEY`, `GCP_PROJECT` secrets.
Configure GitHub → Settings → Secrets. Never auto-deploy arbitrary branches to prod.

## Environments
- **development** — local, mock OTP, seeded demo data.
- **staging** — Cloud Run staging service, `APP_ENV=staging`, mock OTP OK, separate Atlas DB.
- **production** — `APP_ENV=production`, Twilio OTP, no seeding, explicit CORS.
