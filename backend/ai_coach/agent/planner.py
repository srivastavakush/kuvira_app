"""Deterministic evidence planner with an LLM-ready contract."""
from __future__ import annotations
from typing import Any, Dict, List


INTENT_RULES = {
    "match_analysis": ("why", "lost", "lose", "match", "game", "performance"),
    "training": ("train", "training", "drill", "practice", "work on"),
    "progress": ("progress", "improve", "improvement", "trend", "getting better"),
    "comparison": ("compare", "versus", "vs", "difference", "better than"),
}


class AgentPlanner:
    def __init__(self, max_steps: int = 8, max_replans: int = 2) -> None:
        self.max_steps = max(1, max_steps)
        self.max_replans = max(0, max_replans)

    def classify_intent(self, goal: str) -> str:
        text = (goal or "").lower()
        scores = {k: sum(1 for token in tokens if token in text) for k, tokens in INTENT_RULES.items()}
        return max(scores, key=scores.get) if max(scores.values(), default=0) else "general_coaching"

    def plan(self, goal: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        context = context or {}
        intent = self.classify_intent(goal)
        required: List[str] = ["player_profile"]
        actions: List[Dict[str, Any]] = [{"tool": "get_player_profile", "reason": "establish player context"}]

        # A match/video context is an explicit evidence requirement even when
        # the user's wording is generic (e.g. report generation).
        if context.get("match_id") or context.get("video_id"):
            required.append("match_analytics")
            actions.append({"tool": "get_match_analytics", "reason": "ground the answer in measured match evidence"})
            if context.get("video_id"):
                required.append("video_analysis")
                actions.insert(-1, {"tool": "analyze_video", "reason": "include the completed video-analysis evidence"})

        if intent == "match_analysis":
            if "match_analytics" not in required:
                required.append("match_analytics")
                actions.append({"tool": "get_match_analytics", "reason": "ground diagnosis in observed match evidence"})
            required.append("coaching_knowledge")
            actions.append({"tool": "retrieve_coaching_knowledge", "reason": "ground recommendations in methodology"})
        elif intent == "comparison":
            required += ["match_history", "match_comparison"]
            actions += [
                {"tool": "get_match_history", "reason": "select comparable matches"},
                {"tool": "compare_matches", "reason": "measure change and recurring patterns"},
            ]
        elif intent == "progress":
            required += ["match_history", "training_history"]
            actions += [
                {"tool": "get_match_history", "reason": "establish longitudinal baseline"},
                {"tool": "get_training_history", "reason": "connect training to outcomes"},
            ]
        elif intent == "training":
            required += ["coaching_knowledge", "previous_recommendations"]
            actions += [
                {"tool": "retrieve_coaching_knowledge", "reason": "select evidence-based drills"},
                {"tool": "get_previous_recommendations", "reason": "avoid repeating stale advice"},
            ]
        else:
            if "coaching_knowledge" not in required:
                required.append("coaching_knowledge")
                actions.append({"tool": "retrieve_coaching_knowledge", "reason": "provide grounded coaching guidance"})

        return {"intent": intent, "required_evidence": required, "plan": actions,
                "max_steps": self.max_steps, "max_replans": self.max_replans}
