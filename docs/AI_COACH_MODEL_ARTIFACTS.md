# AI Coach CV Model Artifacts

The codebase is fail-closed: a capability is not considered available because an environment variable exists. The referenced artifact must load and produce validated evidence.

## Required configuration

```env
AI_COACH_ANALYZER=yolo26
AI_COACH_YOLO_WEIGHTS=/models/pickleball_detector.pt
AI_COACH_POSE_WEIGHTS=/models/player_pose.pt
AI_COACH_SHOT_ADAPTER=your_package.shot:classifier
AI_COACH_COURT_CALIBRATION=/config/pickleball_court.json
```

## Model contracts

### Detector
Must identify, at minimum where supported by the artifact:
- player/person
- ball/pickleball
- paddle

Output requirements:
- frame
- bounding box
- class
- confidence
- optional track id
- model version

### Pose
Must return player-associated keypoints and confidence per observation. Biomechanical recommendations are unavailable if pose quality fails configured thresholds.

### Court
Must provide calibrated court coordinates/homography. Image-space coordinates must not be presented as court-space metrics.

### Shot classifier
Must be temporal/sequence-aware and return normalized events with:
- shot type
- frame/time
- player track id where available
- confidence
- source/model version

The classifier may return `unknown`; unknown is preferable to a guessed stroke.

### Rally / point segmentation
Rallies may be reconstructed from validated temporal shot events. Point boundaries require explicit point-end/score evidence and are never inferred solely from a ball-visibility gap.

## Validation rule

Before enabling a model in production, run the evaluation harness against the golden-video manifest and require the configured thresholds to pass. Do not store or expose evaluation numbers until they come from the real dataset.
