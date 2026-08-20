"""Dedicated AI Coach inference worker entry point."""
from __future__ import annotations
import asyncio
import os

from deps import db
from .jobs import run_analysis_job, run_worker_once
from .queue import JobQueue


async def main() -> None:
    poll_seconds = float(os.environ.get("AI_COACH_WORKER_POLL_SECONDS", "2"))
    batch_size = int(os.environ.get("AI_COACH_WORKER_BATCH_SIZE", "1"))
    queue = JobQueue()
    while True:
        if queue.backend == "sqs":
            message = queue.receive()
            if message and message.get("job_id"):
                await run_analysis_job(db, message["job_id"])
                if message.get("receipt_handle"):
                    queue.delete(message["receipt_handle"])
            else:
                await asyncio.sleep(poll_seconds)
        else:
            processed = await run_worker_once(db, batch_size)
            if processed == 0:
                await asyncio.sleep(poll_seconds)


if __name__ == "__main__":
    asyncio.run(main())
