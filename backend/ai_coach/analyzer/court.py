"""Calibrated court geometry estimator.

A court model can still be plugged in, but the MVP now supports an explicit
pixel-to-court calibration supplied as JSON. This produces real homography-based
court coordinates without pretending generic line detection is calibrated.
"""
from __future__ import annotations
import json
import os
from typing import Any, Dict, List

import cv2
import numpy as np

from .components import CourtEstimator


class ConfigurableCourtEstimator(CourtEstimator):
    def __init__(self) -> None:
        self.model_path = os.environ.get("AI_COACH_COURT_MODEL", "")
        self.calibration_json = os.environ.get("AI_COACH_COURT_CALIBRATION", "")
        self._matrix = None
        self._source = None
        self._load_calibration()

    def _load_calibration(self) -> None:
        raw = self.calibration_json
        if not raw and self.model_path and self.model_path.endswith(".json"):
            try:
                with open(self.model_path, "r", encoding="utf-8") as f:
                    raw = f.read()
            except OSError:
                raw = ""
        if not raw:
            return
        try:
            cfg = json.loads(raw)
            src = np.asarray(cfg["pixel_points"], dtype=np.float32)
            dst = np.asarray(cfg["court_points"], dtype=np.float32)
            if src.shape[0] >= 4 and src.shape == dst.shape:
                self._matrix, _ = cv2.findHomography(src, dst, method=0)
                self._source = cfg.get("source", "manual_court_calibration")
        except Exception:
            self._matrix = None

    def estimate(self, frame: Any, detections: Any) -> Dict[str, Any]:
        if self._matrix is None:
            return {"available": False, "confidence": 0.0, "source": "court_calibration_not_configured"}
        return {
            "available": True,
            "confidence": 0.95,
            "source": self._source or "manual_court_calibration",
            "homography": self._matrix.tolist(),
            "court_coordinate_system": "configured_calibration_units",
        }

    def project(self, x: float, y: float) -> Dict[str, float]:
        if self._matrix is None:
            raise RuntimeError("court calibration is not configured")
        pts = np.asarray([[[float(x), float(y)]]], dtype=np.float32)
        out = cv2.perspectiveTransform(pts, self._matrix)[0][0]
        return {"x": float(out[0]), "y": float(out[1])}
