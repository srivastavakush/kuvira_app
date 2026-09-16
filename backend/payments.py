"""PayU Hosted Checkout integration.

Secrets stay server-side.  A client receives only a short-lived opaque checkout
URL; it never receives the merchant salt or any hash input.
"""
from __future__ import annotations

import hashlib
import hmac
import html
import os
import secrets
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from deps import KuviraError, PAYMENT_PROVIDER, gen_id


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _amount(value: Any) -> str:
    try:
        amount = Decimal(str(value)).quantize(Decimal('0.01'))
        if not amount.is_finite() or amount < 0: raise ValueError('Invalid amount')
        return f"{amount:.2f}"
    except (InvalidOperation, ValueError):
        raise KuviraError(400, "INVALID_PAYMENT_AMOUNT", "Payment amount is invalid")


class PayU:
    def __init__(self) -> None:
        self.mode = os.environ.get("PAYU_MODE", "test").strip().lower()
        self.key = os.environ.get("PAYU_MERCHANT_KEY", "").strip()
        self.salt = os.environ.get("PAYU_MERCHANT_SALT", "").strip()
        self.callback_base = os.environ.get("PAYU_CALLBACK_BASE_URL", "").rstrip("/")
        self.checkout_endpoint = os.environ.get(
            "PAYU_CHECKOUT_URL",
            "https://secure.payu.in/_payment" if self.mode == "live" else "https://test.payu.in/_payment",
        )
        self.verify_endpoint = os.environ.get(
            "PAYU_VERIFY_URL",
            "https://info.payu.in/merchant/postservice.php?form=2" if self.mode == "live" else "https://test.payu.in/merchant/postservice?form=2",
        )
        if not self.key or not self.salt or not self.callback_base:
            raise KuviraError(503, "PAYU_NOT_CONFIGURED", "Payments are not configured yet")

    def _digest(self, value: str) -> str:
        return hashlib.sha512(value.encode("utf-8")).hexdigest()

    def request_hash(self, fields: dict[str, str]) -> str:
        # PayU Hosted Checkout v1 request sequence.
        plain = "|".join([
            self.key, fields["txnid"], fields["amount"], fields["productinfo"],
            fields["firstname"], fields["email"], fields.get("udf1", ""),
            fields.get("udf2", ""), fields.get("udf3", ""), fields.get("udf4", ""),
            fields.get("udf5", ""), "", "", "", "", "", self.salt,
        ])
        return self._digest(plain)

    def valid_response_hash(self, payload: dict[str, Any]) -> bool:
        received = str(payload.get("hash") or "")
        if not received or str(payload.get("key") or "") != self.key:
            return False
        status = str(payload.get("status") or "")
        base = (
            f"{self.salt}|{status}||||||{payload.get('udf5', '')}|{payload.get('udf4', '')}|"
            f"{payload.get('udf3', '')}|{payload.get('udf2', '')}|{payload.get('udf1', '')}|"
            f"{payload.get('email', '')}|{payload.get('firstname', '')}|{payload.get('productinfo', '')}|"
            f"{payload.get('amount', '')}|{payload.get('txnid', '')}|{self.key}"
        )
        additional = payload.get("additionalCharges") or payload.get("additional_charges")
        if additional:
            base = f"{additional}|{base}"
        return hmac.compare_digest(self._digest(base), received)

    async def verify(self, txnid: str) -> dict[str, Any]:
        command = "verify_payment"
        hash_value = self._digest(f"{self.key}|{command}|{txnid}|{self.salt}")
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(self.verify_endpoint, data={
                    "key": self.key, "command": command, "var1": txnid, "hash": hash_value,
                })
                response.raise_for_status()
                data = response.json()
        except Exception as exc:
            raise KuviraError(502, "PAYU_VERIFICATION_FAILED", "Could not verify the payment with PayU") from exc
        details = (data.get("transaction_details") or {}).get(txnid) or {}
        return details if isinstance(details, dict) else {}

    def checkout_fields(self, txn: dict[str, Any]) -> dict[str, str]:
        resource = txn["resource"]
        fields = {
            "key": self.key,
            "txnid": txn["txnid"],
            "amount": txn["amount"],
            "productinfo": txn["productinfo"],
            "firstname": txn["customer"]["firstname"],
            "email": txn["customer"]["email"],
            "phone": txn["customer"]["phone"],
            "surl": f"{self.callback_base}/api/payments/payu/return",
            "furl": f"{self.callback_base}/api/payments/payu/return",
            "udf1": txn["id"],
            "udf2": resource["kind"],
            "udf3": resource["id"],
            "udf4": "",
            "udf5": "",
        }
        fields["hash"] = self.request_hash(fields)
        return fields


def _payu() -> PayU:
    if PAYMENT_PROVIDER != "payu":
        raise KuviraError(503, "PAYMENTS_NOT_ENABLED", "Online payments are not enabled")
    return PayU()


async def create_checkout(
    db: Any, *, user: dict[str, Any], resource: dict[str, Any], amount: Any,
    productinfo: str, customer_email: str | None = None, session=None,
) -> dict[str, Any]:
    from reservations import expires_at
    payu = _payu()
    email = (customer_email or user.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise KuviraError(400, "EMAIL_REQUIRED", "Enter an email address to continue to payment")
    txnid = f"KP{secrets.token_hex(12)}"[:32]
    payment_id, token = gen_id(), secrets.token_urlsafe(32)
    txn = {
        "id": payment_id, "txnid": txnid, "provider": "payu", "mode": payu.mode,
        "expires_at": expires_at(), "status": "initiated", "amount": _amount(amount), "productinfo": productinfo[:100],
        "user_id": user["id"], "customer": {
            "firstname": (user.get("name") or "Player")[:60], "email": email,
            "phone": str(user.get("mobile") or "")[:20],
        },
        "resource": resource, "checkout_token": token, "created_at": _now(), "updated_at": _now(),
    }
    await db.payment_transactions.insert_one(txn.copy(), **({"session":session} if session else {}))
    return {
        "payment": {"id": payment_id, "txnid": txnid, "status": "initiated", "amount": txn["amount"]},
        "checkout_url": f"/api/payments/checkout/{payment_id}?token={token}",
    }


def checkout_html(action: str, fields: dict[str, str]) -> str:
    inputs = "".join(
        f'<input type="hidden" name="{html.escape(key)}" value="{html.escape(value)}">'
        for key, value in fields.items()
    )
    return f"""<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Redirecting to PayU</title></head><body><p>Redirecting securely to PayU…</p><form id=\"payu\" method=\"post\" action=\"{html.escape(action)}\">{inputs}</form><script>document.getElementById('payu').submit()</script></body></html>"""


async def process_callback(db: Any, payload: dict[str, Any]) -> dict[str, Any]:
    payu = _payu()
    txn = await db.payment_transactions.find_one({"txnid": str(payload.get("txnid") or "")}, {"_id": 0})
    if not txn:
        raise KuviraError(404, "PAYMENT_NOT_FOUND", "Unknown payment transaction")
    # Never mutate stored financial state from an unauthenticated callback.
    if not payu.valid_response_hash(payload):
        raise KuviraError(400, "PAYU_HASH_INVALID", "Payment callback could not be verified")
    if _amount(payload.get("amount")) != txn["amount"]:
        raise KuviraError(400, "PAYU_AMOUNT_MISMATCH", "Payment amount does not match")
    return await reconcile_payment(db, txn)


async def reconcile_payment(db, txn):
    from reservations import atomic, release
    verification = await _payu().verify(txn['txnid'])
    status = str(verification.get('status', '')).lower()
    if status == 'success':
        verified_amount = verification.get('amt', verification.get('amount'))
        if verified_amount is None or _amount(verified_amount) != txn['amount']:
            raise KuviraError(409, 'PAYU_AMOUNT_MISMATCH', 'Verified payment amount does not match')
    async def operation(session):
        current = await db.payment_transactions.find_one({'id':txn['id']}, session=session)
        if current['status'] == 'succeeded':
            return {'payment': {'id':txn['id'],'status':'succeeded'}, 'resource':None}
        if status == 'success':
            resource = await fulfill_succeeded_payment(db, current, session)
            await db.payment_transactions.update_one({'id':txn['id']}, {'$set':{
                'status':'succeeded','verification':verification,'updated_at':_now(),'fulfilled_at':_now(),
                'requires_review':resource is None,'refund_status':'review_required' if resource is None else 'none'}}, session=session)
            return {'payment':{'id':txn['id'],'status':'succeeded'},'resource':resource}
        expired = current.get('expires_at', '') and current['expires_at'] < _now()
        failed = status in ('failure','failed','dropped','bounced')
        # A missing gateway record after the checkout window closes is an abandoned checkout.
        if failed or (expired and (not verification or status == 'not found')):
            await release(db, current['resource'], session)
            state = 'failed' if failed else 'expired'
        else:
            state = current['status'] if current['status'] in ('failed','expired') else 'verification_pending'
        await db.payment_transactions.update_one({'id':txn['id']}, {'$set':{'status':state,'updated_at':_now()}}, session=session)
        return {'payment':{'id':txn['id'],'status':state},'resource':None}
    return await atomic(db, operation)


async def expire_holds(db, limit=30):
    """Run in maintenance, outside user requests; failures keep reservations intact."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc)-timedelta(minutes=20)).isoformat()
    docs = await db.payment_transactions.find({'status':{'$in':['initiated','verification_pending']},'created_at':{'$lt':cutoff}}, {'_id':0}).limit(limit).to_list(limit)
    for txn in docs:
        if not txn.get('expires_at'):
            await db.payment_transactions.update_one({'id':txn['id']},{'$set':{'expires_at':cutoff}})
            txn['expires_at']=cutoff
        try: await reconcile_payment(db,txn)
        except Exception: pass  # Retry later; never free a slot on a network error.


async def fulfill_succeeded_payment(db, txn, session):
    resource = txn['resource']; kind, rid = resource['kind'], resource['id']
    collection = {'booking':db.bookings,'coach_session':db.coach_sessions,'order':db.orders,
                  'tournament_registration':db.tournament_registrations,
                  'event_registration':db.event_registrations}.get(kind)
    if collection is None:
        raise KuviraError(400,'UNKNOWN_PAYMENT_RESOURCE','Unsupported payment resource')
    item = await collection.find_one({'id':rid},session=session)
    # A late payment for a released/cancelled reservation requires support/refund review.
    if not item or item.get('status') not in ('pending_payment','confirmed'):
        return None
    if item['status']=='confirmed': return {k:v for k,v in item.items() if k!='_id'}
    payment={'provider':'payu','status':'paid','amount':txn['amount'],'payment_id':txn['id'],'txnid':txn['txnid']}
    await collection.update_one({'id':rid,'status':'pending_payment'},{'$set':{'status':'confirmed','payment':payment,'confirmed_at':_now()}},session=session)
    if kind=='tournament_registration':
        changes={'participants_count':1}
        if item.get('inventory_reserved'):changes['reserved_count']=-1
        await db.tournaments.update_one({'id':item['tournament_id']},{'$inc':changes},session=session)
    if kind=='event_registration':
        changes={'participants_count':1}
        if item.get('inventory_reserved'):changes['reserved_count']=-1
        await db.events.update_one({'id':item['event_id']},{'$inc':changes},session=session)
    # Do not wipe a cart the customer may have edited while checkout was open.
    return {'id':rid,'status':'confirmed','payment':payment}
