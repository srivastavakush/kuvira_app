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
    """Compatibility facade over the complete agentic workflow.

    Existing callers can continue to instantiate `CoachWorkflow(provider,
    retriever)` and call `run(state)`. The underlying workflow now plans and
    executes typed tools, critiques evidence, replans within hard limits, and
    synthesizes only from collected evidence.
    """
    def __init__(self, provider: Optional[AIProvider] = None, retriever: Optional[KnowledgeRetriever] = None):
        self.provider = provider or get_default_provider()
        self.retriever = retriever
        self.agent: Optional[AgenticCoachWorkflow] = None
        db = getattr(retriever, "db", None)
        if db is not None:
            self.agent = AgenticCoachWorkflow(db=db, provider=self.provider, retriever=retriever)

    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        if self.agent is None:
            # This should only occur in isolated unit tests with a fake retriever.
            # Keep a deterministic safe response rather than silently inventing data.
            return {
                **state,
                "final_report": {
                    "match_summary": "Agent runtime is not connected to the application data store.",
                    "data_quality_summary": "No database-backed evidence tools are available.",
                    "unavailable": ["agent_tools"],
                },
                "retrieved_evidence": [],
            }
        result = await self.agent.run(
            user_id=state.get("user_id", ""),
            goal=state.get("query") or "Generate a grounded coaching report",
            match_id=state.get("match_id"),
            sport=(state.get("match_analytics") or {}).get("sport") or state.get("sport") or "pickleball",
        )
        # Preserve the fields expected by the existing report endpoint.
        return {
            **state,
            "intent": result.get("intent"),
            "player_profile": result.get("player_context", state.get("player_profile", {})),
            "match_analytics": result.get("match_analytics", state.get("match_analytics", {})),
            "retrieved_evidence": result.get("knowledge", []),
            "agent": {
                "plan": result.get("plan", []),
                "tool_calls": result.get("tool_calls", []),
                "critique": result.get("critique", {}),
                "replan_count": result.get("replan_count", 0),
                "step_count": result.get("step_count", 0),
            },
            "final_report": result.get("final_report", {}),
        }
