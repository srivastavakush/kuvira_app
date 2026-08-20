"""Durable video object storage abstraction.

S3-compatible storage is the production path. Local filesystem storage remains
available only when AI_COACH_STORAGE_BACKEND=local for development/tests.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import BinaryIO


class ObjectStorage:
    def __init__(self) -> None:
        self.backend = os.environ.get("AI_COACH_STORAGE_BACKEND", "local").lower()
        self.bucket = os.environ.get("AI_COACH_S3_BUCKET", "")
        self.prefix = os.environ.get("AI_COACH_S3_PREFIX", "ai-coach/videos").strip("/")
        self.region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
        self._client = None
        if self.backend == "s3":
            if not self.bucket:
                raise RuntimeError("AI_COACH_S3_BUCKET is required for S3 storage")
            import boto3
            self._client = boto3.client("s3", region_name=self.region)
        elif self.backend != "local":
            raise RuntimeError(f"Unsupported AI_COACH_STORAGE_BACKEND: {self.backend}")

    def key(self, video_id: str, extension: str = ".mp4") -> str:
        extension = extension if extension.startswith(".") else f".{extension}"
        return f"{self.prefix}/{video_id}{extension}"

    def put(self, fileobj: BinaryIO, video_id: str, extension: str = ".mp4") -> dict:
        key = self.key(video_id, extension)
        if self.backend == "s3":
            assert self._client is not None
            self._client.upload_fileobj(fileobj, self.bucket, key, ExtraArgs={"ContentType": "video/mp4"})
            return {"backend": "s3", "bucket": self.bucket, "object_key": key}
        upload_dir = Path(os.environ.get("AI_COACH_UPLOAD_DIR", "/app/backend/uploads/videos"))
        upload_dir.mkdir(parents=True, exist_ok=True)
        path = upload_dir / f"{video_id}{extension}"
        with path.open("wb") as out:
            while True:
                chunk = fileobj.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        return {"backend": "local", "path": str(path)}

    def download_to(self, storage: dict, destination: str) -> str:
        if storage.get("backend") == "s3":
            assert self._client is not None
            self._client.download_file(storage["bucket"], storage["object_key"], destination)
            return destination
        path = storage.get("path") or storage.get("storage_path")
        if not path or not os.path.exists(path):
            raise FileNotFoundError("Stored video object is unavailable")
        return path

    def delete(self, storage: dict) -> None:
        if storage.get("backend") == "s3":
            assert self._client is not None
            self._client.delete_object(Bucket=storage["bucket"], Key=storage["object_key"])
            return
        path = storage.get("path") or storage.get("storage_path")
        if path:
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
