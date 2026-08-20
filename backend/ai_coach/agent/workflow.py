"""Bounded agentic coaching workflow."""
from __future__ import annotations
import json
import logging
from typing import Any, Dict, Optional

from .state import CoachAgentState
from .tools import AgentTool, AgentToolRegistry
from .planner import AgentPlanner
from .critic import EvidenceCritic
from ..providers import AIProvider, get_default_provider
from ..retriever import KnowledgeRetriever, get_default_retriever

log = logging.getLogger("kuvira.ai_coach.agent")


class AgenticCoachWorkflow:
    def __init__(self, db: Any, provider: Optional[AIProvider] = None, retriever: Optional[KnowledgeRetriever] = None):
        self.db = db
        self.provider = provider or get_default_provider()
        self.retriever = retriever or get_default_retriever(db)
        self.planner = AgentPlanner()
        self.critic = EvidenceCritic()
        self.tools = AgentToolRegistry()
        self._register_tools()

    def _register_tools(self) -> None:
        self.tools.register(AgentTool("get_player_profile", "Load the authenticated player's coaching profile.", self.get_player_profile))
        self.tools.register(AgentTool("get_match_history", "Load recent matches for longitudinal reasoning.", self.get_match_history))
        self.tools.register(AgentTool("get_match_analytics", "Load measured analytics for a match.", self.get_match_analytics))
        self.tools.register(AgentTool("analyze_video", "Use completed video analytics as evidence; never fabricate unavailable metrics.", self.analyze_video))
        self.tools.register(AgentTool("retrieve_coaching_knowledge", "Retrieve authoritative coaching knowledge for the goal.", self.retrieve_coaching_knowledge))
        self.tools.register(AgentTool("compare_matches", "Compare measured metrics across selected matches.", self.compare_matches))
        self.tools.register(AgentTool("get_training_history", "Load recorded AI Coach training/recommendation outcomes.", self.get_training_history))
        self.tools.register(AgentTool("get_previous_recommendations", "Load previous recommendations to avoid repetition.", self.get_previous_recommendations))

    async def get_player_profile(self, user_id: str, **_: Any) -> Dict[str, Any]:
        return await self.db.users.find_one({"id": user_id}, {"_id": 0}) or {}

    async def get_match_history(self, user_id: str, limit: int = 10, **_: Any) -> list[Dict[str, Any]]:
        return await self.db.ai_coach_matches.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)

    async def get_match_analytics(self, match_id: str, **_: Any) -> Dict[str, Any]:
        return await self.db.ai_coach_analytics.find_one({"match_id": match_id}, {"_id": 0}) or {}

    async def analyze_video(self, match_id: str, **_: Any) -> Dict[str, Any]:
        analytics = await self.get_match_analytics(match_id)
        return {"analytics": analytics, "available": bool(analytics), "confidence": float((analytics.get("data_quality") or {}).get("overall_confidence", 0.0))}

    async def retrieve_coaching_knowledge(self, query: str, sport: str = "pickleball", **_: Any) -> list[Dict[str, Any]]:
        results = await self.retriever.retrieve(query or "sports coaching", top_k=6, filters={"sport": sport})
        return [{"id": r.item.id, "title": r.item.title, "body": r.item.body, "source": r.item.source_name,
                 "authority_level": r.item.authority_level, "confidence": r.item.confidence, "score": r.score} for r in results]

    async def compare_matches(self, user_id: str, match_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
        matches = await self.get_match_history(user_id, limit=6)
        if match_id:
            matches = [m for m in matches if m.get("id") == match_id] + [m for m in matches if m.get("id") != match_id]
        rows = []
        for match in matches[:5]:
            analytics = await self.get_match_analytics(match.get("id", ""))
            rows.append({"match_id": match.get("id"), "created_at": match.get("created_at"), "metrics": analytics.get("metrics", []),
                         "data_quality": analytics.get("data_quality", {})})
        return {"matches": rows}

    async def get_training_history(self, user_id: str, limit: int = 20, **_: Any) -> list[Dict[str, Any]]:
        try:
            return await self.db.ai_coach_training.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        except Exception:
            return []

    async def get_previous_recommendations(self, user_id: str, limit: int = 10, **_: Any) -> list[Dict[str, Any]]:
        try:
            return await self.db.ai_coach_recommendations.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        except Exception:
            return await self.db.ai_coach_reports.find({"user_id": user_id}, {"_id": 0, "recommended_drills": 1, "generated_at": 1}).sort("generated_at", -1).to_list(limit)

    async def _execute_plan(self, state: CoachAgentState) -> None:
        for action in state.get("plan", []):
            if state.get("step_count", 0) >= state.get("max_steps", 8):
                break
            name = action["tool"]
            args: Dict[str, Any] = {"user_id": state["user_id"], "match_id": state.get("match_id"), "sport": state.get("sport", "pickleball"), "query": state.get("goal", "")}
            try:
                result = await self.tools.execute(name, **args)
                state.setdefault("tool_calls", []).append({"tool": name, "args": args, "result": result})
                state["step_count"] = state.get("step_count", 0) + 1
                if name == "get_player_profile":
                    state["player_context"] = result
                    state.setdefault("evidence", []).append({"kind": "player_profile", "source": "users", "confidence": 1.0, "data": result, "available": bool(result)})
                elif name == "get_match_analytics":
                    state["match_analytics"] = result
                    dq = result.get("data_quality") or {}
                    state.setdefault("evidence", []).append({"kind": "match_analytics", "source": result.get("analyzer", "analyzer"), "confidence": float(dq.get("overall_confidence", 0.0)), "data": result, "available": bool(result)})
                elif name == "analyze_video":
                    dq = (result.get("analytics") or {}).get("data_quality") or {}
                    state.setdefault("evidence", []).append({"kind": "video_analysis", "source": "video_analyzer", "confidence": float(dq.get("overall_confidence", 0.0)), "data": result, "available": bool(result.get("available"))})
                elif name == "get_match_history":
                    state.setdefault("evidence", []).append({"kind": "match_history", "source": "ai_coach_matches", "confidence": 1.0, "data": result, "available": bool(result)})
                elif name == "compare_matches":
                    state.setdefault("evidence", []).append({"kind": "match_comparison", "source": "ai_coach_analytics", "confidence": 1.0 if result.get("matches") else 0.0, "data": result, "available": bool(result.get("matches"))})
                elif name == "get_training_history":
                    state.setdefault("evidence", []).append({"kind": "training_history", "source": "ai_coach_training", "confidence": 1.0 if result else 0.0, "data": result, "available": bool(result)})
                elif name == "get_previous_recommendations":
                    state.setdefault("evidence", []).append({"kind": "previous_recommendations", "source": "ai_coach_recommendations", "confidence": 1.0 if result else 0.0, "data": result, "available": bool(result)})
                elif name == "retrieve_coaching_knowledge":
                    state["knowledge"] = result
                    state.setdefault("evidence", []).append({"kind": "coaching_knowledge", "source": "knowledge_retriever", "confidence": min([float(x.get("confidence", 0.0)) for x in result], default=0.0), "data": result, "available": bool(result)})
            except Exception as exc:
                log.exception("agent tool failed: %s", name)
                state.setdefault("tool_calls", []).append({"tool": name, "args": args, "error": str(exc)})
                state["step_count"] = state.get("step_count", 0) + 1

    async def _synthesize(self, state: CoachAgentState) -> Dict[str, Any]:
        evidence = state.get("evidence", [])
        prompt = {
            "goal": state.get("goal"), "intent": state.get("intent"), "player": state.get("player_context", {}),
            "analytics": state.get("match_analytics", {}), "evidence": evidence, "knowledge": state.get("knowledge", []),
            "previous_recommendations": [e.get("data") for e in evidence if e.get("kind") == "previous_recommendations"],
            "critic": state.get("critique", {}),
            "instructions": "Return JSON. Never invent statistics or tactical observations. Separate measured facts from inference. If evidence is insufficient, put the limitation in unavailable and do not make player-specific tactical claims.",
        }
        schema = {"title": "AgenticCoachingReport", "type": "object", "properties": {
            "match_summary": {"type": "string"}, "data_quality_summary": {"type": "string"}, "key_takeaway": {"type": "string"},
            "strengths": {"type": "array", "items": {"type": "string"}}, "weaknesses": {"type": "array", "items": {"type": "string"}},
            "tactical_observations": {"type": "array", "items": {"type": "string"}}, "recommended_drills": {"type": "array", "items": {"type": "object"}},
            "training_plan": {"type": "array", "items": {"type": "object"}}, "unavailable": {"type": "array", "items": {"type": "string"}},
        }, "required": ["match_summary", "data_quality_summary", "unavailable"]}
        return await self.provider.generate_structured_analysis(
            system="You are Kuvira's evidence-first agentic sports coach. Use only supplied evidence. Do not fabricate.",
            user=json.dumps(prompt, default=str), schema=schema)

    @staticmethod
    def _apply_critic_guard(report: Dict[str, Any], critique: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic final safety gate; never trust model compliance alone."""
        if critique.get("approved"):
            return report
        unavailable = list(report.get("unavailable") or [])
        for key in ("strengths", "weaknesses", "tactical_observations"):
            if report.get(key):
                report[key] = []
                tag = f"{key}_requires_more_evidence"
                if tag not in unavailable:
                    unavailable.append(tag)
        report["unavailable"] = unavailable
        return report

    async def run(self, *, user_id: str, goal: str = "Generate a grounded coaching report", match_id: Optional[str] = None, video_id: Optional[str] = None, sport: str = "pickleball") -> CoachAgentState:
        state: CoachAgentState = {"user_id": user_id, "goal": goal, "match_id": match_id, "video_id": video_id, "sport": sport,
                                  "evidence": [], "tool_calls": [], "step_count": 0, "replan_count": 0, "max_steps": self.planner.max_steps, "max_replans": self.planner.max_replans, "done": False}
        state.update(self.planner.plan(goal, {"match_id": match_id, "video_id": video_id}))
        while not state.get("done"):
            await self._execute_plan(state)
            critique = self.critic.evaluate(state.get("required_evidence", []), state.get("evidence", []))
            state["critique"] = critique
            action = self.critic.next_action(critique, state.get("replan_count", 0), state.get("max_replans", 2))
            state["next_action"] = action
            if action == "replan":
                state["replan_count"] = state.get("replan_count", 0) + 1
                missing = set(critique.get("missing_evidence", []))
                mapping = {
                    "player_profile": "get_player_profile", "match_analytics": "get_match_analytics",
                    "video_analysis": "analyze_video", "match_history": "get_match_history",
                    "match_comparison": "compare_matches", "training_history": "get_training_history",
                    "previous_recommendations": "get_previous_recommendations", "coaching_knowledge": "retrieve_coaching_knowledge",
                }
                state["plan"] = [p for p in state.get("plan", []) if p.get("tool") in {mapping.get(x, x) for x in missing}]
                if not state["plan"]:
                    state["next_action"] = "safe_finalize"
                    break
                continue
            state["done"] = True
        try:
            report = await self._synthesize(state)
            state["final_report"] = self._apply_critic_guard(report, state.get("critique", {}))
        except Exception as exc:
            log.exception("agent synthesis failed")
            state["final_report"] = {"match_summary": "Coach could not reach the reasoning model.", "data_quality_summary": "The evidence pipeline completed, but reasoning is unavailable.", "unavailable": ["reasoning_layer"], "error": str(exc)[:200]}
        return state
