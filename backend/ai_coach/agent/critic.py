"""Evidence critic and bounded replanning policy."""
from __future__ import annotations
from typing import Any, Dict, Iterable


class EvidenceCritic:
    def __init__(self, minimum_confidence: float = 0.5) -> None:
        self.minimum_confidence = minimum_confidence

    def evaluate(self, required: Iterable[str], evidence: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        evidence = list(evidence)
        available = {e.get("kind") for e in evidence if e.get("available", True)}
        missing = [item for item in required if item not in available]
        confidences = [float(e.get("confidence", 0.0)) for e in evidence if e.get("available", True)]
        overall = min(confidences) if confidences else 0.0
        return {
            "approved": not missing and overall >= self.minimum_confidence,
            "overall_confidence": overall,
            "missing_evidence": missing,
            "reason": "evidence_sufficient" if not missing and overall >= self.minimum_confidence else "evidence_insufficient",
        }

    def next_action(self, critique: Dict[str, Any], replan_count: int, max_replans: int) -> str:
        if critique.get("approved"):
            return "finalize"
        if replan_count < max_replans and critique.get("missing_evidence"):
            return "replan"
        return "safe_finalize"
