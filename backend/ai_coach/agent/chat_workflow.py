"""Agentic chat over the same planner/tool/critic runtime as reports."""
from __future__ import annotations
from typing import Any, Optional

from .workflow import AgenticCoachWorkflow


class AgenticChatWorkflow(AgenticCoachWorkflow):
    """Use the shared evidence loop for conversational coaching.

    Chat does not bypass evidence planning. The response is generated from the
    same player/match/history/training evidence and the same critic guard.
    """

    async def run_chat(
        self,
        *,
        user_id: str,
        message: str,
        session_id: Optional[str] = None,
        match_id: Optional[str] = None,
        video_id: Optional[str] = None,
        sport: str = "pickleball",
    ) -> dict[str, Any]:
        prior = await self.db.ai_coach_chat.find(
            {"user_id": user_id, "session_id": session_id or f"coach-{user_id}"},
            {"_id": 0, "role": 1, "text": 1, "created_at": 1},
        ).sort("created_at", -1).to_list(12)
        prior.reverse()
        context = "\n".join(f"{x.get('role', 'user')}: {x.get('text', '')}" for x in prior[-8:])
        goal = message if not context else f"Recent conversation:\n{context}\n\nCurrent player request:\n{message}"
        state = await self.run(
            user_id=user_id,
            goal=goal,
            match_id=match_id,
            video_id=video_id,
            sport=sport,
        )
        report = state.get("final_report", {})
        reply = report.get("reply") or report.get("key_takeaway") or report.get("match_summary") or "I need more evidence to answer that safely."
        now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        sid = session_id or f"coach-{user_id}"
        await self.db.ai_coach_chat.insert_one({"session_id": sid, "user_id": user_id, "role": "user", "text": message, "match_id": match_id, "created_at": now})
        await self.db.ai_coach_chat.insert_one({"session_id": sid, "user_id": user_id, "role": "assistant", "text": reply, "match_id": match_id, "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()})
        return {"session_id": sid, "reply": reply, "match_id": match_id, "agent": state.get("agent", {}), "evidence": state.get("evidence", []), "critique": state.get("critique", {})}
