from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class ChatLegacyRequest(BaseModel):
    message: str
    system_prompt: str = "You are a helpful Voice AI Agent copilot."


class ChatLegacyResponse(BaseModel):
    reply: str


class CopilotChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    agent_settings: dict[str, Any] = Field(default_factory=dict)
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class CopilotChatResponse(BaseModel):
    session_id: str
    reply: str
    actions: list[dict[str, Any]] = Field(default_factory=list)
    provider: str = ""


class AgentUpsert(BaseModel):
    id: Optional[str] = None
    name: str = "Untitled agent"
    settings: dict[str, Any] = Field(default_factory=dict)
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)


class KnowledgeIngest(BaseModel):
    agent_id: str = ""
    title: str
    text: str


class CallStartRequest(BaseModel):
    agent_settings: dict[str, Any] = Field(default_factory=dict)
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    knowledge: list[str] = Field(default_factory=list)
    source: str = "browser"
    caller_number: str = "browser"


class CallTurnRequest(BaseModel):
    session_id: str
    user_text: str


class SimulateRequest(BaseModel):
    name: str = "Simulation"
    persona: str
    script: str
    expected_outcome: str = ""
    agent_settings: dict[str, Any] = Field(default_factory=dict)
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    knowledge: list[str] = Field(default_factory=list)
    max_turns: int = 8


class OutboundCallRequest(BaseModel):
    to: str
    agent_settings: dict[str, Any] = Field(default_factory=dict)
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    knowledge: list[str] = Field(default_factory=list)
