"""Deterministic evaluation contracts for AI Coach."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List

@dataclass(frozen=True)
class EvaluationThresholds:
    player_detection: float = 0.80; ball_detection: float = 0.70; tracking: float = 0.70; pose: float = 0.70; court_calibration: float = 0.80
    shot_classification: float = 0.75; rally_segmentation: float = 0.75; point_segmentation: float = 0.75; grounding: float = 0.95
    unsupported_claim_rate: float = 0.05; tool_selection: float = 0.90; recommendation_consistency: float = 0.90

@dataclass
class EvaluationResult:
    scores: Dict[str,float]=field(default_factory=dict); passed: bool=False; failures: List[str]=field(default_factory=list)

def _ratio(tp:int,fp:int,fn:int)->float:
    denom=2*tp+fp+fn; return (2*tp/denom) if denom else 1.0

def evaluate_report(report:Dict[str,Any])->Dict[str,Any]:
    dq=report.get("data_quality") or {}; confidence=float(dq.get("overall_confidence",0.0) or 0.0); unavailable=set(report.get("unavailable") or []); violations=[]
    if confidence<0.5 and any(report.get(k) for k in ("tactical_observations","weaknesses","strengths")): violations.append("low_confidence_player_claims")
    missing=sorted({"metrics","data_quality","evidence"}-set(report.keys()))
    if missing: violations.append("missing_report_contract:"+",".join(missing))
    if confidence<0.5 and not unavailable: violations.append("missing_unavailable_disclosure")
    return {"passed":not violations,"violations":violations,"confidence":confidence,"has_tactical_claims":bool(report.get("tactical_observations")),"unavailable_count":len(unavailable)}

def evaluate_cv(prediction:Dict[str,Any],golden:Dict[str,Any],thresholds:EvaluationThresholds|None=None)->EvaluationResult:
    t=thresholds or EvaluationThresholds(); scores={}; failures=[]
    for name,threshold in (("player_detection",t.player_detection),("ball_detection",t.ball_detection),("tracking",t.tracking),("pose",t.pose),("court_calibration",t.court_calibration),("shot_classification",t.shot_classification),("rally_segmentation",t.rally_segmentation),("point_segmentation",t.point_segmentation)):
        row=golden.get(name)
        if not isinstance(row,dict) or not {"tp","fp","fn"}.issubset(row): failures.append(f"missing_golden_labels:{name}"); continue
        scores[name]=_ratio(int(row["tp"]),int(row["fp"]),int(row["fn"]))
        if scores[name]<threshold: failures.append(f"below_threshold:{name}")
    return EvaluationResult(scores=scores,passed=not failures,failures=failures)

def evaluate_agent(prediction:Dict[str,Any],golden:Dict[str,Any],thresholds:EvaluationThresholds|None=None)->EvaluationResult:
    t=thresholds or EvaluationThresholds(); scores={}; failures=[]
    for name in ("tool_selection","grounding","recommendation_consistency"):
        value=golden.get(name)
        if value is None: failures.append(f"missing_golden_labels:{name}"); continue
        scores[name]=float(value)
        if scores[name]<getattr(t,name): failures.append(f"below_threshold:{name}")
    value=golden.get("unsupported_claim_rate")
    if value is None: failures.append("missing_golden_labels:unsupported_claim_rate")
    else:
        scores["unsupported_claim_rate"]=float(value)
        if scores["unsupported_claim_rate"]>t.unsupported_claim_rate: failures.append("above_threshold:unsupported_claim_rate")
    return EvaluationResult(scores=scores,passed=not failures,failures=failures)

def evaluate_coaching(prediction:Dict[str,Any],golden:Dict[str,Any],thresholds:EvaluationThresholds|None=None)->EvaluationResult:
    return evaluate_agent(prediction,golden,thresholds)

def evaluate_dataset(cases:Iterable[Dict[str,Any]],thresholds:EvaluationThresholds|None=None)->Dict[str,Any]:
    results=[]
    for case in cases:
        result=evaluate_cv(case.get("prediction",{}),case.get("golden",{}),thresholds); results.append({"id":case.get("id"),"passed":result.passed,"scores":result.scores,"failures":result.failures})
    return {"cases":results,"passed":bool(results) and all(x["passed"] for x in results),"case_count":len(results)}
