"""Async analysis job runner with configurable analyzer registry."""
from __future__ import annotations
import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

from .analyzer import VideoAnalyzer, get_analyzer

log = logging.getLogger("kuvira.jobs")


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat()


STAGES = [
    ("uploading", 0.05), ("reading_video", 0.15), ("sampling_frames", 0.35),
    ("computing_motion", 0.55), ("assessing_quality", 0.75), ("finalizing", 0.95),
]


async def run_analysis_job(db, job_id: str) -> None:
    job = await db.ai_coach_jobs.find_one({"id": job_id})
    if not job:
        log.warning("job %s not found", job_id); return

    async def set_stage(stage: str, progress: float, **extra: Any) -> None:
        update = {"stage": stage, "progress": float(progress)}
        update.update(extra)
        await db.ai_coach_jobs.update_one({"id": job_id}, {"$set": update})

    await set_stage("processing", 0.02, status="processing", started_at=_iso())
    video = await db.ai_coach_videos.find_one({"id": job["video_id"]})
    if not video:
        await set_stage("failed", 1.0, status="failed", completed_at=_iso(), error="video_missing"); return
    path = video["storage_path"]
    if not os.path.exists(path):
        await set_stage("failed", 1.0, status="failed", completed_at=_iso(), error="video_file_missing_on_disk"); return

    async def progress_cb(stage: str, p: float) -> None:
        await set_stage(stage, p)

    analyzer_name = os.environ.get("AI_COACH_ANALYZER", "lightweight")
    try:
        analyzer: VideoAnalyzer = get_analyzer()
        await db.ai_coach_jobs.update_one({"id": job_id}, {"$set": {"analyzer": analyzer.name, "analyzer_version": analyzer.version}})
        for stage, p in STAGES[:3]:
            await set_stage(stage, p)
            await asyncio.sleep(0.05)
        result = await analyzer.analyze(path, report_progress=progress_cb, sport=job.get("sport", "pickleball"))
    except Exception as e:
        log.exception("analyzer %s crashed for job %s", analyzer_name, job_id)
        await set_stage("failed", 1.0, status="failed", completed_at=_iso(), error=str(e)[:300]); return

    for stage, p in STAGES[3:]:
        await set_stage(stage, p)

    analytics_doc: Dict[str, Any] = {
        "match_id": job["match_id"], "video_id": job["video_id"],
        "sport": job.get("sport", "pickleball"), "data_quality": result.data_quality.model_dump(),
        "metrics": [m.model_dump() for m in result.metrics], "rallies": result.rallies,
        "shots": result.shots, "important_moments": result.important_moments,
        "analyzer": result.analyzer, "analyzer_version": result.analyzer_version,
        "diagnostics": result.diagnostics, "generated_at": _iso(),
    }
    await db.ai_coach_analytics.update_one({"match_id": job["match_id"]}, {"$set": analytics_doc}, upsert=True)
    await db.ai_coach_jobs.update_one({"id": job_id}, {"$set": {
        "status": "completed", "stage": "completed", "progress": 1.0,
        "completed_at": _iso(), "diagnostics": result.diagnostics,
    }})
    log.info("job %s completed with analyzer=%s", job_id, result.analyzer)
