"""YOLO26-backed video analyzer adapter.

The detector/tracker is configurable through model weights. This module never
labels a shot or rally unless an explicit temporal shot model is configured;
therefore generic object detection cannot silently become fabricated tactical
analytics.

Environment:
  AI_COACH_YOLO_WEIGHTS=/path/to/yolo26-weights.pt
  AI_COACH_SHOT_MODEL=/path/to/shot-classifier.pt   # optional
"""
from __future__ import annotations
import asyncio
import os
from typing import Any, Optional

import cv2

from ..models import DataQuality, Metric
from .base import AnalyzerResult, VideoAnalyzer, ProgressCb


class YOLO26Analyzer(VideoAnalyzer):
    name = "yolo26"
    version = "0.1.0"

    def __init__(self, weights: Optional[str] = None, shot_model: Optional[str] = None):
        self.weights = weights or os.environ.get("AI_COACH_YOLO_WEIGHTS", "")
        self.shot_model = shot_model or os.environ.get("AI_COACH_SHOT_MODEL", "")
        self._model = None

    def _load_model(self):
        if not self.weights:
            raise RuntimeError("AI_COACH_YOLO_WEIGHTS is required when AI_COACH_ANALYZER=yolo26")
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("ultralytics is required for the YOLO26 analyzer") from exc
        if self._model is None:
            self._model = YOLO(self.weights)
        return self._model

    async def analyze(self, video_path: str, *, report_progress: Optional[ProgressCb] = None, sport: str = "pickleball") -> AnalyzerResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._analyze_sync, video_path, report_progress, sport)

    def _analyze_sync(self, video_path: str, report_progress: Optional[ProgressCb], sport: str) -> AnalyzerResult:
        if not os.path.exists(video_path):
            return AnalyzerResult(analyzer=self.name, analyzer_version=self.version,
                                  data_quality=DataQuality(missing=["video_file"], warnings=["file_not_found"], overall_confidence=0.0))
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return AnalyzerResult(analyzer=self.name, analyzer_version=self.version,
                                  data_quality=DataQuality(missing=["decoded_frames"], warnings=["cannot_open_video"], overall_confidence=0.0))
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        n_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration = n_total / fps if fps else 0.0
        cap.release()

        model = self._load_model()
        # `track` gives stable IDs where the configured model/tracker supports it.
        results = model.track(source=video_path, stream=True, persist=False, verbose=False)
        player_scores: list[float] = []
        ball_scores: list[float] = []
        player_frames = 0
        ball_frames = 0
        sampled = 0
        tracks: dict[int, list[dict[str, Any]]] = {}
        for result in results:
            sampled += 1
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            cls = boxes.cls.tolist() if getattr(boxes, "cls", None) is not None else []
            conf = boxes.conf.tolist() if getattr(boxes, "conf", None) is not None else []
            xyxy = boxes.xyxy.tolist() if getattr(boxes, "xyxy", None) is not None else []
            ids = boxes.id.tolist() if getattr(boxes, "id", None) is not None else [None] * len(cls)
            frame_players = frame_ball = False
            for c, score, box, track_id in zip(cls, conf, xyxy, ids):
                label = str(names.get(int(c), int(c))).lower()
                if label == "person":
                    player_scores.append(float(score)); frame_players = True
                if label in {"sports ball", "ball", "pickleball"}:
                    ball_scores.append(float(score)); frame_ball = True
                if track_id is not None:
                    tracks.setdefault(int(track_id), []).append({"frame": sampled, "label": label, "confidence": float(score), "bbox": box})
            player_frames += int(frame_players)
            ball_frames += int(frame_ball)
            if report_progress and n_total:
                # Generator frame count is approximate but monotonic.
                p = min(0.90, sampled / max(1, n_total) * 0.90)
                try:
                    asyncio.get_event_loop().create_task(report_progress("cv_inference", p))
                except Exception:
                    pass

        player_conf = sum(player_scores) / len(player_scores) if player_scores else 0.0
        ball_conf = sum(ball_scores) / len(ball_scores) if ball_scores else 0.0
        missing: list[str] = []
        warnings: list[str] = []
        if not player_scores: missing.append("player_detection")
        if not ball_scores: missing.append("ball_detection")
        missing += ["paddle_detection", "player_pose", "court_geometry"]

        shots: list[dict[str, Any]] = []
        rallies: list[dict[str, Any]] = []
        if not self.shot_model:
            missing += ["shot_classification", "rally_boundaries", "point_boundaries"]
            warnings.append("shot_model_not_configured")
        else:
            # The temporal model is intentionally an explicit extension point;
            # generic object detections must not be converted into shot labels.
            missing += ["shot_classification", "rally_boundaries", "point_boundaries"]
            warnings.append("configured_shot_model_requires_temporal_adapter")

        overall = min(player_conf, ball_conf) if player_scores and ball_scores else 0.0
        dq = DataQuality(
            frames_sampled=sampled, duration_sec=duration,
            resolution=f"{width}x{height}" if width and height else None,
            player_tracking_confidence=round(player_conf, 4),
            ball_tracking_confidence=round(ball_conf, 4),
            shot_classification_confidence=0.0,
            missing=missing, warnings=warnings,
            overall_confidence=round(overall, 4),
        )
        metrics = [
            Metric(metric="video_duration", value=round(duration, 2), unit="s", source="video_metadata", confidence=0.98 if fps else 0.5),
            Metric(metric="player_detection_confidence", value=round(player_conf, 4), unit="confidence", source="yolo26", confidence=player_conf),
            Metric(metric="ball_detection_confidence", value=round(ball_conf, 4), unit="confidence", source="yolo26", confidence=ball_conf),
        ]
        diagnostics = {"weights": self.weights, "shot_model": bool(self.shot_model), "tracked_objects": len(tracks), "player_frames": player_frames, "ball_frames": ball_frames}
        return AnalyzerResult(analyzer=self.name, analyzer_version=self.version, data_quality=dq, metrics=metrics,
                              rallies=rallies, shots=shots, important_moments=[], diagnostics=diagnostics)
