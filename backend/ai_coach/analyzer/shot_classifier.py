"""Temporal shot-classification adapter.

Supported adapter contract: a configured Python module/object may expose
`classify(sequence, fps, sport)` and return a list of typed shot events. The
adapter is optional and the system fails closed when it is absent or invalid.
"""
from __future__ import annotations

import importlib
import os
from typing import Any, Dict, List

from .components import ShotClassifier


class ConfigurableShotClassifier(ShotClassifier):
    def __init__(self) -> None:
        self.adapter_path = os.environ.get("AI_COACH_SHOT_ADAPTER", "")
        self._adapter = None

    def _load(self):
        if self._adapter is not None:
            return self._adapter
        if not self.adapter_path:
            return None
        try:
            module_name, attr_name = self.adapter_path.rsplit(":", 1)
            obj = getattr(importlib.import_module(module_name), attr_name)
            self._adapter = obj() if isinstance(obj, type) else obj
            return self._adapter
        except Exception:
            return None

    def classify(self, sequence: List[Dict[str, Any]], *, fps: float, sport: str) -> List[Dict[str, Any]]:
        adapter = self._load()
        if adapter is None:
            return []
        try:
            raw = adapter.classify(sequence, fps=fps, sport=sport)
        except Exception:
            return []
        if not isinstance(raw, list):
            return []
        out: List[Dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            confidence = float(item.get("confidence", 0.0) or 0.0)
            label = str(item.get("shot_type", "")).strip()
            if not label or confidence <= 0.0:
                continue
            out.append({
                **item,
                "shot_type": label,
                "confidence": min(1.0, confidence),
                "source": item.get("source", "temporal_shot_adapter"),
            })
        return out
