from .event_segmentation import normalize_shot_events, reconstruct_rallies_from_shots, segment_points_from_explicit_events


def test_shots_form_candidate_rally():
    shots = [
        {"frame": 0, "shot_type": "serve", "confidence": 0.9},
        {"frame": 20, "shot_type": "return", "confidence": 0.85},
        {"frame": 45, "shot_type": "drive", "confidence": 0.82},
    ]
    normalized = normalize_shot_events(shots)
    rallies = reconstruct_rallies_from_shots(normalized, fps=30)
    assert len(rallies) == 1
    assert rallies[0]["shot_count"] == 3


def test_points_require_explicit_point_events():
    assert segment_points_from_explicit_events([{"frame": 120, "shot_type": "drive", "confidence": 0.95}], 30) == []
    points = segment_points_from_explicit_events([{"frame": 120, "event_type": "point_end", "confidence": 0.92, "outcome": "player"}], 30)
    assert len(points) == 1
    assert points[0]["evidence_kind"] == "verified"
