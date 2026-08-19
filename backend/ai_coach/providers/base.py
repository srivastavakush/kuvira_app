"""AIProvider interface — swap OpenAI for another vendor without touching the graph."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, TypedDict


class ChatTurn(TypedDict):
    role: str            # "system" | "user" | "assistant"
    content: str


class AIProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    async def generate_coaching_response(
        self,
        system: str,
        messages: List[ChatTurn],
        model: Optional[str] = None,
        max_output_tokens: int = 900,
    ) -> str: ...

    @abstractmethod
    async def generate_structured_analysis(
        self,
        system: str,
        user: str,
        schema: Dict[str, Any],
        model: Optional[str] = None,
    ) -> Dict[str, Any]: ...

    @abstractmethod
    async def embed(self, texts: List[str], model: Optional[str] = None) -> List[List[float]]: ...
