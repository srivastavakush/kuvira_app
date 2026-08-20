"""Longitudinal coaching state and adaptive-training persistence helpers."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CoachingStateService:
    """Mongo-backed player coaching state.

    State is append-safe: observations and outcomes are recorded as events while
    `ai_coach_player_state` stores the latest compact summary for fast reads.
    """
    def __init__(self, db: Any):
        self.db = db

    async def ensure_indexes(self) -> None:
        await self.db.ai_coach_player_state.create_index("user_id", unique=True)
        await self.db.ai_coach_goals.create_index([("user_id", 1), ("status", 1)])
        await self.db.ai_coach_recommendations.create_index([("user_id", 1), ("created_at", -1)])
        await self.db.ai_coach_training.create_index([("user_id", 1), ("created_at", -1)])
        await self.db.ai_coach_training.create_index([("user_id", 1), ("status", 1)])
        await self.db.ai_coach_coaching_events.create_index([("user_id", 1), ("created_at", -1)])

    async def get_state(self, user_id: str) -> Dict[str, Any]:
        await self.ensure_indexes()
        doc = await self.db.ai_coach_player_state.find_one({"user_id": user_id}, {"_id": 0})
        if doc:
            return doc
        empty = {
            "user_id": user_id,
            "goals": [],
            "active_focus": [],
            "recurring_weaknesses": [],
            "improving_areas": [],
            "regressions": [],
            "training_adherence": {},
            "last_analyzed_match_id": None,
            "updated_at": now_iso(),
        }
        await self.db.ai_coach_player_state.insert_one(empty.copy())
        return empty

    async def upsert_state(self, user_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        await self.ensure_indexes()
        patch = {**patch, "updated_at": now_iso()}
        await self.db.ai_coach_player_state.update_one({"user_id": user_id}, {"$set": patch}, upsert=True)
        return await self.get_state(user_id)

    async def add_goal(self, user_id: str, title: str, target: Optional[str] = None, due_at: Optional[str] = None) -> Dict[str, Any]:
        await self.ensure_indexes()
        goal = {"id": f"goal-{int(datetime.now(timezone.utc).timestamp() * 1000000)}", "user_id": user_id,
                "title": title, "target": target, "due_at": due_at, "status": "active", "created_at": now_iso()}
        await self.db.ai_coach_goals.insert_one(goal.copy())
        goals = await self.db.ai_coach_goals.find({"user_id": user_id, "status": "active"}, {"_id": 0}).sort("created_at", -1).to_list(50)
        await self.upsert_state(user_id, {"goals": goals})
        return goal

    async def update_goal(self, user_id: str, goal_id: str, status: str) -> Optional[Dict[str, Any]]:
        await self.ensure_indexes()
        await self.db.ai_coach_goals.update_one({"id": goal_id, "user_id": user_id}, {"$set": {"status": status, "updated_at": now_iso()}})
        return await self.db.ai_coach_goals.find_one({"id": goal_id, "user_id": user_id}, {"_id": 0})

    async def record_recommendation(self, user_id: str, match_id: Optional[str], payload: Dict[str, Any], source: str = "agent") -> Dict[str, Any]:
        await self.ensure_indexes()
        doc = {"user_id": user_id, "match_id": match_id, "source": source, "created_at": now_iso(), **payload}
        await self.db.ai_coach_recommendations.insert_one(doc.copy())
        return {k: v for k, v in doc.items()}

    async def assign_training(self, user_id: str, recommendation: Dict[str, Any], match_id: Optional[str] = None) -> Dict[str, Any]:
        await self.ensure_indexes()
        doc = {
            "id": f"training-{int(datetime.now(timezone.utc).timestamp() * 1000000)}",
            "user_id": user_id,
            "match_id": match_id,
            "title": recommendation.get("title") or recommendation.get("focus") or "Training session",
            "description": recommendation.get("description", ""),
            "target": recommendation.get("target"),
            "status": "assigned",
            "outcome": None,
            "created_at": now_iso(),
            "completed_at": None,
        }
        await self.db.ai_coach_training.insert_one(doc.copy())
        return doc

    async def record_training_outcome(self, user_id: str, training_id: str, status: str, outcome: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        await self.ensure_indexes()
        completed_at = now_iso() if status in {"completed", "skipped"} else None
        await self.db.ai_coach_training.update_one(
            {"id": training_id, "user_id": user_id},
            {"$set": {"status": status, "outcome": outcome, "completed_at": completed_at, "updated_at": now_iso()}},
        )
        doc = await self.db.ai_coach_training.find_one({"id": training_id, "user_id": user_id}, {"_id": 0})
        if doc:
            await self._refresh_adherence(user_id)
            await self.db.ai_coach_coaching_events.insert_one({"user_id": user_id, "type": "training_outcome", "training_id": training_id, "status": status, "outcome": outcome, "created_at": now_iso()})
        return doc

    async def _refresh_adherence(self, user_id: str) -> None:
        rows = await self.db.ai_coach_training.find({"user_id": user_id}, {"_id": 0, "status": 1}).to_list(500)
        assigned = len(rows)
        completed = sum(1 for r in rows if r.get("status") == "completed")
        skipped = sum(1 for r in rows if r.get("status") == "skipped")
        rate = completed / assigned if assigned else 0.0
        await self.upsert_state(user_id, {"training_adherence": {"assigned": assigned, "completed": completed, "skipped": skipped, "completion_rate": round(rate, 4)}})

    async def record_coaching_event(self, user_id: str, event_type: str, payload: Dict[str, Any]) -> None:
        await self.ensure_indexes()
        await self.db.ai_coach_coaching_events.insert_one({"user_id": user_id, "type": event_type, "payload": payload, "created_at": now_iso()})
