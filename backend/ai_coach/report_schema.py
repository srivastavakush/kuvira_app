"""Strict schemas for evidence-backed AI Coach reports.

The schema makes provenance and confidence first-class so downstream clients
cannot accidentally treat an unsupported claim as a measured metric.
"""
from __future__ import annotations
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator

EvidenceKind = Literal["verified", "inferred", "unknown"]


class EvidenceRef(BaseModel):
    id: str
    kind: EvidenceKind = "verified"
    source: str
    confidence: float = Field(ge=0.0, le=1.0)
    data: Any = None


class MetricEvidence(BaseModel):
    metric: str
    value: float | int | str
    unit: str
    source: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_ids: list[str] = Field(default_factory=list)


class CoachingClaim(BaseModel):
    text: str
    kind: EvidenceKind = "inferred"
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_ids: list[str] = Field(default_factory=list)


class DrillRecommendation(BaseModel):
    title: str
    description: str = ""
    target: Optional[str] = None
    rationale: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence_ids: list[str] = Field(default_factory=list)


class AIReadyReport(BaseModel):
    id: str
    user_id: str
    match_id: str
    generated_at: str
    match_summary: str = ""
    data_quality_summary: str = ""
    key_takeaway: str = ""
    metrics: list[MetricEvidence] = Field(default_factory=list)
    strengths: list[CoachingClaim] = Field(default_factory=list)
    weaknesses: list[CoachingClaim] = Field(default_factory=list)
    tactical_observations: list[CoachingClaim] = Field(default_factory=list)
    recommended_drills: list[DrillRecommendation] = Field(default_factory=list)
    training_plan: list[DrillRecommendation] = Field(default_factory=list)
    evidence: list[EvidenceRef] = Field(default_factory=list)
    unavailable: list[str] = Field(default_factory=list)
    data_quality: dict[str, Any] = Field(default_factory=dict)
    analyzer: Optional[str] = None
    model: Optional[str] = None
    version: str = "1.0.0"

    @field_validator("tactical_observations")
    @classmethod
    def tactical_claims_need_evidence(cls, value: list[CoachingClaim]) -> list[CoachingClaim]:
        for claim in value:
            if claim.kind != "unknown" and not claim.evidence_ids:
                raise ValueError("tactical observations require evidence_ids")
        return value


def validate_report_payload(payload: dict[str, Any]) -> AIReadyReport:
    return AIReadyReport.model_validate(payload)
