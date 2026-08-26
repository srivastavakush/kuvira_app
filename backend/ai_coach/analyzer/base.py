"""VideoAnalyzer interface. A real YOLO26 + pose + tracker implementation must
simply subclass this and return an `AnalyzerResult` with the same schema.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Dict, List, Optional
from pydantic import BaseModel, Field

from ..models import DataQuality, Metric


ProgressCb = Callable[[str, float], Awaitable[None]]


class AnalyzerResult(BaseModel):
    analyzer: str
    analyzer_version: str
    data_quality: DataQuality
    metrics: List[Metric] = Field(default_factory=list)
    rallies: List[Dict[str, Any]] = Field(default_factory=list)
    shots: List[Dict[str, Any]] = Field(default_factory=list)
    important_moments: List[Dict[str, Any]] = Field(default_factory=list)
    diagnostics: Dict[str, Any] = Field(default_factory=dict)


class VideoAnalyzer(ABC):
    name: str = "abstract"
    version: str = "0"

    @abstractmethod
    async def analyze(
        self,
        video_path: str,
        *,
        report_progress: Optional[ProgressCb] = None,
        sport: str = "pickleball",
    ) -> AnalyzerResult: ...
