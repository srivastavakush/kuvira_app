# Kuvira AI Coach CV Model Artifacts

The codebase is fail-closed: a capability is not considered available because an environment variable exists. The referenced artifact must load, produce validated evidence, and pass the evaluation gate before production use.

## Required production configuration

```env
AI_COACH_PRODUCTION_MODE=true
AI_COACH_ANALYZER=yolo26
AI_COACH_YOLO_WEIGHTS=/models/pickleball_detector.pt
AI_COACH_POSE_WEIGHTS=/models/player_pose.pt
AI_COACH_SHOT_ADAPTER=your_package.shot:classifier
AI_COACH_COURT_CALIBRATION=/config/pickleball_court.json
AI_COACH_EVAL_RESULT_FILE=/config/pickleball_eval_result.json
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

## What the repository can complete without external artifacts

The repository now contains:
- model interfaces and runtime loading
- evidence/provenance propagation
- confidence gating
- court calibration loading
- shot/rally/point event segmentation contracts
- production storage and worker boundaries
- evaluation schemas and runners
- a production preflight gate

## External blocker

The following cannot be honestly created by application code alone and must come from real model/data work:

1. Validated player/ball/paddle detector weights.
2. Validated pose weights.
3. Validated pickleball temporal shot classifier.
4. Camera-specific court calibration or validated court detector.
5. Ground-truth annotated videos for shot/rally/point evaluation.
6. Evaluation results that actually pass configured acceptance thresholds.

Do not replace these artifacts with fabricated or hardcoded outputs.

## Validation rule

Before enabling production inference, run the evaluation harness against the real golden-video dataset and create the configured evaluation result file. The production worker refuses to start when the preflight artifacts or evaluation gate are missing.
