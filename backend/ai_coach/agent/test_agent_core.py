"""Fast unit checks for the agentic control plane.

These tests intentionally avoid Mongo/OpenAI/CV dependencies so the planning and
safety behavior can run in CI on every change.
"""
from .planner import AgentPlanner
from .critic import EvidenceCritic


def test_match_context_requires_analytics_and_video():
    plan = AgentPlanner().plan("Generate my match report", {"match_id": "m1", "video_id": "v1"})
    assert "match_analytics" in plan["required_evidence"]
    assert "video_analysis" in plan["required_evidence"]
    assert any(x["tool"] == "get_match_analytics" for x in plan["plan"])
    assert any(x["tool"] == "analyze_video" for x in plan["plan"])


def test_training_goal_plans_previous_recommendations():
    plan = AgentPlanner().plan("Give me a training drill")
    names = {x["tool"] for x in plan["plan"]}
    assert "retrieve_coaching_knowledge" in names
    assert "get_previous_recommendations" in names


def test_critic_rejects_missing_evidence():
    critique = EvidenceCritic().evaluate(
        ["player_profile", "match_analytics"],
        [{"kind": "player_profile", "confidence": 1.0, "available": True}],
    )
    assert critique["approved"] is False
    assert "match_analytics" in critique["missing_evidence"]


def test_critic_accepts_sufficient_evidence():
    critique = EvidenceCritic().evaluate(
        ["player_profile", "coaching_knowledge"],
        [
            {"kind": "player_profile", "confidence": 1.0, "available": True},
            {"kind": "coaching_knowledge", "confidence": 0.8, "available": True},
        ],
    )
    assert critique["approved"] is True


def test_critic_guard_strips_tactical_claims_when_unapproved():
    from .workflow import AgenticCoachWorkflow

    report = {
        "strengths": ["made more winners"],
        "weaknesses": ["poor positioning"],
        "tactical_observations": ["attack the backhand"],
        "unavailable": [],
    }
    guarded = AgenticCoachWorkflow._apply_critic_guard(report, {"approved": False})
    assert guarded["strengths"] == []
    assert guarded["weaknesses"] == []
    assert guarded["tactical_observations"] == []
    assert guarded["unavailable"]
