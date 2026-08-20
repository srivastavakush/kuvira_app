"""Optional pose-model adapter for player biomechanics evidence."""
from __future__ import annotations

import os
from typing import Any, Dict

from .components import PoseEstimator


class YOLOPoseEstimator(PoseEstimator):
    def __init__(self, weights: str | None = None) -> None:
        self.weights = weights or os.environ.get("AI_COACH_POSE_WEIGHTS", "")
        self._model = None

    def _load(self):
        if not self.weights:
            return None
        try:
            from ultralytics import YOLO
        except ImportError:
            return None
        if self._model is None:
            self._model = YOLO(self.weights)
        return self._model

    def estimate(self, frame: Any) -> Dict[str, Any]:
        model = self._load()
        if model is None:
            return {"available": False, "confidence": 0.0, "source": "pose_model_unavailable"}
        try:
            result = model.predict(source=frame, verbose=False)[0]
            keypoints = getattr(result, "keypoints", None)
            if keypoints is None:
                return {"available": False, "confidence": 0.0, "source": "pose_no_keypoints"}
            conf = getattr(keypoints, "conf", None)
            values = conf.tolist() if conf is not None else []
            flat = [float(x) for row in values for x in (row if isinstance(row, list) else [row])]
            confidence = sum(flat) / len(flat) if flat else 0.0
            return {"available": bool(flat), "confidence": round(confidence, 4), "source": "yolo_pose", "keypoints": keypoints.xy.tolist()}
        except Exception as exc:
            return {"available": False, "confidence": 0.0, "source": "pose_inference_error", "error": str(exc)}
