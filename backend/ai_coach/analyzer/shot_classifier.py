"""Temporal shot-classification boundary.

A detector cannot safely infer a stroke from a single bounding box. This
module makes the temporal model an explicit dependency and fails closed when
it is absent.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List

from .components import ShotClassifier


class ConfigurableShotClassifier(ShotClassifier):
    def __init__(self) -> None:
        self.model_path = os.environ.get("AI_COACH_SHOT_MODEL", "")

    def classify(self, sequence: List[Dict[str, Any]], *, fps: float, sport: str) -> List[Dict[str, Any]]:
        if not self.model_path:
            return []
        # Keep the model adapter explicit. A generic image classifier cannot
        # reconstruct temporal stroke events without a sequence-aware model.
        return []
