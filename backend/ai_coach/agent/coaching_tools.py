"""Agent-facing longitudinal coaching tools and workflow integration."""
from __future__ import annotations
from typing import Any, Dict
from ..coaching_state import CoachingStateService
from .workflow import AgenticCoachWorkflow
from .tools import AgentTool


class CoachingTools:
    def __init__(self, db: Any):
        self.state = CoachingStateService(db)

    async def get_coaching_state(self, user_id: str) -> Dict[str, Any]:
        return await self.state.get_state(user_id)

    async def get_training_history(self, user_id: str, limit: int = 20) -> Dict[str, Any]:
        await self.state.ensure_indexes()
        rows = await self.state.db.ai_coach_training.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 100))
        return {"training": rows}

    async def get_previous_recommendations(self, user_id: str, limit: int = 20) -> Dict[str, Any]:
        await self.state.ensure_indexes()
        rows = await self.state.db.ai_coach_recommendations.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 100))
        return {"recommendations": rows}

    async def create_training_plan(self, user_id: str, recommendations: list[Dict[str, Any]], match_id: str | None = None) -> Dict[str, Any]:
        assignments = []
        for item in recommendations[:10]:
            await self.state.record_recommendation(user_id, match_id, item)
            assignments.append(await self.state.assign_training(user_id, item, match_id))
        return {"assignments": assignments}


class LongitudinalCoachWorkflow(AgenticCoachWorkflow):
    """Agent workflow that treats coaching history as first-class evidence."""
    def _register_tools(self) -> None:
        super()._register_tools()
        self.coaching = CoachingTools(self.db)
        self.tools.register(AgentTool("get_coaching_state", "Load persistent player coaching state.", self.coaching.get_coaching_state))
        self.tools.register(AgentTool("get_training_history", "Load training assignments and outcomes.", self.coaching.get_training_history))
        self.tools.register(AgentTool("get_previous_recommendations", "Load prior coaching recommendations.", self.coaching.get_previous_recommendations))

    async def run(self, **kwargs: Any):
        result = await super().run(**kwargs)
        user_id = kwargs["user_id"]
        coaching_state = await self.coaching.get_coaching_state(user_id)
        result["coaching_state"] = coaching_state
        result.setdefault("evidence", []).append({
            "kind": "coaching_state", "source": "ai_coach_player_state", "confidence": 1.0,
            "data": coaching_state, "available": True,
        })
        report = result.get("final_report") or {}
        recommendations = report.get("recommended_drills") or report.get("training_plan") or []
        if recommendations and kwargs.get("match_id"):
            for item in recommendations[:5]:
                await self.coaching.state.record_recommendation(user_id, kwargs.get("match_id"), item)
        if kwargs.get("match_id"):
            await self.coaching.state.upsert_state(user_id, {"last_analyzed_match_id": kwargs.get("match_id")})
        return result
