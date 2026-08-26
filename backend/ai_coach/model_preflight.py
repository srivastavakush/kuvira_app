"""Fail-closed validation for AI Coach CV artifacts.

This module validates configuration and loadability only. It never marks a
model as production-ready without evaluation evidence from the real dataset.
"""
from __future__ import annotations

import importlib
import json
import os
from pathlib import Path
from typing import Any


def _load_object(spec: str) -> Any:
    module_name, sep, attr_name = spec.partition(":")
    if not sep or not module_name or not attr_name:
        raise ValueError(f"Invalid adapter spec: {spec!r}; expected module.path:object")
    module = importlib.import_module(module_name)
    return getattr(module, attr_name)


def validate_court_calibration(path: str) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        return {"available": False, "reason": "calibration_file_missing", "path": path}
    data = json.loads(p.read_text(encoding="utf-8"))
    matrix = data.get("homography")
    if not isinstance(matrix, list) or len(matrix) != 3 or any(not isinstance(row, list) or len(row) != 3 for row in matrix):
        return {"available": False, "reason": "homography_must_be_3x3", "path": path}
    return {"available": True, "path": path, "source": "configured_homography"}


def validate_artifacts(require_production: bool = False) -> dict[str, Any]:
    analyzer = os.environ.get("AI_COACH_ANALYZER", "lightweight").lower()
    result: dict[str, Any] = {"analyzer": analyzer, "ready": True, "artifacts": {}, "errors": [], "warnings": []}
    if analyzer == "lightweight":
        result["warnings"].append("lightweight_analyzer_has_no_real_sports_cv")
        result["ready"] = not require_production
        if require_production:
            result["errors"].append("production_requires_yolo26_or_supported_sports_analyzer")
        return result
    if analyzer != "yolo26":
        result["ready"] = False
        result["errors"].append(f"unsupported_analyzer:{analyzer}")
        return result

    weights = os.environ.get("AI_COACH_YOLO_WEIGHTS", "")
    if not weights or not Path(weights).exists():
        result["ready"] = False
        result["errors"].append("AI_COACH_YOLO_WEIGHTS_missing_or_unreadable")
    else:
        result["artifacts"]["detector"] = {"path": weights, "exists": True}

    pose = os.environ.get("AI_COACH_POSE_WEIGHTS", "")
    if not pose or not Path(pose).exists():
        result["ready"] = False
        result["errors"].append("AI_COACH_POSE_WEIGHTS_missing_or_unreadable")
    else:
        result["artifacts"]["pose"] = {"path": pose, "exists": True}

    calibration = os.environ.get("AI_COACH_COURT_CALIBRATION", "")
    if not calibration:
        result["ready"] = False
        result["errors"].append("AI_COACH_COURT_CALIBRATION_missing")
    else:
        court = validate_court_calibration(calibration)
        result["artifacts"]["court"] = court
        if not court["available"]:
            result["ready"] = False
            result["errors"].append(court["reason"])

    shot_spec = os.environ.get("AI_COACH_SHOT_ADAPTER", "")
    if not shot_spec:
        result["ready"] = False
        result["errors"].append("AI_COACH_SHOT_ADAPTER_missing")
    else:
        try:
            _load_object(shot_spec)
            result["artifacts"]["shot"] = {"adapter": shot_spec, "importable": True}
        except Exception as exc:
            result["ready"] = False
            result["errors"].append(f"shot_adapter_unloadable:{type(exc).__name__}")

    result["warnings"].append("artifact_presence_does_not_mean_validation_passed")
    if require_production:
        result["artifacts"]["evaluation_gate"] = {
            "required": True,
            "source": os.environ.get("AI_COACH_EVAL_RESULT_FILE", ""),
        }
        evaluation_file = os.environ.get("AI_COACH_EVAL_RESULT_FILE", "")
        if not evaluation_file or not Path(evaluation_file).exists():
            result["ready"] = False
            result["errors"].append("validated_evaluation_result_missing")
    return result
