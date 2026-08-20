# Kuvira AI Coach — Implementation Status

## Objective

Implement the agentic coaching architecture defined by the AI Coach design rather than stopping at a fixed report-generation pipeline.

## Phase 1 — Agentic orchestration

Implemented on branch `feat/complete-agentic-ai-coach`:

- Typed `CoachAgentState` with evidence, plan, tool calls, critique, replan count and bounded execution state.
- `AgentTool` + `AgentToolRegistry` abstraction.
- Evidence planner with intent routing for match analysis, training, progress and comparison.
- Context-aware planning: a match/video context explicitly requires match analytics evidence.
- Tool implementations for player profile, match history, match analytics, video evidence, coaching knowledge, match comparison, training history and previous recommendations.
- `EvidenceCritic` with confidence threshold and missing-evidence detection.
- Bounded replanning with configurable maximum steps/replans.
- Deterministic critic guard after LLM synthesis; low-confidence evidence cannot leak tactical claims.
- Existing `CoachWorkflow` API retained as a compatibility facade, now backed by the agentic runtime.

## Phase 2 — CV architecture

Implemented infrastructure:

- `YOLO26Analyzer` adapter behind the existing `VideoAnalyzer` contract.
- `AI_COACH_ANALYZER=lightweight|yolo26` analyzer registry.
- `AI_COACH_YOLO_WEIGHTS` configuration.
- Analysis jobs now resolve the configured analyzer at runtime and persist analyzer/version/diagnostics.
- Generic player/ball detection and tracking can be supplied by the configured Ultralytics model.

Important: a generic detector is **not** treated as a shot classifier. Shot/rally/point analytics remain unavailable until a validated temporal shot model and sport-specific court/pose pipeline are supplied. This prevents fabricated sports analytics.

## Phase 3 — Remaining CV work

Required for real pickleball intelligence:

1. Validated YOLO26 weights containing player/ball/paddle classes or a supported class mapping.
2. Pose model/keypoint pipeline.
3. Court-keypoint detection + homography.
4. Player/ball/paddle tracking validation and occlusion handling.
5. Temporal shot-event classifier.
6. Rally reconstruction and point segmentation.
7. Sport-specific metrics with calibrated confidence.
8. Golden-video evaluation set and acceptance thresholds.

These are model/data/inference deliverables, not API-key configuration. The repository now has the adapter boundary for them.

## Phase 4 — Longitudinal coaching state

The agent has read tools for training history and previous recommendations with backwards-compatible empty fallbacks. Persistent write APIs still need to be exposed for:

- coaching goals
- recommendation records
- drill assignment/completion
- training outcomes
- recommendation effectiveness
- player coaching state snapshots

## Phase 5 — Agentic chat

The report path now uses the agentic runtime. The existing chat endpoint remains the legacy context + RAG path and should be migrated to the same planner/tool/critic runtime so report, chat, progress and training conversations share one coaching state machine.

## Phase 6 — Productionization

Still required before calling the system production-complete:

- object storage for uploaded videos instead of container-local persistence
- dedicated GPU inference worker
- durable job queue instead of fire-and-forget tasks
- retry/idempotency policy
- rate limiting and quotas
- analyzer/model observability
- evaluation dataset + regression tests
- cost/latency budgets
- cleanup lifecycle

## Completion rule

The AI Coach should only be called **fully implemented** when all of the following are true:

- planner/tool/critic/replan flow is active for report and chat
- real CV produces validated player/ball/court/pose/shot/rally evidence
- tactical claims are gated by calibrated confidence
- training recommendations persist and feed back into future planning
- longitudinal state connects matches → diagnosis → drills → outcomes → next diagnosis
- production video storage and inference jobs are durable
- end-to-end evaluation passes on a representative video set
