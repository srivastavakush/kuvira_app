# AI Coach RAG operations

The coach stores source records in `ai_coach_knowledge_sources` and active,
retrievable chunks in `ai_coach_knowledge`.

- A source record contains the cleaned original coaching note, canonical URL,
  authority level, source update date, verification date and content hash.
- A chunk contains the original chunk text, metadata, a document embedding and
  a stable `source_id + chunk_index` identity.
- Refresh is idempotent: unchanged chunks retain their embedding; changed
  chunks are re-embedded; chunks no longer present in a source are marked
  inactive rather than deleted. Older unversioned seed records are also marked
  inactive so they cannot be presented as sourced evidence.

## Refreshing the corpus

An authenticated platform admin can call:

```text
POST /api/ai-coach/knowledge/refresh
Authorization: Bearer <admin token>
```

The current curated registry is in `ai_coach/knowledge_seed.py`. Add a new
`SourceDocument` when adding a source. Keep an external URL canonical, keep
each note short and original, and identify official rules separately from
internally authored coaching guidance. Internal guidance intentionally has no
external URL; it must never be presented as an externally verified source.
Do not paste full third-party articles or rule books into the database.

Run this refresh when an official rule book changes and on a regular review
cadence (for example, monthly). The response reports inserted, changed and
unchanged sources/chunks, plus `embeddings_ready` and `embeddings_pending`.
If pending is nonzero, check provider configuration/availability and repeat
the refresh. Pending chunks remain available to lexical retrieval.

Refresh re-indexes the curated notes; it does **not** fetch web pages or
re-verify them. `last_verified_at` is an explicit editorial review date and
`last_ingested_at` is the database refresh time. Unknown review dates stay
empty. To add web knowledge, review the primary source, write a focused
original summary with its URL and metadata in `knowledge_seed.py`, record
the review date, and run refresh. Do not infer a publication date from the
date a note was reviewed. Seven additional notes were reviewed on 2026-09-12,
bringing the registry to 19 notes across five sports.

Embedding reuse requires the same provider, model, and normalized title/body input
hash. Model changes and changed titles/text trigger re-embedding. Failed or
invalid replacements clear the old vector and mark the chunk pending; the
next refresh retries it. Existing records without this embedding provenance
will be re-embedded once after deployment.

## Atlas Vector Search (recommended for production)

Without a vector index, the service uses a bounded hybrid cosine/keyword scan.
It is correct for a small corpus but should not be the production path once the
library grows. In Atlas Search & Vector Search, create a **Vector Search**
index named `ai_coach_knowledge_vector` on the database collection
`ai_coach_knowledge` with this definition for `text-embedding-005`:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "active" },
    { "type": "filter", "path": "sport" },
    { "type": "filter", "path": "category" },
    { "type": "filter", "path": "embedding_model" },
    { "type": "filter", "path": "embedding_provider" }
  ]
}
```

Then set `AI_COACH_VECTOR_INDEX=ai_coach_knowledge_vector` on the API and
worker and restart them. If the embedding model or dimensionality changes,
create a compatible index and re-ingest every source before switching traffic.
The retriever logs a warning and falls back safely if the index is absent or
still building. Update existing indexes with the two embedding provenance
filter fields above before rollout. Use dimensions matching the configured
provider's actual vectors; the example is specific to the Vertex model.

Atlas results are combined with a bounded scan of up to 500 records. This keeps
pending, lexical-only chunks eligible, but keyword coverage is incomplete
for larger collections. Add an indexed lexical candidate path before growing
the corpus beyond this bound. Atlas scores are converted back to cosine
before reranking so they match the fallback scoring scale. All caller filters
are applied; an empty sport corpus never falls back to another sport.
Authority and skill-level bonuses cannot qualify otherwise unrelated evidence.

## Evidence contract

The agent receives retrieved chunks with source IDs and URLs. The generation
schema requires citation IDs; invalid IDs are discarded server-side. Responses
include `citations` and `sources`. If no reliable source is retrieved, the
report marks `reliable_coaching_source_not_retrieved` as unavailable instead of
inventing a citation.

## Validation and rollout

From the repository root, run:

```sh
python -m unittest backend.ai_coach.retriever.test_rag_pipeline -v
```

Tests use deterministic providers and in-memory collections. They cover
embedding reuse, failure/retry, model changes, invalid vectors, chunk bounds,
source dates, sport isolation, no-evidence retrieval, Atlas score parity and
representative questions. They do not establish live model quality or Atlas
latency. After deployment, an admin must run the refresh with the application's
MongoDB connection and configured AI provider, check that pending is zero,
and evaluate real coach responses and citations before production acceptance.
