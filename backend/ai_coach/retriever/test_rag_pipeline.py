from __future__ import annotations

import time
import unittest

from .ingestion import SourceDocument, clean_text, deduplicate_documents, document_to_items
from .mongo_retriever import MongoKnowledgeRetriever
from ..knowledge_seed import seed_documents


class _Cursor:
    def __init__(self, rows): self.rows = rows
    async def to_list(self, _limit): return list(self.rows)


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


class RagPipelineTests(unittest.IsolatedAsyncioTestCase):
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
