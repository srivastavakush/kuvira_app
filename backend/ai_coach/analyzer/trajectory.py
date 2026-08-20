"""Trajectory primitives derived from tracked ball observations.

These metrics describe what is actually observable from the video. Rally
segments are visibility-continuous periods, not point scores; shot events remain
owned by the temporal shot classifier.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional


def _center(box: List[float]) -> tuple[float, float]:
    x1, y1, x2, y2 = [float(x) for x in box]
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0


def build_ball_trajectory(observations: List[Dict[str, Any]], fps: float) -> Dict[str, Any]:
    obs = sorted([o for o in observations if o.get("bbox")], key=lambda x: int(x.get("frame", 0)))
    points: List[Dict[str, Any]] = []
    for o in obs:
        cx, cy = _center(o["bbox"])
        points.append({"frame": int(o.get("frame", 0)), "x": cx, "y": cy, "confidence": float(o.get("confidence", 0.0))})
    velocities: List[float] = []
    for a, b in zip(points, points[1:]):
        dt_frames = max(1, b["frame"] - a["frame"])
        dt = dt_frames / fps if fps > 0 else float(dt_frames)
        velocities.append(math.hypot(b["x"] - a["x"], b["y"] - a["y"]) / max(dt, 1e-6))
    mean_velocity = sum(velocities) / len(velocities) if velocities else 0.0
    max_velocity = max(velocities) if velocities else 0.0
    return {
        "points": points,
        "samples": len(points),
        "coverage": len(points),
        "mean_pixel_velocity": round(mean_velocity, 4),
        "max_pixel_velocity": round(max_velocity, 4),
        "confidence": round(sum(p["confidence"] for p in points) / len(points), 4) if points else 0.0,
        "source": "ball_track_trajectory",
    }


def reconstruct_visibility_rallies(observations: List[Dict[str, Any]], fps: float, max_gap_seconds: float = 0.75) -> List[Dict[str, Any]]:
    """Create observable rally-like segments from sustained ball visibility.

    These are not scoreboard rallies. They are only continuous ball-observation
    segments and therefore carry an explicit `type` and conservative confidence.
    """
    obs = sorted([o for o in observations if o.get("bbox")], key=lambda x: int(x.get("frame", 0)))
    if not obs or fps <= 0:
        return []
    max_gap = max(1, int(max_gap_seconds * fps))
    segments: List[List[Dict[str, Any]]] = [[obs[0]]]
    for current in obs[1:]:
        gap = int(current.get("frame", 0)) - int(segments[-1][-1].get("frame", 0))
        if gap <= max_gap:
            segments[-1].append(current)
        else:
            segments.append([current])
    rallies: List[Dict[str, Any]] = []
    for idx, seg in enumerate(segments, 1):
        if len(seg) < max(3, int(fps * 0.1)):
            continue
        start = int(seg[0]["frame"])
        end = int(seg[-1]["frame"])
        conf = sum(float(x.get("confidence", 0.0)) for x in seg) / len(seg)
        rallies.append({
            "id": f"visibility-rally-{idx}",
            "type": "ball_visibility_segment",
            "start_frame": start,
            "end_frame": end,
            "start_sec": round(start / fps, 3),
            "end_sec": round(end / fps, 3),
            "duration_sec": round((end - start) / fps, 3),
            "ball_observations": len(seg),
            "confidence": round(conf, 4),
            "source": "ball_track_continuity",
            "note": "Observable ball-continuity segment; not a scored rally.",
        })
    return rallies
