"""Versioned source ingestion for the AI Coach retrieval corpus.

The app deliberately stores short, attributed coaching notes rather than
copying entire third-party rule books or articles.  Each source record keeps
the cleaned original note and each chunk is independently embedded and
retrievable.  Re-ingesting the same canonical source is idempotent; changed
sources replace their chunks and deactivate stale ones.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from hashlib import sha256
import html
import re
import unicodedata
from typing import Iterable, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .base import KnowledgeItem


_SPACE = re.compile(r"\s+")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")
_TRACKING_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "source"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonicalize_url(url: str) -> str:
    """Remove fragments and analytics parameters while retaining meaningful query keys."""
    parts = urlsplit(url.strip())
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                       if k.lower() not in _TRACKING_KEYS and not k.lower().startswith("utm_")])
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, query, ""))


def clean_text(text: str) -> str:
    """Normalize pasted/source text without changing its coaching meaning."""
    text = unicodedata.normalize("NFKC", html.unescape(text or ""))
    text = re.sub(r"[\u200b-\u200d\ufeff]", "", text)
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
    lines: list[str] = []
    seen: set[str] = set()
    for raw in text.splitlines():
        line = _SPACE.sub(" ", raw).strip(" -•\t")
        key = line.casefold()
        if line and key not in seen:
            lines.append(line)
            seen.add(key)
    return "\n\n".join(lines)


def _words(text: str) -> list[str]:
    return text.split()


def chunk_text(text: str, *, target_words: int = 180, overlap_words: int = 32) -> list[str]:
    """Create paragraph/sentence-respecting chunks with a small context overlap."""
    if target_words <= 0 or not 0 <= overlap_words < target_words:
        raise ValueError("Require target_words > 0 and 0 <= overlap_words < target_words")
    text = clean_text(text)
    if not text:
        return []
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    units: list[str] = []
    for paragraph in paragraphs:
        sentences = [s.strip() for s in _SENTENCE.split(paragraph) if s.strip()]
        units.extend(sentences or [paragraph])

    chunks: list[str] = []
    current: list[str] = []
    current_words = 0
    for unit in units:
        unit_words = len(_words(unit))
        if current and current_words + unit_words > target_words:
            chunks.append(" ".join(current).strip())
            overlap = _words(chunks[-1])[-overlap_words:] if overlap_words else []
            overlap = overlap[-max(0, target_words - unit_words):] if unit_words < target_words else []
            current = [" ".join(overlap)] if overlap else []
            current_words = len(overlap)
        # A very long sentence is still safely split into bounded chunks.
        if unit_words > target_words:
            words = _words(unit)
            for start in range(0, len(words), max(1, target_words - overlap_words)):
                piece = " ".join(words[start:start + target_words])
                if piece:
                    if current:
                        chunks.append(" ".join(current).strip())
                        current, current_words = [], 0
                    chunks.append(piece)
            continue
        current.append(unit)
        current_words += unit_words
    if current:
        chunks.append(" ".join(current).strip())
    return list(dict.fromkeys(c for c in chunks if c))


def content_hash(text: str) -> str:
    return sha256(clean_text(text).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class SourceDocument:
    title: str
    text: str
    source_url: Optional[str]
    source_name: str
    sport: str = "pickleball"
    topic: str = "general coaching"
    category: str = "coaching"
    source_type: str = "coaching"
    authority_level: int = 2
    confidence: float = 0.8
    source_updated_at: Optional[str] = None
    last_verified_at: Optional[str] = None
    skill: Optional[str] = None
    skill_level: Optional[str] = None
    situation: Optional[str] = None
    tactic: Optional[str] = None
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def canonical_url(self) -> str:
        return canonicalize_url(self.source_url) if self.source_url else ""

    @property
    def source_id(self) -> str:
        # One official page can support several independently maintained
        # coaching notes. Include stable topic/title identity so refreshes do
        # not collapse them into one record merely because their URL matches.
        identity = f"{self.canonical_url}\n{self.title.strip().casefold()}\n{self.topic.strip().casefold()}"
        return "src-" + sha256(identity.encode("utf-8")).hexdigest()[:24]


def document_to_items(document: SourceDocument, *, verified_at: Optional[str] = None) -> list[KnowledgeItem]:
    cleaned = clean_text(document.text)
    chunks = chunk_text(cleaned)
    verified_at = verified_at or document.last_verified_at
    source_hash = content_hash(cleaned)
    count = len(chunks)
    items: list[KnowledgeItem] = []
    for index, chunk in enumerate(chunks):
        chunk_hash = content_hash(chunk)
        items.append(KnowledgeItem(
            id=f"{document.source_id}-c{index:03d}",
            title=document.title if count == 1 else f"{document.title} ({index + 1}/{count})",
            body=chunk,
            sport=document.sport.lower(), category=document.category, topic=document.topic,
            skill=document.skill, skill_level=document.skill_level, situation=document.situation,
            tactic=document.tactic, tags=list(document.tags), source_type=document.source_type,
            source_name=document.source_name, source_url=document.canonical_url,
            source_id=document.source_id, source_updated_at=document.source_updated_at,
            last_verified_at=verified_at, authority_level=document.authority_level,
            confidence=document.confidence, chunk_index=index, chunk_count=count,
            content_hash=chunk_hash, source_hash=source_hash, active=True,
        ))
    return items


def deduplicate_documents(documents: Iterable[SourceDocument]) -> list[SourceDocument]:
    """Last document wins per canonical URL; identical documents are retained once."""
    result: dict[str, SourceDocument] = {}
    for document in documents:
        if clean_text(document.text):
            key = f"{document.canonical_url}\n{document.title.strip().casefold()}\n{document.topic.strip().casefold()}"
            result[key] = document
    return list(result.values())
