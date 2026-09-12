from __future__ import annotations

import time
import unittest
from dataclasses import replace
from unittest.mock import AsyncMock

from .ingestion import SourceDocument, chunk_text, clean_text, deduplicate_documents, document_to_items
from .mongo_retriever import MongoKnowledgeRetriever
from ..knowledge_seed import seed_documents


class _Cursor:
    def __init__(self, rows): self.rows = rows
    async def to_list(self, _limit): return list(self.rows)[:_limit]


class _Collection:
    def __init__(self, rows): self.rows = rows
    def find(self, query, _projection=None):
        return _Cursor([row.copy() for row in self.rows if all(row.get(key) == value for key, value in query.items())])
    def aggregate(self, _pipeline): return _Cursor([])


class _Db:
    def __init__(self, rows): self.collection = _Collection(rows)
    def __getitem__(self, _name): return self.collection


class _UnavailableEmbeddingProvider:
    async def embed(self, _texts, **_kwargs):
        raise RuntimeError("offline test uses lexical fallback")


class _EmbeddingProvider:
    name = "test"
    embedding_model = "model-a"

    def __init__(self):
        self.embed = AsyncMock(return_value=[[1.0, 0.0]])


class _WritableCollection(_Collection):
    async def create_index(self, *args, **kwargs): pass

    @staticmethod
    def matches(row, query):
        for key, value in query.items():
            if isinstance(value, dict):
                for op, operand in value.items():
                    if op == "$in" and row.get(key) not in operand: return False
                    if op == "$ne" and row.get(key) == operand: return False
                    if op == "$gte" and row.get(key, -1) < operand: return False
                    if op == "$exists" and (key in row) != operand: return False
            elif row.get(key) != value: return False
        return True

    def find(self, query, _projection=None):
        return _Cursor([row.copy() for row in self.rows if self.matches(row, query)])

    async def find_one(self, query, _projection=None):
        return next((row.copy() for row in self.rows if self.matches(row, query)), None)

    async def count_documents(self, query):
        return sum(self.matches(row, query) for row in self.rows)

    async def update_many(self, query, update):
        for row in self.rows:
            if self.matches(row, query): row.update(update["$set"])

    async def update_one(self, query, update, **kwargs):
        row = next((r for r in self.rows if self.matches(r, query)), None)
        if row is None:
            row = dict(update.get("$setOnInsert", {}))
            self.rows.append(row)
        row.update(update["$set"])


class _WritableDb(_Db):
    def __init__(self):
        self.collection = _WritableCollection([])
        self.sources = _WritableCollection([])

    def __getitem__(self, name):
        return self.sources if name.endswith("_sources") else self.collection


class RagPipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_source_refresh_stats_and_stale_chunks(self):
        db, provider = _WritableDb(), _EmbeddingProvider()
        provider.embed.side_effect = lambda texts, **kwargs: [[1.0, 0.0] for _ in texts]
        retriever = MongoKnowledgeRetriever(db, provider=provider)
        source = SourceDocument(title="Note", text="word " * 400, source_url=None, source_name="Internal")
        first = await retriever.ingest_documents([source, source])
        self.assertEqual(first["sources"], 1)
        self.assertGreater(first["embeddings_ready"], 1)
        second = await retriever.ingest_documents([source])
        self.assertEqual(second["unchanged"], 1)
        self.assertEqual(provider.embed.await_count, 1)
        provider.embed.side_effect = RuntimeError("offline")
        third = await retriever.ingest_documents([replace(source, text="Shorter changed note.")])
        self.assertEqual(third["changed"], 1)
        self.assertEqual(third["embeddings_pending"], 1)
        self.assertEqual(third["embeddings_ready"], 0)
        self.assertEqual(sum(row["active"] for row in db.collection.rows), 1)
        self.assertIsNone(db.sources.rows[0]["last_verified_at"])
        self.assertTrue(db.sources.rows[0]["last_ingested_at"])

    def test_chunk_bounds_and_zero_overlap(self):
        text = " ".join(["First sentence.", "A much longer sentence fills the next chunk completely."] * 10)
        for overlap in (0, 3, 9):
            chunks = chunk_text(text, target_words=10, overlap_words=overlap)
            self.assertTrue(all(len(chunk.split()) <= 10 for chunk in chunks))
        self.assertEqual(chunk_text("one two. three four.", target_words=2, overlap_words=0),
                         ["one two.", "three four."])
        with self.assertRaises(ValueError):
            chunk_text("test", target_words=10, overlap_words=10)

    def test_refresh_does_not_invent_verification_date(self):
        source = SourceDocument(title="Test", text="Test note.", source_url=None, source_name="Internal")
        self.assertIsNone(document_to_items(source)[0].last_verified_at)
        reviewed = replace(source, last_verified_at="2026-09-12")
        self.assertEqual(document_to_items(reviewed)[0].last_verified_at, "2026-09-12")

    async def test_embedding_refresh_reuses_retries_and_migrates(self):
        db, provider = _WritableDb(), _EmbeddingProvider()
        retriever = MongoKnowledgeRetriever(db, provider=provider)
        source = SourceDocument(title="Test", text="A legal kitchen volley.", source_url=None, source_name="Test")
        items = document_to_items(source)
        await retriever.upsert(items)
        await retriever.upsert(items)
        self.assertEqual(provider.embed.await_count, 1)
        self.assertEqual(len(db.collection.rows), 1)
        provider.embed.side_effect = RuntimeError("temporary outage")
        changed = document_to_items(replace(source, text="A changed kitchen rule."))
        await retriever.upsert(changed)
        self.assertEqual(db.collection.rows[0]["embedding"], [])
        self.assertEqual(db.collection.rows[0]["embedding_status"], "pending")
        provider.embed.side_effect = None
        await retriever.upsert(changed)
        self.assertEqual(db.collection.rows[0]["embedding_status"], "ready")
        retriever.embedding_model = "model-b"
        await retriever.upsert(changed)
        self.assertEqual(provider.embed.await_count, 4)
        self.assertEqual(db.collection.rows[0]["embedding_model"], "model-b")
        # Titles are part of embedding input, including for direct-item callers.
        await retriever.upsert([changed[0].model_copy(update={"title": "New title"})])
        self.assertEqual(provider.embed.await_count, 5)

    async def test_invalid_embedding_responses_remain_pending(self):
        for vectors in ([], [[]], [[float("nan"), 1]], [[0.0, 0.0]]):
            db, provider = _WritableDb(), _EmbeddingProvider()
            provider.embed.return_value = vectors
            retriever = MongoKnowledgeRetriever(db, provider=provider)
            source = SourceDocument(title="Test", text="Test note.", source_url=None, source_name="Test")
            await retriever.upsert(document_to_items(source))
            self.assertEqual(db.collection.rows[0]["embedding_status"], "pending")

    async def test_no_evidence_does_not_return_unrelated_authority_or_other_sport(self):
        rows = [item.model_dump() for source in seed_documents() for item in document_to_items(source)]
        retriever = MongoKnowledgeRetriever(_Db(rows), provider=_UnavailableEmbeddingProvider())
        self.assertEqual(await retriever.retrieve("quantum entanglement", filters={"sport": "pickleball"}), [])
        self.assertEqual(await retriever.retrieve("volley kitchen", filters={"sport": "hockey"}), [])
        self.assertEqual(await retriever.retrieve("volley", top_k=0), [])
        self.assertEqual(await retriever.retrieve("   "), [])

    async def test_model_mismatch_cannot_supply_semantic_evidence(self):
        source = SourceDocument(title="Unrelated", text="Unrelated material.", source_url=None,
                                source_name="Test", authority_level=1)
        row = document_to_items(source)[0].model_dump()
        row.update(embedding=[1.0, 0.0], embedding_provider="test", embedding_model="old-model")
        retriever = MongoKnowledgeRetriever(_Db([row]), provider=_EmbeddingProvider())
        self.assertEqual(await retriever.retrieve("kitchen volley"), [])

    async def test_atlas_cosine_scale_and_lexical_union(self):
        provider = _EmbeddingProvider()
        source = SourceDocument(title="Kitchen", text="Kitchen volley rule.", source_url=None, source_name="Test")
        row = document_to_items(source)[0].model_dump()
        row.update(embedding=[0.6, 0.8], embedding_provider="test", embedding_model="model-a")
        retriever = MongoKnowledgeRetriever(_Db([row]), provider=provider)
        local = await retriever.retrieve("kitchen volley")
        atlas = {**row, "vector_score": 0.8}
        atlas.pop("embedding")
        retriever._atlas_vector_candidates = AsyncMock(return_value=[atlas])
        remote = await retriever.retrieve("kitchen volley")
        self.assertAlmostEqual(local[0].score, remote[0].score)
        pending = document_to_items(replace(source, title="Pending", text="Kitchen volley practice."))[0].model_dump()
        retriever.col.rows.append(pending)
        results = await retriever.retrieve("kitchen volley practice")
        self.assertTrue(any(r.item.id == pending["id"] for r in results))

    async def test_reviewed_web_notes_answer_specific_questions(self):
        rows = [item.model_dump() for source in seed_documents() for item in document_to_items(source)]
        retriever = MongoKnowledgeRetriever(_Db(rows), provider=_UnavailableEmbeddingProvider())
        cases = [
            ("pickleball", "Explain the two-bounce rule", "Pickleball: two-bounce rule"),
            ("football", "Offside directly from a throw-in", "Football: offside position and active involvement"),
            ("cricket", "What are the no-ball consequences", "Cricket: no-ball consequences"),
            ("tennis", "Intermediate volley depth control", "Tennis: intermediate volley depth control"),
        ]
        for sport, query, title in cases:
            results = await retriever.retrieve(query, filters={"sport": sport})
            self.assertEqual(results[0].item.title, title)
            self.assertEqual(results[0].citation["verified_at"], "2026-09-12")

    def test_clean_chunk_and_deduplicate_are_stable(self):
        text = "  Scan  before passing.\n\nScan before passing.\n\n" + "One controlled sentence. " * 120
        cleaned = clean_text(text)
        self.assertEqual(cleaned.split("\n\n")[0], "Scan before passing.")
        source = SourceDocument(title="Test", text=cleaned, source_url="https://example.com/page?utm_source=x", source_name="Test")
        items = document_to_items(source)
        self.assertGreater(len(items), 1)
        self.assertTrue(all(item.source_url == "https://example.com/page" for item in items))
        self.assertEqual(len(deduplicate_documents([source, source])), 1)

    async def test_representative_questions_retrieve_authoritative_sources_quickly(self):
        rows = [item.model_dump() for source in seed_documents() for item in document_to_items(source)]
        retriever = MongoKnowledgeRetriever(_Db(rows), provider=_UnavailableEmbeddingProvider())
        cases = [
            ("pickleball", "Can I volley while standing in the kitchen?", "USA Pickleball"),
            ("football", "How can I scan before a pass under pressure?", "The FA Boot Room"),
            ("tennis", "I swing too much at my volleys. What should I practise?", "USTA"),
            ("cricket", "Give me a safe beginner batting and catching drill.", "International Cricket Council"),
        ]
        for sport, question, source_name in cases:
            started = time.perf_counter()
            results = await retriever.retrieve(question, top_k=3, filters={"sport": sport}, context={"skill_level": "Beginner"})
            elapsed = time.perf_counter() - started
            self.assertLess(elapsed, 0.15)
            self.assertTrue(results)
            self.assertEqual(results[0].item.source_name, source_name)
            self.assertTrue(results[0].citation["source_url"])
