# Kuvira AI Coach — Implementation Status

## Objective

Implement the agentic coaching architecture defined by the AI Coach design rather than stopping at a fixed report-generation pipeline.

## Phase 1 — Agentic orchestration

Implemented:

- Typed `CoachAgentState` with evidence, plan, tool calls, critique, replan count and bounded execution state.
- `AgentTool` + `AgentToolRegistry` abstraction.
- Evidence planner with intent routing for match analysis, training, progress and comparison.
- Player, history, analytics, video, knowledge, comparison, training-history and recommendation tools.
- Evidence critic with confidence threshold and missing-evidence detection.
- Bounded replanning and deterministic final grounding guard.
- Existing `CoachWorkflow` compatibility facade retained.

## Phase 2 — CV architecture

Implemented infrastructure:

- `YOLO26Analyzer` adapter and runtime analyzer registry.
- Player/ball tracking evidence.
- Optional pose model evidence.
- Explicit calibrated court geometry boundary.
- Ball trajectory metrics and conservative ball-visibility segments.
- Temporal shot adapter contract.
- Explicit confidence/provenance for every CV layer.

Important: generic detection is never treated as shot classification; visibility segments are never treated as scored rallies.

## Phase 3 — Longitudinal adaptive coaching

Implemented:

- Persistent player coaching state.
- Goals and goal status transitions.
- Recommendation persistence and duplicate fingerprints.
- Training assignment persistence and duplicate protection.
- Training completion/outcome recording.
- Training adherence calculations.
- Match-report → coaching-state transition service.
- Confidence/evidence gate preventing weak reports from mutating player state or creating adaptive drills.
- Regression tracking.
- Unified agentic chat using the same planner/tool/critic/replan runtime.
- Frontend API surface for coaching state, goals, training and outcomes.

Closed loop:

`match → evidence → diagnosis → state transition → recommendation → training assignment → outcome → updated state → next agent run`

## Phase 4 — Reliability / production guards

Implemented in application code:

- Analyzer retry with exponential backoff.
- Idempotent match-level analytics upsert.
- Duplicate active-job suppression for the same match/video.
- Optional `Idempotency-Key` support for analysis requests.
- Configurable chat and analysis rate limits.
- Job attempt/error diagnostics.
- Deterministic report-evaluation harness (`backend/ai_coach/evaluation.py`) for grounding-contract regression checks.

These are process-local guards. For horizontally scaled production, replace the in-memory limiter with Redis/Cloud Tasks semantics.

## Remaining real sports-intelligence deliverables

These cannot be honestly completed without the actual validated model/data artifacts:

1. YOLO26 weights/class mapping for player, ball and paddle.
2. Validated pose model and keypoint thresholds.
3. Court-keypoint detector or calibrated configurations for supported camera views.
4. Trained temporal pickleball shot classifier.
5. Validated point/rally segmentation.
6. Sport-specific metrics from calibrated evidence.
7. Golden-video evaluation dataset and acceptance thresholds.

## Remaining production infrastructure

- Object storage for videos instead of container-local persistence.
- Durable GPU inference worker/queue rather than process-local fire-and-forget execution.
- Distributed rate limiting/quota enforcement.
- Model/analyzer observability.
- Cost/latency budgets.
- Automated video cleanup lifecycle.
- Full end-to-end regression suite over representative videos.
- Multi-sport analyzer registry and sport-specific model implementations.

## Completion rule

The AI Coach is **not fully complete** until:

- report and chat use planner/tool/critic/replan
- validated CV provides player/ball/court/pose/shot/rally evidence
- tactical claims use calibrated confidence
- matches update player state and training outcomes feed future planning
- video storage and inference jobs are durable
- representative-video evaluation passes
