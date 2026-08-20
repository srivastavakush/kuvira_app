"""Lightweight evaluation harness for AI Coach evidence safety and contracts.

Run with pytest or import `evaluate_report`. Model-quality evaluation should
add a golden-video dataset later; these checks prevent regressions in the
agent's most important safety guarantees.
"""
from __future__ import annotations
from typing import Any, Dict, List


def evaluate_report(report: Dict[str, Any]) -> Dict[str, Any]:
    dq = report.get("data_quality") or {}
    confidence = float(dq.get("overall_confidence", 0.0) or 0.0)
    unavailable = set(report.get("unavailable") or [])
    tactical = bool(report.get("tactical_observations"))
    weaknesses = bool(report.get("weaknesses"))
    strengths = bool(report.get("strengths"))
    violations: List[str] = []
    if confidence < 0.5 and (tactical or weaknesses or strengths):
        violations.append("low_confidence_player_claims")
    required_claim_keys = {"metrics", "data_quality", "evidence"}
    missing = sorted(required_claim_keys - set(report.keys()))
    if missing:
        violations.append("missing_report_contract:" + ",".join(missing))
    if confidence < 0.5 and not unavailable:
        violations.append("missing_unavailable_disclosure")
    return {
        "passed": not violations,
        "violations": violations,
        "confidence": confidence,
        "has_tactical_claims": tactical,
        "unavailable_count": len(unavailable),
    }
