"""OTP service — environment-gated. Development uses a mock code; production
requires a real SMS provider (Twilio Verify). Includes in-memory rate limiting
and attempt caps (note: for multi-instance production, back this with Redis).
"""
import time
import hashlib
from typing import Dict, Tuple

from deps import (
    OTP_PROVIDER, IS_PROD, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
    TWILIO_VERIFY_SERVICE, KuviraError, log,
)

MOCK_OTP = "123456"

# --- simple in-memory limiters (per-process) --------------------------------
_send_log: Dict[str, list] = {}      # mobile -> [timestamps]
_verify_attempts: Dict[str, int] = {}  # mobile -> attempts since last send
SEND_WINDOW_SEC = 3600
SEND_MAX = 5           # max OTP sends per hour per mobile
VERIFY_MAX = 5         # max verify attempts per issued OTP


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
    """Return dict with `sent` and, in non-prod, a `demo_otp` hint."""
    check_send_rate(mobile)
    if OTP_PROVIDER == "twilio":
        if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE):
            raise KuviraError(500, "OTP_PROVIDER_MISCONFIGURED", "OTP provider not configured")
        try:
            client = _twilio_client()
            client.verify.v2.services(TWILIO_VERIFY_SERVICE).verifications.create(to=mobile, channel="sms")
        except Exception:
            log.exception("Twilio send_otp failed")
            raise KuviraError(502, "OTP_SEND_FAILED", "Could not send OTP. Please try again.")
        return {"sent": True}
    # mock provider (development / staging)
    if IS_PROD:
        raise KuviraError(500, "OTP_PROVIDER_MISCONFIGURED", "Mock OTP is disabled in production")
    return {"sent": True, "demo_otp": MOCK_OTP}


async def verify_otp(mobile: str, code: str) -> bool:
    register_attempt(mobile)
    if OTP_PROVIDER == "twilio":
        try:
            client = _twilio_client()
            check = client.verify.v2.services(TWILIO_VERIFY_SERVICE).verification_checks.create(to=mobile, code=code)
            return check.status == "approved"
        except Exception:
            log.exception("Twilio verify_otp failed")
            raise KuviraError(502, "OTP_VERIFY_FAILED", "Could not verify OTP. Please try again.")
    # mock
    if IS_PROD:
        raise KuviraError(500, "OTP_PROVIDER_MISCONFIGURED", "Mock OTP is disabled in production")
    return code == MOCK_OTP
