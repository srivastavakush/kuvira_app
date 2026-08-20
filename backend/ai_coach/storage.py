"""Durable video object storage abstraction.

Production backends: GCS or S3. Local filesystem is development-only.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import BinaryIO


class ObjectStorage:
    def __init__(self) -> None:
        self.backend = os.environ.get("AI_COACH_STORAGE_BACKEND", "local").lower()
        self.bucket = os.environ.get("AI_COACH_STORAGE_BUCKET", "")
        self.prefix = os.environ.get("AI_COACH_STORAGE_PREFIX", "ai-coach/videos").strip("/")
        self.region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
        self._client = None
        if self.backend == "s3":
            if not self.bucket:
                raise RuntimeError("AI_COACH_STORAGE_BUCKET is required for S3 storage")
            import boto3
            self._client = boto3.client("s3", region_name=self.region)
        elif self.backend == "gcs":
            if not self.bucket:
                raise RuntimeError("AI_COACH_STORAGE_BUCKET is required for GCS storage")
            from google.cloud import storage as gcs_storage
            self._client = gcs_storage.Client()
            self._bucket = self._client.bucket(self.bucket)
        elif self.backend != "local":
            raise RuntimeError(f"Unsupported AI_COACH_STORAGE_BACKEND: {self.backend}")

    def key(self, video_id: str, extension: str = ".mp4") -> str:
        extension = extension if extension.startswith(".") else f".{extension}"
        return f"{self.prefix}/{video_id}{extension}"

    def put(self, fileobj: BinaryIO, video_id: str, extension: str = ".mp4", max_bytes: int | None = None) -> dict:
        key = self.key(video_id, extension)
        total = 0
        if self.backend == "s3":
            assert self._client is not None
            self._client.upload_fileobj(fileobj, self.bucket, key, ExtraArgs={"ContentType": "video/mp4"})
            return {"backend": "s3", "bucket": self.bucket, "object_key": key}
        if self.backend == "gcs":
            blob = self._bucket.blob(key)
            blob.chunk_size = 8 * 1024 * 1024
            blob.upload_from_file(fileobj, rewind=False, content_type="video/mp4")
            return {"backend": "gcs", "bucket": self.bucket, "object_key": key}
        upload_dir = Path(os.environ.get("AI_COACH_UPLOAD_DIR", "/app/backend/uploads/videos"))
        upload_dir.mkdir(parents=True, exist_ok=True)
        path = upload_dir / f"{video_id}{extension}"
        try:
            with path.open("wb") as out:
                while True:
                    chunk = fileobj.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if max_bytes and total > max_bytes:
                        raise ValueError("video exceeds configured size limit")
                    out.write(chunk)
        except Exception:
            try: path.unlink()
            except FileNotFoundError: pass
            raise
        return {"backend": "local", "path": str(path), "size_bytes": total}

    def download_to(self, storage: dict, destination: str) -> str:
        backend = storage.get("backend")
        if backend == "s3":
            assert self._client is not None
            self._client.download_file(storage["bucket"], storage["object_key"], destination)
            return destination
        if backend == "gcs":
            blob = self._bucket.blob(storage["object_key"])
            blob.download_to_filename(destination)
            return destination
        path = storage.get("path") or storage.get("storage_path")
        if not path or not os.path.exists(path):
            raise FileNotFoundError("Stored video object is unavailable")
        return path

    def delete(self, storage: dict) -> None:
        backend = storage.get("backend")
        if backend == "s3":
            assert self._client is not None
            self._client.delete_object(Bucket=storage["bucket"], Key=storage["object_key"])
        elif backend == "gcs":
            self._bucket.blob(storage["object_key"]).delete()
        else:
            path = storage.get("path") or storage.get("storage_path")
            if path:
                try: os.unlink(path)
                except FileNotFoundError: pass
