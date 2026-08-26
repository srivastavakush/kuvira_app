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
    authority_level: int = 2             # 1 (rules/research) is highest
    evidence_type: Optional[str] = None
    confidence: float = 0.8
    version: str = "1"


class RetrievalResult(BaseModel):
    item: KnowledgeItem
    score: float
    reason: Optional[str] = None


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
    ) -> List[RetrievalResult]: ...
