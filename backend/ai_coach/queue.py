"""Durable queue adapter for AI Coach jobs.

MongoDB remains the source of truth for job state; SQS is the durable dispatch
signal. Messages are deleted only after the worker has claimed the Mongo job.
"""
from __future__ import annotations
import json
import os
from typing import Any, Optional


class JobQueue:
    def __init__(self) -> None:
        self.backend = os.environ.get("AI_COACH_QUEUE_BACKEND", "local").lower()
        self.queue_url = os.environ.get("AI_COACH_SQS_QUEUE_URL", "")
        self.wait_seconds = int(os.environ.get("AI_COACH_SQS_WAIT_SECONDS", "10"))
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

    def receive(self) -> Optional[dict[str, Any]]:
        if self.backend != "sqs":
            return None
        assert self._client is not None
        response = self._client.receive_message(QueueUrl=self.queue_url, MaxNumberOfMessages=1, WaitTimeSeconds=self.wait_seconds, VisibilityTimeout=int(os.environ.get("AI_COACH_SQS_VISIBILITY_TIMEOUT", "1800")))
        messages = response.get("Messages") or []
        if not messages:
            return None
        message = messages[0]
        try:
            body = json.loads(message.get("Body", "{}"))
        except json.JSONDecodeError:
            body = {}
        return {"job_id": body.get("job_id"), "receipt_handle": message.get("ReceiptHandle")}

    def delete(self, receipt_handle: str) -> None:
        if self.backend == "sqs" and receipt_handle:
            assert self._client is not None
            self._client.delete_message(QueueUrl=self.queue_url, ReceiptHandle=receipt_handle)
