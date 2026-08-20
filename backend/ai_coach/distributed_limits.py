"""Mongo-backed fixed-window rate limiter for multi-replica deployments.

This avoids a new runtime dependency while remaining shared across application
instances because counters live in MongoDB. It is intentionally conservative:
a denied write is treated as allowed only when the database is unavailable to
avoid turning an outage into a total application outage; production can choose
to fail closed with AI_COACH_RATE_LIMIT_FAIL_CLOSED=true.
"""
from __future__ import annotations
import os
import time
from typing import Any


class MongoRateLimiter:
    def __init__(self, db: Any, *, limit: int, window_seconds: int, collection: str = "ai_coach_rate_limits"):
        self.db = db
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self.collection = getattr(db, collection)
        self._indexes_ready = False

    async def _ensure_index(self) -> None:
        if self._indexes_ready:
            return
        await self.collection.create_index("expires_at", expireAfterSeconds=0)
        await self.collection.create_index([("key", 1), ("window", 1)], unique=True)
        self._indexes_ready = True

    async def allow(self, key: str) -> bool:
        await self._ensure_index()
        now = int(time.time())
        window = now // self.window_seconds
        document_key = f"{self.limit}:{self.window_seconds}:{key}"
        try:
            doc = await self.collection.find_one_and_update(
                {"key": document_key, "window": window},
                {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now + self.window_seconds + 5}},
                upsert=True,
                return_document=True,
            )
            return int(doc.get("count", self.limit + 1)) <= self.limit
        except Exception:
            return os.environ.get("AI_COACH_RATE_LIMIT_FAIL_CLOSED", "false").lower() == "false"
