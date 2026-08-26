"""Deterministic, evidence-first planner for the bounded coaching agent.

The planner is intentionally deterministic at the safety boundary. It can be
replaced by an LLM-assisted planner later, but every proposed action still has
to come from the typed tool registry and the evidence critic.
"""
from __future__ import annotations
from typing import Any, Dict, List


INTENT_RULES = {
    "match_analysis": ("why", "lost", "lose", "match", "game", "performance", "points"),
    "training": ("train", "training", "drill", "practice", "work on", "today", "this week"),
    "progress": ("progress", "improve", "improvement", "trend", "getting better", "better"),
    "comparison": ("compare", "versus", "vs", "difference", "better than", "last five"),
    "technique_diagnosis": ("backhand", "forehand", "serve", "return", "dink", "drive", "drop", "volley", "lob", "overhead", "reset", "swing", "technique"),
}

BASE_CONTEXT_TOOLS = [
    ("get_player_profile", "establish authenticated player context"),
    ("get_coaching_state", "load persistent goals, focus, strengths, weaknesses and adherence"),
]


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
        required: List[str] = ["player_profile", "coaching_state"]
        actions: List[Dict[str, Any]] = [
            {"tool": name, "reason": reason} for name, reason in BASE_CONTEXT_TOOLS
        ]

        if context.get("match_id") or context.get("video_id"):
            required.append("match_analytics")
            actions.append({"tool": "get_match_analytics", "reason": "ground the answer in measured match evidence"})
            if context.get("video_id"):
                required.append("video_analysis")
                actions.append({"tool": "analyze_video", "reason": "include completed video-analysis evidence"})

        if intent in {"match_analysis", "technique_diagnosis"}:
            if "match_analytics" not in required:
                required.append("match_analytics")
                actions.append({"tool": "get_match_analytics", "reason": "ground diagnosis in observed match evidence"})
            required.append("coaching_knowledge")
            actions.append({"tool": "retrieve_coaching_knowledge", "reason": "ground interpretation in coaching methodology"})
            if intent == "technique_diagnosis" and context.get("video_id") and "video_analysis" not in required:
                required.append("video_analysis")
                actions.append({"tool": "analyze_video", "reason": "obtain temporal technique evidence when available"})
        elif intent == "comparison":
            required += ["match_history", "match_comparison"]
            actions += [
                {"tool": "get_match_history", "reason": "select comparable matches"},
                {"tool": "compare_matches", "reason": "measure change and recurring patterns"},
            ]
        elif intent == "progress":
            required += ["match_history", "training_history", "previous_recommendations"]
            actions += [
                {"tool": "get_match_history", "reason": "establish longitudinal baseline"},
                {"tool": "get_training_history", "reason": "connect training adherence and outcomes"},
                {"tool": "get_previous_recommendations", "reason": "compare prior coaching focus"},
            ]
        elif intent == "training":
            required += ["training_history", "previous_recommendations", "coaching_knowledge"]
            actions += [
                {"tool": "get_training_history", "reason": "avoid assigning duplicate or stale work"},
                {"tool": "get_previous_recommendations", "reason": "avoid repeating prior recommendations"},
                {"tool": "retrieve_coaching_knowledge", "reason": "select evidence-based drills"},
            ]
        else:
            required.append("coaching_knowledge")
            actions.append({"tool": "retrieve_coaching_knowledge", "reason": "provide grounded general coaching guidance"})

        # Training mutation tools are only planned after evidence gathering. The
        # final state-transition service remains the authoritative dedupe gate.
        return {
            "intent": intent,
            "required_evidence": required,
            "plan": actions,
            "max_steps": self.max_steps,
            "max_replans": self.max_replans,
        }
