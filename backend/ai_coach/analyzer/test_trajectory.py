from .trajectory import build_ball_trajectory, reconstruct_visibility_rallies


def test_ball_trajectory_and_velocity():
    obs = [
        {"frame": 1, "bbox": [0, 0, 10, 10], "confidence": 0.9},
        {"frame": 2, "bbox": [10, 0, 20, 10], "confidence": 0.8},
        {"frame": 3, "bbox": [20, 0, 30, 10], "confidence": 0.7},
    ]
    result = build_ball_trajectory(obs, fps=10)
    assert result["coverage"] == 3
    assert result["mean_pixel_velocity"] > 0
    assert 0 < result["confidence"] <= 1


def test_visibility_rallies_are_not_score_rallies():
    obs = [{"frame": i, "bbox": [i, 0, i + 8, 8], "confidence": 0.9} for i in range(1, 12)]
    result = reconstruct_visibility_rallies(obs, fps=10)
    assert result
    assert result[0]["type"] == "ball_visibility_segment"
    assert "scored rally" in result[0]["note"]
