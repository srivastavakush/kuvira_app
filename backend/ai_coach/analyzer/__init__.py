from .base import VideoAnalyzer, AnalyzerResult
from .lightweight import LightweightAnalyzer
from .yolo26_analyzer import YOLO26Analyzer
from .registry import get_sport_analyzer, register_sport_analyzer, supported_sports


def get_analyzer(sport: str = "pickleball"):
    """Select the configured sport analyzer without changing callers."""
    import os
    return get_sport_analyzer(sport, os.environ.get("AI_COACH_ANALYZER", "lightweight"))


__all__ = ["VideoAnalyzer", "AnalyzerResult", "LightweightAnalyzer", "YOLO26Analyzer", "get_analyzer", "get_sport_analyzer", "register_sport_analyzer", "supported_sports"]
