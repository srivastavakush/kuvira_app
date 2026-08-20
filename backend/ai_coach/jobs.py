"""Durable, retry-safe AI Coach analysis worker."""
from __future__ import annotations
import logging, os, socket, tempfile
from datetime import datetime, timezone
from typing import Any, Dict
from pymongo import ReturnDocument
from .analyzer import VideoAnalyzer, get_analyzer
from .infra import AsyncRetry
from .storage import ObjectStorage

log=logging.getLogger("kuvira.jobs")
WORKER_ID=f"{socket.gethostname()}:{os.getpid()}"
LOCK_TIMEOUT_SEC=int(os.environ.get("AI_COACH_JOB_LOCK_TIMEOUT_SEC","900"))

def _iso()->str: return datetime.now(timezone.utc).isoformat()
STAGES=[("reading_video",.15),("sampling_frames",.30),("cv_inference",.80),("assessing_quality",.90),("finalizing",.95)]

async def _claim_job(db,job_id:str)->dict|None:
    now=datetime.now(timezone.utc); stale_before=now.timestamp()-LOCK_TIMEOUT_SEC
    return await db.ai_coach_jobs.find_one_and_update(
        {"id":job_id,"status":{"$in":["queued","processing"]},"$or":[{"locked_at":None},{"locked_at":{"$exists":False}},{"lock_epoch":{"$lt":stale_before}}]},
        {"$set":{"status":"processing","stage":"processing","started_at":_iso(),"locked_at":_iso(),"lock_epoch":now.timestamp(),"locked_by":WORKER_ID},"$inc":{"attempts":1}},
        projection={"_id":0},return_document=ReturnDocument.AFTER)

async def run_analysis_job(db,job_id:str)->None:
    job=await _claim_job(db,job_id)
    if not job:return
    async def set_stage(stage:str,progress:float,**extra:Any)->None:
        update={"stage":stage,"progress":float(progress),"heartbeat_at":_iso()}; update.update(extra); await db.ai_coach_jobs.update_one({"id":job_id,"locked_by":WORKER_ID},{"$set":update})
    video=await db.ai_coach_videos.find_one({"id":job["video_id"],"user_id":job["user_id"]},{"_id":0})
    if not video: await set_stage("failed",1.0,status="failed",completed_at=_iso(),error="video_missing",locked_at=None,locked_by=None); return
    storage=ObjectStorage(); temp_path=None
    try:
        storage_ref=video.get("storage") or {"backend":video.get("storage_backend"),"path":video.get("storage_path")}; suffix=os.path.splitext(video.get("original_filename","video.mp4"))[1] or ".mp4"
        with tempfile.NamedTemporaryFile(prefix="kuvira-ai-coach-",suffix=suffix,delete=False) as tmp: temp_path=tmp.name
        path=storage.download_to(storage_ref,temp_path)
        async def progress_cb(stage:str,p:float)->None: await set_stage(stage,p)
        async def execute()->Any:
            analyzer:VideoAnalyzer=get_analyzer(job.get("sport","pickleball")); await db.ai_coach_jobs.update_one({"id":job_id,"locked_by":WORKER_ID},{"$set":{"analyzer":analyzer.name,"analyzer_version":analyzer.version}})
            for stage,p in STAGES[:2]: await set_stage(stage,p)
            return await analyzer.analyze(path,report_progress=progress_cb,sport=job.get("sport","pickleball"))
        try:
            result=await AsyncRetry(attempts=int(os.environ.get("AI_COACH_JOB_RETRIES","3"))).run(execute)
        except Exception as exc:
            attempts=int(job.get("attempts",1)); max_attempts=int(os.environ.get("AI_COACH_JOB_MAX_ATTEMPTS","5")); status="queued" if attempts<max_attempts else "failed"; await set_stage("queued" if status=="queued" else "failed",0.0 if status=="queued" else 1.0,status=status,error=str(exc)[:300],last_error_at=_iso(),locked_at=None,locked_by=None); return
        for stage,p in STAGES[3:]: await set_stage(stage,p)
        points = result.diagnostics.get("explicit_points", 0) if isinstance(result.diagnostics, dict) else 0
        analytics_doc:Dict[str,Any]={
            "match_id":job["match_id"],"video_id":job["video_id"],"user_id":job["user_id"],"sport":job.get("sport","pickleball"),
            "data_quality":result.data_quality.model_dump(),"metrics":[m.model_dump() for m in result.metrics],
            "rallies":result.rallies,"shots":result.shots,"points":result.diagnostics.get("points", []) if isinstance(result.diagnostics,dict) else [],
            "important_moments":result.important_moments,"analyzer":result.analyzer,"analyzer_version":result.analyzer_version,
            "diagnostics":{**result.diagnostics,"explicit_point_count":points},"generated_at":_iso()
        }
        await db.ai_coach_analytics.update_one({"match_id":job["match_id"],"user_id":job["user_id"]},{"$set":analytics_doc},upsert=True)
        await db.ai_coach_jobs.update_one({"id":job_id,"locked_by":WORKER_ID},{"$set":{"status":"completed","stage":"completed","progress":1.0,"completed_at":_iso(),"diagnostics":result.diagnostics,"locked_at":None,"locked_by":None}})
    except Exception as exc:
        await set_stage("failed",1.0,status="failed",completed_at=_iso(),error=str(exc)[:300],locked_at=None,locked_by=None)
    finally:
        if temp_path:
            try: os.unlink(temp_path)
            except FileNotFoundError: pass

async def run_worker_once(db,limit:int=1)->int:
    """Claim queued or stale processing jobs; intended for a dedicated worker."""
    jobs=await db.ai_coach_jobs.find({"status":{"$in":["queued","processing"]}},{"_id":0}).sort("created_at",1).to_list(limit)
    for job in jobs: await run_analysis_job(db,job["id"])
    return len(jobs)
