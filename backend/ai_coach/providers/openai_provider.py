"""OpenAI implementation of AIProvider.

Uses the Responses API where available (with a Chat Completions fallback so the
system still functions on temporarily unavailable model IDs). Retries transient
errors with exponential backoff.
"""
from __future__ import annotations
import os
import json
import asyncio
import logging
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI, APIError, RateLimitError, APITimeoutError

from .base import AIProvider, ChatTurn

log = logging.getLogger("kuvira.ai")


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        primary_model: Optional[str] = None,
        secondary_model: Optional[str] = None,
        embedding_model: Optional[str] = None,
    ) -> None:
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.base_url = base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"
        self.primary_model = primary_model or os.environ.get("OPENAI_MODEL_PRIMARY", "gpt-5.6-terra")
        self.secondary_model = secondary_model or os.environ.get("OPENAI_MODEL_SECONDARY", "gpt-5.6-luna")
        self.embedding_model = embedding_model or os.environ.get("OPENAI_MODEL_EMBEDDING", "text-embedding-3-small")
        if not self.api_key:
            log.warning("OPENAI_API_KEY not set — provider will raise on first call.")
        self._client = AsyncOpenAI(api_key=self.api_key or "missing", base_url=self.base_url)

    # ------------------------------------------------------------------ helpers
    async def _with_retry(self, fn, *args, retries: int = 2, base_delay: float = 1.5, **kwargs):
        last: Exception | None = None
        for attempt in range(retries + 1):
            try:
                return await fn(*args, **kwargs)
            except (RateLimitError, APITimeoutError, APIError) as e:
                last = e
                if attempt == retries:
                    break
                await asyncio.sleep(base_delay * (2 ** attempt))
        raise last  # type: ignore[misc]

    async def _responses_or_chat(
        self,
        model: str,
        system: str,
        messages: List[ChatTurn],
        max_output_tokens: int,
        response_format: Optional[Dict[str, Any]] = None,
    ) -> str:
        # Prefer Responses API. Fall back to Chat Completions if the model does
        # not accept Responses (older or provider-restricted models).
        try:
            input_msgs = [{"role": "system", "content": system}] + [{"role": m["role"], "content": m["content"]} for m in messages]
            kwargs: Dict[str, Any] = {
                "model": model,
                "input": input_msgs,
                "max_output_tokens": max_output_tokens,
            }
            if response_format:
                kwargs["response_format"] = response_format
            resp = await self._client.responses.create(**kwargs)
            # SDK exposes .output_text convenience string
            text = getattr(resp, "output_text", None)
            if text:
                return text
            # Fallback: assemble from .output blocks
            try:
                blocks = resp.output or []
                out = []
                for b in blocks:
                    content = getattr(b, "content", None) or []
                    for c in content:
                        t = getattr(c, "text", None)
                        if t:
                            out.append(t if isinstance(t, str) else getattr(t, "value", ""))
                return "\n".join(x for x in out if x)
            except Exception:
                return ""
        except Exception as e:  # graceful fallback
            log.info("Responses API failed (%s); falling back to chat.completions", e)
            chat_msgs = [{"role": "system", "content": system}] + [dict(m) for m in messages]
            kwargs2: Dict[str, Any] = {
                "model": model,
                "messages": chat_msgs,
                "max_tokens": max_output_tokens,
            }
            if response_format:
                kwargs2["response_format"] = response_format
            resp = await self._client.chat.completions.create(**kwargs2)
            return resp.choices[0].message.content or ""

    # -------------------------------------------------------------- public API
    async def generate_coaching_response(
        self,
        system: str,
        messages: List[ChatTurn],
        model: Optional[str] = None,
        max_output_tokens: int = 900,
    ) -> str:
        m = model or self.primary_model
        return await self._with_retry(self._responses_or_chat, m, system, messages, max_output_tokens)

    async def generate_structured_analysis(
        self,
        system: str,
        user: str,
        schema: Dict[str, Any],
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        m = model or self.secondary_model
        rf = {
            "type": "json_schema",
            "json_schema": {"name": schema.get("title", "payload"), "schema": schema, "strict": False},
        }
        text = await self._with_retry(
            self._responses_or_chat, m, system, [{"role": "user", "content": user}], 1200, rf,
        )
        try:
            return json.loads(text) if text else {}
        except Exception:
            # last-resort: attempt to locate a json object in the string
            start, end = text.find("{"), text.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(text[start:end + 1])
                except Exception:
                    pass
            return {"_raw": text}

    async def embed(self, texts: List[str], model: Optional[str] = None) -> List[List[float]]:
        m = model or self.embedding_model
        resp = await self._with_retry(
            self._client.embeddings.create, model=m, input=texts,
        )
        return [d.embedding for d in resp.data]


_default: Optional[OpenAIProvider] = None


def get_default_provider() -> OpenAIProvider:
    global _default
    if _default is None:
        _default = OpenAIProvider()
    return _default
