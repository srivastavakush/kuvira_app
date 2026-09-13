# MatchDrome: GCP production setup

This guide matches the repository, including PR #12 production safeguards and the legacy demo cleanup changes. It describes configuration to perform in your account; it is not confirmation that your live resources are configured. Keep the existing MongoDB database name, Firebase app identifiers and API URLs unless deliberately migrating them.

## 1. Select the existing resources

Open Google Cloud Console and choose your existing API project. Record the project ID, region, Cloud Run API service name, API HTTPS URL, web HTTPS origin, existing MongoDB database name and private storage bucket names. The app currently uses Firebase project `kuvira-bc2be`; this can differ from the API project. Its Android package and iOS bundle ID are `com.emergent.kuvirasportsapp.zwrxyl`.

Enable Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Storage and Vertex AI APIs in the API project. Enable Firebase Authentication/Identity Toolkit in the Firebase project and confirm billing/SMS availability. Use a separate staging database and PayU test credentials for staging. Do not change DB_NAME to match the new brand: that would point the app at a different database.

## 2. Service identity and database network

Create or reuse a dedicated runtime service account, for example `matchdrome-runtime`. Assign this identity to the API, worker and cleanup job. Grant Secret Manager Secret Accessor on the particular secrets it needs; Storage Object Admin on the video/profile buckets; Vertex AI User in the Vertex project. In Firebase project `kuvira-bc2be`, grant Firebase Authentication Admin (`roles/firebaseauth.admin`) to the runtime identity for account lookup/deletion. The Firebase project must trust the service account from the API project. Use attached service identities/ADC, not downloaded service-account key files.

Keep your existing MongoDB deployment. Financial reservations require a replica set; Atlas is supported. Give the application database user read/write access only to the app database. Keep API and worker on the same database. If Atlas uses an IP allowlist, route Cloud Run outbound traffic through a VPC and Cloud NAT with a reserved address, and allow that address in Atlas. Apply equivalent network access to worker and cleanup job. Verify SRV DNS and TLS connectivity; do not open Atlas to every IP as the production solution.

## 3. Store secrets

In **Security → Secret Manager**, create secrets for these environment variables and enter values in the console:

| Environment variable | Value |
| --- | --- |
| MONGO_URL | Existing MongoDB connection string |
| JWT_SECRET | Unique cryptographically random secret, at least 32 characters; retain the current secure value to avoid signing everyone out |
| PAYU_MERCHANT_KEY | PayU live merchant key |
| PAYU_MERCHANT_SALT | PayU live salt |
| SMTP_USER | Transactional SMTP account username |
| SMTP_PASSWORD | Transactional SMTP password/app credential |

In each runtime's Variables & Secrets panel, reference these secrets with the exact environment variable names above. Prefer pinned secret versions for reproducible releases. Never put these in EXPO_PUBLIC variables or source control. The cleanup job needs only MONGO_URL, DB_NAME and database network access.

## 4. Configure private storage

Create/reuse a private video bucket and a private profile-photo bucket. Enable uniform bucket-level access and public access prevention. Set the runtime's bucket permissions as in step 2. Separate buckets make retention policies easier: do not apply short video retention to avatars.

For browser uploads, save the following as `cors.json`, replacing the origin with your real web domain, then apply it in Cloud Shell. An origin has scheme and host, without a trailing path. List every genuine frontend origin; do not use `*`.

```json
[{"origin":["https://YOUR_WEB_DOMAIN"],"method":["PUT"],"responseHeader":["Range","Content-Range","Content-Type"],"maxAgeSeconds":3600}]
```

```bash
gcloud storage buckets update gs://YOUR_VIDEO_BUCKET --cors-file=cors.json
```

The app sends video directly to GCS. Keep the 500 MiB default initially. Source footage is deleted after analysis; cleanup retries in the worker. Check bucket soft-delete/versioning retention and align it with your privacy policy. Do not set a bucket-wide lifecycle policy that removes videos still being analysed. Upload session URLs are private bearer URLs and must not be logged or shared.

## 5. Configure API environment

Cloud Run → existing API → **Edit & deploy new revision → Variables & Secrets**. Preserve existing unrelated variables. Add these ordinary environment variables and the secret references from step 3:

```dotenv
APP_ENV=production
DB_NAME=YOUR_EXISTING_DATABASE_NAME
CORS_ALLOWED_ORIGINS=https://YOUR_WEB_DOMAIN
OTP_PROVIDER=firebase
PAYMENT_PROVIDER=payu
PAYU_MODE=live
PAYU_CALLBACK_BASE_URL=https://YOUR_EXISTING_API_HOST
GOOGLE_CLOUD_PROJECT=YOUR_VERTEX_PROJECT_ID
VERTEX_AI_LOCATION=YOUR_SUPPORTED_VERTEX_REGION
AI_PROVIDER=vertex
AI_COACH_ANALYZER=vertex_gemini
AI_COACH_STORAGE_BACKEND=gcs
AI_COACH_STORAGE_BUCKET=YOUR_VIDEO_BUCKET
AI_COACH_STORAGE_PREFIX=ai-coach/videos
AI_COACH_MAX_VIDEO_MB=500
PROFILE_MEDIA_STORAGE_BACKEND=gcs
PROFILE_MEDIA_BUCKET=YOUR_PROFILE_BUCKET
AI_COACH_QUEUE_BACKEND=worker
AI_COACH_RATE_LIMIT_BACKEND=mongo
AI_COACH_RATE_LIMIT_FAIL_CLOSED=true
SMTP_HOST=YOUR_SMTP_PROVIDER_HOST
SMTP_PORT=587
SMTP_FROM=contact@kuvirasports.com
```

Set `VERTEX_AI_MODEL_PRIMARY`, `VERTEX_AI_MODEL_SECONDARY`, `VERTEX_AI_VIDEO_MODEL` and `VERTEX_AI_EMBEDDING_MODEL` to models currently available to your Vertex project/region. Existing examples use Gemini 2.5 Flash and text-embedding-005; verify model lifecycle/access in Vertex Console before deployment. Retain the existing embedding model/dimensions for stored vectors. Set AI_COACH_VECTOR_INDEX only after creating the matching Atlas vector index described in AI_COACH_RAG.md. Model access/quota is separate from enabling the API.

Remove blank `PAYU_CHECKOUT_URL` and `PAYU_VERIFY_URL` environment overrides if present; let the live-mode defaults select endpoints. PAYU_CALLBACK_BASE_URL is the API origin, not the web domain and not a URL ending in `/api`.

Use the existing API container startup command. It listens on Cloud Run's PORT. Guest discovery and PayU callbacks need a publicly reachable API; application JWT/role checks protect private endpoints. `/api/health` checks the process; `/api/readiness` checks MongoDB connectivity.

## 6. Build and deploy the API image

Merge the reviewed code first, then build from the backend directory (the Dockerfile expects this build context). In Cloud Shell, with a checked-out repository:

```bash
gcloud config set project YOUR_API_PROJECT_ID
gcloud builds submit backend --tag YOUR_REGION-docker.pkg.dev/YOUR_API_PROJECT_ID/YOUR_ARTIFACT_REPOSITORY/matchdrome-api:YOUR_RELEASE_TAG
```

Create the Artifact Registry Docker repository first if it does not exist. Select that image in the API revision. Choose resource limits using staging load tests; Vertex analysis runs in the separate worker.

For the PR #12 booking index migration, take a MongoDB backup and arrange a maintenance window. Stop old booking writers before the new startup migrates active-slot indexes. Do not leave old/new booking implementations writing concurrently. Confirm startup and readiness before reopening traffic. A healthy process alone does not prove payment configuration works.

## 7. Run the continuous worker

Use **Cloud Run → Worker pools → Deploy container**, using the same backend image, database configuration, secrets and runtime identity. Select a region supporting worker pools and your network setup. Set one running instance initially; container command `python`, arguments `-m,ai_coach.worker` (enter as two separate arguments in the console). Configure all environment variables from step 5 and secrets from step 3.

This entry point has no HTTP listener, so do not deploy it unchanged as a normal Cloud Run HTTP service. The worker handles queued analyses and starts payment reconciliation, email retries, account deletion and video cleanup. If worker pools are unavailable in the chosen region, run this same container continuously on a managed VM with restart supervision; a scheduled finite job is not a substitute for this infinite polling process.

Check logs for database/provider errors and monitor queue age, oldest pending support email and deletion request age. Keep a single maintenance instance initially to reduce duplicate SMTP delivery attempts; SMTP delivery is at-least-once. Worker failures must alert an operator.

## 8. Remove live demo records

The app now filters exact known legacy seed IDs and records explicitly marked `is_demo`, `is_test` or `is_sample`. “Find Your Squad” opens Players. The original seeders no longer create demo content. Genuine unmarked custom test entries cannot be identified safely by their names.

Use **Cloud Run → Jobs → Create job**, the newly built backend image, command `python`, argument `remove_demo_data.py`. Set MONGO_URL from Secret Manager, DB_NAME to the existing database and the same database networking. Set task count/parallelism to one and retries to zero for the preview. Execute and inspect the per-collection match counts in logs. No credentials or record contents are printed.

After checking the counts and taking a database backup, edit the job's arguments to `remove_demo_data.py`, `--apply` and execute again. It archives each matched document in `demo_cleanup_archive` before removing it from live catalogs. Re-running is safe for an interrupted cleanup. Financial records and the sports reference catalog are preserved. Old cleanup filenames now use this same dry-run-first command.

Run the preview again: expected catalog match counts are zero. Reload the rebuilt frontend and inspect Home, Players, Open games, courts, coaches, events, tournaments and shop. Empty lists should show empty states. If custom unmarked tests remain, identify their exact record IDs and review them separately; do not delete by guessed names or broad prefixes. The archive is restricted database data, not exposed through an API; set its retention according to your backup policy after confirming the cleanup.

## 9. Configure PayU and support email

PayU merchant console: confirm live activation, registered business/bank details and the live key/salt. The app uses these public POST endpoints:

- Return URL: `https://YOUR_API_HOST/api/payments/payu/return`
- Webhook URL: `https://YOUR_API_HOST/api/payments/payu/webhook`

Set up webhook delivery with PayU, then verify it reaches the API without Google sign-in or a redirect. Collect payments into your merchant account; club settlement remains your agreed manual process. Keep a reconciliation record of gross receipts, fees, refunds, commission and net club settlement. A support ticket does not execute a bank refund.

Use a transactional SMTP provider supporting STARTTLS on port 587. Verify the sender/domain and set SPF/DKIM as instructed by that provider. Confirm contact@kuvirasports.com can receive mail. Submit a support ticket from a test account: it should appear in admin tools, arrive in the mailbox, and change email_status to sent. Cancellation inquiries require at least four hours before the scheduled start (IST for dates without timezone). Test retry behaviour when SMTP is unavailable.

## 10. Firebase and frontend release configuration

Firebase Console → project `kuvira-bc2be` → Authentication → Sign-in method: enable Phone. Confirm SMS billing, region policy for India and web Authorized domains. Download Android `google-services.json` and iOS `GoogleService-Info.plist` from the matching registered apps.

In frontend/app.json, set `expo.android.googleServicesFile` and `expo.ios.googleServicesFile` to those files (or use EAS file-variable paths through a dynamic app config). Add `@react-native-firebase/app` and `@react-native-firebase/auth` to Expo plugins for the native build. Follow React Native Firebase's current iOS static-framework setup if building iOS; install/configure expo-build-properties for that step. The repository has dependencies but does not supply your native registration files. Do not change package IDs to rebrand the display name.

In your frontend build environment set:

```dotenv
EXPO_PUBLIC_BACKEND_URL=https://YOUR_API_HOST
EXPO_PUBLIC_AUTH_MODE=firebase
```

These are build-time values: changing a Cloud Run environment variable on an already-built static web container does not change its JavaScript. The web Dockerfile now defaults AUTH_MODE to firebase; override API URL with Docker build arguments if your existing API URL differs. The web Firebase SDK config already targets kuvira-bc2be. Rebuild and deploy web with SPA routing so `/policies/privacy` and `/policies/deletion` load directly.

For Android, register both SHA-1 and SHA-256 of the signing certificates in Firebase. For Play-distributed builds, include the Play App Signing certificate fingerprints from Play Console, not only the upload certificate. Download updated Firebase config when necessary. Test SMS login on a physical device using a native release/internal-testing build; Expo Go is not a native Firebase production test.

Publish the policy pages under your actual public domain and supply business/retention details. In Play Console provide those public privacy/deletion URLs, complete Data safety based on actual providers/data retention, and upload a signed Android App Bundle (`.aab`). A source ZIP is not a Play Store release artifact. Start with internal testing before a production rollout.

## 11. Go-live checks

Verify real OTP and return-to-action; booking success/failure/abandonment/late success; duplicate callbacks; last-slot and last-item contention; tournament last-seat contention; role isolation; 500 MiB upload with interruption/retry and analysis/source deletion; support delivery; account deletion; public policy links. Run payment scenarios in staging first, then controlled live verification with your own account. Confirm the maintenance worker continues without browser traffic. Review Cloud Logging and alerts before releasing widely.

## Official setup references

- Cloud Run secrets: https://docs.cloud.google.com/run/docs/configuring/services/secrets
- Worker pools: https://docs.cloud.google.com/run/docs/deploy-worker-pools
- Worker scaling: https://docs.cloud.google.com/run/docs/configuring/workerpools/manual-scaling
- GCS CORS: https://docs.cloud.google.com/storage/docs/using-cors
- Firebase phone auth: https://firebase.google.com/docs/auth/android/phone-auth
- React Native Firebase Expo setup: https://rnfirebase.io/#expo
