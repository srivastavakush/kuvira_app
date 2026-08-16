"""Phone verification abstraction for Kuvira.

Development can keep using the deterministic mock OTP. Production can use
Firebase phone authentication: the mobile app verifies the SMS with Firebase
and sends the resulting Firebase ID token here for server-side verification.
"""
import time
from typing import Dict

from deps import (
    OTP_PROVIDER, IS_PROD, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE, KuviraError, log,
)

MOCK_OTP = "123456"

_send_log: Dict[str, list] = {}
_verify_attempts: Dict[str, int] = {}
SEND_WINDOW_SEC = 3600
SEND_MAX = 5
VERIFY_MAX = 5


def _now() -> float:
    return time.time()


def check_send_rate(mobile: str):
    stamps = [t for t in _send_log.get(mobile, []) if _now() - t < SEND_WINDOW_SEC]
    if len(stamps) >= SEND_MAX:
        raise KuviraError(429, "OTP_RATE_LIMITED", "Too many OTP requests. Try again later.")
    stamps.append(_now())
    _send_log[mobile] = stamps
    _verify_attempts[mobile] = 0


def register_attempt(mobile: str):
    _verify_attempts[mobile] = _verify_attempts.get(mobile, 0) + 1
    if _verify_attempts[mobile] > VERIFY_MAX:
        raise KuviraError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many attempts. Request a new code.")


def _twilio_client():
    from twilio.rest import Client
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


async def send_otp(mobile: str) -> dict:
    """Legacy server-side OTP start for Twilio/mock compatibility.

    The Firebase production client sends the SMS itself, so the mobile app does
    not call this endpoint when OTP_PROVIDER=firebase.
    """
    check_send_rate(mobile)
    if OTP_PROVIDER == "firebase":
        return {"sent": True, "provider": "firebase"}

    if OTP_PROVIDER == "twilio":
        if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE):
            raise KuviraError(500, "OTP_PROVIDER_MISCONFIGURED", "OTP provider not configured")
        try:
            client = _twilio_client()
            client.verify.v2.services(TWILIO_VERIFY_SERVICE).verifications.create(
                to=mobile, channel="sms"
            )
        except Exception:
            log.exception("Twilio send_otp failed")
            raise KuviraError(502, "OTP_SEND_FAILED", "Could not send OTP. Please try again.")
        return {"sent": True}

    if IS_PROD:
        raise KuviraError(500, "OTP_PROVIDER_MISCONFIGURED", "Mock OTP is disabled in production")
    return {"sent": True, "demo_otp": MOCK_OTP}


async def verify_otp(mobile: str, code: str) -> bool:
    register_attempt(mobile)

    if OTP_PROVIDER == "firebase":
        from firebase_auth import verify_id_token

        decoded = verify_id_token(code)
        verified_phone = decoded.get("phone_number")
        if verified_phone != mobile:
            raise KuviraError(401, "PHONE_MISMATCH", "Firebase phone number does not match the login number")
        return True

    if OTP_PROVIDER == "twilio":
        try:
            client = _twilio_client()
            check = client.verify.v2.services(TWILIO_VERIFY_SERVICE).verification_checks.create(
                to=mobile, code=code
            )
            return check.status == "approved"
        except Exception:
            log.exception("Twilio verify_otp failed")
            raise KuviraError(502, "OTP_VERIFY_FAILED", "Could not verify OTP. Please try again.")

    if IS_PROD:
        raise KuviraError(500, "OTP_PROVIDER_MISCONFIGURED", "Mock OTP is disabled in production")
    return code == MOCK_OTP
