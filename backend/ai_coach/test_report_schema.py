import pytest
from .report_schema import validate_report_payload


def test_tactical_claim_requires_evidence():
    with pytest.raises(ValueError):
        validate_report_payload({
            "id": "r1", "user_id": "u1", "match_id": "m1", "generated_at": "now",
            "tactical_observations": [{"text": "You were too deep.", "confidence": 0.8}],
        })


def test_report_schema_accepts_grounded_claim():
    report = validate_report_payload({
        "id": "r1", "user_id": "u1", "match_id": "m1", "generated_at": "now",
        "metrics": [{"metric": "duration", "value": 10, "unit": "s", "source": "video_metadata", "confidence": 0.98}],
        "evidence": [{"id": "e1", "source": "video_metadata", "confidence": 0.98}],
        "tactical_observations": [{"text": "Observed positioning in the clip.", "confidence": 0.8, "evidence_ids": ["e1"]}],
    })
    assert report.tactical_observations[0].evidence_ids == ["e1"]
