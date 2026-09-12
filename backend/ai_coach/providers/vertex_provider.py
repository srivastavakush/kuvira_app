"""Vertex AI implementation of the shared AI Coach provider contract.

Authentication deliberately uses Application Default Credentials (ADC).  On
Cloud Run this means the service account attached to the service; no Google API
key is stored in the mobile app or checked into the repository.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from .base import AIProvider, ChatTurn

log = logging.getLogger("kuvira.ai.vertex")


class VertexAIProvider(AIProvider):
    name = "vertex"

    def __init__(
        self,
        project: Optional[str] = None,
        location: Optional[str] = None,
        primary_model: Optional[str] = None,
        secondary_model: Optional[str] = None,
        embedding_model: Optional[str] = None,
    ) -> None:
        self.project = project or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
        self.location = location or os.environ.get("VERTEX_AI_LOCATION", "asia-south1")
        self.primary_model = primary_model or os.environ.get("VERTEX_AI_MODEL_PRIMARY", "gemini-2.5-flash")
        self.secondary_model = secondary_model or os.environ.get("VERTEX_AI_MODEL_SECONDARY", self.primary_model)
        self.embedding_model = embedding_model or os.environ.get("VERTEX_AI_EMBEDDING_MODEL", "text-embedding-005")
        if not self.project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required when AI_PROVIDER=vertex")

        # Import lazily so local development can continue without the optional
        # Google SDK installed.
        from google import genai
        from google.genai import types

        self.types = types
        self._client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
            http_options=types.HttpOptions(api_version="v1"),
        )

    async def _with_retry(self, fn, *args, **kwargs):
        last: Exception | None = None
        for attempt in range(3):
            try:
                return await fn(*args, **kwargs)
            except Exception as exc:  # Vertex errors expose different concrete classes by transport.
                last = exc
                if attempt == 2:
                    break
                await asyncio.sleep(1.0 * (2 ** attempt))
        raise last  # type: ignore[misc]

    def _contents(self, messages: List[ChatTurn]):
        return [
            self.types.Content(
                role="model" if message["role"] == "assistant" else "user",
                parts=[self.types.Part(text=message["content"])],
            )
            for message in messages
            if message["role"] != "system"
        ]

    async def generate_coaching_response(
        self,
        system: str,
        messages: List[ChatTurn],
        model: Optional[str] = None,
        max_output_tokens: int = 900,
    ) -> str:
        config = self.types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_output_tokens,
            temperature=0.35,
        )
        response = await self._with_retry(
            self._client.aio.models.generate_content,
            model=model or self.primary_model,
            contents=self._contents(messages),
            config=config,
        )
        return (getattr(response, "text", None) or "").strip()

    async def generate_structured_analysis(
        self,
        system: str,
        user: str,
        schema: Dict[str, Any],
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        config = self.types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_json_schema=schema,
            temperature=0.15,
            max_output_tokens=1600,
        )
        response = await self._with_retry(
            self._client.aio.models.generate_content,
            model=model or self.secondary_model,
            contents=user,
            config=config,
        )
        text = (getattr(response, "text", None) or "").strip()
        try:
            return json.loads(text) if text else {}
        except json.JSONDecodeError:
            log.warning("Vertex returned non-JSON structured output")
            return {"_raw": text}

    async def embed(
        self,
        texts: List[str],
        model: Optional[str] = None,
        purpose: str = "RETRIEVAL_DOCUMENT",
    ) -> List[List[float]]:
        if not texts:
            return []
        response = await self._with_retry(
            self._client.aio.models.embed_content,
            model=model or self.embedding_model,
            contents=texts,
            # Vertex uses different optimized representations for documents and
            # queries. Both sides of the index must use the same embedding model.
            config=self.types.EmbedContentConfig(task_type=purpose),
        )
        return [list(item.values) for item in (getattr(response, "embeddings", None) or [])]
