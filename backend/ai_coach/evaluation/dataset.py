"""Golden-video manifest schema/loader.

The repository may ship sample manifests, but evaluation never fabricates a
passing result when actual media/labels are unavailable.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List


def load_dataset_manifest(path: str) -> Dict[str, Any]:
    manifest_path = Path(path)
    if not manifest_path.exists():
        raise FileNotFoundError(f"evaluation manifest not found: {path}")
    if manifest_path.suffix.lower() == ".json":
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        raise ValueError("only JSON evaluation manifests are currently supported")
    if not isinstance(data, dict) or not isinstance(data.get("videos"), list):
        raise ValueError("manifest must be an object with a videos list")
    required = {"id", "video_path", "sport", "labels_path"}
    for item in data["videos"]:
        if not isinstance(item, dict) or not required.issubset(item):
            raise ValueError(f"each manifest item requires {sorted(required)}")
    return data
