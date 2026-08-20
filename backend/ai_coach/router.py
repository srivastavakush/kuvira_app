"""AI Coach FastAPI router."""
from __future__ import annotations
import asyncio, logging, os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Header
from pydantic import BaseModel
from deps import db, gen_id, current_user
from .jobs import run_analysis_job
from .knowledge_seed import seed_items
from .providers import get_default_provider
from .retriever import get_default_retriever
from .graph import CoachWorkflow
from .coaching_state import CoachingStateService
from .agent.chat_workflow import AgenticChatWorkflow
from .infra import RateLimiter
from .storage import ObjectStorage

log = logging.getLogger("kuvira.ai_coach")
router = APIRouter(prefix="/api/ai-coach", tags=["ai-coach"])
MAX_VIDEO_BYTES = int(os.environ.get("AI_COACH_MAX_VIDEO_MB", "500")) * 1024 * 1024
ALLOWED_EXT = {".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"}
_CHAT_LIMITER = RateLimiter(int(os.environ.get("AI_COACH_CHAT_RATE_LIMIT", "20")), 60)
_ANALYZE_LIMITER = RateLimiter(int(os.environ.get("AI_COACH_ANALYZE_RATE_LIMIT", "5")), 3600)


def _iso(): return datetime.now(timezone.utc).isoformat()


class MatchCreateBody(BaseModel):
    sport: str = "pickleball"; player_level: Optional[str] = None; result: Optional[str] = None; opponent_name: Optional[str] = None; opponent_level: Optional[str] = None; notes: Optional[str] = None; played_at: Optional[str] = None
class AnalyzeBody(BaseModel): match_id: str; video_id: str
class ChatBody(BaseModel): text: str; session_id: Optional[str] = None; match_id: Optional[str] = None; video_id: Optional[str] = None
class GoalBody(BaseModel): title: str; target: Optional[str] = None; due_at: Optional[str] = None
class GoalUpdateBody(BaseModel): status: str
class TrainingOutcomeBody(BaseModel): status: str; outcome: Optional[Dict[str, Any]] = None

_workflow = None
_storage = None

def _get_workflow():
    global _workflow
    if _workflow is None: _workflow = CoachWorkflow(provider=get_default_provider(), retriever=get_default_retriever(db))
    return _workflow

def _get_chat_workflow(): return AgenticChatWorkflow(db=db, provider=get_default_provider(), retriever=get_default_retriever(db))
def _get_storage():
    global _storage
    if _storage is None: _storage = ObjectStorage()
    return _storage

async def _ensure_indexes():
    await db.ai_coach_matches.create_index("user_id")
    await db.ai_coach_videos.create_index("user_id")
    await db.ai_coach_jobs.create_index([("user_id", 1), ("status", 1)])
    await db.ai_coach_jobs.create_index([("user_id", 1), ("match_id", 1), ("video_id", 1), ("status", 1)])
    await db.ai_coach_jobs.create_index([("status", 1), ("locked_at", 1)])
    await db.ai_coach_jobs.create_index([("user_id", 1), ("idempotency_key", 1)], sparse=True)
    await db.ai_coach_analytics.create_index("match_id", unique=True)
    await db.ai_coach_reports.create_index("match_id", unique=True)
    await db.ai_coach_chat.create_index([("session_id",1),("created_at",1)])
    await CoachingStateService(db).ensure_indexes()

@router.post("/matches")
async def create_match(body: MatchCreateBody, user=Depends(current_user)):
    await _ensure_indexes(); m={"id":gen_id(),"user_id":user["id"],**body.model_dump(),"created_at":_iso()}; await db.ai_coach_matches.insert_one(m.copy()); m.pop("_id",None); return m

@router.get("/matches")
async def list_matches(user=Depends(current_user)):
    docs=await db.ai_coach_matches.find({"user_id":user["id"]},{"_id":0}).sort("created_at",-1).to_list(50)
    for d in docs:
        d["report"]=await db.ai_coach_reports.find_one({"match_id":d["id"]},{"_id":0,"id":1,"generated_at":1}); d["job"]=await db.ai_coach_jobs.find_one({"match_id":d["id"],"user_id":user["id"]},{"_id":0},sort=[("created_at",-1)])
    return docs

@router.post("/videos")
async def upload_video(file: UploadFile=File(...), match_id: Optional[str]=Form(None), user=Depends(current_user)):
    if not file.content_type or not file.content_type.startswith("video/"): raise HTTPException(400,f"Unsupported content type: {file.content_type}")
    ext=Path(file.filename or "video.mp4").suffix.lower()
    if ext and ext not in ALLOWED_EXT: raise HTTPException(400,f"Unsupported file extension: {ext}")
    if file.headers and file.headers.get("content-length") and int(file.headers["content-length"]) > MAX_VIDEO_BYTES:
        raise HTTPException(413,"Video exceeds configured limit")
    video_id=gen_id(); storage=_get_storage()
    try:
        stored=await asyncio.to_thread(storage.put, file.file, video_id, ext or ".mp4")
    except Exception as exc:
        log.exception("video storage failed")
        raise HTTPException(503,f"Video storage unavailable: {str(exc)[:120]}")
    size_bytes=int(file.headers.get("content-length", 0)) if file.headers else 0
    doc={"id":video_id,"user_id":user["id"],"match_id":match_id,"original_filename":file.filename or "video","mime_type":file.content_type,"size_bytes":size_bytes,"storage":stored,"storage_backend":stored.get("backend"),"created_at":_iso()}
    await db.ai_coach_videos.insert_one(doc.copy())
    if match_id: await db.ai_coach_matches.update_one({"id":match_id,"user_id":user["id"]},{"$set":{"video_id":video_id}})
    doc.pop("_id",None); return doc

@router.post("/analyze")
async def start_analysis(body: AnalyzeBody, user=Depends(current_user), idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")):
    if not _ANALYZE_LIMITER.allow(user["id"]): raise HTTPException(429,"Analysis rate limit exceeded")
    match=await db.ai_coach_matches.find_one({"id":body.match_id,"user_id":user["id"]}); video=await db.ai_coach_videos.find_one({"id":body.video_id,"user_id":user["id"]})
    if not match: raise HTTPException(404,"Match not found")
    if not video: raise HTTPException(404,"Video not found")
    if idempotency_key:
        existing=await db.ai_coach_jobs.find_one({"user_id":user["id"],"idempotency_key":idempotency_key},{"_id":0})
        if existing: return existing
    active=await db.ai_coach_jobs.find_one({"user_id":user["id"],"match_id":body.match_id,"video_id":body.video_id,"status":{"$in":["queued","processing"]}},{"_id":0})
    if active: return active
    job={"id":gen_id(),"user_id":user["id"],"match_id":body.match_id,"video_id":body.video_id,"status":"queued","stage":"queued","progress":0.0,"analyzer":os.environ.get("AI_COACH_ANALYZER","lightweight"),"sport":match.get("sport","pickleball"),"created_at":_iso(),"diagnostics":{},"idempotency_key":idempotency_key,"attempts":0,"locked_at":None,"locked_by":None}
    await db.ai_coach_jobs.insert_one(job.copy()); await db.ai_coach_matches.update_one({"id":body.match_id,"user_id":user["id"]},{"$set":{"analysis_job_id":job["id"]}})
    # Mongo job record is durable. A configured external queue may claim it; the
    # local fallback keeps development behavior without changing the contract.
    if os.environ.get("AI_COACH_QUEUE_BACKEND", "local").lower() == "local":
        asyncio.create_task(run_analysis_job(db,job["id"]))
    job.pop("_id",None); return job

@router.get("/analysis/{job_id}")
async def analysis_status(job_id:str,user=Depends(current_user)):
    job=await db.ai_coach_jobs.find_one({"id":job_id,"user_id":user["id"]},{"_id":0});
    if not job: raise HTTPException(404,"Job not found")
    return job

async def _load_context(user_id,match_id):
    profile=await db.users.find_one({"id":user_id},{"_id":0}) or {}; analytics=await db.ai_coach_analytics.find_one({"match_id":match_id},{"_id":0}) or {}; history=await db.ai_coach_matches.find({"user_id":user_id},{"_id":0}).sort("created_at",-1).to_list(5); return {"player_profile":profile,"match_analytics":analytics,"recent_match_history":history}

@router.get("/match/{match_id}/report")
async def get_match_report(match_id:str,refresh:bool=False,user=Depends(current_user)):
    match=await db.ai_coach_matches.find_one({"id":match_id,"user_id":user["id"]},{"_id":0});
    if not match: raise HTTPException(404,"Match not found")
    if not refresh:
        existing=await db.ai_coach_reports.find_one({"match_id":match_id,"user_id":user["id"]},{"_id":0})
        if existing: return existing
    ctx=await _load_context(user["id"],match_id)
    if not ctx["match_analytics"]: raise HTTPException(409,"Analysis not complete for this match")
    state=await _get_workflow().run({"user_id":user["id"],"match_id":match_id,**ctx}); fr=state.get("final_report") or {}
    report={"id":gen_id(),"user_id":user["id"],"match_id":match_id,"generated_at":_iso(),**{k:fr.get(k,[]) for k in ["strengths","weaknesses","tactical_observations","recommended_drills","training_plan","unavailable"]},"match_summary":fr.get("match_summary",""),"data_quality_summary":fr.get("data_quality_summary",""),"key_takeaway":fr.get("key_takeaway",""),"metrics":ctx["match_analytics"].get("metrics",[]),"data_quality":ctx["match_analytics"].get("data_quality",{}),"evidence":state.get("retrieved_evidence",state.get("evidence",[])),"analyzer":ctx["match_analytics"].get("analyzer"),"model":os.environ.get("OPENAI_MODEL_PRIMARY","gpt-5.6-terra"),"version":"0.4.0","agent": {"intent": state.get("intent"), "plan": state.get("plan",[]), "tool_calls": state.get("tool_calls",[]), "critique": state.get("critique",{}), "replan_count": state.get("replan_count",0), "step_count": state.get("step_count",0)}}
    await db.ai_coach_reports.update_one({"match_id":match_id,"user_id":user["id"]},{"$set":report},upsert=True)
    evolution=await CoachingStateService(db).evolve_from_report(user["id"],match_id,report,ctx["match_analytics"].get("data_quality",{}))
    report["coaching_transition"]={"mutated":evolution.get("mutated",False),"reason":evolution.get("reason"),"training_assignments":evolution.get("training_assignments",[]),"state":evolution.get("state")}
    await db.ai_coach_matches.update_one({"id":match_id,"user_id":user["id"]},{"$set":{"report_id":report["id"],"coaching_state_version":report["generated_at"]}}); return report

@router.get("/player-performance")
async def player_performance(user=Depends(current_user)):
    matches=await db.ai_coach_matches.find({"user_id":user["id"]},{"_id":0}).sort("created_at",-1).to_list(50); entries=[]
    for m in matches:
        an=await db.ai_coach_analytics.find_one({"match_id":m["id"]},{"_id":0})
        if an: entries.append({"match_id":m["id"],"created_at":m["created_at"],"metrics":an.get("metrics",[]),"data_quality":an.get("data_quality",{})})
    return {"matches_analyzed":len(entries),"latest":entries[0] if entries else None}

@router.get("/coaching-state")
async def coaching_state(user=Depends(current_user)): return await CoachingStateService(db).get_state(user["id"])
@router.post("/goals")
async def create_goal(body:GoalBody,user=Depends(current_user)): return await CoachingStateService(db).add_goal(user["id"],body.title,body.target,body.due_at)
@router.patch("/goals/{goal_id}")
async def update_goal(goal_id:str,body:GoalUpdateBody,user=Depends(current_user)):
    if body.status not in {"active","completed","paused","cancelled"}: raise HTTPException(400,"Invalid goal status")
    result=await CoachingStateService(db).update_goal(user["id"],goal_id,body.status)
    if not result: raise HTTPException(404,"Goal not found")
    return result
@router.get("/training")
async def training_history(user=Depends(current_user)): return await __import__("ai_coach.agent.coaching_tools",fromlist=["CoachingTools"]).CoachingTools(db).get_training_history(user["id"],50)
@router.post("/training/{training_id}/outcome")
async def training_outcome(training_id:str,body:TrainingOutcomeBody,user=Depends(current_user)):
    if body.status not in {"assigned","in_progress","completed","skipped"}: raise HTTPException(400,"Invalid training status")
    result=await CoachingStateService(db).record_training_outcome(user["id"],training_id,body.status,body.outcome)
    if not result: raise HTTPException(404,"Training assignment not found")
    return result

@router.post("/chat")
async def chat(body:ChatBody,user=Depends(current_user)):
    if not _CHAT_LIMITER.allow(user["id"]): raise HTTPException(429,"Chat rate limit exceeded")
    sid=body.session_id or f"coach-{user['id']}"
    try: result=await _get_chat_workflow().run_chat(user_id=user["id"],message=body.text,session_id=sid,match_id=body.match_id,video_id=body.video_id,sport="pickleball")
    except Exception as e: log.exception("agentic chat failed"); raise HTTPException(502,f"Coach model unavailable: {str(e)[:120]}")
    return result

@router.get("/history")
async def chat_history(session_id:Optional[str]=None,user=Depends(current_user)):
    sid=session_id or f"coach-{user['id']}"; msgs=await db.ai_coach_chat.find({"session_id":sid,"user_id":user["id"]},{"_id":0}).sort("created_at",1).to_list(200); return {"session_id":sid,"messages":msgs}

@router.post("/knowledge/seed")
async def knowledge_seed(user=Depends(current_user)):
    n=await get_default_retriever(db).upsert(seed_items()); return {"upserted":n}
