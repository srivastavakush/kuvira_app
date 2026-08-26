# Firebase Phone Authentication

Kuvira now uses Firebase Phone Authentication for production SMS OTP verification while keeping the existing FastAPI JWT and backend RBAC model.

## Flow

1. React Native calls Firebase `signInWithPhoneNumber`.
2. Firebase sends and verifies the SMS OTP.
3. The app gets a Firebase ID token from the verified Firebase user.
4. The app sends that ID token to `POST /api/auth/otp/verify` in the existing `otp` field.
5. FastAPI verifies the Firebase ID token with the Firebase Admin SDK and checks that its verified phone number matches `mobile`.
6. Kuvira creates/finds the MongoDB user and returns the existing Kuvira JWT.
7. Existing protected APIs continue using the Kuvira JWT and backend RBAC.

Firebase ID-token verification is performed server-side as recommended by Firebase. See the official Firebase documentation for ID-token verification and revocation checking.

## Firebase Console

Create/select the Firebase project used by Kuvira and enable:

- Authentication → Sign-in method → Phone
- SMS region policy allowing India (`IN`)

Register the existing native app identifiers from `frontend/app.json`:

- Android: `com.emergent.kuvirasportsapp.zwrxyl`
- iOS: `com.emergent.kuvirasportsapp.zwrxyl`

Download the native configuration files into `frontend/`:

- `google-services.json`
- `GoogleService-Info.plist`

These files are intentionally ignored by Git.

## Local development

For React Native Firebase phone auth, use a native development build rather than Expo Go.

From `frontend/` install dependencies and create a development build after adding the Firebase native configuration files.

## Backend configuration

Set:

```text
OTP_PROVIDER=firebase
```

For local backend development, Firebase Admin can use:

```text
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json
```

On Cloud Run, prefer Google Application Default Credentials/service identity rather than shipping a service-account JSON file with the container.

## Existing test mode

When `OTP_PROVIDER` is not `firebase` and the backend is not production, the existing mock OTP behavior remains available for backend regression tests. The mock code is `123456`.

Do not enable the mock provider in production.
