"""LangGraph coaching workflow.

Stateful pipeline; nodes only produce claims backed by evidence they can point
to in the state. `validate_evidence` weakens or removes any factual claim about
the player that isn't grounded in structured data.
"""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional, TypedDict

try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except Exception:  # pragma: no cover
    LANGGRAPH_AVAILABLE = False

from .providers import AIProvider, get_default_provider
from .retriever import KnowledgeRetriever
from .models import CoachingReport, EvidenceItem, Metric

log = logging.getLogger("kuvira.graph")


class CoachState(TypedDict, total=False):
    user_id: str
    match_id: str
    query: Optional[str]
    player_profile: Dict[str, Any]
    recent_match_history: List[Dict[str, Any]]
    match_analytics: Dict[str, Any]
    data_quality: Dict[str, Any]
    intent: str
    diagnosis: Dict[str, Any]
    retrieved_evidence: List[Dict[str, Any]]
    recommendations: List[Dict[str, Any]]
    drills: List[Dict[str, Any]]
    final_report: Dict[str, Any]


REPORT_SYSTEM = (
    "You are Kuvira AI Coach. You are a disciplined, evidence-first sports coach.\n"
    "GROUND RULES:\n"
    "1. NEVER invent player statistics. Only cite numbers that appear in the provided METRICS list.\n"
    "2. If MATCH ANALYTICS says an event type is unavailable or low-confidence, say so explicitly.\n"
    "3. Distinguish (A) verified facts, (B) retrieved coaching evidence, (C) model inference — do not present (C) as fact.\n"
    "4. If evidence is insufficient, say the coach does not yet have enough data.\n"
    "5. Structure every actionable answer as: Observation → Why it matters → Evidence → Action → Drill → Target.\n"
    "6. Keep sentences short. No hype. No emoji. No sparkles metaphors.\n"
)


REPORT_SCHEMA = {
    "title": "CoachingReport",
    "type": "object",
    "properties": {
        "match_summary": {"type": "string"},
        "data_quality_summary": {"type": "string"},
        "key_takeaway": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "weaknesses": {"type": "array", "items": {"type": "string"}},
        "tactical_observations": {"type": "array", "items": {"type": "string"}},
        "recommended_drills": {"type": "array", "items": {"type": "object", "properties": {"title": {"type": "string"}, "description": {"type": "string"}, "target": {"type": "string"}}}},
        "training_plan": {"type": "array", "items": {"type": "object", "properties": {"week": {"type": "integer"}, "focus": {"type": "string"}, "sessions": {"type": "array", "items": {"type": "string"}}}}},
        "unavailable": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["match_summary", "data_quality_summary", "unavailable"],
}


class CoachWorkflow:
    """Reusable workflow. If LangGraph is present we compile a StateGraph; if not
    we run the same nodes sequentially with the same state contract.
    """
    def __init__(self, provider: Optional[AIProvider] = None, retriever: Optional[KnowledgeRetriever] = None):
        self.provider = provider or get_default_provider()
        self.retriever = retriever
        self.graph = self._build() if LANGGRAPH_AVAILABLE else None

    # ---------------------------------------------------------------- nodes
    async def identify_intent(self, state: CoachState) -> CoachState:
        q = (state.get("query") or "").lower()
        if not q:
            state["intent"] = "generate_report"
        elif any(k in q for k in ["train", "plan", "practice", "drill"]):
            state["intent"] = "training_plan"
        elif any(k in q for k in ["why", "lose", "lost", "fix", "improve"]):
            state["intent"] = "diagnose"
        elif any(k in q for k in ["compare", "progress", "trend", "last"]):
            state["intent"] = "progress"
        else:
            state["intent"] = "chat"
        return state

    async def load_player_context(self, state: CoachState) -> CoachState:
        # Context is expected to be pre-loaded by the caller (Mongo). We just
        # ensure the keys exist so nodes downstream never NPE.
        state.setdefault("player_profile", {})
        state.setdefault("recent_match_history", [])
        return state

    async def load_match_analytics(self, state: CoachState) -> CoachState:
        state.setdefault("match_analytics", {})
        return state

    async def assess_data_quality(self, state: CoachState) -> CoachState:
        analytics = state.get("match_analytics") or {}
        dq = analytics.get("data_quality") or {}
        state["data_quality"] = dq
        return state

    async def diagnose(self, state: CoachState) -> CoachState:
        # We do not use the LLM to invent shot-level diagnoses. We produce a
        # structured, honest "what do we actually know" object that later nodes
        # feed into the LLM as ground truth.
        analytics = state.get("match_analytics") or {}
        dq = state.get("data_quality") or {}
        metrics = analytics.get("metrics") or []
        missing = dq.get("missing") or []

        available: List[Dict[str, Any]] = []
        for m in metrics:
            if (m.get("value") is not None) and (m.get("confidence", 0) >= 0.3):
                available.append(m)

        state["diagnosis"] = {
            "available_metrics": available,
            "missing_categories": missing,
            "overall_confidence": dq.get("overall_confidence", 0.0),
            "can_make_tactical_claims": bool(available) and (dq.get("overall_confidence", 0.0) >= 0.5),
        }
        return state

    async def retrieve_knowledge(self, state: CoachState) -> CoachState:
        if not self.retriever:
            state["retrieved_evidence"] = []
            return state
        profile = state.get("player_profile") or {}
        query_parts = [
            state.get("query") or "pickleball coaching guidance",
            profile.get("skill_level") or "",
            profile.get("primary_sport") or "pickleball",
        ]
        query = " ".join([p for p in query_parts if p]).strip()
        try:
            results = await self.retriever.retrieve(query, top_k=6, filters={"sport": "pickleball"})
        except Exception:
            log.exception("knowledge retrieval failed")
            results = []
        state["retrieved_evidence"] = [
            {"id": r.item.id, "title": r.item.title, "body": r.item.body,
             "authority_level": r.item.authority_level, "source_name": r.item.source_name,
             "score": r.score}
            for r in results
        ]
        return state

    async def generate_report(self, state: CoachState) -> CoachState:
        profile = state.get("player_profile") or {}
        analytics = state.get("match_analytics") or {}
        dq = state.get("data_quality") or {}
        diag = state.get("diagnosis") or {}
        evidence = state.get("retrieved_evidence") or []

        # We instruct the model that everything shot-level is unavailable when
        # we said so — and that it must acknowledge it in the report.
        prompt = {
            "player_profile": profile,
            "match_analytics": {
                "metrics": analytics.get("metrics", []),
                "analyzer": analytics.get("analyzer"),
            },
            "data_quality": dq,
            "diagnosis": diag,
            "retrieved_evidence": evidence,
            "instructions": (
                "Produce a JSON CoachingReport. Populate ONLY strengths/weaknesses/tactical_observations that are "
                "supported by (a) provided metrics or (b) retrieved evidence. Any player-specific claim you cannot "
                "support MUST be omitted, and the corresponding category MUST be listed in `unavailable`. "
                "`data_quality_summary` must plainly state what the system could and could not measure. "
                "Recommended drills should be drawn from retrieved_evidence where possible; each drill should have title, description, and a measurable target."
            ),
        }
        try:
            data = await self.provider.generate_structured_analysis(
                system=REPORT_SYSTEM, user=json.dumps(prompt), schema=REPORT_SCHEMA,
            )
        except Exception as e:
            log.exception("structured report generation failed")
            data = {
                "match_summary": "Coach could not reach the reasoning model. Please try again shortly.",
                "data_quality_summary": f"Analyzer produced {len(analytics.get('metrics', []))} legitimate video-level metrics. No shot-level analytics are available yet.",
                "unavailable": dq.get("missing", []) or ["shot_analytics"],
                "error": str(e)[:200],
            }
        state["final_report"] = data
        return state

    async def validate_evidence(self, state: CoachState) -> CoachState:
        """Strip any claim from the final report that is not backed by evidence.

        Concretely: if the diagnosis said we cannot make tactical claims, we
        move any populated `strengths`/`weaknesses`/`tactical_observations`
        into `unavailable` and clear them.
        """
        report = state.get("final_report") or {}
        diag = state.get("diagnosis") or {}
        if not diag.get("can_make_tactical_claims", False):
            moved = []
            for k in ("strengths", "weaknesses", "tactical_observations"):
                if report.get(k):
                    moved.append(k)
                report[k] = []
            unavailable = list(report.get("unavailable") or [])
            for m in moved:
                tag = f"{m}_require_shot_analytics"
                if tag not in unavailable:
                    unavailable.append(tag)
            report["unavailable"] = unavailable
        state["final_report"] = report
        return state

    async def finalize(self, state: CoachState) -> CoachState:
        return state

    # ------------------------------------------------------------------ build
    def _build(self):
        g = StateGraph(CoachState)
        g.add_node("identify_intent", self.identify_intent)
        g.add_node("load_player_context", self.load_player_context)
        g.add_node("load_match_analytics", self.load_match_analytics)
        g.add_node("assess_data_quality", self.assess_data_quality)
        g.add_node("diagnose", self.diagnose)
        g.add_node("retrieve_knowledge", self.retrieve_knowledge)
        g.add_node("generate_report", self.generate_report)
        g.add_node("validate_evidence", self.validate_evidence)
        g.add_node("finalize", self.finalize)

        g.set_entry_point("identify_intent")
        g.add_edge("identify_intent", "load_player_context")
        g.add_edge("load_player_context", "load_match_analytics")
        g.add_edge("load_match_analytics", "assess_data_quality")
        g.add_edge("assess_data_quality", "diagnose")
        g.add_edge("diagnose", "retrieve_knowledge")
        g.add_edge("retrieve_knowledge", "generate_report")
        g.add_edge("generate_report", "validate_evidence")
        g.add_edge("validate_evidence", "finalize")
        g.add_edge("finalize", END)
        return g.compile()

    # ------------------------------------------------------------------- run
    async def run(self, state: CoachState) -> CoachState:
        if self.graph:
            return await self.graph.ainvoke(state)  # type: ignore[return-value]
        # Fallback sequential runner if langgraph isn't importable.
        for step in [
            self.identify_intent, self.load_player_context, self.load_match_analytics,
            self.assess_data_quality, self.diagnose, self.retrieve_knowledge,
            self.generate_report, self.validate_evidence, self.finalize,
        ]:
            state = await step(state)
        return state
