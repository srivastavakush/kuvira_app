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
unchanged sources/chunks.

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
    { "type": "filter", "path": "category" }
  ]
}
```

Then set `AI_COACH_VECTOR_INDEX=ai_coach_knowledge_vector` on the API and
worker and restart them. If the embedding model or dimensionality changes,
create a compatible index and re-ingest every source before switching traffic.
The retriever logs a warning and falls back safely if the index is absent or
still building.

## Evidence contract

The agent receives retrieved chunks with source IDs and URLs. The generation
schema requires citation IDs; invalid IDs are discarded server-side. Responses
include `citations` and `sources`. If no reliable source is retrieved, the
report marks `reliable_coaching_source_not_retrieved` as unavailable instead of
inventing a citation.
