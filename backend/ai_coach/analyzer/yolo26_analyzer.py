"""YOLO-backed video analyzer with explicit evidence boundaries."""
from __future__ import annotations

import asyncio
import os
from typing import Any, Optional

import cv2

from ..models import DataQuality, Metric
from .base import AnalyzerResult, VideoAnalyzer, ProgressCb
from .components import ByteTrackPlayerTracker
from .court import ConfigurableCourtEstimator
from .pose import YOLOPoseEstimator
from .shot_classifier import ConfigurableShotClassifier


class YOLO26Analyzer(VideoAnalyzer):
    name = "yolo26"
    version = "0.2.0"

    def __init__(self, weights: Optional[str] = None, shot_model: Optional[str] = None):
        self.weights = weights or os.environ.get("AI_COACH_YOLO_WEIGHTS", "")
        self._model = None
        self.tracker = ByteTrackPlayerTracker()
        self.pose = YOLOPoseEstimator()
        self.court = ConfigurableCourtEstimator()
        self.shot_classifier = ConfigurableShotClassifier()
        if shot_model:
            os.environ["AI_COACH_SHOT_MODEL"] = shot_model

    def _load_model(self):
        if not self.weights:
            raise RuntimeError("AI_COACH_YOLO_WEIGHTS is required when AI_COACH_ANALYZER=yolo26")
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("ultralytics is required for the YOLO analyzer") from exc
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
        results = model.track(source=video_path, stream=True, persist=False, verbose=False)
        player_scores: list[float] = []
        ball_scores: list[float] = []
        player_frames = ball_frames = sampled = 0
        tracked_players = 0
        frame_sequences: list[dict[str, Any]] = []
        pose_confidences: list[float] = []
        court_confidences: list[float] = []

        for result in results:
            sampled += 1
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            cls = boxes.cls.tolist() if getattr(boxes, "cls", None) is not None else []
            conf = boxes.conf.tolist() if getattr(boxes, "conf", None) is not None else []
            xyxy = boxes.xyxy.tolist() if getattr(boxes, "xyxy", None) is not None else []
            frame_players = frame_ball = False
            frame_tracks = self.tracker.track(result)
            tracked_players += len(frame_tracks)
            for c, score, box in zip(cls, conf, xyxy):
                label = str(names.get(int(c), int(c))).lower()
                if label in {"person", "player"}:
                    player_scores.append(float(score)); frame_players = True
                if label in {"sports ball", "ball", "pickleball"}:
                    ball_scores.append(float(score)); frame_ball = True
            player_frames += int(frame_players)
            ball_frames += int(frame_ball)
            frame_sequences.append({"frame": sampled, "players": frame_tracks})

            # Pose/court are optional evidence producers. They never elevate
            # confidence unless they actually return evidence.
            pose = self.pose.estimate(getattr(result, "orig_img", None))
            court = self.court.estimate(getattr(result, "orig_img", None), boxes)
            if pose.get("available"):
                pose_confidences.append(float(pose.get("confidence", 0.0)))
            if court.get("available"):
                court_confidences.append(float(court.get("confidence", 0.0)))

            if report_progress and n_total and sampled % max(1, n_total // 20) == 0:
                try:
                    asyncio.run(report_progress("cv_inference", min(0.90, sampled / max(1, n_total) * 0.90)))
                except Exception:
                    pass

        player_conf = sum(player_scores) / len(player_scores) if player_scores else 0.0
        ball_conf = sum(ball_scores) / len(ball_scores) if ball_scores else 0.0
        pose_conf = sum(pose_confidences) / len(pose_confidences) if pose_confidences else 0.0
        court_conf = sum(court_confidences) / len(court_confidences) if court_confidences else 0.0

        missing: list[str] = []
        warnings: list[str] = []
        if not player_scores: missing.append("player_detection")
        if not ball_scores: missing.append("ball_detection")
        if not pose_confidences: missing.append("player_pose")
        if not court_confidences: missing.append("court_geometry")

        shots = self.shot_classifier.classify(frame_sequences, fps=fps, sport=sport)
        if not shots:
            missing.append("shot_classification")
            warnings.append("temporal_shot_model_not_producing_events")
        rallies: list[dict[str, Any]] = []
        if not rallies:
            missing.append("rally_boundaries")

        # Tactical evidence requires all critical layers. Detection alone is
        # never enough to make a tactical claim.
        critical = [player_conf, ball_conf, pose_conf, court_conf,
                    max((float(s.get("confidence", 0.0)) for s in shots), default=0.0)]
        overall = min(critical) if all(x > 0 for x in critical) else 0.0
        dq = DataQuality(
            frames_sampled=sampled,
            duration_sec=duration,
            resolution=f"{width}x{height}" if width and height else None,
            player_tracking_confidence=round(player_conf, 4),
            ball_tracking_confidence=round(ball_conf, 4),
            shot_classification_confidence=round(max((float(s.get("confidence", 0.0)) for s in shots), default=0.0), 4),
            missing=missing,
            warnings=warnings,
            overall_confidence=round(overall, 4),
        )
        metrics = [
            Metric(metric="video_duration", value=round(duration, 2), unit="s", source="video_metadata", confidence=0.98 if fps else 0.5),
            Metric(metric="player_detection_confidence", value=round(player_conf, 4), unit="confidence", source="yolo26_tracker", confidence=player_conf),
            Metric(metric="ball_detection_confidence", value=round(ball_conf, 4), unit="confidence", source="yolo26", confidence=ball_conf),
            Metric(metric="pose_confidence", value=round(pose_conf, 4), unit="confidence", source="yolo_pose", confidence=pose_conf),
            Metric(metric="court_geometry_confidence", value=round(court_conf, 4), unit="confidence", source="court_estimator", confidence=court_conf),
        ]
        diagnostics = {
            "weights": self.weights,
            "tracked_player_observations": tracked_players,
            "player_frames": player_frames,
            "ball_frames": ball_frames,
            "pose_observations": len(pose_confidences),
            "court_observations": len(court_confidences),
            "shot_events": len(shots),
        }
        return AnalyzerResult(analyzer=self.name, analyzer_version=self.version,
                              data_quality=dq, metrics=metrics, rallies=rallies,
                              shots=shots, important_moments=[], diagnostics=diagnostics)
