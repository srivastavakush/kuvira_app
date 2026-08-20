"""Dedicated AI Coach inference worker entry point.

Run this as a separate process/container in production. Jobs are durable in
MongoDB and are atomically claimed by workers, so a web-process restart does
not lose queued work.
"""
from __future__ import annotations
import asyncio
import os

from deps import db
from .jobs import run_worker_once
from .model_preflight import validate_artifacts


async def main() -> None:
    if os.environ.get("AI_COACH_PRODUCTION_MODE", "false").lower() == "true":
        preflight = validate_artifacts(require_production=True)
        if not preflight["ready"]:
            raise RuntimeError(
                "AI Coach production model preflight failed: "
                + "; ".join(preflight["errors"])
            )
    poll_seconds = float(os.environ.get("AI_COACH_WORKER_POLL_SECONDS", "2"))
    batch_size = int(os.environ.get("AI_COACH_WORKER_BATCH_SIZE", "1"))
    while True:
        processed = await run_worker_once(db, batch_size)
        if processed == 0:
            await asyncio.sleep(poll_seconds)


if __name__ == "__main__":
    asyncio.run(main())
