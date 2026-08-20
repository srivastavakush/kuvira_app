# Kuvira AI Coach — Implementation Status

## Objective

Implement the agentic coaching architecture defined by the AI Coach design rather than stopping at a fixed report-generation pipeline.

## Phase 1 — Agentic orchestration

Implemented on branch `feat/complete-agentic-ai-coach`:

- Typed `CoachAgentState` with evidence, plan, tool calls, critique, replan count and bounded execution state.
- `AgentTool` + `AgentToolRegistry` abstraction.
- Evidence planner with intent routing for match analysis, training, progress and comparison.
- Tool implementations for player profile, match history, match analytics, video evidence, coaching knowledge, match comparison, training history and previous recommendations.
- `EvidenceCritic` with confidence threshold and missing-evidence detection.
- Bounded replanning and deterministic final grounding guard.
- Existing `CoachWorkflow` API retained as a compatibility facade.

## Phase 2 — CV architecture

Implemented infrastructure:

- `YOLO26Analyzer` adapter behind the existing `VideoAnalyzer` contract.
- `AI_COACH_ANALYZER=lightweight|yolo26` analyzer registry.
- `AI_COACH_YOLO_WEIGHTS` configuration.
- Runtime analyzer selection and persisted analyzer/version/diagnostics.
- Explicit player/ball tracking evidence.
- Optional YOLO pose evidence through `AI_COACH_POSE_WEIGHTS`.
- Explicit calibrated court geometry through `AI_COACH_COURT_CALIBRATION` or a JSON calibration model path.
- Ball trajectory metrics derived from tracked observations.
- Observable ball-visibility segments reconstructed with conservative provenance.
- Temporal shot classification through an explicit adapter contract: `AI_COACH_SHOT_ADAPTER=module.path:ClassOrObject`.

Important: a generic detector is **not** treated as a shot classifier. Visibility segments are **not** treated as scored rallies. This prevents fabricated sports analytics.

## Phase 3 — Longitudinal adaptive coaching

Implemented:

- Persistent player coaching state.
- Goals and goal status transitions.
- Recommendation persistence with fingerprints.
- Training assignment persistence with duplicate protection.
- Training completion/outcome recording.
- Training adherence calculations.
- Match-report → coaching-state transition service.
- Confidence/evidence gate preventing weak reports from mutating recurring strengths/weaknesses or assigning adaptive drills.
- Regression tracking when a previously observed weakness reappears.
- Unified agentic chat using the same planner/tool/critic/replan runtime.
- Frontend API surface for coaching state, goals, training and outcomes.

Closed-loop path:

`match → evidence → diagnosis → state transition → recommendation → training assignment → outcome → updated state → next agent run`

## Remaining real sports-intelligence deliverables

The repository now has the production contracts, but the following model/data artifacts must still be validated:

1. Actual YOLO26 weights/class mapping for player, ball and paddle.
2. Validated pose model and keypoint quality thresholds.
3. Court-keypoint detector or calibrated court configurations for supported camera views.
4. Trained temporal pickleball shot classifier implementing the shot-adapter contract.
5. Point/rally segmentation with validated point-boundary evidence. Ball-visibility segments alone are insufficient.
6. Sport-specific metrics computed only from calibrated evidence.
7. Golden-video evaluation set and acceptance thresholds.

## Productionization still required

- Object storage for videos instead of container-local persistence.
- Durable GPU inference workers and durable queue semantics instead of fire-and-forget tasks.
- Retry/idempotency policy.
- Rate limiting and quotas.
- Model/analyzer observability.
- Cost and latency budgets.
- Video cleanup lifecycle.
- End-to-end regression suite over representative videos.
- Multi-sport analyzer registry and sport-specific model implementations.

## Completion rule

The AI Coach should only be called **fully implemented** when all of these are true:

- planner/tool/critic/replan flow is active for report and chat
- real CV produces validated player/ball/court/pose/shot/rally evidence
- tactical claims are gated by calibrated confidence
- training recommendations persist and feed back into future planning
- longitudinal state connects matches → diagnosis → drills → outcomes → next diagnosis
- production video storage and inference jobs are durable
- end-to-end evaluation passes on representative video data
