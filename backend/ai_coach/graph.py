"""Agentic AI Coach graph entry point.

The public `CoachWorkflow` contract is retained for backwards compatibility,
while orchestration is delegated to the bounded planner/tool/critic workflow.
"""
from __future__ import annotations
from typing import Any, Dict, Optional

from .providers import AIProvider, get_default_provider
from .retriever import KnowledgeRetriever
from .agent.workflow import AgenticCoachWorkflow


class CoachWorkflow:
    def __init__(self, provider: Optional[AIProvider] = None, retriever: Optional[KnowledgeRetriever] = None):
        self.provider = provider or get_default_provider()
        self.retriever = retriever
        self.agent: Optional[AgenticCoachWorkflow] = None
        db = getattr(retriever, "db", None)
        if db is not None:
            self.agent = AgenticCoachWorkflow(db=db, provider=self.provider, retriever=retriever)

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        if self.agent is None:
            return {
                **state,
                "final_report": {
                    "match_summary": "Agent runtime is not connected to the application data store.",
                    "data_quality_summary": "No database-backed evidence tools are available.",
                    "unavailable": ["agent_tools"],
                },
                "retrieved_evidence": [],
            }
        analytics = state.get("match_analytics") or {}
        result = await self.agent.run(
            user_id=state.get("user_id", ""),
            goal=state.get("query") or "Generate a grounded coaching report",
            match_id=state.get("match_id"),
            video_id=state.get("video_id") or analytics.get("video_id"),
            sport=analytics.get("sport") or state.get("sport") or "pickleball",
        )
        return {
            **state,
            "intent": result.get("intent"),
            "player_profile": result.get("player_context", state.get("player_profile", {})),
            "match_analytics": result.get("match_analytics", analytics),
            "retrieved_evidence": result.get("knowledge", []),
            "agent": {
                "plan": result.get("plan", []), "tool_calls": result.get("tool_calls", []),
                "critique": result.get("critique", {}), "replan_count": result.get("replan_count", 0),
                "step_count": result.get("step_count", 0), "next_action": result.get("next_action"),
            },
            "final_report": result.get("final_report", {}),
        }
