"""Court geometry estimator boundary.

Court geometry is deliberately confidence-gated. A future calibrated
pickleball court model can implement this interface without changing the
analyzer or agent layers.
"""
from __future__ import annotations

import os
from typing import Any, Dict

from .components import CourtEstimator


class ConfigurableCourtEstimator(CourtEstimator):
    def __init__(self) -> None:
        self.model_path = os.environ.get("AI_COACH_COURT_MODEL", "")

    def estimate(self, frame: Any, detections: Any) -> Dict[str, Any]:
        if not self.model_path:
            return {
                "available": False,
                "confidence": 0.0,
                "source": "court_model_not_configured",
            }
        # The model is an explicit extension point; do not use arbitrary line
        # detection as a substitute for calibrated court geometry.
        return {
            "available": False,
            "confidence": 0.0,
            "source": "court_model_adapter_not_implemented",
        }
