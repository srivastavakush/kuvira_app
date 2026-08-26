"""Deterministic segmentation over validated temporal shot events.

This module never invents events. It only groups events supplied by a real
sequence-aware shot classifier and only emits point boundaries when the
classifier explicitly provides a point_end/score evidence event.
"""
from __future__ import annotations
from typing import Any, Dict, Iterable, List


def normalize_shot_events(events: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    for idx, event in enumerate(events, 1):
        if not isinstance(event, dict):
            continue
        confidence = float(event.get("confidence", 0.0) or 0.0)
        if confidence <= 0.0:
            continue
        shot_type = str(event.get("shot_type") or event.get("type") or "unknown")
        frame = int(event.get("frame", event.get("start_frame", 0)) or 0)
        normalized.append({
            **event,
            "id": str(event.get("id") or f"shot-{idx}"),
            "shot_type": shot_type,
            "frame": frame,
            "confidence": max(0.0, min(1.0, confidence)),
            "evidence_kind": "verified" if confidence >= 0.8 else "inferred",
            "source": str(event.get("source") or "temporal_shot_classifier"),
        })
    normalized.sort(key=lambda x: x["frame"])
    return normalized


def reconstruct_rallies_from_shots(shots: List[Dict[str, Any]], fps: float, max_gap_seconds: float = 2.5) -> List[Dict[str, Any]]:
    """Group validated shot events by temporal gap.

    This produces candidate rallies, not score-confirmed rallies. A rally must
    contain at least two shot events and retains an explicit confidence note.
    """
    if fps <= 0:
        return []
    events = normalize_shot_events(shots)
    if len(events) < 2:
        return []
    max_gap = max(1, int(max_gap_seconds * fps))
    groups: List[List[Dict[str, Any]]] = [[events[0]]]
    for event in events[1:]:
        if event["frame"] - groups[-1][-1]["frame"] <= max_gap:
            groups[-1].append(event)
        else:
            groups.append([event])
    rallies: List[Dict[str, Any]] = []
    for idx, group in enumerate(groups, 1):
        if len(group) < 2:
            continue
        start, end = group[0]["frame"], group[-1]["frame"]
        confidence = sum(float(e["confidence"]) for e in group) / len(group)
        rallies.append({
            "id": f"rally-{idx}",
            "type": "candidate_rally",
            "start_frame": start,
            "end_frame": end,
            "start_sec": round(start / fps, 3),
            "end_sec": round(end / fps, 3),
            "duration_sec": round((end - start) / fps, 3),
            "shot_count": len(group),
            "shot_ids": [e["id"] for e in group],
            "confidence": round(confidence, 4),
            "source": "temporal_shot_sequence",
            "note": "Candidate rally; point outcome is not inferred from timing alone.",
        })
    return rallies


def segment_points_from_explicit_events(events: Iterable[Dict[str, Any]], fps: float) -> List[Dict[str, Any]]:
    """Create point segments only from explicit point-end/score evidence."""
    if fps <= 0:
        return []
    normalized = sorted(
        [e for e in events if isinstance(e, dict) and str(e.get("event_type") or e.get("type")) in {"point_end", "score"}],
        key=lambda e: int(e.get("frame", 0) or 0),
    )
    points: List[Dict[str, Any]] = []
    start_frame = 0
    for idx, end_event in enumerate(normalized, 1):
        end_frame = int(end_event.get("frame", 0) or 0)
        confidence = float(end_event.get("confidence", 0.0) or 0.0)
        points.append({
            "id": f"point-{idx}",
            "start_frame": start_frame,
            "end_frame": end_frame,
            "start_sec": round(start_frame / fps, 3),
            "end_sec": round(end_frame / fps, 3),
            "confidence": max(0.0, min(1.0, confidence)),
            "source": str(end_event.get("source") or "explicit_point_event"),
            "evidence_kind": "verified" if confidence >= 0.8 else "inferred",
            "outcome": end_event.get("outcome"),
        })
        start_frame = end_frame + 1
    return points
