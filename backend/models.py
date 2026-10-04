from sqlalchemy import Column, String, Float, Integer, Text, Index
from database import Base

class AgentDB(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(String)
    name = Column(String)
    description = Column(String, default="")
    greeting = Column(String)
    system_prompt = Column(String)
    voice = Column(String, default="Cimo")
    language = Column(String, default="en-US")
    temperature = Column(Float, default=0.4)
    max_duration_minutes = Column(Integer, default=12)
    workflow_nodes = Column(Text, default="[]")
    workflow_edges = Column(Text, default="[]")
    status = Column(String, default="draft")
    published_version = Column(String, default="")
    published_at = Column(String, default="")

class CallLogDB(Base):
    __tablename__ = "call_logs"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(String)
    agent_id = Column(String, index=True)
    caller_number = Column(String)
    source = Column(String, default="browser")
    twilio_sid = Column(String, default="")
    duration_seconds = Column(Integer)
    outcome = Column(String)
    sentiment = Column(String, default="neutral")
    summary = Column(Text, default="")
    transcript = Column(String)  # Storing JSON list as a string for simplicity in sqlite

class WorkflowRevisionDB(Base):
    __tablename__ = "workflow_revisions"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)
    nodes = Column(Text, nullable=False)
    edges = Column(Text, nullable=False)
    label = Column(String, default="Saved version")

class KnowledgeSourceDB(Base):
    __tablename__ = "knowledge_sources"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, index=True, nullable=False, default="")
    title = Column(String, nullable=False, default="")
    content = Column(Text, nullable=False, default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

class AgentReleaseDB(Base):
    __tablename__ = "agent_releases"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, index=True, nullable=False)
    version = Column(String, nullable=False)
    environment = Column(String, nullable=False, default="Development")
    notes = Column(Text, default="")
    created_at = Column(String, nullable=False)
    agent_snapshot = Column(Text, nullable=False)
    workflow_nodes = Column(Text, nullable=False)
    workflow_edges = Column(Text, nullable=False)

class TestScenarioDB(Base):
    __tablename__ = "test_scenarios"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    persona = Column(Text, default="")
    script = Column(Text, default="")
    expected_outcome = Column(Text, default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

class SimulationRunDB(Base):
    __tablename__ = "simulation_runs"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, index=True, nullable=False)
    scenario_id = Column(String, index=True, default="")
    created_at = Column(String, nullable=False)
    status = Column(String, nullable=False)
    duration_ms = Column(Integer, default=0)
    result_json = Column(Text, nullable=False)

class OutboundCallDB(Base):
    __tablename__ = "outbound_calls"

    id = Column(String, primary_key=True, index=True)
    agent_id = Column(String, index=True, nullable=False)
    phone_number = Column(String, nullable=False)
    twilio_sid = Column(String, index=True, default="")
    status = Column(String, nullable=False, default="queued")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    error = Column(Text, default="")

Index("ix_knowledge_sources_agent_updated", KnowledgeSourceDB.agent_id, KnowledgeSourceDB.updated_at)
Index("ix_call_logs_agent_timestamp", CallLogDB.agent_id, CallLogDB.timestamp)
Index("ix_agent_releases_agent_created", AgentReleaseDB.agent_id, AgentReleaseDB.created_at)
Index("ix_simulation_runs_agent_created", SimulationRunDB.agent_id, SimulationRunDB.created_at)
