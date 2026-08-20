"""Sport-to-analyzer registry.

The agent consumes the common VideoAnalyzer/AnalyzerResult contract and never
branches on sport-specific model internals.
"""
from __future__ import annotations
from typing import Callable

from .base import VideoAnalyzer
from .lightweight import LightweightAnalyzer
from .yolo26_analyzer import YOLO26Analyzer

_ANALYZERS: dict[str, Callable[[], VideoAnalyzer]] = {
    "pickleball": lambda: YOLO26Analyzer(),
}


def register_sport_analyzer(sport: str, factory: Callable[[], VideoAnalyzer]) -> None:
    _ANALYZERS[sport.strip().lower()] = factory


def get_sport_analyzer(sport: str, configured: str | None = None) -> VideoAnalyzer:
    name = (configured or "").strip().lower()
    if name == "lightweight":
        return LightweightAnalyzer()
    if name and name != "yolo26":
        raise ValueError(f"Unsupported AI_COACH_ANALYZER: {name}")
    sport_key = (sport or "pickleball").strip().lower()
    factory = _ANALYZERS.get(sport_key)
    if not factory:
        raise RuntimeError(f"No analyzer is registered for sport={sport_key}")
    return factory()


def supported_sports() -> list[str]:
    return sorted(_ANALYZERS)
