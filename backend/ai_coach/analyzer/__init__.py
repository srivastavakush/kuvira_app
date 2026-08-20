from .base import VideoAnalyzer, AnalyzerResult
from .lightweight import LightweightAnalyzer
from .yolo26_analyzer import YOLO26Analyzer


def get_analyzer():
    """Select the configured analyzer without changing callers."""
    import os
    name = os.environ.get("AI_COACH_ANALYZER", "lightweight").strip().lower()
    if name == "yolo26":
        return YOLO26Analyzer()
    if name != "lightweight":
        raise ValueError(f"Unsupported AI_COACH_ANALYZER: {name}")
    return LightweightAnalyzer()


__all__ = ["VideoAnalyzer", "AnalyzerResult", "LightweightAnalyzer", "YOLO26Analyzer", "get_analyzer"]
