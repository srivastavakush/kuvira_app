"""Durable queue adapter for AI Coach jobs."""
from __future__ import annotations
import json
import os
from typing import Any


class JobQueue:
    def __init__(self) -> None:
        self.backend = os.environ.get("AI_COACH_QUEUE_BACKEND", "local").lower()
        self.queue_url = os.environ.get("AI_COACH_SQS_QUEUE_URL", "")
        self._client = None
        if self.backend == "sqs":
            if not self.queue_url: raise RuntimeError("AI_COACH_SQS_QUEUE_URL is required for SQS")
            import boto3
            self._client = boto3.client("sqs", region_name=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"))
        elif self.backend != "local":
            raise RuntimeError(f"Unsupported AI_COACH_QUEUE_BACKEND: {self.backend}")

    def enqueue(self, job_id: str) -> None:
        if self.backend == "sqs":
            assert self._client is not None
            self._client.send_message(QueueUrl=self.queue_url, MessageBody=json.dumps({"job_id": job_id}))
