from .contracts import EvaluationThresholds, evaluate_cv_labels, evaluate_report_grounding


def test_grounding_rejects_unreferenced_tactical_claim():
    result = evaluate_report_grounding({
        "tactical_observations": [{"text": "You stayed too deep.", "kind": "inferred", "evidence_ids": []}],
        "evidence": [],
        "metrics": [],
    })
    assert not result.passed
    assert result.metrics["unsupported_claim_rate"] == 1.0


def test_grounding_accepts_referenced_claim():
    result = evaluate_report_grounding({
        "tactical_observations": [{"text": "Observed late positioning.", "kind": "inferred", "evidence_ids": ["e1"]}],
        "evidence": [{"id": "e1"}],
        "metrics": [{"metric": "x", "value": 1, "source": "video_metadata", "confidence": 0.9}],
    }, EvaluationThresholds())
    assert result.passed


def test_categorical_f1():
    result = evaluate_cv_labels([{"shot": "dink"}, {"shot": "drive"}], [{"shot": "dink"}, {"shot": "lob"}], "shot")
    assert result["f1"] == 0.5
