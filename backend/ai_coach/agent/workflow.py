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
        self.tools.register(AgentTool("get_player_profile", "Load the authenticated player's profile.", self.get_player_profile))
        self.tools.register(AgentTool("get_coaching_state", "Load persistent coaching state.", self.get_coaching_state))
        self.tools.register(AgentTool("get_match_history", "Load recent matches for longitudinal reasoning.", self.get_match_history))
        self.tools.register(AgentTool("get_match_analytics", "Load measured analytics for a match.", self.get_match_analytics))
        self.tools.register(AgentTool("analyze_video", "Use completed video analytics as evidence; never fabricate unavailable metrics.", self.analyze_video))
        self.tools.register(AgentTool("retrieve_coaching_knowledge", "Retrieve authoritative coaching knowledge for the goal.", self.retrieve_coaching_knowledge))
        self.tools.register(AgentTool("compare_matches", "Compare measured metrics across selected matches.", self.compare_matches))
        self.tools.register(AgentTool("get_training_history", "Load recorded training assignments and outcomes.", self.get_training_history))
        self.tools.register(AgentTool("get_previous_recommendations", "Load previous recommendations to avoid repetition.", self.get_previous_recommendations))
        self.tools.register(AgentTool("create_training_plan", "Create deduplicated training assignments from grounded recommendations.", self.create_training_plan, read_only=False))
        self.tools.register(AgentTool("assign_training", "Assign a single deduplicated training item.", self.assign_training, read_only=False))
        self.tools.register(AgentTool("get_training_outcomes", "Load completed training outcomes for longitudinal reasoning.", self.get_training_outcomes))

    async def get_player_profile(self, user_id: str, **_: Any) -> Dict[str, Any]:
        return await self.db.users.find_one({"id": user_id}, {"_id": 0}) or {}

    async def get_coaching_state(self, user_id: str, **_: Any) -> Dict[str, Any]:
        from ..coaching_state import CoachingStateService
        return await CoachingStateService(self.db).get_state(user_id)

    async def get_match_history(self, user_id: str, limit: int = 10, **_: Any) -> list[Dict[str, Any]]:
        return await self.db.ai_coach_matches.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)

    async def get_match_analytics(self, match_id: str, **_: Any) -> Dict[str, Any]:
        return await self.db.ai_coach_analytics.find_one({"match_id": match_id}, {"_id": 0}) or {}

    async def analyze_video(self, match_id: str, video_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
        analytics = await self.get_match_analytics(match_id)
        if video_id and analytics.get("video_id") not in {None, video_id}:
            return {"analytics": {}, "available": False, "confidence": 0.0, "reason": "video_does_not_match_analytics"}
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

    async def get_training_outcomes(self, user_id: str, limit: int = 20, **_: Any) -> list[Dict[str, Any]]:
        rows = await self.get_training_history(user_id, limit=limit)
        return [row for row in rows if row.get("outcome") is not None or row.get("status") in {"completed", "skipped"}]

    async def get_previous_recommendations(self, user_id: str, limit: int = 10, **_: Any) -> list[Dict[str, Any]]:
        try:
            return await self.db.ai_coach_recommendations.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
        except Exception:
            return []

    async def create_training_plan(self, user_id: str, recommendations: list[Dict[str, Any]] | None = None, match_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
        from ..coaching_state import CoachingStateService
        service = CoachingStateService(self.db)
        assignments = []
        for item in (recommendations or [])[:5]:
            if not isinstance(item, dict):
                continue
            rec = await service.record_recommendation(user_id, match_id, item)
            assignments.append(await service.assign_training(user_id, rec, match_id))
        return {"assignments": assignments}

    async def assign_training(self, user_id: str, recommendation: Dict[str, Any] | None = None, match_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
        return await self.create_training_plan(user_id, [recommendation] if recommendation else [], match_id=match_id)

    def _required_tool_args(self, state: CoachAgentState, name: str) -> Dict[str, Any]:
        args: Dict[str, Any] = {
            "user_id": state["user_id"], "match_id": state.get("match_id"), "video_id": state.get("video_id"),
            "sport": state.get("sport", "pickleball"), "query": state.get("goal", ""),
        }
        return {k: v for k, v in args.items() if v is not None}

    def _record_evidence(self, state: CoachAgentState, name: str, result: Any) -> None:
        available = bool(result)
        confidence = 1.0 if available else 0.0
        kind = name
        if name in {"get_match_analytics", "analyze_video"}:
            analytics = result.get("analytics", result) if isinstance(result, dict) else {}
            dq = analytics.get("data_quality") or {}
            confidence = float(result.get("confidence", dq.get("overall_confidence", 0.0))) if isinstance(result, dict) else 0.0
            available = bool(result.get("available", True)) and bool(analytics)
            kind = "video_analysis" if name == "analyze_video" else "match_analytics"
        elif name == "get_coaching_state":
            kind = "coaching_state"
        elif name == "compare_matches":
            kind = "match_comparison"; available = bool(result.get("matches"))
        elif name == "get_training_history":
            kind = "training_history"
        elif name == "get_training_outcomes":
            kind = "training_outcomes"
        elif name == "get_previous_recommendations":
            kind = "previous_recommendations"
        elif name == "retrieve_coaching_knowledge":
            kind = "coaching_knowledge"
            confidence = min([float(x.get("confidence", 0.0)) for x in result], default=0.0)
        elif name == "get_match_history":
            kind = "match_history"
        state.setdefault("evidence", []).append({"kind": kind, "source": name, "confidence": confidence, "data": result, "available": available})

    async def _execute_plan(self, state: CoachAgentState) -> None:
        for action in state.get("plan", []):
            if state.get("step_count", 0) >= state.get("max_steps", 8):
                break
            name = action["tool"]
            args = self._required_tool_args(state, name)
            try:
                result = await self.tools.execute(name, **args)
                state.setdefault("tool_calls", []).append({"tool": name, "args": args, "result": result})
                state["step_count"] = state.get("step_count", 0) + 1
                if name == "get_player_profile": state["player_context"] = result
                elif name == "get_coaching_state": state["coaching_state"] = result
                elif name == "get_match_analytics": state["match_analytics"] = result
                elif name == "retrieve_coaching_knowledge": state["knowledge"] = result
                elif name == "get_training_history": state["training_history"] = result
                elif name == "get_previous_recommendations": state["previous_recommendations"] = result
                self._record_evidence(state, name, result)
            except Exception as exc:
                log.exception("agent tool failed: %s", name)
                state.setdefault("tool_calls", []).append({"tool": name, "args": args, "error": str(exc)})
                state["step_count"] = state.get("step_count", 0) + 1
                state.setdefault("evidence", []).append({"kind": name, "source": name, "confidence": 0.0, "data": {}, "available": False})

    async def _synthesize(self, state: CoachAgentState) -> Dict[str, Any]:
        evidence = state.get("evidence", [])
        prompt = {
            "goal": state.get("goal"), "intent": state.get("intent"), "player": state.get("player_context", {}),
            "coaching_state": state.get("coaching_state", {}), "analytics": state.get("match_analytics", {}),
            "evidence": evidence, "knowledge": state.get("knowledge", []),
            "training_history": state.get("training_history", []), "previous_recommendations": state.get("previous_recommendations", []),
            "critic": state.get("critique", {}),
            "instructions": "Return JSON. Never invent statistics, positioning, shot/rally outcomes, tactical observations or confidence. Distinguish FACT, EVIDENCE, INFERENCE and ACTION. Player-specific claims must cite supplied evidence. If evidence is insufficient, put the limitation in unavailable and do not make the claim.",
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
            state["missing_evidence"] = critique.get("missing_evidence", [])
            action = self.critic.next_action(critique, state.get("replan_count", 0), state.get("max_replans", 2))
            state["next_action"] = action
            if action == "replan":
                state["replan_count"] = state.get("replan_count", 0) + 1
                missing = set(critique.get("missing_evidence", []))
                mapping = {
                    "player_profile": "get_player_profile", "coaching_state": "get_coaching_state", "match_analytics": "get_match_analytics",
                    "video_analysis": "analyze_video", "match_history": "get_match_history", "match_comparison": "compare_matches",
                    "training_history": "get_training_history", "training_outcomes": "get_training_outcomes",
                    "previous_recommendations": "get_previous_recommendations", "coaching_knowledge": "retrieve_coaching_knowledge",
                }
                missing_tools = {mapping.get(x, x) for x in missing}
                state["plan"] = [p for p in state.get("plan", []) if p.get("tool") in missing_tools]
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
