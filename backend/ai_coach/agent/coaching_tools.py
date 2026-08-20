"""Agent-facing longitudinal coaching tools."""
from __future__ import annotations
from typing import Any, Dict
from ..coaching_state import CoachingStateService


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
