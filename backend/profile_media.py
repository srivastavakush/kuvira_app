"""Profile-avatar storage with safe local development and private GCS support."""
from __future__ import annotations

import io
import os
import uuid
from pathlib import Path
from typing import BinaryIO


MAX_AVATAR_BYTES = 5 * 1024 * 1024
_IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
    b"\x89PNG\r\n\x1a\n": ("image/png", ".png"),
    b"RIFF": ("image/webp", ".webp"),
}


def _image_kind(data: bytes) -> tuple[str, str]:
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return _IMAGE_SIGNATURES[b"RIFF"]
    for signature, result in _IMAGE_SIGNATURES.items():
        if data.startswith(signature):
            return result
    raise ValueError("Choose a JPG, PNG, or WebP image")


class ProfileMediaStorage:
    """Stores only user-selected, publicly displayable profile avatars.

    Local disk is intentionally development-only. Production can use the same
    private GCS bucket as the AI Coach; the API streams avatar bytes so the
    bucket itself never needs public access.
    """

    def __init__(self) -> None:
        self.backend = os.environ.get("PROFILE_MEDIA_STORAGE_BACKEND", "local").lower()
        self.bucket = os.environ.get("PROFILE_MEDIA_BUCKET") or os.environ.get("AI_COACH_STORAGE_BUCKET", "")
        self.prefix = os.environ.get("PROFILE_MEDIA_PREFIX", "profiles/avatars").strip("/")
        self._bucket = None
        if self.backend == "gcs":
            if not self.bucket:
                raise RuntimeError("PROFILE_MEDIA_BUCKET is required when profile media uses GCS")
            from google.cloud import storage as gcs_storage
            self._bucket = gcs_storage.Client().bucket(self.bucket)
        elif self.backend != "local":
            raise RuntimeError(f"Unsupported PROFILE_MEDIA_STORAGE_BACKEND: {self.backend}")

    def put(self, source: BinaryIO, user_id: str) -> dict:
        data = source.read(MAX_AVATAR_BYTES + 1)
        if len(data) > MAX_AVATAR_BYTES:
            raise ValueError("Profile photo must be 5 MB or smaller")
        if not data:
            raise ValueError("Profile photo is empty")
        content_type, extension = _image_kind(data[:16])
        asset_id = uuid.uuid4().hex
        if self.backend == "gcs":
            key = f"{self.prefix}/{user_id}/{asset_id}{extension}"
            assert self._bucket is not None
            self._bucket.blob(key).upload_from_file(io.BytesIO(data), content_type=content_type)
            return {"backend": "gcs", "bucket": self.bucket, "object_key": key, "asset_id": asset_id, "content_type": content_type}

        directory = Path(os.environ.get("PROFILE_MEDIA_UPLOAD_DIR", str(Path(__file__).parent / "uploads" / "avatars")))
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{user_id}-{asset_id}{extension}"
        path.write_bytes(data)
        return {"backend": "local", "path": str(path), "asset_id": asset_id, "content_type": content_type}

    def read(self, reference: dict) -> bytes:
        if reference.get("backend") == "gcs":
            if self._bucket is None:
                raise RuntimeError("Profile media storage is unavailable")
            return self._bucket.blob(reference["object_key"]).download_as_bytes()
        path = Path(reference.get("path") or "")
        if not path.is_file():
            raise FileNotFoundError("Profile photo is unavailable")
        return path.read_bytes()

    def delete(self, reference: dict | None) -> None:
        if not reference:
            return
        if reference.get("backend") == "gcs":
            if self._bucket is not None:
                self._bucket.blob(reference["object_key"]).delete()
            return
        try:
            Path(reference.get("path") or "").unlink()
        except FileNotFoundError:
            pass
