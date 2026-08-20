# Kuvira AI Coach — Agentic Architecture Design

**Status:** Target architecture / implementation contract  
**Current baseline:** Phase 1 pipeline is implemented; this document defines the intended evolution into the full agentic coach.  
**Primary sport:** Pickleball first; architecture must remain sport-extensible.

---

## 1. Purpose

Kuvira AI Coach is intended to be an **evidence-driven, tool-using sports coach**, not a chatbot that simply generates advice from an LLM.

The coach should:

1. Understand the player's goal and intent.
2. Inspect the player's available context and evidence.
3. Decide what information is required to answer reliably.
4. Invoke the appropriate tools/models to obtain that evidence.
5. Diagnose only from evidence that actually exists.
6. Retrieve authoritative coaching knowledge when useful.
7. Critique the proposed diagnosis against the evidence.
8. Re-plan when evidence is insufficient.
9. Produce an actionable coaching response with explicit confidence and evidence.
10. Learn longitudinally from the player's accumulated matches and training outcomes.

The LLM is the **reasoning/orchestration layer**. Computer vision, analytics, retrieval, player history, and training systems are tools/data sources used by the agent.

---

## 2. Core Principle

> **The agent must never manufacture sports analytics to make an answer look intelligent.**

If the system cannot reliably observe a shot, rally, movement pattern, court position, or other metric, the agent must treat it as unknown.

Every player-specific analytical claim should be traceable to one or more of:

- video/CV evidence
- structured match analytics
- longitudinal player data
- retrieved coaching knowledge
- explicitly labelled inference

Low-confidence evidence must not silently become a high-confidence coaching claim.

---

## 3. Target Agentic Flow

```text
                         USER
                           |
                           v
                 +--------------------+
                 |   COACH AGENT      |
                 | intent + objective |
                 +---------+----------+
                           |
                           v
                 +--------------------+
                 |  CONTEXT MANAGER   |
                 | profile/history/   |
                 | current match      |
                 +---------+----------+
                           |
                           v
                 +--------------------+
                 | EVIDENCE PLANNER   |
                 | What do I need to  |
                 | answer reliably?   |
                 +---------+----------+
                           |
                           v
                 +--------------------+
                 |    TOOL ROUTER     |
                 +---------+----------+
                           |
          +----------------+------------------+
          |                |                  |
          v                v                  v
   Video/CV tools    Match/history      Knowledge/RAG
          |                |                  |
          +----------------+------------------+
                           |
                           v
                 +--------------------+
                 |   DIAGNOSIS /      |
                 |   SYNTHESIS        |
                 +---------+----------+
                           |
                           v
                 +--------------------+
                 |  EVIDENCE CRITIC   |
                 +---------+----------+
                           |
                    sufficient?
                     /          \
                   yes           no
                   /               \
                  v                 v
             FINAL COACH        REPLAN
             RESPONSE             |
                                  +----> invoke another tool
                                  |
                                  +----> request more evidence
                                  |
                                  +----> lower confidence / mark unknown
```

The important difference from the Phase 1 implementation is the **decision loop**. The agent should not always execute a fixed sequence of nodes. It should decide which tools are necessary and can return to planning when the evidence is inadequate.

---

## 4. Agent Responsibilities

### 4.1 Intent / Goal Agent

Determine what the player is trying to accomplish.

Examples:

- Analyze this match
- Why am I losing points?
- How is my backhand improving?
- Give me a training plan
- Compare my last five matches
- What should I practice today?
- Explain this metric

Intent should influence tool selection and the final response format.

### 4.2 Evidence Planner

Before making a diagnosis, determine what evidence is required.

Example:

> User asks: "Why am I losing long rallies?"

Potential evidence plan:

1. Retrieve recent rally-length analytics.
2. Check shot-level data if available.
3. Check movement/court-position data.
4. Compare with previous matches.
5. Retrieve coaching knowledge on rally construction.
6. If required evidence is unavailable, do not invent the reason; state what is missing.

### 4.3 Tool Router

The agent chooses tools based on the evidence plan.

Initial tool set:

```text
get_player_profile
get_match_history
get_match_analytics
analyze_video
retrieve_coaching_knowledge
compare_matches
get_training_history
get_previous_recommendations
create_training_plan
find_relevant_drills
```

Tools should have explicit input/output schemas and return provenance/confidence where applicable.

### 4.4 Diagnosis / Synthesis Agent

Combine verified observations with coaching knowledge.

The diagnosis should distinguish:

```text
FACT
  What was directly measured/detected?

EVIDENCE
  What source supports it?

INFERENCE
  What coaching interpretation follows from that evidence?

ACTION
  What should the player do next?
```

### 4.5 Evidence Critic

The critic checks whether the proposed answer is supported.

It should detect:

- unsupported tactical claims
- metrics not present in analytics
- claims exceeding confidence thresholds
- knowledge presented as player-specific fact
- recommendations that don't follow from the evidence

The critic should either approve, downgrade, remove, or send the agent back to planning.

---

## 5. CV / YOLO26 Is a Tool, Not the Agent

YOLO26 should be implemented behind the existing `VideoAnalyzer` abstraction.

Target relationship:

```text
Coach Agent
     |
     +--> analyze_video(video_id, requested_analysis)
                    |
                    v
              YOLO26 pipeline
                    |
          +---------+---------+
          |         |         |
       players    ball      court
          |         |         |
          +---------+---------+
                    |
                    v
             tracking/events
                    |
                    v
             shots / rallies
                    |
                    v
             AnalyzerResult
```

The agent does not need to know YOLO internals. It asks for evidence; the CV subsystem returns structured evidence.

This keeps the architecture reusable when the underlying model changes.

---

## 6. Analyzer Contract

The existing `VideoAnalyzer` / `AnalyzerResult` contract should remain the integration boundary.

A real analyzer should progressively populate:

- video metadata
- players
- court information
- ball detections/tracks
- player tracks
- shots
- rallies
- movement metrics
- shot metrics
- derived performance metrics
- data quality
- diagnostics

Every metric/event must retain:

```text
source
confidence
```

The analyzer must return `unavailable` rather than fabricate data when detection is unreliable.

---

## 7. Dynamic Decision Examples

### Example A — User asks about a match

```text
User
 ↓
Intent = match_analysis
 ↓
Planner asks:
  Do I have match analytics?
 ↓
Yes
 ↓
Inspect analytics
 ↓
Are shot/rally metrics sufficient?
 ↓
Yes
 ↓
Retrieve relevant coaching knowledge
 ↓
Diagnose
 ↓
Critic
 ↓
Final report
```

### Example B — User asks why their backhand is weak

```text
User
 ↓
Intent = technique_diagnosis
 ↓
Planner
 ↓
No shot-level evidence
 ↓
Can video provide it?
 ↓
Yes
 ↓
Invoke analyze_video
 ↓
YOLO/CV + event analysis
 ↓
Backhand evidence available?
 ↓
Yes
 ↓
Retrieve methodology
 ↓
Diagnose + critic
 ↓
Recommendation
```

### Example C — Evidence remains insufficient

```text
Planner
 ↓
Video exists
 ↓
CV confidence too low
 ↓
Cannot safely diagnose backhand mechanics
 ↓
Replan
 ↓
Try another available match/video
       OR
Ask user for a better recording
       OR
Give a general drill without claiming player-specific diagnosis
```

The system should never convert insufficient evidence into a fabricated diagnosis.

---

## 8. Replanning Rules

The agent may re-enter planning when:

- required evidence is missing
- confidence is below the task threshold
- the selected tool failed
- the result is internally inconsistent
- a different evidence source is needed
- the user asks a follow-up requiring additional context

Replanning should be bounded to prevent infinite loops.

Recommended initial limit:

```text
MAX_AGENT_STEPS = 8
MAX_REPLANS = 2
```

When limits are reached, the agent should produce the best evidence-grounded answer possible and clearly identify limitations.

---

## 9. Confidence Model

Confidence is not the same as LLM certainty.

The system should distinguish:

```text
Detection confidence
    ↓
Analytics confidence
    ↓
Evidence sufficiency
    ↓
Diagnostic confidence
    ↓
Recommendation confidence
```

A confident LLM response cannot increase the underlying CV confidence.

For example:

```text
YOLO detects backhand = 0.92
Shot classification = 0.81
Rally association = 0.74

=> strong enough for shot-level analysis
```

But:

```text
Player identity = 0.61
Ball tracking = 0.31

=> do not make precise ball/shot trajectory claims
```

---

## 10. Knowledge / RAG Architecture

Knowledge retrieval remains a tool used by the agent rather than a mandatory fixed node.

The agent should retrieve knowledge when it needs:

- technique methodology
- tactical principles
- rules
- drill recommendations
- training methodology
- explanations of metrics

Knowledge should have authority metadata.

Preferred hierarchy:

```text
Official rules / authoritative sources
        ↓
Expert methodology
        ↓
Kuvira coaching methodology
        ↓
General supporting material
```

Retrieved knowledge explains **what good practice means**. Player analytics explain **what this player actually did**. The agent must keep those concepts separate.

---

## 11. Longitudinal Coaching

The eventual coach should not treat every match independently.

Player state should evolve over time:

```text
Match 1 ─┐
Match 2 ─┤
Match 3 ─┼──> Player Performance State
Match 4 ─┤          |
Training ┘          v
                 Current goals
                     |
                     v
               Next recommendation
```

The agent should eventually identify:

- recurring weaknesses
- improving metrics
- regression
- persistent tactical patterns
- completed drills
- training adherence
- goals
- recommended next focus

This is where Kuvira can become a **coach over time**, rather than a match-report generator.

---

## 12. Training Loop

The long-term loop should be:

```text
Analyze
  ↓
Diagnose
  ↓
Prioritize one or two weaknesses
  ↓
Recommend drills
  ↓
Player trains
  ↓
Training outcome recorded
  ↓
Next match analyzed
  ↓
Measure improvement
  ↓
Update player state
```

The coach should avoid giving a long list of simultaneous corrections. It should prioritize the highest-impact, best-supported intervention.

---

## 13. Report Generation Is the Last Step

A report is an output of the agent, not the agent itself.

The final response should be generated only after:

1. Intent is understood.
2. Required evidence has been evaluated.
3. Necessary tools have been used.
4. Diagnosis has been formed.
5. Evidence has been critically checked.

Final response structure can remain:

```text
Match summary
Data quality
What you did well
What needs work
Why
Evidence used
Tactical observations
Recommended drills
Training plan
What was not detected
```

The existing frontend can continue consuming this structured response.

---

## 14. Current Phase 1 vs Target Architecture

### Current Phase 1

```text
Intent
  ↓
Context
  ↓
Analytics
  ↓
Data quality
  ↓
Diagnosis
  ↓
Retrieval
  ↓
Report
  ↓
Validation
```

This is intentionally conservative and is acceptable as the Phase 1 foundation.

### Target

```text
Intent
  ↓
Plan
  ↓
Choose tools dynamically
  ↓
Observe results
  ↓
Diagnose
  ↓
Critique evidence
  ↓
Replan if necessary
  ↓
Final coach response
  ↓
Update player state
```

The target architecture should be implemented incrementally rather than replacing Phase 1.

---

## 15. Implementation Roadmap

### Step 1 — Stabilize Phase 1 contracts

- Keep `VideoAnalyzer` and `AnalyzerResult` stable.
- Add analyzer factory/configuration.
- Fix user/session authorization boundaries.
- Make CI tests blocking.
- Add regression tests for grounding and authorization.

### Step 2 — Real CV

Implement:

```text
analyzer/yolo26_analyzer.py
```

and return real:

- player detections/tracks
- court information
- ball information where reliable
- shot events
- rallies
- confidence-aware metrics

### Step 3 — Tool abstraction

Create explicit tool interfaces around:

```text
VideoAnalysisTool
MatchAnalyticsTool
PlayerHistoryTool
KnowledgeTool
ComparisonTool
TrainingTool
```

### Step 4 — Agent planner

Replace the fixed workflow with conditional LangGraph routing:

```text
planner → tool → observe → planner
```

while preserving the existing evidence validator.

### Step 5 — Critic + replanning

Add a separate evidence critic and bounded replanning loop.

### Step 6 — Longitudinal state

Add persistent player goals, weaknesses, improvements, training outcomes, and recommendations.

### Step 7 — Multi-sport expansion

Keep sport-specific detection/analytics behind the same tool interfaces.

```text
PickleballAnalyzer
TennisAnalyzer
BadmintonAnalyzer
TableTennisAnalyzer
       |
       v
VideoAnalysisTool
       |
       v
Coach Agent
```

The agentic layer should not need to be rewritten for each sport.

---

## 16. Non-Goals

The agent should **not**:

- pretend to see things that CV did not detect
- use LLM confidence as sports-data confidence
- expose raw model reasoning/chain-of-thought
- continuously run expensive CV analysis without a reason
- make medical/injury diagnoses
- produce unlimited replanning/tool loops
- couple the frontend directly to YOLO internals

---

## 17. Architectural Decision

**Decision:** Keep the current Phase 1 architecture and evolve it into a tool-using, evidence-planning LangGraph agent.

Do **not** rewrite the existing API or frontend when implementing the agentic layer.

The stable boundary should be:

```text
Frontend
   ↕
AI Coach API
   ↕
Agent / LangGraph
   ↕
Tools
   ├── Video/CV
   ├── Match analytics
   ├── Player history
   ├── Knowledge/RAG
   └── Training
```

This gives Kuvira a path from today's safe Phase 1 implementation to a genuine personalized sports-coaching agent without throwing away the work already completed.
