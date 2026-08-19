# Kuvira AI Coach — Phase 1

Video-first, sensor-optional coaching system. Grounded reasoning over structured
analytics + retrieved coaching evidence. Modular so real CV models can drop in
without changes to the LangGraph, retriever, provider, API, or frontend layers.

## Files created

Backend (`/app/backend/ai_coach/`):
- `__init__.py`
- `models.py`                     — pydantic schemas (Match, Video, Job, Metric, DataQuality, MatchAnalytics, CoachingReport, EvidenceItem, ChatMessage)
- `providers/base.py`             — `AIProvider` abstract interface
- `providers/openai_provider.py`  — `OpenAIProvider` with Responses API + Chat Completions fallback and retry
- `analyzer/base.py`              — `VideoAnalyzer` abstract interface + `AnalyzerResult`
- `analyzer/lightweight.py`       — OpenCV-only metadata analyzer (no fabricated shot/rally data)
- `retriever/base.py`             — `KnowledgeRetriever` abstract interface + `KnowledgeItem`
- `retriever/mongo_retriever.py`  — Mongo + in-Python cosine + hybrid keyword + authority bonus
- `graph.py`                      — LangGraph workflow (with sequential fallback if langgraph not present)
- `jobs.py`                       — async analysis job runner
- `router.py`                     — FastAPI router
- `knowledge_seed.py`             — tiered coaching knowledge (rules / expert / Kuvira drills)

Frontend (`/app/frontend/app/`):
- `ai-coach.tsx`                        — hub (Analyze / Recent match / Trends / Training / Chat)
- `ai-coach/upload.tsx`                 — video picker + match info + start
- `ai-coach/analyzing/[id].tsx`         — staged progress poller
- `ai-coach/report/[id].tsx`            — grounded coaching report
- `ai-coach/performance.tsx`            — longitudinal metrics
- `ai-coach/chat.tsx`                   — context-aware coach chat

## Files modified

- `/app/backend/server.py`           — mounts `ai_coach.router`
- `/app/backend/requirements.txt`    — adds `opencv-python-headless`, `langgraph`
- `/app/backend/.env`                — adds `OPENAI_API_KEY`, `OPENAI_BASE_URL`, model IDs, upload dir/size
- `/app/frontend/src/api.ts`         — adds `api.aiCoach.*` client (multipart upload, analyze, status, report, chat, history, performance, seed)
- `/app/frontend/package.json`       — adds `expo-image-picker` (already reinstalled)

## MongoDB collections

- `ai_coach_matches`      — user's matches
- `ai_coach_videos`       — uploaded video metadata + storage path
- `ai_coach_jobs`         — async analysis jobs (queued / processing / completed / failed + stage + progress + diagnostics)
- `ai_coach_analytics`    — one document per analyzed match (metrics, data_quality, rallies, shots, moments)
- `ai_coach_reports`      — grounded coaching reports
- `ai_coach_chat`         — session-scoped chat history
- `ai_coach_knowledge`    — coaching knowledge with embeddings and metadata

## API endpoints (all `/api/ai-coach/…`)

- `POST /matches`                        create match
- `GET  /matches`                        list matches (enriched with job + report)
- `POST /videos`                         multipart upload (MIME + size + extension validated)
- `POST /analyze`                        start async analysis job
- `GET  /analysis/{job_id}`              poll job status
- `GET  /match/{match_id}/report`        get/generate grounded coaching report (LangGraph)
- `GET  /player-performance`             longitudinal metric trends
- `POST /chat`                           context-aware coach chat
- `GET  /history`                        chat history
- `POST /knowledge/seed`                 (dev) seed knowledge base

## LangGraph workflow

`START → identify_intent → load_player_context → load_match_analytics → assess_data_quality → diagnose → retrieve_knowledge → generate_report → validate_evidence → finalize → END`

Grounding rule enforced by `validate_evidence`: if `diagnosis.can_make_tactical_claims` is false (which is the case whenever `data_quality.overall_confidence < 0.5`), any populated `strengths`/`weaknesses`/`tactical_observations` are moved into `unavailable`. The lightweight analyzer sets `overall_confidence=0` — so on Phase 1 no shot/tactical claims can leak into a report.

## Models & providers configured

- `AIProvider` default = `OpenAIProvider`
- Primary reasoning model:   `gpt-5.6-terra`  (env: `OPENAI_MODEL_PRIMARY`)
- Secondary / structured:    `gpt-5.6-luna`   (env: `OPENAI_MODEL_SECONDARY`)
- Embeddings:                `text-embedding-3-small`  (env: `OPENAI_MODEL_EMBEDDING`)
- Base URL:                  `https://api.openai.com/v1` (env: `OPENAI_BASE_URL`)
- Responses API used first, Chat Completions fallback for temporarily unavailable models. Exponential backoff on transient errors.

## Environment variables

Required (server-side only; never expose to client):
```
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_PRIMARY=gpt-5.6-terra
OPENAI_MODEL_SECONDARY=gpt-5.6-luna
OPENAI_MODEL_EMBEDDING=text-embedding-3-small
AI_COACH_UPLOAD_DIR=/app/backend/uploads/videos
AI_COACH_MAX_VIDEO_MB=500
```

## Local setup

1. `cd /app/backend && pip install -r requirements.txt`  (opencv + langgraph already installed)
2. Set `OPENAI_API_KEY` in `/app/backend/.env` — this key is required only for report generation / chat; upload + analytics work without it.
3. `sudo supervisorctl restart backend expo`
4. Sign in on the app, open Coach → Analyze a match, upload any real match video.

## Tests / verification

Backend was tested end-to-end by the deep testing agent:
- ffmpeg-generated 2-second sample MP4 uploaded successfully
- job progressed queued → processing → completed with legitimate stage transitions
- analytics document written with 4 legit metrics (`video_duration`, `video_fps`, `average_motion_signal`, `scene_change_estimate`), each with `source` + `confidence`
- report endpoint (without OpenAI key) correctly returns empty strengths/weaknesses/tactical_observations and marks them in `unavailable`
- chat endpoint returns 502 without key (never 500)
- player-performance endpoint returns the aggregated trend map

## Known limitations

1. **No trained CV**: the shipped analyzer only reports video metadata + motion. Shot classification, rally boundaries, court geometry are all `unavailable` by design. This is honest, not lazy — no synthetic analytics.
2. **In-Python cosine similarity**: fine for hundreds of knowledge items; not for millions. Migrate to Atlas Vector Search or pgvector via `KnowledgeRetriever` subclass.
3. **Chunked upload**: current implementation streams a single multipart POST. Sufficient for phones on Wi-Fi; a resumable protocol (tus/S3 multipart) is a follow-up.
4. **Storage lifecycle**: uploaded videos remain on disk after analysis. Add a periodic cleanup job that deletes videos older than N days if desired.
5. **Rate limiting**: not yet applied to `ai-coach/chat` and `ai-coach/analyze`.
6. **OpenAI availability**: model IDs `gpt-5.6-terra` / `gpt-5.6-luna` are configured as requested. If the account cannot access them today, the provider will error cleanly (502) rather than fabricate output.

## Exact next step — replacing the lightweight analyzer with real CV

Drop-in path (no other code changes needed):

1. Create `/app/backend/ai_coach/analyzer/yolo26_analyzer.py`:
```python
from .base import VideoAnalyzer, AnalyzerResult
from ..models import DataQuality, Metric

class Yolo26Analyzer(VideoAnalyzer):
    name = "yolo26"
    version = "0.1.0"

    async def analyze(self, video_path, *, report_progress=None, sport="pickleball"):
        # 1. Load YOLO26 (player + ball + paddle) via ultralytics
        # 2. Load YOLO26-pose for player keypoints
        # 3. Run detection per sampled frame; feed detections to ByteTrack/BoT-SORT
        # 4. Estimate court homography with OpenCV once you have court keypoints
        # 5. Convert tracked entities into shot candidates → temporal shot classifier
        # 6. Assemble AnalyzerResult with real rallies/shots/important_moments and true confidences
        ...
```

2. Switch `jobs.py` to select the analyzer via config:
```python
import os
_analyzer = LightweightAnalyzer()
if os.environ.get("AI_COACH_ANALYZER") == "yolo26":
    from .analyzer.yolo26_analyzer import Yolo26Analyzer
    _analyzer = Yolo26Analyzer()
```

3. Add weights path via `AI_COACH_YOLO_WEIGHTS`; run analysis on GPU or a dedicated worker (video CV is not sandbox-friendly).

Because the LangGraph reads `data_quality.overall_confidence` and `metrics`, the moment the real analyzer produces populated shots/rallies with non-zero confidence, the report will *automatically* stop being empty for tactical claims — with grounding preserved.
