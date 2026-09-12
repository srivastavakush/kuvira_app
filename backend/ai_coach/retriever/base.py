from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class KnowledgeItem(BaseModel):
    id: str
    title: str
    body: str
    sport: str = "pickleball"
    category: Optional[str] = None       # technical | tactical | movement | rules | drill | ...
    skill: Optional[str] = None
    skill_level: Optional[str] = None
    situation: Optional[str] = None
    tactic: Optional[str] = None
    source_type: Optional[str] = None    # rulebook | research | coaching | kuvira
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    source_id: Optional[str] = None
    source_updated_at: Optional[str] = None
    last_verified_at: Optional[str] = None
    topic: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    chunk_index: int = 0
    chunk_count: int = 1
    content_hash: Optional[str] = None
    source_hash: Optional[str] = None
    embedding_model: Optional[str] = None
    active: bool = True
    authority_level: int = 2             # 1 (rules/research) is highest
    evidence_type: Optional[str] = None
    confidence: float = 0.8
    version: str = "1"


class RetrievalResult(BaseModel):
    item: KnowledgeItem
    score: float
    reason: Optional[str] = None
    citation: Optional[Dict[str, str]] = None


class KnowledgeRetriever(ABC):
    @abstractmethod
    async def upsert(self, items: List[KnowledgeItem]) -> int: ...

    @abstractmethod
    async def retrieve(
        self,
        query: str,
        *,
        top_k: int = 6,
        filters: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievalResult]: ...
