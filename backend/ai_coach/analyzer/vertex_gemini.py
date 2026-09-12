"""Vertex Gemini video analyst for GCS-resident match footage.

Gemini's observations are labelled as model-assisted estimates and retain their
confidence.  It must never turn uncertain visual interpretation into claimed
score, speed, swing, or point data.
"""
from __future__ import annotations

import json
import os
from typing import Any, Optional

from ..models import DataQuality, Metric
from .base import AnalyzerResult, ProgressCb, VideoAnalyzer


class VertexGeminiVideoAnalyzer(VideoAnalyzer):
    name = "vertex_gemini"
    version = "1.0.0"

    def __init__(self) -> None:
        self.project = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
        self.location = os.environ.get("VERTEX_AI_LOCATION", "asia-south1")
        self.model = os.environ.get("VERTEX_AI_VIDEO_MODEL", os.environ.get("VERTEX_AI_MODEL_SECONDARY", "gemini-2.5-flash"))
        if not self.project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for Vertex video analysis")

    async def analyze(
        self,
        video_path: str,
        *,
        report_progress: Optional[ProgressCb] = None,
        sport: str = "pickleball",
    ) -> AnalyzerResult:
        if not video_path.startswith("gs://"):
            raise RuntimeError("vertex_gemini requires a private gs:// video object")
        return await self.analyze_gcs(video_path, report_progress=report_progress, sport=sport)

    async def analyze_gcs(
        self,
        gcs_uri: str,
        *,
        mime_type: str = "video/mp4",
        report_progress: Optional[ProgressCb] = None,
        sport: str = "pickleball",
    ) -> AnalyzerResult:
        from google import genai
        from google.genai import types

        if report_progress:
            await report_progress("cv_inference", 0.45)
        client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
            http_options=types.HttpOptions(api_version="v1"),
        )
        schema: dict[str, Any] = {
            "type": "object",
            "properties": {
                "data_quality": {"type": "object", "properties": {
                    "frames_sampled": {"type": "integer"}, "duration_sec": {"type": "number"},
                    "resolution": {"type": "string"}, "player_tracking_confidence": {"type": "number"},
                    "ball_tracking_confidence": {"type": "number"}, "paddle_detection_confidence": {"type": "number"},
                    "pose_confidence": {"type": "number"}, "court_geometry_confidence": {"type": "number"},
                    "shot_classification_confidence": {"type": "number"}, "overall_confidence": {"type": "number"},
                    "missing": {"type": "array", "items": {"type": "string"}}, "warnings": {"type": "array", "items": {"type": "string"}},
                }},
                "metrics": {"type": "array", "items": {"type": "object", "properties": {
                    "metric": {"type": "string"}, "value": {"type": "number"}, "unit": {"type": "string"},
                    "confidence": {"type": "number"}, "note": {"type": "string"},
                }}},
                "rallies": {"type": "array", "items": {"type": "object"}},
                "shots": {"type": "array", "items": {"type": "object"}},
                "important_moments": {"type": "array", "items": {"type": "object"}},
                "diagnostics": {"type": "object"},
            },
        }
        prompt = f"""Analyze this {sport} match video as an assistant coach.
Return only evidence visible in the footage. Do not invent score, winners,
errors, swing speed, ball speed, point boundaries, player identity, or exact
timestamps. If an observation is uncertain, add it to warnings or missing.
Metrics must be clearly named model-assisted visual estimates with confidence
between 0 and 0.7. Use short evidence notes. Return the requested JSON."""
        response = await client.aio.models.generate_content(
            model=self.model,
            contents=[types.Part.from_uri(file_uri=gcs_uri, mime_type=mime_type), prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=schema,
                temperature=0.1,
                max_output_tokens=3000,
            ),
        )
        if report_progress:
            await report_progress("cv_inference", 0.82)
        text = (getattr(response, "text", None) or "").strip()
        try:
            payload = json.loads(text) if text else {}
        except json.JSONDecodeError:
            payload = {"diagnostics": {"raw_response": text[:1000]}, "data_quality": {"warnings": ["invalid_vertex_json"]}}

        quality = dict(payload.get("data_quality") or {})
        for key in ("player_tracking_confidence", "ball_tracking_confidence", "paddle_detection_confidence", "pose_confidence", "court_geometry_confidence", "shot_classification_confidence", "overall_confidence"):
            quality[key] = min(0.7, max(0.0, float(quality.get(key) or 0.0)))
        quality.setdefault("missing", [])
        quality.setdefault("warnings", [])
        quality["warnings"] = list(quality["warnings"]) + ["vertex_visual_estimates_not_calibrated_cv_measurements"]

        metrics: list[Metric] = []
        for raw in payload.get("metrics") or []:
            try:
                metrics.append(Metric(
                    metric=str(raw.get("metric") or "visual_observation"), value=float(raw["value"]) if raw.get("value") is not None else None,
                    unit=raw.get("unit"), source="vertex_gemini", confidence=min(0.7, max(0.0, float(raw.get("confidence") or 0.0))),
                    note=raw.get("note"),
                ))
            except (TypeError, ValueError):
                continue
        diagnostics = dict(payload.get("diagnostics") or {})
        diagnostics.update({"gcs_uri": gcs_uri, "model": self.model, "provider": "vertex"})
        return AnalyzerResult(
            analyzer=self.name, analyzer_version=self.version, data_quality=DataQuality.model_validate(quality), metrics=metrics,
            rallies=list(payload.get("rallies") or []), shots=list(payload.get("shots") or []),
            important_moments=list(payload.get("important_moments") or []), diagnostics=diagnostics,
        )
