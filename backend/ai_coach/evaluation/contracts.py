"""Deterministic evaluation contracts for CV, agent and coaching outputs."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass(frozen=True)
class EvaluationThresholds:
    max_unsupported_claim_rate: float = 0.0
    min_grounding_pass_rate: float = 0.95
    min_shot_f1: float = 0.80
    min_rally_f1: float = 0.75
    min_point_f1: float = 0.75


@dataclass
class EvaluationResult:
    passed: bool
    checks: Dict[str, bool] = field(default_factory=dict)
    metrics: Dict[str, float] = field(default_factory=dict)
    failures: List[str] = field(default_factory=list)


def _claim_count(report: Dict[str, Any]) -> int:
    sections = ["strengths", "weaknesses", "tactical_observations"]
    count = 0
    for section in sections:
        value = report.get(section) or []
        count += len(value) if isinstance(value, list) else 0
    return count


def evaluate_report_grounding(report: Dict[str, Any], thresholds: EvaluationThresholds | None = None) -> EvaluationResult:
    thresholds = thresholds or EvaluationThresholds()
    evidence_ids = {str(e.get("id")) for e in (report.get("evidence") or []) if isinstance(e, dict) and e.get("id")}
    unsupported = 0
    total = 0
    for section in ("strengths", "weaknesses", "tactical_observations"):
        for claim in report.get(section) or []:
            total += 1
            if isinstance(claim, dict):
                refs = {str(x) for x in (claim.get("evidence_ids") or [])}
                if claim.get("kind", "inferred") != "unknown" and not refs.intersection(evidence_ids):
                    unsupported += 1
            elif section == "tactical_observations":
                unsupported += 1
    unsupported_rate = unsupported / total if total else 0.0
    metric_evidence_pass = all(
        isinstance(m, dict) and bool(m.get("source")) and 0.0 <= float(m.get("confidence", 0.0)) <= 1.0
        for m in (report.get("metrics") or [])
    )
    checks = {
        "metric_evidence": metric_evidence_pass,
        "unsupported_claim_rate": unsupported_rate <= thresholds.max_unsupported_claim_rate,
        "tactical_claims_grounded": unsupported == 0,
    }
    failures = [name for name, ok in checks.items() if not ok]
    return EvaluationResult(
        passed=not failures,
        checks=checks,
        metrics={"unsupported_claim_rate": unsupported_rate, "claims": float(total)},
        failures=failures,
    )


def evaluate_cv_labels(predictions: List[Dict[str, Any]], labels: List[Dict[str, Any]], key: str) -> Dict[str, float]:
    """Simple deterministic precision/recall/F1 for normalized categorical events."""
    pred = [str(x.get(key)) for x in predictions]
    truth = [str(x.get(key)) for x in labels]
    if not truth and not pred:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0}
    truth_set, pred_set = set(truth), set(pred)
    tp = len(truth_set & pred_set); fp = len(pred_set - truth_set); fn = len(truth_set - pred_set)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"precision": precision, "recall": recall, "f1": f1}
