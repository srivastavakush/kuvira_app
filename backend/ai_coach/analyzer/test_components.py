from .components import ByteTrackPlayerTracker, NullCourtEstimator, NullPoseEstimator, NullShotClassifier


class Box:
    cls = type("V", (), {"tolist": lambda self: [0, 32]})()
    conf = type("V", (), {"tolist": lambda self: [0.95, 0.9]})()
    xyxy = type("V", (), {"tolist": lambda self: [[1, 2, 3, 4], [5, 6, 7, 8]]})()
    id = type("V", (), {"tolist": lambda self: [11, 12]})()


class Result:
    names = {0: "person", 32: "sports ball"}
    boxes = Box()


def test_tracker_only_emits_players():
    tracks = ByteTrackPlayerTracker().track(Result())
    assert len(tracks) == 1
    assert tracks[0]["track_id"] == 11
    assert tracks[0]["label"] == "player"
    assert tracks[0]["source"] == "yolo26_tracker"


def test_null_components_fail_closed():
    assert NullCourtEstimator().estimate(None, None)["available"] is False
    assert NullPoseEstimator().estimate(None)["available"] is False
    assert NullShotClassifier().classify([], fps=30, sport="pickleball") == []
