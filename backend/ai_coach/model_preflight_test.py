import os
from pathlib import Path

from .model_preflight import validate_artifacts


def test_lightweight_is_only_dev_ready(monkeypatch):
    monkeypatch.setenv("AI_COACH_ANALYZER", "lightweight")
    assert validate_artifacts(False)["ready"] is True
    assert validate_artifacts(True)["ready"] is False


def test_yolo_requires_all_artifacts(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("AI_COACH_ANALYZER", "yolo26")
    monkeypatch.setenv("AI_COACH_YOLO_WEIGHTS", str(tmp_path / "detector.pt"))
    monkeypatch.setenv("AI_COACH_POSE_WEIGHTS", str(tmp_path / "pose.pt"))
    monkeypatch.setenv("AI_COACH_COURT_CALIBRATION", str(tmp_path / "court.json"))
    monkeypatch.setenv("AI_COACH_SHOT_ADAPTER", "missing.module:Classifier")
    result = validate_artifacts(True)
    assert result["ready"] is False
    assert any("missing_or_unreadable" in error for error in result["errors"])
    assert any("shot_adapter_unloadable" in error for error in result["errors"])
