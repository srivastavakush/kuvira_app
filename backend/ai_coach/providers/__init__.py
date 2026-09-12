from .base import AIProvider, ChatTurn
from .openai_provider import OpenAIProvider
from .vertex_provider import VertexAIProvider

_default: AIProvider | None = None


def get_default_provider() -> AIProvider:
    """Select a provider once per process from explicit runtime configuration."""
    global _default
    if _default is None:
        import os
        provider = os.environ.get("AI_PROVIDER", "openai").strip().lower()
        if provider == "vertex":
            _default = VertexAIProvider()
        elif provider == "openai":
            _default = OpenAIProvider()
        else:
            raise RuntimeError(f"Unsupported AI_PROVIDER: {provider}")
    return _default

__all__ = ["AIProvider", "ChatTurn", "OpenAIProvider", "VertexAIProvider", "get_default_provider"]
