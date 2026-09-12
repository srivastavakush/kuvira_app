"""MongoDB/Atlas Vector Search backed retrieval for the AI Coach.

Atlas Vector Search is used when `AI_COACH_VECTOR_INDEX` is configured. The
same metadata-aware hybrid ranking falls back to a bounded Mongo scan locally.
"""
from __future__ import annotations

import logging
import math
import os
import re
from typing import Any, Dict, Iterable, List, Optional

from ..providers import get_default_provider
from .base import KnowledgeRetriever, KnowledgeItem, RetrievalResult
from .ingestion import SourceDocument, clean_text, deduplicate_documents, document_to_items, now_iso

log = logging.getLogger("kuvira.retriever")
_WORD = re.compile(r"[a-zA-Z][a-zA-Z0-9\-]{2,}")


def _cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def _tokens(value: str) -> set[str]:
    return {word.lower() for word in _WORD.findall(value or "")}


def _keyword_score(query: str, item: KnowledgeItem) -> float:
    terms = _tokens(query)
    if not terms:
        return 0.0
    haystack = _tokens(" ".join([
        item.title, item.body, item.topic or "", item.skill or "", item.tactic or "",
        item.situation or "", item.category or "", " ".join(item.tags),
    ]))
    return len(terms & haystack) / len(terms)


def _context_score(item: KnowledgeItem, context: Dict[str, Any]) -> float:
    bonus = 0.0
    level = str(context.get("skill_level") or "").strip().lower()
    if level and item.skill_level:
        if level == item.skill_level.lower():
            bonus += 0.08
        elif item.skill_level.lower() in {"all", "all-levels"}:
            bonus += 0.03
    requested = _tokens(" ".join(str(context.get(k) or "") for k in ("topic", "skill", "situation", "intent")))
    item_tags = _tokens(" ".join([item.topic or "", item.skill or "", item.situation or "", item.category or "", " ".join(item.tags)]))
    if requested and item_tags:
        bonus += min(0.10, 0.035 * len(requested & item_tags))
    return bonus


def _citation(item: KnowledgeItem) -> Dict[str, str]:
    return {
        "id": item.id,
        "title": item.title,
        "source_name": item.source_name or "Kuchu Puchu coaching library",
        "source_url": item.source_url or "",
        "updated_at": item.source_updated_at or item.last_verified_at or "",
    }


class MongoKnowledgeRetriever(KnowledgeRetriever):
    def __init__(self, db, collection: str = "ai_coach_knowledge", provider=None):
        self.db = db
        self.col = db[collection]
        self.sources = db[f"{collection}_sources"]
        self.provider = provider or get_default_provider()
        self.vector_index = os.environ.get("AI_COACH_VECTOR_INDEX", "").strip()
        self.embedding_model = os.environ.get("VERTEX_AI_EMBEDDING_MODEL") or os.environ.get("OPENAI_MODEL_EMBEDDING")
        self.batch_size = max(1, int(os.environ.get("AI_COACH_EMBED_BATCH_SIZE", "32")))

    async def _ensure_indexes(self) -> None:
        await self.col.create_index("id", unique=True)
        await self.col.create_index([("source_id", 1), ("chunk_index", 1)], unique=True, sparse=True)
        await self.col.create_index([("active", 1), ("sport", 1), ("category", 1)])
        await self.col.create_index("content_hash")
        await self.sources.create_index("source_id", unique=True)
        await self.sources.create_index("source_url")

    async def _embed(self, texts: List[str], purpose: str) -> List[List[float]]:
        vectors: List[List[float]] = []
        for start in range(0, len(texts), self.batch_size):
            vectors.extend(await self.provider.embed(texts[start:start + self.batch_size], purpose=purpose))
        if len(vectors) != len(texts):
            raise RuntimeError(f"Embedding count mismatch: expected {len(texts)}, got {len(vectors)}")
        return vectors

    async def _upsert_items(self, items: List[KnowledgeItem]) -> int:
        if not items:
            return 0
        existing = await self.col.find(
            {"id": {"$in": [item.id for item in items]}}, {"_id": 0, "id": 1, "content_hash": 1, "embedding": 1}
        ).to_list(len(items))
        previous = {doc["id"]: doc for doc in existing}
        to_embed = [item for item in items if not (previous.get(item.id, {}).get("content_hash") == item.content_hash and previous.get(item.id, {}).get("embedding"))]
        vectors: Dict[str, List[float]] = {}
        if to_embed:
            try:
                embedded = await self._embed([f"{item.title}\n{item.body}" for item in to_embed], "RETRIEVAL_DOCUMENT")
                vectors = {item.id: vector for item, vector in zip(to_embed, embedded)}
            except Exception as exc:
                # Preserve lexical retrieval if a remote embedding call is transient.
                log.warning("knowledge embeddings failed; using lexical fallback: %s", exc)
        for item in items:
            doc = item.model_dump()
            doc["embedding"] = vectors.get(item.id, previous.get(item.id, {}).get("embedding", []))
            doc["embedding_model"] = self.embedding_model or getattr(self.provider, "embedding_model", None)
            await self.col.update_one({"id": item.id}, {"$set": doc, "$setOnInsert": {"created_at": now_iso()}}, upsert=True)
        return len(items)

    async def upsert(self, items: List[KnowledgeItem]) -> int:
        """Compatibility entry point for direct item ingestion."""
        await self._ensure_indexes()
        return await self._upsert_items(items)

    async def ingest_documents(self, documents: Iterable[SourceDocument]) -> Dict[str, int]:
        """Clean, chunk, embed and upsert source documents without duplicates."""
        await self._ensure_indexes()
        documents = deduplicate_documents(documents)
        verified_at = now_iso()
        # Earlier releases stored unversioned snippets without source URLs.
        # Keep them for audit, but prevent them from being presented as current
        # evidence once the attributed corpus is refreshed.
        await self.col.update_many(
            {"$or": [{"source_id": {"$exists": False}}, {"source_url": {"$in": [None, ""]}}]},
            {"$set": {"active": False, "superseded_at": verified_at, "superseded_reason": "unversioned_source"}},
        )
        inserted = changed = unchanged = chunks = 0
        for document in documents:
            cleaned = clean_text(document.text)
            items = document_to_items(document, verified_at=verified_at)
            if not items:
                continue
            source_id, source_hash = document.source_id, items[0].source_hash
            prior = await self.sources.find_one({"source_id": source_id}, {"_id": 0, "source_hash": 1})
            state = "unchanged" if prior and prior.get("source_hash") == source_hash else ("changed" if prior else "inserted")
            # A source may be reclassified (for example from a provisional URL
            # to an internal playbook). Retire the older logical record instead
            # of leaving both versions eligible for retrieval.
            logical_match = {"title": document.title, "sport": document.sport.lower(), "topic": document.topic, "source_id": {"$ne": source_id}}
            await self.sources.update_many(logical_match, {"$set": {"active": False, "superseded_at": verified_at}})
            await self.col.update_many(logical_match, {"$set": {"active": False, "superseded_at": verified_at, "superseded_reason": "source_identity_changed"}})
            source_record = {
                "source_id": source_id, "source_url": document.canonical_url, "title": document.title,
                "source_name": document.source_name, "sport": document.sport.lower(), "topic": document.topic,
                "source_type": document.source_type, "authority_level": document.authority_level,
                "source_updated_at": document.source_updated_at, "last_verified_at": verified_at,
                "original_text": cleaned, "source_hash": source_hash, "active": True,
            }
            await self.sources.update_one({"source_id": source_id}, {"$set": source_record, "$setOnInsert": {"created_at": verified_at}}, upsert=True)
            await self._upsert_items(items)
            await self.col.update_many(
                {"source_id": source_id, "chunk_index": {"$gte": len(items)}},
                {"$set": {"active": False, "superseded_at": verified_at}},
            )
            chunks += len(items)
            if state == "inserted": inserted += 1
            elif state == "changed": changed += 1
            else: unchanged += 1
        return {"sources": len(documents), "inserted": inserted, "changed": changed, "unchanged": unchanged, "chunks": chunks}

    async def _atlas_vector_candidates(self, qvec: List[float], filters: Dict[str, Any], limit: int) -> List[Dict[str, Any]]:
        if not self.vector_index or not qvec:
            return []
        vector_filter = {key: value for key, value in filters.items() if key in {"sport", "active", "category"}}
        try:
            pipeline = [{"$vectorSearch": {
                "index": self.vector_index, "path": "embedding", "queryVector": qvec,
                "numCandidates": max(100, limit * 20), "limit": limit, "filter": vector_filter,
            }}, {"$project": {"_id": 0, "embedding": 0, "vector_score": {"$meta": "vectorSearchScore"}}}]
            return await self.col.aggregate(pipeline).to_list(limit)
        except Exception as exc:
            # A not-yet-built index cannot make coaching unavailable.
            log.warning("Atlas Vector Search unavailable; using bounded hybrid fallback: %s", exc)
            return []

    async def retrieve(
        self,
        query: str,
        *,
        top_k: int = 6,
        filters: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievalResult]:
        filters = {**(filters or {}), "active": True}
        context = context or {}
        try:
            qvec = (await self._embed([query], "RETRIEVAL_QUERY"))[0]
        except Exception as exc:
            log.warning("query embedding failed; keyword-only retrieval: %s", exc)
            qvec = []
        candidate_limit = max(top_k * 8, 32)
        docs = await self._atlas_vector_candidates(qvec, filters, candidate_limit)
        if not docs:
            docs = await self.col.find(filters, {"_id": 0}).to_list(max(500, candidate_limit))
        if not docs and filters.get("sport"):
            fallback = {key: value for key, value in filters.items() if key != "sport"}
            docs = await self.col.find(fallback, {"_id": 0}).to_list(max(500, candidate_limit))
        scored: List[RetrievalResult] = []
        for doc in docs:
            vector_score = float(doc.pop("vector_score", 0.0) or 0.0)
            embedding = doc.pop("embedding", []) or []
            try:
                item = KnowledgeItem(**{key: value for key, value in doc.items() if key in KnowledgeItem.model_fields})
            except Exception:
                log.warning("skipping malformed knowledge record %s", doc.get("id"))
                continue
            cosine = vector_score or (_cosine(qvec, embedding) if qvec and embedding else 0.0)
            keyword = _keyword_score(query, item)
            authority = 0.045 * (3 - min(3, max(1, item.authority_level)))
            score = 0.67 * cosine + 0.21 * keyword + authority + _context_score(item, context)
            if score < 0.08:
                continue
            scored.append(RetrievalResult(
                item=item, score=score,
                reason=f"semantic={cosine:.3f}; lexical={keyword:.3f}; authority={item.authority_level}",
                citation=_citation(item),
            ))
        scored.sort(key=lambda result: result.score, reverse=True)
        selected: List[RetrievalResult] = []
        seen_pairs: set[tuple[str, str]] = set()
        for result in scored:
            pair = (result.item.source_id or result.item.id, result.item.topic or result.item.category or "general")
            if pair in seen_pairs and len(selected) >= 2:
                continue
            selected.append(result)
            seen_pairs.add(pair)
            if len(selected) == top_k:
                break
        return selected


_default: Optional[MongoKnowledgeRetriever] = None


def get_default_retriever(db) -> MongoKnowledgeRetriever:
    global _default
    if _default is None or _default.db is not db:
        _default = MongoKnowledgeRetriever(db)
    return _default
