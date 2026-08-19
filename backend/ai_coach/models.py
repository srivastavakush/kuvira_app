"""Pydantic schemas for the AI Coach domain.

Every numerical metric carries `source` + `confidence` so downstream consumers
can distinguish verified fact from inference. See product spec.
"""
from __future__ import annotations
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


JobStatus = Literal["queued", "processing", "completed", "failed"]
AnalyticSource = Literal[
    "video_metadata", "video_estimation", "paddle_imu",
    "player_history", "self_report", "coach_input", "unavailable",
]


class Metric(BaseModel):
    metric: str
    value: Optional[float] = None
    unit: Optional[str] = None
    source: AnalyticSource = "unavailable"
    confidence: float = 0.0  # 0..1
    note: Optional[str] = None


class MatchCreate(BaseModel):
    sport: str = "pickleball"
    player_level: Optional[str] = None
    result: Optional[str] = None            # "win" | "loss" | "draw" | None
    opponent_name: Optional[str] = None
    opponent_level: Optional[str] = None
    notes: Optional[str] = None
    played_at: Optional[str] = None         # ISO date


class MatchDoc(MatchCreate):
    id: str
    user_id: str
    created_at: str = Field(default_factory=_now)
    video_id: Optional[str] = None
    analysis_job_id: Optional[str] = None
    report_id: Optional[str] = None


class VideoDoc(BaseModel):
    id: str
    user_id: str
    match_id: Optional[str] = None
    original_filename: Optional[str] = None
    mime_type: str
    size_bytes: int
    duration_sec: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    storage_path: str
    created_at: str = Field(default_factory=_now)


class AnalysisJobDoc(BaseModel):
    id: str
    user_id: str
    match_id: str
    video_id: str
    status: JobStatus = "queued"
    stage: str = "queued"           # human-readable current stage
    progress: float = 0.0           # 0..1
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    analyzer: str = "lightweight"   # analyzer id used
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=_now)


class DataQuality(BaseModel):
    frames_sampled: int = 0
    duration_sec: float = 0.0
    resolution: Optional[str] = None
    motion_signal: Optional[float] = None       # aggregate motion magnitude
    player_tracking_confidence: float = 0.0     # 0 if not detected
    ball_tracking_confidence: float = 0.0
    shot_classification_confidence: float = 0.0
    missing: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    overall_confidence: float = 0.0             # 0..1


class MatchAnalytics(BaseModel):
    match_id: str
    video_id: Optional[str] = None
    data_quality: DataQuality
    metrics: List[Metric] = Field(default_factory=list)
    rallies: List[Dict[str, Any]] = Field(default_factory=list)  # empty until real CV
    shots: List[Dict[str, Any]] = Field(default_factory=list)    # empty until real CV
    important_moments: List[Dict[str, Any]] = Field(default_factory=list)
    analyzer: str = "lightweight"
    analyzer_version: str = "0.1.0"
    generated_at: str = Field(default_factory=_now)


class EvidenceItem(BaseModel):
    kind: Literal["player_metric", "match_analytic", "knowledge", "history"]
    ref: str                  # id or citation
    summary: str
    source: Optional[str] = None
    authority_level: Optional[int] = None
    confidence: float = 0.0


class CoachingReport(BaseModel):
    id: str
    user_id: str
    match_id: str
    generated_at: str = Field(default_factory=_now)
    match_summary: str
    data_quality_summary: str
    key_takeaway: Optional[str] = None
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    tactical_observations: List[str] = Field(default_factory=list)
    recommended_drills: List[Dict[str, Any]] = Field(default_factory=list)
    training_plan: List[Dict[str, Any]] = Field(default_factory=list)
    metrics: List[Metric] = Field(default_factory=list)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    unavailable: List[str] = Field(default_factory=list)  # explicitly not detected
    model: str = ""
    version: str = "0.1.0"


class ChatMessage(BaseModel):
    text: str
    session_id: Optional[str] = None
    match_id: Optional[str] = None
