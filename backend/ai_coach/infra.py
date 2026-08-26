"""Small, dependency-free production guards for AI Coach.

These primitives are intentionally process-local. They provide safe defaults in
single-instance deployments; distributed deployments should replace them with
Redis/Cloud Tasks equivalents without changing endpoint contracts.
"""
from __future__ import annotations
import asyncio
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = max(1, limit)
        self.window_seconds = max(1, window_seconds)
        self._events: Dict[str, Deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self._events[key]
        cutoff = now - self.window_seconds
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True


class AsyncRetry:
    def __init__(self, attempts: int = 3, base_delay: float = 0.5) -> None:
        self.attempts = max(1, attempts)
        self.base_delay = max(0.0, base_delay)

    async def run(self, fn):
        last = None
        for attempt in range(self.attempts):
            try:
                return await fn()
            except Exception as exc:
                last = exc
                if attempt + 1 >= self.attempts:
                    raise
                await asyncio.sleep(self.base_delay * (2 ** attempt))
        raise last
