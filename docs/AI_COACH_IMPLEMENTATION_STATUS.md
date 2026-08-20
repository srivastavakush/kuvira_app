# Kuvira AI Coach — Implementation Status

## Audit result — 2026-08-21

`main` now contains the intended evidence-first, bounded agentic architecture plus the production boundaries required to run it safely. The remaining blockers are primarily real sports-model/data artifacts and deployment-time controls, not missing generic orchestration.

## Implemented — agentic core

- Typed agent state, evidence planner, dynamic tool registry/execution, bounded steps and bounded replanning.
- Evidence critic and deterministic grounding guard.
- Report and chat share the same agentic runtime.
- Coaching-state tools are first-class agent evidence.

## Implemented — longitudinal coaching

- Persistent goals, strengths, weaknesses, recurring weaknesses, improving areas and regressions.
- Recommendation and active-training fingerprinting/deduplication.
- Match-report → coaching-state transition with confidence gate.
- Training completion/outcome recording.
- Deterministic recommendation effectiveness when pre/post metrics and desired direction are supplied by the client.
- Training adherence and recommendation-effectiveness state are persisted for future agent runs.

## Implemented — CV evidence pipeline

- Configurable YOLO26 detector/tracker boundary.
- Player and ball observations with confidence/provenance.
- Optional paddle observations when the configured detector provides a supported class.
- Pose evidence boundary.
- Calibrated court-geometry boundary.
- Ball trajectory metrics.
- Conservative ball-visibility segments.
- Temporal shot-classifier adapter contract.
- Deterministic candidate-rally reconstruction from validated shot events.
- Explicit point-boundary segmentation only when the upstream temporal component provides `point_end`/`score` evidence.
- Points, shots and rallies are persisted as separate analytics structures.
- Domain metric schema now accepts the actual CV provenance sources and rejects out-of-range confidence.

## Implemented — storage / jobs / reliability

- Local storage for development.
- S3-compatible object storage.
- Google Cloud Storage backend with ADC-based credentials.
- Upload-size enforcement across all storage backends.
- Durable Mongo job records.
- Atomic worker claiming and stale-lock recovery.
- Retry/backoff and bounded attempts.
- Match/video duplicate-job suppression.
- Optional Idempotency-Key.
- Local in-process rate limit fallback.
- Mongo-backed distributed fixed-window rate limiting for multi-replica deployments.
- SQS durable dispatch and worker consumption; Mongo remains the job-state source of truth.
- Dedicated worker entry point.

## Implemented — evaluation infrastructure

- Strict report/evidence schema.
- Grounding evaluation with unsupported-claim rate checks.
- CV categorical-event precision/recall/F1 helper.
- Golden-video manifest loader.
- Evaluation CLI that fails when real media/labels are unavailable instead of fabricating a pass.
- Unit tests for report schema, grounding, shot/rally/point segmentation.
- Model-artifact requirements documented in `docs/AI_COACH_MODEL_ARTIFACTS.md`.

## Still required — real sports model/data artifacts

These cannot be honestly completed without validated artifacts and representative annotated videos:

1. Production-quality YOLO26/player-ball-paddle weights and class mapping for the supported camera views.
2. Validated pose model and quality thresholds.
3. Validated court detector/calibration set for supported camera setups.
4. Trained temporal pickleball shot classifier covering the supported stroke taxonomy.
5. Validated rally and point segmentation against labeled video.
6. Evidence-backed pickleball movement/position/error metrics computed from calibrated observations.
7. Representative golden-video dataset with ground-truth labels.
8. Measured acceptance thresholds from that dataset.

The code is fail-closed when those artifacts are absent; it does not synthesize analytics to appear complete.

## Still required — deployment-time production controls

- Deploy the GCS/S3 backend and grant the worker service account/object-storage permissions.
- Deploy the GPU inference worker with actual model weights.
- Configure SQS (or equivalent durable queue) and visibility/dead-letter policies when using the SQS backend.
- Configure distributed rate limiting (`AI_COACH_RATE_LIMIT_BACKEND=mongo`) and operational quotas.
- Add production observability/alerts, cost budgets and retention lifecycle policies.
- Run the evaluation CLI against real golden videos and store the results as CI artifacts.
- Complete cross-user authorization regression tests and representative end-to-end tests in the deployed environment.

## Current completion status

**NOT COMPLETE — intentionally.**

The code-completable architecture is substantially implemented. The AI Coach must only be marked fully complete after the real CV artifacts are validated on representative videos, the durable worker/queue is deployed, production controls are configured, and the end-to-end evaluation passes.
