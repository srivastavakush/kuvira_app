"""AI Coach FastAPI router.

Endpoints:
  POST /api/ai-coach/matches                     create a match record
  POST /api/ai-coach/videos                      upload video (multipart)
  POST /api/ai-coach/analyze                     kick off analysis (async job)
  GET  /api/ai-coach/analysis/{id}               job status
  GET  /api/ai-coach/match/{id}/report           coaching report (grounded)
  GET  /api/ai-coach/player-performance          longitudinal metric snapshot
  POST /api/ai-coach/chat                        context-aware coach chat
  GET  /api/ai-coach/history                     chat history
  POST /api/ai-coach/knowledge/seed              (dev) seed coaching knowledge
"""
from __future__ import annotations
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from deps import db, gen_id, current_user
from .jobs import run_analysis_job
from .knowledge_seed import seed_items
from .providers import get_default_provider
from .retriever import get_default_retriever
from .graph import CoachWorkflow

log = logging.getLogger("kuvira.ai_coach")

router = APIRouter(prefix="/api/ai-coach", tags=["ai-coach"])

UPLOAD_DIR = Path(os.environ.get("AI_COACH_UPLOAD_DIR", "/app/backend/uploads/videos"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_VIDEO_BYTES = int(os.environ.get("AI_COACH_MAX_VIDEO_MB", "500")) * 1024 * 1024
ALLOWED_MIME_PREFIXES = ("video/",)
ALLOWED_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------- models
class MatchCreateBody(BaseModel):
    sport: str = "pickleball"
    player_level: Optional[str] = None
    result: Optional[str] = None
    opponent_name: Optional[str] = None
    opponent_level: Optional[str] = None
    notes: Optional[str] = None
    played_at: Optional[str] = None


class AnalyzeBody(BaseModel):
    match_id: str
    video_id: str


class ChatBody(BaseModel):
    text: str
    session_id: Optional[str] = None
    match_id: Optional[str] = None


# ---------------------------------------------------------------- setup once
_workflow: Optional[CoachWorkflow] = None


def _get_workflow() -> CoachWorkflow:
    global _workflow
    if _workflow is None:
        _workflow = CoachWorkflow(provider=get_default_provider(), retriever=get_default_retriever(db))
    return _workflow


async def _ensure_indexes() -> None:
    await db.ai_coach_matches.create_index("user_id")
    await db.ai_coach_videos.create_index("user_id")
    await db.ai_coach_jobs.create_index("user_id")
    await db.ai_coach_jobs.create_index("status")
    await db.ai_coach_analytics.create_index("match_id", unique=True)
    await db.ai_coach_reports.create_index("match_id", unique=True)
    await db.ai_coach_chat.create_index([("session_id", 1), ("created_at", 1)])


# ------------------------------------------------------------------- matches
@router.post("/matches")
async def create_match(body: MatchCreateBody, user=Depends(current_user)):
    await _ensure_indexes()
    m = {"id": gen_id(), "user_id": user["id"], **body.model_dump(), "created_at": _iso()}
    await db.ai_coach_matches.insert_one(m.copy())
    m.pop("_id", None)
    return m


@router.get("/matches")
async def list_matches(user=Depends(current_user)):
    docs = await db.ai_coach_matches.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # enrich with report id + job status where available
    for d in docs:
        rep = await db.ai_coach_reports.find_one({"match_id": d["id"]}, {"_id": 0, "id": 1, "generated_at": 1})
        d["report"] = rep
        job = await db.ai_coach_jobs.find_one({"match_id": d["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        d["job"] = job
    return docs


# -------------------------------------------------------------------- videos
@router.post("/videos")
async def upload_video(
    file: UploadFile = File(...),
    match_id: Optional[str] = Form(None),
    user=Depends(current_user),
):
    if not file.content_type or not any(file.content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES):
        raise HTTPException(400, f"Unsupported content type: {file.content_type}")
    orig_name = file.filename or "video"
    ext = Path(orig_name).suffix.lower()
    if ext and ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Unsupported file extension: {ext}")

    video_id = gen_id()
    dest = UPLOAD_DIR / f"{video_id}{ext or '.mp4'}"
    written = 0
    with dest.open("wb") as f:
        while True:
            chunk = await file.read(1 << 20)  # 1 MiB
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_VIDEO_BYTES:
                f.close()
                try: dest.unlink()
                except Exception: pass
                raise HTTPException(413, f"Video exceeds {MAX_VIDEO_BYTES // (1024 * 1024)} MB limit")
            f.write(chunk)

    doc = {
        "id": video_id, "user_id": user["id"], "match_id": match_id,
        "original_filename": orig_name, "mime_type": file.content_type,
        "size_bytes": written, "storage_path": str(dest),
        "created_at": _iso(),
    }
    await db.ai_coach_videos.insert_one(doc.copy())
    if match_id:
        await db.ai_coach_matches.update_one({"id": match_id, "user_id": user["id"]}, {"$set": {"video_id": video_id}})
    doc.pop("_id", None)
    return doc


# --------------------------------------------------------------- analyze job
@router.post("/analyze")
async def start_analysis(body: AnalyzeBody, user=Depends(current_user)):
    match = await db.ai_coach_matches.find_one({"id": body.match_id, "user_id": user["id"]})
    if not match:
        raise HTTPException(404, "Match not found")
    video = await db.ai_coach_videos.find_one({"id": body.video_id, "user_id": user["id"]})
    if not video:
        raise HTTPException(404, "Video not found")

    job_id = gen_id()
    job = {
        "id": job_id, "user_id": user["id"], "match_id": body.match_id, "video_id": body.video_id,
        "status": "queued", "stage": "queued", "progress": 0.0,
        "analyzer": "lightweight", "sport": match.get("sport", "pickleball"),
        "created_at": _iso(), "diagnostics": {},
    }
    await db.ai_coach_jobs.insert_one(job.copy())
    await db.ai_coach_matches.update_one({"id": body.match_id}, {"$set": {"analysis_job_id": job_id}})
    asyncio.create_task(run_analysis_job(db, job_id))
    job.pop("_id", None)
    return job


@router.get("/analysis/{job_id}")
async def analysis_status(job_id: str, user=Depends(current_user)):
    job = await db.ai_coach_jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    return job


# ------------------------------------------------------------------- report
async def _load_context(user_id: str, match_id: str) -> Dict[str, Any]:
    profile = await db.users.find_one({"id": user_id}, {"_id": 0}) or {}
    analytics = await db.ai_coach_analytics.find_one({"match_id": match_id}, {"_id": 0}) or {}
    history = await db.ai_coach_matches.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(5)
    return {"player_profile": profile, "match_analytics": analytics, "recent_match_history": history}


@router.get("/match/{match_id}/report")
async def get_match_report(match_id: str, refresh: bool = False, user=Depends(current_user)):
    match = await db.ai_coach_matches.find_one({"id": match_id, "user_id": user["id"]}, {"_id": 0})
    if not match:
        raise HTTPException(404, "Match not found")

    if not refresh:
        existing = await db.ai_coach_reports.find_one({"match_id": match_id}, {"_id": 0})
        if existing:
            return existing

    ctx = await _load_context(user["id"], match_id)
    if not ctx["match_analytics"]:
        raise HTTPException(409, "Analysis not complete for this match")

    wf = _get_workflow()
    state = await wf.run({"user_id": user["id"], "match_id": match_id, **ctx})

    fr = state.get("final_report") or {}
    report = {
        "id": gen_id(),
        "user_id": user["id"],
        "match_id": match_id,
        "generated_at": _iso(),
        "match_summary": fr.get("match_summary", ""),
        "data_quality_summary": fr.get("data_quality_summary", ""),
        "key_takeaway": fr.get("key_takeaway", ""),
        "strengths": fr.get("strengths", []),
        "weaknesses": fr.get("weaknesses", []),
        "tactical_observations": fr.get("tactical_observations", []),
        "recommended_drills": fr.get("recommended_drills", []),
        "training_plan": fr.get("training_plan", []),
        "unavailable": fr.get("unavailable", []),
        "metrics": (ctx["match_analytics"].get("metrics") or []),
        "data_quality": ctx["match_analytics"].get("data_quality") or {},
        "evidence": state.get("retrieved_evidence", []),
        "analyzer": ctx["match_analytics"].get("analyzer"),
        "model": os.environ.get("OPENAI_MODEL_PRIMARY", "gpt-5.6-terra"),
        "version": "0.1.0",
    }
    await db.ai_coach_reports.update_one({"match_id": match_id}, {"$set": report}, upsert=True)
    await db.ai_coach_matches.update_one({"id": match_id}, {"$set": {"report_id": report["id"]}})
    report.pop("_id", None)
    return report


@router.get("/player-performance")
async def player_performance(user=Depends(current_user)):
    """Longitudinal snapshot: metric-by-metric current/previous with source+confidence."""
    matches = await db.ai_coach_matches.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    entries: List[Dict[str, Any]] = []
    for m in matches:
        an = await db.ai_coach_analytics.find_one({"match_id": m["id"]}, {"_id": 0})
        if an:
            entries.append({"match_id": m["id"], "created_at": m["created_at"], "metrics": an.get("metrics", []), "data_quality": an.get("data_quality", {})})

    trends: Dict[str, Any] = {}
    if entries:
        latest = entries[0]
        prev = entries[1] if len(entries) > 1 else None
        for m in latest["metrics"]:
            name = m["metric"]
            prev_val = None
            if prev:
                for pm in prev["metrics"]:
                    if pm["metric"] == name:
                        prev_val = pm.get("value"); break
            trends[name] = {
                "current": m.get("value"),
                "previous": prev_val,
                "unit": m.get("unit"),
                "source": m.get("source"),
                "confidence": m.get("confidence"),
            }
    return {"matches_analyzed": len(entries), "latest": entries[0] if entries else None, "trends": trends}


# --------------------------------------------------------------------- chat
CHAT_SYSTEM_BASE = (
    "You are Kuvira AI Coach. Ground rules:\n"
    "• Only cite player-specific numbers that appear in PLAYER CONTEXT or MATCH ANALYTICS.\n"
    "• Distinguish (A) verified facts, (B) retrieved coaching evidence, (C) inference.\n"
    "• If data is missing or low-confidence, say so; do not invent.\n"
    "• Structure actionable answers as Observation → Why → Evidence → Action → Drill → Target.\n"
    "• Keep sentences short. No hype, no emoji."
)


@router.post("/chat")
async def chat(body: ChatBody, user=Depends(current_user)):
    session_id = body.session_id or f"coach-{user['id']}"
    match_id = body.match_id
    if not match_id:
        # fall back to the user's most recent match with analytics
        recent = await db.ai_coach_matches.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
        for r in recent:
            an = await db.ai_coach_analytics.find_one({"match_id": r["id"]})
            if an:
                match_id = r["id"]; break

    ctx: Dict[str, Any] = {"player_profile": await db.users.find_one({"id": user["id"]}, {"_id": 0}) or {}}
    if match_id:
        an = await db.ai_coach_analytics.find_one({"match_id": match_id}, {"_id": 0}) or {}
        ctx["match_analytics"] = an
        ctx["data_quality"] = an.get("data_quality", {})

    # Retrieve knowledge relevant to the question + player skill.
    retriever = get_default_retriever(db)
    try:
        results = await retriever.retrieve(body.text or "pickleball coaching", top_k=5, filters={"sport": "pickleball"})
        evidence = [{"title": r.item.title, "body": r.item.body, "source": r.item.source_name, "authority": r.item.authority_level} for r in results]
    except Exception:
        log.exception("chat retrieval failed"); evidence = []

    # Load short chat history
    history = await db.ai_coach_chat.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    msgs = [{"role": h["role"], "content": h["text"]} for h in history[-8:]]

    system = CHAT_SYSTEM_BASE + "\n\nPLAYER CONTEXT:\n" + str({k: ctx["player_profile"].get(k) for k in ["name", "skill_level", "city", "primary_sport", "playing_frequency"] if ctx["player_profile"].get(k)})
    if ctx.get("match_analytics"):
        system += "\n\nMATCH ANALYTICS:\n" + str({
            "metrics": ctx["match_analytics"].get("metrics", []),
            "data_quality": ctx.get("data_quality", {}),
            "analyzer": ctx["match_analytics"].get("analyzer"),
        })
    else:
        system += "\n\nMATCH ANALYTICS: none available yet — the user has not uploaded an analyzed match."
    if evidence:
        system += "\n\nRETRIEVED COACHING EVIDENCE:\n" + str(evidence)

    msgs.append({"role": "user", "content": body.text})

    provider = get_default_provider()
    try:
        reply = await provider.generate_coaching_response(system=system, messages=msgs, max_output_tokens=700)
    except Exception as e:
        log.exception("chat generation failed")
        raise HTTPException(502, f"Coach model unavailable: {str(e)[:120]}")

    now = _iso()
    await db.ai_coach_chat.insert_one({"session_id": session_id, "user_id": user["id"], "role": "user", "text": body.text, "match_id": match_id, "created_at": now})
    await db.ai_coach_chat.insert_one({"session_id": session_id, "user_id": user["id"], "role": "assistant", "text": reply, "match_id": match_id, "created_at": _iso()})
    return {"session_id": session_id, "reply": reply, "match_id": match_id, "evidence": evidence}


@router.get("/history")
async def chat_history(session_id: Optional[str] = None, user=Depends(current_user)):
    sid = session_id or f"coach-{user['id']}"
    msgs = await db.ai_coach_chat.find({"session_id": sid}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"session_id": sid, "messages": msgs}


# --------------------------------------------------------------- knowledge
@router.post("/knowledge/seed")
async def knowledge_seed(user=Depends(current_user)):
    retriever = get_default_retriever(db)
    n = await retriever.upsert(seed_items())
    return {"upserted": n}
