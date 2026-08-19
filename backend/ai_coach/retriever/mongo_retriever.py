"""MongoDB + in-Python cosine similarity retriever with metadata filtering and
a light hybrid keyword score. Deliberately abstracted so the same interface can
later be served by Atlas Vector Search or pgvector.
"""
from __future__ import annotations
import math
import re
import logging
from typing import Any, Dict, List, Optional

from ..providers import get_default_provider
from .base import KnowledgeRetriever, KnowledgeItem, RetrievalResult

log = logging.getLogger("kuvira.retriever")


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


_WORD = re.compile(r"[a-zA-Z][a-zA-Z0-9\-]{2,}")


def _keyword_score(query: str, item: KnowledgeItem) -> float:
    q = set(w.lower() for w in _WORD.findall(query))
    if not q:
        return 0.0
    hay = " ".join([item.title, item.body, item.skill or "", item.tactic or "", item.situation or "", item.category or ""]).lower()
    hits = sum(1 for w in q if w in hay)
    return hits / len(q)


class MongoKnowledgeRetriever(KnowledgeRetriever):
    def __init__(self, db, collection: str = "ai_coach_knowledge", provider=None):
        self.db = db
        self.col = db[collection]
        self.provider = provider or get_default_provider()

    async def _ensure_indexes(self):
        try:
            await self.col.create_index("id", unique=True)
            await self.col.create_index("sport")
            await self.col.create_index("category")
            await self.col.create_index("authority_level")
        except Exception:
            log.exception("knowledge index creation failed")

    async def upsert(self, items: List[KnowledgeItem]) -> int:
        await self._ensure_indexes()
        if not items:
            return 0
        try:
            embeds = await self.provider.embed([f"{it.title}\n{it.body}" for it in items])
        except Exception as e:
            log.warning("embedding failed (%s); storing without vectors — retrieval will fall back to keywords", e)
            embeds = [[] for _ in items]
        count = 0
        for it, emb in zip(items, embeds):
            doc = it.model_dump()
            doc["embedding"] = emb
            await self.col.update_one({"id": it.id}, {"$set": doc}, upsert=True)
            count += 1
        return count

    async def retrieve(
        self,
        query: str,
        *,
        top_k: int = 6,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievalResult]:
        q: Dict[str, Any] = dict(filters or {})
        cursor = self.col.find(q, {"_id": 0})
        docs = await cursor.to_list(500)
        if not docs:
            return []

        try:
            qvec = (await self.provider.embed([query]))[0]
        except Exception as e:
            log.warning("query embedding failed (%s); keyword-only fallback", e)
            qvec = []

        scored: List[RetrievalResult] = []
        for d in docs:
            emb = d.pop("embedding", None) or []
            item = KnowledgeItem(**{k: v for k, v in d.items() if k in KnowledgeItem.model_fields})
            cos = _cosine(qvec, emb) if qvec and emb else 0.0
            kw = _keyword_score(query, item)
            # Hybrid blend with a mild authority bonus (tier 1 > 2 > 3).
            authority_bonus = 0.06 * (3 - min(3, max(1, item.authority_level)))
            score = 0.72 * cos + 0.22 * kw + authority_bonus
            scored.append(RetrievalResult(item=item, score=score, reason=f"cos={cos:.2f} kw={kw:.2f}"))

        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:top_k]


_default: Optional[MongoKnowledgeRetriever] = None


def get_default_retriever(db) -> MongoKnowledgeRetriever:
    global _default
    if _default is None:
        _default = MongoKnowledgeRetriever(db)
    return _default
