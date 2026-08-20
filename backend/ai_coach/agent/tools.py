"""Typed tool registry for the coaching agent.

Tools are deliberately small and side-effect aware. The registry gives the
planner a stable interface while implementations can change independently.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional


ToolFn = Callable[..., Awaitable[Any]]


@dataclass(frozen=True)
class AgentTool:
    name: str
    description: str
    handler: ToolFn
    read_only: bool = True

    async def execute(self, **kwargs: Any) -> Any:
        return await self.handler(**kwargs)


class AgentToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, AgentTool] = {}

    def register(self, tool: AgentTool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"Agent tool already registered: {tool.name}")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[AgentTool]:
        return self._tools.get(name)

    def describe(self) -> list[dict[str, Any]]:
        return [
            {"name": t.name, "description": t.description, "read_only": t.read_only}
            for t in self._tools.values()
        ]

    async def execute(self, name: str, **kwargs: Any) -> Any:
        tool = self.get(name)
        if not tool:
            raise KeyError(f"Unknown agent tool: {name}")
        return await tool.execute(**kwargs)

    def names(self) -> list[str]:
        return list(self._tools)
