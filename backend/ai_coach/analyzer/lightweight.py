"""Lightweight, honest video analyzer.

This analyzer only reports things it can legitimately measure from raw frames
without a trained sports model:
  • video metadata (duration, fps, resolution, size)
  • frame sampling count
  • aggregate motion signal (mean inter-frame absolute-difference)
  • scene-boundary count (naive threshold on the motion signal)

All higher-level analytics (shots, rallies, serve %, winners, errors) are
explicitly reported as UNAVAILABLE. A downstream real CV analyzer will replace
this class without changing any callers.
"""
from __future__ import annotations
import asyncio
import logging
import math
import os
from typing import Optional

import cv2
import numpy as np

from ..models import DataQuality, Metric
from .base import AnalyzerResult, VideoAnalyzer, ProgressCb

log = logging.getLogger("kuvira.analyzer")


MAX_FRAMES_SAMPLED = 240        # cap CPU work in the sandbox
TARGET_MIN_WIDTH = 480


class LightweightAnalyzer(VideoAnalyzer):
    name = "lightweight"
    version = "0.1.0"

    async def analyze(
        self,
        video_path: str,
        *,
        report_progress: Optional[ProgressCb] = None,
        sport: str = "pickleball",
    ) -> AnalyzerResult:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._analyze_sync, video_path, report_progress, sport)

    def _analyze_sync(self, video_path: str, report_progress: Optional[ProgressCb], sport: str) -> AnalyzerResult:
        diagnostics: dict = {"video_path": video_path, "exists": os.path.exists(video_path)}
        missing: list[str] = []
        warnings: list[str] = []

        if not diagnostics["exists"]:
            dq = DataQuality(missing=["video_file"], warnings=["file_not_found"], overall_confidence=0.0)
            return AnalyzerResult(analyzer=self.name, analyzer_version=self.version, data_quality=dq, diagnostics=diagnostics)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            dq = DataQuality(missing=["decoded_frames"], warnings=["cannot_open_video"], overall_confidence=0.0)
            return AnalyzerResult(analyzer=self.name, analyzer_version=self.version, data_quality=dq, diagnostics=diagnostics)

        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        n_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = (n_total / fps) if fps > 0 else 0.0

        if fps <= 0 or n_total <= 0:
            warnings.append("unreliable_metadata")

        # Sample up to MAX_FRAMES_SAMPLED frames uniformly across the video.
        target_samples = min(MAX_FRAMES_SAMPLED, max(1, n_total)) if n_total > 0 else MAX_FRAMES_SAMPLED
        step = max(1, math.floor(n_total / target_samples)) if n_total > 0 else 1

        prev_gray: Optional[np.ndarray] = None
        motion_series: list[float] = []
        sampled = 0
        frame_idx = 0

        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            if frame_idx % step == 0:
                if w and w > TARGET_MIN_WIDTH:
                    scale = TARGET_MIN_WIDTH / w
                    frame = cv2.resize(frame, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                if prev_gray is not None:
                    diff = cv2.absdiff(gray, prev_gray)
                    motion_series.append(float(np.mean(diff)))
                prev_gray = gray
                sampled += 1
                if sampled >= MAX_FRAMES_SAMPLED:
                    break
            frame_idx += 1

        cap.release()

        avg_motion = float(np.mean(motion_series)) if motion_series else 0.0
        std_motion = float(np.std(motion_series)) if motion_series else 0.0
        # Naive scene-change count: motion samples that exceed mean + 1.5*std.
        if motion_series:
            thr = avg_motion + 1.5 * std_motion
            scene_changes = int(sum(1 for m in motion_series if m > thr))
        else:
            scene_changes = 0

        # Data quality — we can measure video-level facts, nothing more.
        missing.extend([
            "player_detection", "ball_detection", "paddle_detection",
            "player_pose", "court_geometry", "shot_classification",
            "rally_boundaries", "point_boundaries",
        ])
        if duration < 20:
            warnings.append("very_short_video")
        if w < 480 or h < 270:
            warnings.append("low_resolution")
        if fps < 20:
            warnings.append("low_fps")

        overall_conf = 0.0  # honest: without a trained CV model, sports-analytic confidence is zero
        dq = DataQuality(
            frames_sampled=sampled,
            duration_sec=duration,
            resolution=f"{w}x{h}" if w and h else None,
            motion_signal=avg_motion,
            player_tracking_confidence=0.0,
            ball_tracking_confidence=0.0,
            shot_classification_confidence=0.0,
            missing=missing,
            warnings=warnings,
            overall_confidence=overall_conf,
        )

        # Only report legitimately measurable metrics. Everything shot-level is unavailable.
        metrics = [
            Metric(metric="video_duration", value=round(duration, 2), unit="s", source="video_metadata", confidence=0.95 if fps > 0 else 0.4),
            Metric(metric="video_fps", value=round(fps, 2), unit="fps", source="video_metadata", confidence=0.9 if fps > 0 else 0.2),
            Metric(metric="average_motion_signal", value=round(avg_motion, 3), unit="px/frame", source="video_estimation", confidence=0.5 if motion_series else 0.0,
                   note="Aggregate inter-frame absolute difference. Correlates loosely with activity intensity."),
            Metric(metric="scene_change_estimate", value=float(scene_changes), unit="count", source="video_estimation", confidence=0.35 if motion_series else 0.0,
                   note="Naive motion-spike count. Not a rally count."),
        ]

        diagnostics.update({
            "fps": fps, "width": w, "height": h, "frame_count": n_total,
            "sampled": sampled, "scene_changes_naive": scene_changes,
        })

        return AnalyzerResult(
            analyzer=self.name,
            analyzer_version=self.version,
            data_quality=dq,
            metrics=metrics,
            rallies=[],
            shots=[],
            important_moments=[],
            diagnostics=diagnostics,
        )
