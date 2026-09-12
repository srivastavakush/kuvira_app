# Production deployment checklist

The API should not be deployed with the local `.env`. Copy the variable names
from `.env.example` into Secret Manager / Cloud Run configuration and keep all
secret values out of source control.

## Required Google Cloud resources

1. A private GCS bucket in the same regional area as the API and Vertex AI.
   Use `asia-south1` for the current India-oriented configuration unless the
   team selects another supported region.
2. Enable Cloud Storage and Vertex AI APIs for the selected project.
3. Give the API and worker service accounts `roles/storage.objectAdmin` on the
   video bucket and `roles/aiplatform.user` on the project. Do not make video
   objects public.
4. Deploy two services from the same backend image: `api` starts `server:app`;
   `ai-coach-worker` runs `python -m ai_coach.worker`. Set
   `AI_COACH_QUEUE_BACKEND=worker` on both. The API inserts a durable Mongo job
   record; the worker claims it atomically, so an API restart cannot lose a
   submitted analysis.
5. Create the Atlas Vector Search index described in `AI_COACH_RAG.md`, set
   `AI_COACH_VECTOR_INDEX`, and run the admin knowledge refresh before enabling
   AI Coach traffic. The API can fall back to a bounded scan while the index is
   building, but this is not suitable for a large production corpus.

## Validation before traffic

`APP_ENV=production` causes startup to fail if mock OTP/payment, wildcard CORS,
local uploads, process-local rate limits, or non-Vertex AI settings are present.
Confirm `/api/readiness` checks MongoDB, then test an authenticated upload with
a small non-sensitive video. Vertex receives the private `gs://` URI; it never
needs a public download link.

## Still required before selling or booking for money

The existing database records mock payments. Select and configure a real Indian
gateway (for example PayU or Razorpay), create a server-side payment intent,
verify its webhook signature, and only then mark a booking/order/registration
as paid. The new production guard intentionally prevents a deployment from
silently charging nothing while showing users a successful payment.

## PayU Hosted Checkout

Set `PAYMENT_PROVIDER=payu`, `PAYU_MODE=test` (or `live`), merchant key, salt,
and a public HTTPS `PAYU_CALLBACK_BASE_URL`. In PayU Dashboard configure the
webhook URL as `https://your-api.example.com/api/payments/payu/webhook`.
The return URL is generated server-side at `/api/payments/payu/return`.
Both routes validate the reverse SHA-512 hash and call PayU Verify Payment
before changing a booking, tournament registration, order, or coach session to
paid/confirmed. A local `localhost` callback cannot receive a PayU callback;
use a secure tunnel only with test credentials.
