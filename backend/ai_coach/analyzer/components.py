"""Explicit CV component contracts for the agentic video-analysis tool.

Each component has a narrow responsibility and returns confidence/provenance.
Missing components fail closed rather than turning generic detections into
sports claims.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class PlayerTracker(ABC):
    @abstractmethod
    def track(self, results: Any) -> List[Dict[str, Any]]:
        """Return normalized player tracks with confidence."""


class CourtEstimator(ABC):
    @abstractmethod
    def estimate(self, frame: Any, detections: Any) -> Dict[str, Any]:
        """Return court geometry/homography when reliable, else unavailable."""


class PoseEstimator(ABC):
    @abstractmethod
    def estimate(self, frame: Any) -> Dict[str, Any]:
        """Return player keypoints/pose with confidence when available."""


class ShotClassifier(ABC):
    @abstractmethod
    def classify(self, sequence: List[Dict[str, Any]], *, fps: float, sport: str) -> List[Dict[str, Any]]:
        """Return explicitly classified shot events with confidence."""


class ByteTrackPlayerTracker(PlayerTracker):
    """Normalize Ultralytics track results into player tracks.

    This component intentionally uses detector-provided class labels and track
    IDs only; it does not infer stroke type, court position, or rally events.
    """

    def track(self, result: Any) -> List[Dict[str, Any]]:
        boxes = getattr(result, "boxes", None)
        names = getattr(result, "names", {}) or {}
        if boxes is None:
            return []
        cls = boxes.cls.tolist() if getattr(boxes, "cls", None) is not None else []
        conf = boxes.conf.tolist() if getattr(boxes, "conf", None) is not None else []
        xyxy = boxes.xyxy.tolist() if getattr(boxes, "xyxy", None) is not None else []
        ids = boxes.id.tolist() if getattr(boxes, "id", None) is not None else [None] * len(cls)
        out: List[Dict[str, Any]] = []
        for c, score, box, track_id in zip(cls, conf, xyxy, ids):
            label = str(names.get(int(c), int(c))).lower()
            if label not in {"person", "player"}:
                continue
            out.append({
                "track_id": int(track_id) if track_id is not None else None,
                "label": "player",
                "confidence": float(score),
                "bbox": box,
                "source": "yolo26_tracker",
            })
        return out


class NullCourtEstimator(CourtEstimator):
    def estimate(self, frame: Any, detections: Any) -> Dict[str, Any]:
        return {"available": False, "confidence": 0.0, "source": "court_estimator_unavailable"}


class NullPoseEstimator(PoseEstimator):
    def estimate(self, frame: Any) -> Dict[str, Any]:
        return {"available": False, "confidence": 0.0, "source": "pose_estimator_unavailable"}


class NullShotClassifier(ShotClassifier):
    def classify(self, sequence: List[Dict[str, Any]], *, fps: float, sport: str) -> List[Dict[str, Any]]:
        return []
