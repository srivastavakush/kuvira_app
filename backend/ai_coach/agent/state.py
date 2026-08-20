"""State used by the bounded, evidence-first coaching agent."""
from __future__ import annotations
from typing import Any, Dict, List, Optional, TypedDict


class EvidenceItem(TypedDict, total=False):
    kind: str
    source: str
    confidence: float
    data: Any
    available: bool


class AgentToolCall(TypedDict, total=False):
    tool: str
    args: Dict[str, Any]
    result: Any
    error: str


class CoachAgentState(TypedDict, total=False):
    user_id: str
    sport: str
    goal: str
    intent: str
    match_id: Optional[str]
    video_id: Optional[str]
    query: Optional[str]
    player_context: Dict[str, Any]
    evidence: List[EvidenceItem]
    required_evidence: List[str]
    missing_evidence: List[str]
    plan: List[Dict[str, Any]]
    tool_calls: List[AgentToolCall]
    diagnosis: Dict[str, Any]
    draft_report: Dict[str, Any]
    critique: Dict[str, Any]
    recommendations: List[Dict[str, Any]]
    next_action: Optional[str]
    step_count: int
    replan_count: int
    max_steps: int
    max_replans: int
    done: bool
    error: Optional[str]
