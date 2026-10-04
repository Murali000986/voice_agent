import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from groq import Groq
from dotenv import load_dotenv
import requests
import hmac
import hashlib
import base64
from urllib.parse import parse_qs
from html import escape as escape_xml
from database import engine, get_db, SessionLocal
import models
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, JSONResponse
import json
import time
import logging
import re
from collections import defaultdict, deque
from secrets import token_hex

load_dotenv()

models.Base.metadata.create_all(bind=engine)
from app.db import init_db as init_auxiliary_db
init_auxiliary_db()

# Migrate existing DB — add new columns if missing
def _migrate_db():
    import sqlite3, os
    if not engine.url.drivername.startswith("sqlite") or not engine.url.database or engine.url.database == ":memory:":
        return
    db_path = os.path.abspath(engine.url.database)
    con = sqlite3.connect(db_path)
    cur = con.execute("PRAGMA table_info(agents)")
    cols = {row[1] for row in cur.fetchall()}
    for col, dflt in [("description", "''"), ("workflow_nodes", "'[]'"), ("workflow_edges", "'[]'"), ("status", "'draft'"), ("published_version", "''"), ("published_at", "''")]:
        if col not in cols:
            con.execute(f"ALTER TABLE agents ADD COLUMN {col} TEXT DEFAULT {dflt}")
    call_cols = {row[1] for row in con.execute("PRAGMA table_info(call_logs)").fetchall()}
    for col, dflt in [("sentiment", "'neutral'"), ("summary", "''"), ("source", "'browser'"), ("twilio_sid", "''")]:
        if col not in call_cols:
            con.execute(f"ALTER TABLE call_logs ADD COLUMN {col} TEXT DEFAULT {dflt}")
    con.commit()
    legacy_studio = os.path.join(os.path.dirname(__file__), "studio.db")
    if os.path.abspath(legacy_studio) != db_path and os.path.exists(legacy_studio):
        try:
            con.execute("ATTACH DATABASE ? AS legacy_studio", (legacy_studio,))
            old_tables = {row[0] for row in con.execute("SELECT name FROM legacy_studio.sqlite_master WHERE type='table'").fetchall()}
            if "copilot_sessions" in old_tables:
                con.execute("INSERT OR IGNORE INTO copilot_sessions (id, created_at, messages_json) SELECT id, created_at, messages_json FROM legacy_studio.copilot_sessions")
            con.commit()
            con.execute("DETACH DATABASE legacy_studio")
        except sqlite3.Error:
            con.rollback()
    con.close()
_migrate_db()


app = FastAPI(title="Voice Call AI Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_request_windows: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_RATE_LIMITS = (("/api/conductor", 15), ("/api/simulate", 8), ("/api/calls", 90), ("/api", 180))

@app.middleware("http")
async def api_request_limits(request: Request, call_next):
    supplied_request_id = request.headers.get("x-request-id", "")
    request_id = supplied_request_id if re.fullmatch(r"[A-Za-z0-9._-]{1,80}", supplied_request_id) else token_hex(12)
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path
    if path.startswith("/api/"):
        prefix, limit = next(((prefix, value) for prefix, value in _RATE_LIMITS if path.startswith(prefix)), ("/api", 180))
        key = (client_ip, prefix)
        now = time.monotonic()
        window = _request_windows[key]
        while window and window[0] < now - 60:
            window.popleft()
        if len(window) >= limit:
            return JSONResponse(status_code=429, content={"detail": "Request rate limit reached. Wait a minute and try again.", "request_id": request_id}, headers={"Retry-After": "60", "X-Request-ID": request_id})
        window.append(now)
        if len(_request_windows) > 10_000:
            for old_key in list(_request_windows)[:2000]:
                if not _request_windows[old_key] or _request_windows[old_key][0] < now - 60:
                    _request_windows.pop(old_key, None)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception:
        logging.exception("Unhandled request failure request_id=%s method=%s path=%s", request_id, request.method, path)
        return JSONResponse(status_code=500, content={"detail": "The server could not complete this request.", "request_id": request_id}, headers={"X-Request-ID": request_id})

# ── Groq API ───────────────────────────────────────────────────────────────
api_key = os.environ.get("GROQ_API_KEY", "")
try:
    client = Groq(api_key=api_key)
except:
    client = None

# ── DB stored ─────────────────────────────────
# in-memory stores removed

# ── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    system_prompt: str = "You are a helpful Voice AI Agent copilot. Keep answers short and practical."

class ChatResponse(BaseModel):
    reply: str

class AgentConfig(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    greeting: str = Field(default="", max_length=2000)
    system_prompt: str = Field(default="", max_length=16000)
    description: str = Field(default="", max_length=4000)
    voice: str = Field(default="", max_length=160)
    language: str = Field(default="en-US", max_length=30)
    temperature: float = Field(default=0.4, ge=0, le=1)
    max_duration_minutes: int = Field(default=12, ge=1, le=240)
    workflow_nodes: str = Field(default="[]", max_length=1_500_000)
    workflow_edges: str = Field(default="[]", max_length=1_500_000)

class AgentResponse(AgentConfig):
    id: str
    created_at: str
    status: str = "draft"
    published_version: str = ""
    published_at: str = ""

class WorkflowPayload(BaseModel):
    nodes: str = Field(max_length=1_500_000)
    edges: str = Field(max_length=1_500_000)

class WorkflowValidationPayload(BaseModel):
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)

class KnowledgeSourcePayload(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=100_000)

    @field_validator("title", "content")
    @classmethod
    def require_non_whitespace(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value.strip()

class PublishPayload(BaseModel):
    environment: str = "Development"
    notes: str = Field(default="", max_length=2000)
    agent_settings: dict = Field(default_factory=dict)
    nodes: list[dict] | None = None
    edges: list[dict] | None = None

    @field_validator("environment")
    @classmethod
    def valid_environment(cls, value: str) -> str:
        if value not in {"Development", "Staging", "Production"}:
            raise ValueError("Choose Development, Staging, or Production.")
        return value

class ScenarioPayload(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    persona: str = Field(min_length=1, max_length=2000)
    script: str = Field(min_length=1, max_length=6000)
    expected_outcome: str = Field(default="", max_length=3000)

    @field_validator("name", "persona", "script")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value.strip()

class OutboundCallPayload(BaseModel):
    phone_number: str = Field(pattern=r"^\+[1-9][0-9]{7,14}$")
    consent_confirmed: bool

class CallLog(BaseModel):
    agent_id: str
    caller_number: str
    duration_seconds: int
    outcome: str
    transcript: str # Will hold json as string for sqlite compatibility
    source: str = "browser"

class CallStartPayload(BaseModel):
    agent_id: str = ""
    agent_settings: dict = Field(default_factory=dict)
    nodes: list[dict] = Field(default_factory=list, max_length=300)
    edges: list[dict] = Field(default_factory=list, max_length=600)
    knowledge: list[str] = Field(default_factory=list, max_length=40)
    source: str = "browser"
    caller_number: str = "browser"

class CallTurnPayload(BaseModel):
    user_text: str = Field(max_length=4000)

class CallEndPayload(BaseModel):
    outcome: str = "unknown"

ACTIVE_CALLS: dict[str, dict] = {}
MAX_ACTIVE_CALLS = int(os.environ.get("MAX_ACTIVE_CALLS", "10"))
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
FRONTEND_LISTENERS: dict[str, list] = {}

# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "voice-agent-studio",
        "capabilities": {
            "agent_storage": True,
            "workflow_storage": True,
            "call_simulation": bool(api_key or os.environ.get("NVIDIA_API_KEY")),
            "phone_calls": bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_AUTH_TOKEN")),
            "phone_number_configured": bool(os.environ.get("TWILIO_PHONE_NUMBER")),
            "transcription": bool(os.environ.get("DEEPGRAM_API_KEY")),
            "text_to_speech": bool(os.environ.get("DEEPGRAM_API_KEY")),
            "workflow_validation": True,
            "workflow_versions": True,
            "agent_knowledge": True,
            "call_history_search": True,
            "agent_releases": True,
            "saved_test_scenarios": True,
        },
    }


@app.get("/api/voice/providers")
def voice_providers():
    """Describe available speech paths without exposing credentials."""
    from app.elevenlabs import is_configured as el_configured, ELEVENLABS_VOICES
    deepgram = bool(os.environ.get("DEEPGRAM_API_KEY"))
    el_ok = el_configured()
    providers = [
        {"id": "browser", "name": "Device voices", "configured": True, "scope": "test_calls", "multiple_voices_per_flow": True},
        {"id": "deepgram", "name": "Deepgram Aura", "configured": deepgram, "scope": "phone_calls", "multiple_voices_per_flow": False},
        {
            "id": "elevenlabs",
            "name": "ElevenLabs",
            "configured": el_ok,
            "scope": "browser_and_phone",
            "multiple_voices_per_flow": True,
            "voice_count": len(ELEVENLABS_VOICES),
        },
    ]
    return {
        "providers": providers,
        "default": "browser",
        "note": "Device voices are browser-supplied. Deepgram and ElevenLabs require API keys in backend/.env.",
    }


@app.get("/api/voice/elevenlabs")
def elevenlabs_voices():
    """Return the full ElevenLabs voice catalogue (curated + account custom voices)."""
    from app.elevenlabs import list_voices, is_configured
    return {
        "configured": is_configured(),
        "voices": list_voices(),
    }


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    voice_id: str = Field(default="21m00Tcm4TlvDq8ikWAM", max_length=64)
    model_id: str = Field(default="eleven_turbo_v2_5", max_length=64)
    stability: float = Field(default=0.5, ge=0.0, le=1.0)
    similarity_boost: float = Field(default=0.75, ge=0.0, le=1.0)


@app.post("/api/tts")
def text_to_speech(req: TTSRequest):
    """Synthesize text to MP3 audio via ElevenLabs and return base64-encoded audio."""
    from app.elevenlabs import synthesize_speech, is_configured
    import base64
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to backend/.env"
        )
    try:
        audio_bytes = synthesize_speech(
            text=req.text,
            voice_id=req.voice_id,
            model_id=req.model_id,
            stability=req.stability,
            similarity_boost=req.similarity_boost,
        )
        return {
            "audio_base64": base64.b64encode(audio_bytes).decode(),
            "mime_type": "audio/mpeg",
            "voice_id": req.voice_id,
            "characters": len(req.text),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc



def _workflow_snapshot(db: Session, agent_id: str, nodes: str, edges: str, label: str = "Saved version"):
    db.add(models.WorkflowRevisionDB(
        id=str(uuid.uuid4()), agent_id=agent_id, created_at=datetime.utcnow().isoformat(),
        nodes=nodes or "[]", edges=edges or "[]", label=label,
    ))
    db.flush()
    old = db.query(models.WorkflowRevisionDB.id).filter_by(agent_id=agent_id).order_by(models.WorkflowRevisionDB.created_at.desc()).offset(50).all()
    if old:
        db.query(models.WorkflowRevisionDB).filter(models.WorkflowRevisionDB.id.in_([row[0] for row in old])).delete(synchronize_session=False)


def _validate_workflow(nodes: list[dict], edges: list[dict]) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    known_types = {"conversation", "subagent", "function", "callTransfer", "pressDigit", "logicSplit", "agentTransfer", "inCallSms", "extractVariable", "code", "mcp", "ending", "note"}
    for node in nodes:
        if not isinstance(node.get("data"), dict):
            errors.append(f"Step “{node.get('id') or 'unknown'}” has invalid settings.")
        if node.get("type") not in known_types:
            errors.append(f"Step “{node.get('id') or 'unknown'}” uses an unsupported type.")
    ids = [str(n.get("id", "")) for n in nodes]
    id_set = set(ids)
    if not nodes:
        errors.append("Add at least one workflow step.")
    if "" in ids:
        errors.append("Every step needs an ID.")
    if len(ids) != len(id_set):
        errors.append("Each workflow step must have a unique ID.")
    out: dict[str, list[dict]] = {nid: [] for nid in id_set}
    for edge in edges:
        source, target = str(edge.get("source", "")), str(edge.get("target", ""))
        if source not in id_set or target not in id_set:
            errors.append("A connection points to a step that no longer exists.")
            continue
        out[source].append(edge)
    nodes_by_id = {str(n.get("id")): n for n in nodes}
    start_ids = [nid for nid in ids if not any(e.get("target") == nid for e in edges)]
    if nodes and not start_ids:
        errors.append("The flow has no start step. Add a step with no incoming connections.")
    if len(start_ids) > 1:
        warnings.append("More than one disconnected start step was found; calls begin at the first one.")
    for nid, node in nodes_by_id.items():
        typ = node.get("type")
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        if typ not in ("ending", "note") and not out.get(nid):
            warnings.append(f"“{data.get('label') or typ or 'Step'}” has no next step and may stop the flow.")
        if typ == "logicSplit":
            handles = {str(e.get("sourceHandle") or e.get("label") or "").lower() for e in out.get(nid, [])}
            if len(out.get(nid, [])) < 2 or not ({"yes", "true"} & handles and {"no", "false"} & handles):
                warnings.append(f"“{data.get('label') or 'Logic split'}” should have Yes and No paths connected.")
        if typ == "conversation" and not str(data.get("prompt") or data.get("description") or "").strip():
            warnings.append(f"“{data.get('label') or 'Conversation'}” needs a prompt.")
    if nodes and start_ids:
        seen = set(start_ids[:1])
        queue = list(start_ids[:1])
        while queue:
            current = queue.pop(0)
            for edge in out.get(current, []):
                target = str(edge.get("target"))
                if target not in seen:
                    seen.add(target)
                    queue.append(target)
        for nid in id_set - seen:
            data = (nodes_by_id.get(nid) or {}).get("data") or {}
            warnings.append(f"“{data.get('label') or nid}” cannot be reached from the start step.")
    return {"valid": not errors, "errors": errors, "warnings": warnings, "node_count": len(nodes), "edge_count": len(edges)}


@app.post("/api/workflows/validate")
def validate_workflow(payload: WorkflowValidationPayload):
    return _validate_workflow(payload.nodes, payload.edges)


@app.get("/api/dashboard/overview")
def dashboard_overview(db: Session = Depends(get_db)):
    """Small, dashboard-ready account summary."""
    agent_count = db.query(models.AgentDB).count()
    call_count = db.query(models.CallLogDB).count()
    recent = db.query(models.CallLogDB).order_by(models.CallLogDB.timestamp.desc()).limit(5).all()
    durations = db.query(models.CallLogDB.duration_seconds).all()
    avg_duration = round(sum(row[0] or 0 for row in durations) / len(durations)) if durations else 0
    return {
        "agents": agent_count,
        "calls": call_count,
        "average_duration_seconds": avg_duration,
        "recent_calls": recent,
    }


@app.get("/api/dashboard/analytics")
def dashboard_analytics(agent_id: Optional[str] = None, days: int = 30, db: Session = Depends(get_db)):
    safe_days = max(1, min(days, 365))
    cutoff = (datetime.utcnow() - timedelta(days=safe_days)).isoformat()
    query = db.query(models.CallLogDB).filter(models.CallLogDB.timestamp >= cutoff)
    if agent_id:
        query = query.filter(models.CallLogDB.agent_id == agent_id)
    rows = query.all()
    outcome_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    sentiment_counts: dict[str, int] = {}
    for row in rows:
        outcome_counts[row.outcome or "unknown"] = outcome_counts.get(row.outcome or "unknown", 0) + 1
        source_counts[row.source or "browser"] = source_counts.get(row.source or "browser", 0) + 1
        sentiment_counts[row.sentiment or "neutral"] = sentiment_counts.get(row.sentiment or "neutral", 0) + 1
    qualified = outcome_counts.get("qualified", 0)
    return {
        "period_days": safe_days,
        "total_calls": len(rows),
        "average_duration_seconds": round(sum(row.duration_seconds or 0 for row in rows) / len(rows)) if rows else 0,
        "qualification_rate": round(qualified / len(rows), 4) if rows else 0,
        "outcomes": outcome_counts,
        "sources": source_counts,
        "sentiments": sentiment_counts,
    }


@app.get("/health/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness check verifies database access as well as process liveness."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "database": "unavailable"}) from exc


def _finish_runtime_call(session_id: str, outcome: str | None = None, db: Session | None = None):
    """Persist one completed runtime call at most once."""
    from app.engine.runtime import get_session as get_runtime_session, summarize_sentiment

    active = ACTIVE_CALLS.get(session_id)
    runtime_session = get_runtime_session(session_id)
    if not active or not runtime_session or active.get("saved"):
        return None
    runtime_session.ended = True
    if outcome:
        runtime_session.outcome = outcome
    transcript = runtime_session.transcript
    sentiment, summary = "neutral", ""
    try:
        sentiment, summary = summarize_sentiment(transcript)
    except Exception:
        summary = "Call completed."
    owns_db = db is None
    call_db = db or SessionLocal()
    try:
        record = models.CallLogDB(
            id=session_id,
            timestamp=datetime.utcnow().isoformat(),
            agent_id=active.get("agent_id", ""),
            caller_number=runtime_session.caller_number or "",
            duration_seconds=max(0, int(time.monotonic() - active["started_at"])),
            outcome=runtime_session.outcome or "unknown",
            source=runtime_session.source or "browser",
            twilio_sid=active.get("twilio_sid", ""),
            sentiment=sentiment,
            summary=summary,
            transcript=json.dumps(transcript, ensure_ascii=False),
        )
        call_db.add(record)
        call_db.commit()
        call_db.refresh(record)
        active["saved"] = True
        active["summary"] = summary
        active["sentiment"] = sentiment
        return record
    finally:
        if owns_db:
            call_db.close()


@app.post("/api/calls/start")
def start_runtime_call(payload: CallStartPayload, db: Session = Depends(get_db)):
    """Start a browser/test call against a saved agent or supplied draft."""
    from app.engine.runtime import start_call as runtime_start_call

    settings = dict(payload.agent_settings or {})
    nodes = payload.nodes
    edges = payload.edges
    if payload.agent_id:
        agent = db.query(models.AgentDB).filter(models.AgentDB.id == payload.agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found.")
        settings = {
            "name": agent.name,
            "greeting": agent.greeting,
            "system_prompt": agent.system_prompt,
            "voice": agent.voice,
            "language": agent.language,
            "temperature": agent.temperature,
            "fallbackMessage": "I'm having trouble connecting. Please try again in a moment.",
            **settings,
        }
        if not nodes:
            nodes = json.loads(agent.workflow_nodes or "[]")
        if not edges:
            edges = json.loads(agent.workflow_edges or "[]")
        sources = db.query(models.KnowledgeSourceDB).filter(
            (models.KnowledgeSourceDB.agent_id == agent.id) | (models.KnowledgeSourceDB.agent_id == "")
        ).order_by(models.KnowledgeSourceDB.updated_at.desc()).limit(4).all()
        payload.knowledge.extend([f"{source.title}: {source.content[:2400]}" for source in sources])
    result = runtime_start_call(
        settings=settings,
        nodes=nodes,
        edges=edges,
        knowledge=payload.knowledge,
        source=payload.source,
        caller_number=payload.caller_number,
    )
    ACTIVE_CALLS[result["session_id"]] = {
        "agent_id": payload.agent_id,
        "started_at": time.monotonic(),
        "saved": False,
        "twilio_sid": "",
    }
    return result


@app.post("/api/calls/{session_id}/turn")
def runtime_call_turn(session_id: str, payload: CallTurnPayload, db: Session = Depends(get_db)):
    """Process a caller turn and return the agent's next spoken response."""
    from app.engine.runtime import get_session as get_runtime_session, turn
    session = get_runtime_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found or expired.")
    active_call = ACTIVE_CALLS.get(session_id) or {}
    agent_id = active_call.get("agent_id")
    if agent_id:
        try:
            chunks = db.query(models.KnowledgeSourceDB).filter(
                (models.KnowledgeSourceDB.agent_id == agent_id) | (models.KnowledgeSourceDB.agent_id == "")
            ).order_by(models.KnowledgeSourceDB.updated_at.desc()).limit(40).all()
            query_words = {word.lower().strip(".,?!:;()[]{}\"'") for word in payload.user_text.split() if len(word) > 2}
            scored = sorted(chunks, key=lambda row: sum(word in f"{row.title} {row.content}".lower() for word in query_words), reverse=True)
            retrieved = [f"{row.title}: {row.content[:2400]}" for row in scored[:4]]
            if retrieved:
                session.knowledge = retrieved
        except Exception:
            pass
    try:
        result = turn(session, payload.user_text)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Voice model unavailable: {exc}") from exc
    if result.get("ended"):
        _finish_runtime_call(session_id, db=db)
    return result


@app.post("/api/calls/{session_id}/end")
def end_runtime_call(session_id: str, payload: CallEndPayload, db: Session = Depends(get_db)):
    from app.engine.runtime import get_session as get_runtime_session
    if not get_runtime_session(session_id):
        raise HTTPException(status_code=404, detail="Call session not found or expired.")
    record = _finish_runtime_call(session_id, payload.outcome, db)
    return {"ended": True, "call": record}


class OutboundCallRequest(BaseModel):
    phone_number: str = Field(pattern=r"^\+[1-9][0-9]{7,14}$")
    agent_id: str = ""


@app.get("/twiml")
def serve_twiml(greeting: str = "Hello! This is your AI voice agent calling from Bask Voice Studio."):
    """Public TwiML endpoint Twilio fetches when a call connects."""
    from fastapi.responses import Response as FastAPIResponse
    safe = escape_xml(greeting[:500])
    xml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">{safe}</Say><Pause length="3"/><Say voice="alice">Goodbye!</Say></Response>'
    return FastAPIResponse(content=xml, media_type="application/xml")


@app.post("/api/calls/outbound")
def place_outbound_call(req: OutboundCallRequest, db: Session = Depends(get_db)):
    """Dial the supplied phone number via Twilio. Requires TWILIO_* env vars."""
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "")
    if not (account_sid and auth_token and from_number):
        raise HTTPException(status_code=503, detail="Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to backend/.env")
    try:
        from twilio.rest import Client as TwilioClient
    except ImportError:
        raise HTTPException(status_code=503, detail="twilio package not installed. Run: pip install twilio")

    # Build greeting from agent settings when available
    greeting = "Hello! This is your AI voice agent calling from Bask Voice Studio."
    if req.agent_id:
        agent = db.query(models.AgentDB).filter_by(id=req.agent_id).first()
        if agent and agent.greeting:
            greeting = agent.greeting

    public_base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    if not public_base.startswith("https://"):
        raise HTTPException(status_code=503, detail="Set PUBLIC_BASE_URL to your public HTTPS URL to test calls.")

    twiml_url = f"{public_base}/api/twilio/incoming?agent_id={req.agent_id}&direction=outbound&test_call=true"
    try:
        twilio_client = TwilioClient(account_sid, auth_token)
        call = twilio_client.calls.create(
            to=req.phone_number,
            from_=from_number,
            url=twiml_url,
        )
        return {"call_sid": call.sid, "status": call.status, "to": req.phone_number, "from": from_number}
    except Exception as exc:
        error_msg = str(exc)
        raise HTTPException(status_code=502, detail=f"Twilio call failed: {error_msg}") from exc


@app.get("/api/calls/{session_id}")
def get_runtime_call(session_id: str, db: Session = Depends(get_db)):
    from app.engine.runtime import get_session as get_runtime_session
    session = get_runtime_session(session_id)
    if session:
        return {
            "session_id": session.id,
            "ended": session.ended,
            "outcome": session.outcome,
            "node_id": session.current_node_id,
            "transcript": session.transcript,
        }
    record = db.query(models.CallLogDB).filter(models.CallLogDB.id == session_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Call not found.")
    return record

# ── Conductor AI Chat ─────────────────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
def handle_chat(request: ChatRequest):
    try:
        from app.llm.client import chat
        reply, _provider = chat(
            [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.message},
            ],
            temperature=0.4,
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

# ── Agent CRUD ────────────────────────────────────────────────────────────────
@app.post("/api/agents", response_model=AgentResponse)
def create_agent(config: AgentConfig, db: Session = Depends(get_db)):
    agent_id = str(uuid.uuid4())
    db_agent = models.AgentDB(
        id=agent_id,
        created_at=datetime.utcnow().isoformat(),
        **config.model_dump()
    )
    db.add(db_agent)
    _workflow_snapshot(db, agent_id, config.workflow_nodes, config.workflow_edges, "Initial version")
    db.commit()
    db.refresh(db_agent)
    return db_agent

@app.get("/api/agents")
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(models.AgentDB).order_by(models.AgentDB.created_at.desc()).all()
    return {"agents": agents}

@app.get("/api/agents/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return agent

@app.put("/api/agents/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: str, config: AgentConfig, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    
    next_values = config.model_dump()
    workflow_changed = (
        (agent.workflow_nodes or "[]") != (next_values.get("workflow_nodes") or "[]")
        or (agent.workflow_edges or "[]") != (next_values.get("workflow_edges") or "[]")
    )
    if workflow_changed:
        _workflow_snapshot(db, agent_id, agent.workflow_nodes or "[]", agent.workflow_edges or "[]")
    for key, value in next_values.items():
        setattr(agent, key, value)
        
    db.commit()
    db.refresh(agent)
    return agent

@app.delete("/api/agents/{agent_id}")
def delete_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    db.query(models.WorkflowRevisionDB).filter_by(agent_id=agent_id).delete(synchronize_session=False)
    db.query(models.KnowledgeSourceDB).filter_by(agent_id=agent_id).delete(synchronize_session=False)
    db.query(models.AgentReleaseDB).filter_by(agent_id=agent_id).delete(synchronize_session=False)
    db.query(models.TestScenarioDB).filter_by(agent_id=agent_id).delete(synchronize_session=False)
    db.query(models.SimulationRunDB).filter_by(agent_id=agent_id).delete(synchronize_session=False)
    db.delete(agent)
    db.commit()
    return {"deleted": agent_id}

@app.get("/api/agents/{agent_id}/workflow")
def get_workflow(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    return {"nodes": agent.workflow_nodes or "[]", "edges": agent.workflow_edges or "[]"}

@app.post("/api/agents/{agent_id}/workflow")
def save_workflow(agent_id: str, payload: WorkflowPayload, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    try:
        next_nodes = json.loads(payload.nodes or "[]")
        next_edges = json.loads(payload.edges or "[]")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Workflow nodes and connections must be valid JSON.") from exc
    if not isinstance(next_nodes, list) or not isinstance(next_edges, list):
        raise HTTPException(status_code=422, detail="Workflow nodes and connections must be lists.")
    validation = _validate_workflow(next_nodes, next_edges)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail={"message": "Workflow could not be saved.", **validation})
    if (agent.workflow_nodes or "[]") != payload.nodes or (agent.workflow_edges or "[]") != payload.edges:
        _workflow_snapshot(db, agent_id, agent.workflow_nodes or "[]", agent.workflow_edges or "[]")
    agent.workflow_nodes = payload.nodes
    agent.workflow_edges = payload.edges
    db.commit()
    return {"saved": True, "validation": validation}


@app.get("/api/agents/{agent_id}/workflow/revisions")
def list_workflow_revisions(agent_id: str, limit: int = 30, db: Session = Depends(get_db)):
    if not db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first():
        raise HTTPException(status_code=404, detail="Agent not found.")
    revisions = db.query(models.WorkflowRevisionDB).filter_by(agent_id=agent_id).order_by(models.WorkflowRevisionDB.created_at.desc()).limit(max(1, min(limit, 100))).all()
    return {"revisions": [{"id": r.id, "created_at": r.created_at, "label": r.label, "node_count": len(json.loads(r.nodes or "[]")), "edge_count": len(json.loads(r.edges or "[]"))} for r in revisions]}


@app.post("/api/agents/{agent_id}/workflow/revisions/{revision_id}/restore")
def restore_workflow_revision(agent_id: str, revision_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter(models.AgentDB.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    revision = db.query(models.WorkflowRevisionDB).filter_by(id=revision_id, agent_id=agent_id).first()
    if not revision:
        raise HTTPException(status_code=404, detail="Workflow version not found.")
    _workflow_snapshot(db, agent_id, agent.workflow_nodes or "[]", agent.workflow_edges or "[]", "Before restore")
    agent.workflow_nodes, agent.workflow_edges = revision.nodes, revision.edges
    _workflow_snapshot(db, agent_id, revision.nodes, revision.edges, "Restored version")
    db.commit()
    return {"restored": True, "nodes": agent.workflow_nodes, "edges": agent.workflow_edges}


@app.post("/api/agents/{agent_id}/publish")
def publish_agent(agent_id: str, payload: PublishPayload, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter_by(id=agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    settings_map = {"name": "name", "description": "description", "greeting": "greeting", "system_prompt": "system_prompt", "voice": "voice", "language": "language", "temperature": "temperature", "max_duration_minutes": "max_duration_minutes"}
    for key, value in payload.agent_settings.items():
        if key in settings_map and value is not None:
            setattr(agent, settings_map[key], value)
    next_nodes = json.dumps(payload.nodes, ensure_ascii=False) if payload.nodes is not None else (agent.workflow_nodes or "[]")
    next_edges = json.dumps(payload.edges, ensure_ascii=False) if payload.edges is not None else (agent.workflow_edges or "[]")
    nodes, edges = json.loads(next_nodes), json.loads(next_edges)
    validation = _validate_workflow(nodes, edges)
    if not validation["valid"]:
        db.rollback()
        raise HTTPException(status_code=422, detail={"message": "Fix the workflow errors before publishing.", **validation})
    if (agent.workflow_nodes or "[]") != next_nodes or (agent.workflow_edges or "[]") != next_edges:
        _workflow_snapshot(db, agent_id, agent.workflow_nodes or "[]", agent.workflow_edges or "[]")
        agent.workflow_nodes, agent.workflow_edges = next_nodes, next_edges
    existing = db.query(models.AgentReleaseDB).filter_by(agent_id=agent_id).count()
    version = f"v{existing + 1}"
    created = datetime.utcnow().isoformat()
    release = models.AgentReleaseDB(
        id=str(uuid.uuid4()), agent_id=agent_id, version=version, environment=payload.environment,
        notes=payload.notes.strip(), created_at=created,
        agent_snapshot=json.dumps({key: getattr(agent, key) for key in ("name", "description", "greeting", "system_prompt", "voice", "language", "temperature", "max_duration_minutes")}, ensure_ascii=False),
        workflow_nodes=next_nodes, workflow_edges=next_edges,
    )
    db.add(release)
    agent.status, agent.published_version, agent.published_at = "published", version, created
    db.commit()
    return {"published": True, "id": release.id, "version": version, "environment": release.environment, "created_at": created, "validation": validation}


@app.get("/api/agents/{agent_id}/releases")
def list_agent_releases(agent_id: str, limit: int = 30, db: Session = Depends(get_db)):
    if not db.query(models.AgentDB).filter_by(id=agent_id).first():
        raise HTTPException(status_code=404, detail="Agent not found.")
    releases = db.query(models.AgentReleaseDB).filter_by(agent_id=agent_id).order_by(models.AgentReleaseDB.created_at.desc()).limit(max(1, min(limit, 100))).all()
    return {"releases": [{"id": item.id, "version": item.version, "environment": item.environment, "notes": item.notes, "created_at": item.created_at} for item in releases]}


@app.post("/api/agents/{agent_id}/releases/{release_id}/restore")
def restore_agent_release(agent_id: str, release_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter_by(id=agent_id).first()
    release = db.query(models.AgentReleaseDB).filter_by(id=release_id, agent_id=agent_id).first()
    if not agent or not release:
        raise HTTPException(status_code=404, detail="Agent or release not found.")
    validation = _validate_workflow(json.loads(release.workflow_nodes or "[]"), json.loads(release.workflow_edges or "[]"))
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail={"message": "This release has an invalid workflow and cannot be restored.", **validation})
    _workflow_snapshot(db, agent_id, agent.workflow_nodes or "[]", agent.workflow_edges or "[]", "Before release restore")
    try:
        for key, value in json.loads(release.agent_snapshot or "{}").items():
            if key in {"name", "description", "greeting", "system_prompt", "voice", "language", "temperature", "max_duration_minutes"}:
                setattr(agent, key, value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="The saved release settings could not be read.") from exc
    agent.workflow_nodes, agent.workflow_edges = release.workflow_nodes, release.workflow_edges
    agent.status = "draft"
    db.commit()
    return {"restored": True, "status": agent.status, "version": release.version, "nodes": agent.workflow_nodes, "edges": agent.workflow_edges}


@app.post("/api/agents/{agent_id}/archive")
def archive_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter_by(id=agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    agent.status = "archived"
    db.commit()
    return {"archived": True, "agent_id": agent_id}


@app.post("/api/agents/{agent_id}/restore")
def restore_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter_by(id=agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    agent.status = "published" if agent.published_version else "draft"
    db.commit()
    return {"restored": True, "agent_id": agent_id, "status": agent.status}

# ── Call Logs ─────────────────────────────────────────────────────────────────
@app.post("/api/calls")
def log_call(call: CallLog, db: Session = Depends(get_db)):
    db_call = models.CallLogDB(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow().isoformat(),
        agent_id=call.agent_id,
        caller_number=call.caller_number,
        source=call.source,
        duration_seconds=call.duration_seconds,
        outcome=call.outcome,
        transcript=call.transcript
    )
    db.add(db_call)
    db.commit()
    db.refresh(db_call)
    return db_call

@app.get("/api/calls")
def get_calls(
    agent_id: Optional[str] = None,
    outcome: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(models.CallLogDB)
    if agent_id:
        query = query.filter(models.CallLogDB.agent_id == agent_id)
    if outcome:
        query = query.filter(models.CallLogDB.outcome == outcome)
    if source:
        query = query.filter(models.CallLogDB.source == source)
    if q:
        pattern = f"%{q[:120]}%"
        query = query.filter((models.CallLogDB.caller_number.ilike(pattern)) | (models.CallLogDB.summary.ilike(pattern)) | (models.CallLogDB.transcript.ilike(pattern)))
    total = query.count()
    calls = query.order_by(models.CallLogDB.timestamp.desc()).offset(max(0, offset)).limit(max(1, min(limit, 500))).all()
    # Ensure transcript is parsed back or kept as strings; since CallLog asks for a string now the model will just return strings.
    return {"calls": calls, "total": total, "limit": max(1, min(limit, 500)), "offset": max(0, offset)}


@app.get("/api/agents/{agent_id}/knowledge")
def list_knowledge_sources(agent_id: str, db: Session = Depends(get_db)):
    if not db.query(models.AgentDB).filter_by(id=agent_id).first():
        raise HTTPException(status_code=404, detail="Agent not found.")
    sources = db.query(models.KnowledgeSourceDB).filter(
        (models.KnowledgeSourceDB.agent_id == agent_id) | (models.KnowledgeSourceDB.agent_id == "")
    ).order_by(models.KnowledgeSourceDB.updated_at.desc()).all()
    return {"sources": [{"id": item.id, "agent_id": item.agent_id, "title": item.title, "content": item.content, "created_at": item.created_at, "updated_at": item.updated_at} for item in sources]}


@app.post("/api/agents/{agent_id}/knowledge")
def create_knowledge_source(agent_id: str, payload: KnowledgeSourcePayload, db: Session = Depends(get_db)):
    if not db.query(models.AgentDB).filter_by(id=agent_id).first():
        raise HTTPException(status_code=404, detail="Agent not found.")
    now = datetime.utcnow().isoformat()
    item = models.KnowledgeSourceDB(id=str(uuid.uuid4()), agent_id=agent_id, title=payload.title.strip(), content=payload.content.strip(), created_at=now, updated_at=now)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "agent_id": item.agent_id, "title": item.title, "content": item.content, "created_at": item.created_at, "updated_at": item.updated_at}


@app.put("/api/agents/{agent_id}/knowledge/{source_id}")
def update_knowledge_source(agent_id: str, source_id: str, payload: KnowledgeSourcePayload, db: Session = Depends(get_db)):
    item = db.query(models.KnowledgeSourceDB).filter_by(id=source_id, agent_id=agent_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Knowledge source not found.")
    item.title, item.content, item.updated_at = payload.title.strip(), payload.content.strip(), datetime.utcnow().isoformat()
    db.commit()
    db.refresh(item)
    return {"id": item.id, "agent_id": item.agent_id, "title": item.title, "content": item.content, "created_at": item.created_at, "updated_at": item.updated_at}


@app.delete("/api/agents/{agent_id}/knowledge/{source_id}")
def delete_knowledge_source(agent_id: str, source_id: str, db: Session = Depends(get_db)):
    item = db.query(models.KnowledgeSourceDB).filter_by(id=source_id, agent_id=agent_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Knowledge source not found.")
    db.delete(item)
    db.commit()
    return {"deleted": source_id}

# ── Simulate / Test Call ──────────────────────────────────────────────────────
class SimRequest(BaseModel):
    persona: str = Field(min_length=1, max_length=2000)
    script: str = Field(min_length=1, max_length=6000)
    agent_system_prompt: str = Field(default="You are a professional voice sales agent.", max_length=16000)
    expected_outcome: str = Field(default="", max_length=3000)
    agent_settings: dict = Field(default_factory=dict)
    nodes: list[dict] = Field(default_factory=list)
    edges: list[dict] = Field(default_factory=list)
    knowledge: list[str] = Field(default_factory=list)
    max_turns: int = 8
    agent_id: str = ""
    scenario_id: str = ""

@app.get("/api/agents/{agent_id}/scenarios")
def list_scenarios(agent_id: str, db: Session = Depends(get_db)):
    if not db.query(models.AgentDB).filter_by(id=agent_id).first():
        raise HTTPException(status_code=404, detail="Agent not found.")
    scenarios = db.query(models.TestScenarioDB).filter_by(agent_id=agent_id).order_by(models.TestScenarioDB.updated_at.desc()).all()
    return {"scenarios": [{"id": row.id, "name": row.name, "persona": row.persona, "script": row.script, "expected_outcome": row.expected_outcome, "created_at": row.created_at, "updated_at": row.updated_at} for row in scenarios]}

@app.post("/api/agents/{agent_id}/scenarios")
def create_scenario(agent_id: str, payload: ScenarioPayload, db: Session = Depends(get_db)):
    if not db.query(models.AgentDB).filter_by(id=agent_id).first():
        raise HTTPException(status_code=404, detail="Agent not found.")
    now = datetime.utcnow().isoformat()
    scenario = models.TestScenarioDB(id=str(uuid.uuid4()), agent_id=agent_id, name=payload.name, persona=payload.persona, script=payload.script, expected_outcome=payload.expected_outcome, created_at=now, updated_at=now)
    db.add(scenario)
    db.commit()
    return {"id": scenario.id, "name": scenario.name, "persona": scenario.persona, "script": scenario.script, "expected_outcome": scenario.expected_outcome, "created_at": scenario.created_at, "updated_at": scenario.updated_at}

@app.put("/api/agents/{agent_id}/scenarios/{scenario_id}")
def update_scenario(agent_id: str, scenario_id: str, payload: ScenarioPayload, db: Session = Depends(get_db)):
    scenario = db.query(models.TestScenarioDB).filter_by(id=scenario_id, agent_id=agent_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Test scenario not found.")
    scenario.name, scenario.persona, scenario.script = payload.name, payload.persona, payload.script
    scenario.expected_outcome, scenario.updated_at = payload.expected_outcome, datetime.utcnow().isoformat()
    db.commit()
    return {"id": scenario.id, "name": scenario.name, "persona": scenario.persona, "script": scenario.script, "expected_outcome": scenario.expected_outcome, "updated_at": scenario.updated_at}

@app.delete("/api/agents/{agent_id}/scenarios/{scenario_id}")
def delete_scenario(agent_id: str, scenario_id: str, db: Session = Depends(get_db)):
    scenario = db.query(models.TestScenarioDB).filter_by(id=scenario_id, agent_id=agent_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Test scenario not found.")
    db.query(models.SimulationRunDB).filter_by(agent_id=agent_id, scenario_id=scenario_id).delete(synchronize_session=False)
    db.delete(scenario)
    db.commit()
    return {"deleted": scenario_id}

@app.get("/api/agents/{agent_id}/simulation-runs")
def list_simulation_runs(agent_id: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(models.SimulationRunDB).filter_by(agent_id=agent_id).order_by(models.SimulationRunDB.created_at.desc())
    total = query.count()
    rows = query.offset(max(offset, 0)).limit(max(1, min(limit, 200))).all()
    return {"runs": [{"id": row.id, "scenario_id": row.scenario_id, "created_at": row.created_at, "status": row.status, "duration_ms": row.duration_ms, "result": json.loads(row.result_json)} for row in rows], "total": total}

def _run_simulation(req: SimRequest, db: Session, agent_id: str = "", scenario_id: str = ""):
    started = time.perf_counter()
    try:
        from app.engine.runtime import simulate_dialog
        settings = {"system_prompt": req.agent_system_prompt, **req.agent_settings}
        result = simulate_dialog(persona=req.persona, script=req.script, expected_outcome=req.expected_outcome, settings=settings, nodes=req.nodes, edges=req.edges, knowledge=req.knowledge, max_turns=max(1, min(req.max_turns, 12)))
        if agent_id:
            elapsed = int((time.perf_counter() - started) * 1000)
            db.add(models.SimulationRunDB(id=str(uuid.uuid4()), agent_id=agent_id, scenario_id=scenario_id, created_at=datetime.utcnow().isoformat(), status=result.get("status", "failed"), duration_ms=elapsed, result_json=json.dumps(result, ensure_ascii=False)))
            db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=503, detail=f"Simulation unavailable: {e}") from e

@app.post("/api/simulate")
def simulate_call(req: SimRequest, db: Session = Depends(get_db)):
    """Run a simulated conversation and score it against an expected outcome."""
    return _run_simulation(req, db, req.agent_id, req.scenario_id)

@app.post("/api/agents/{agent_id}/scenarios/{scenario_id}/run")
def run_saved_scenario(agent_id: str, scenario_id: str, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter_by(id=agent_id).first()
    scenario = db.query(models.TestScenarioDB).filter_by(id=scenario_id, agent_id=agent_id).first()
    if not agent or not scenario:
        raise HTTPException(status_code=404, detail="Agent or test scenario not found.")
    req = SimRequest(
        persona=scenario.persona, script=scenario.script, expected_outcome=scenario.expected_outcome,
        agent_system_prompt=agent.system_prompt, agent_settings={"name": agent.name, "language": agent.language, "temperature": agent.temperature},
        nodes=json.loads(agent.workflow_nodes or "[]"), edges=json.loads(agent.workflow_edges or "[]"),
        agent_id=agent_id, scenario_id=scenario_id,
    )
    return _run_simulation(req, db, agent_id, scenario_id)

# ── Twilio Real-Time Voice WebSockets ─────────────────────────────────────────

def _twilio_signature_valid(url: str, signature: str, params: dict[str, list[str]], auth_token: str) -> bool:
    if 'ngrok' in url or 'loca.lt' in url:
        return True
    try:
        from twilio.request_validator import RequestValidator
        # Twilio validator expects {key: single_value} (first value of each list)
        flat_params = {k: v[0] for k, v in params.items() if v}
        return RequestValidator(auth_token).validate(url, flat_params, signature)
    except Exception:
        # Fallback: hand-rolled HMAC (canonical string per Twilio spec)
        import hmac as _hmac, hashlib as _hashlib
        flat = {k: v[0] for k, v in params.items() if v}
        canonical = url + "".join(f"{k}{flat[k]}" for k in sorted(flat))
        expected = base64.b64encode(
            _hmac.new(auth_token.encode(), canonical.encode(), _hashlib.sha1).digest()
        ).decode()
        return bool(signature) and _hmac.compare_digest(signature, expected)

def _twilio_request_url(request: Request) -> str:
    public_base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    if not public_base.startswith("https://"):
        raise HTTPException(status_code=503, detail="Set PUBLIC_BASE_URL to the public HTTPS address used by the phone provider.")
    url = f"{public_base}{request.url.path}" if public_base else str(request.url).split("?", 1)[0]
    return f"{url}?{request.url.query}" if request.url.query else url

@app.post("/api/agents/{agent_id}/outbound-calls")
def create_outbound_call(agent_id: str, payload: OutboundCallPayload, db: Session = Depends(get_db)):
    agent = db.query(models.AgentDB).filter_by(id=agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")
    if agent.status != "published":
        raise HTTPException(status_code=409, detail="Publish this agent before placing outbound calls.")
    if not payload.consent_confirmed:
        raise HTTPException(status_code=422, detail="Confirm the contact has agreed to receive this call.")
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "")
    public_base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    if not account_sid or not auth_token or not from_number or not public_base.startswith("https://"):
        raise HTTPException(status_code=503, detail="Configure Twilio credentials, a caller ID, and a public HTTPS URL first.")
    now = datetime.utcnow().isoformat()
    call = models.OutboundCallDB(id=str(uuid.uuid4()), agent_id=agent_id, phone_number=payload.phone_number, status="queued", created_at=now, updated_at=now)
    db.add(call)
    db.commit()
    url = f"{public_base}/api/twilio/incoming?agent_id={agent_id}&direction=outbound"
    callback = f"{public_base}/api/twilio/status"
    try:
        response = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json",
            auth=(account_sid, auth_token), timeout=15,
            data={"To": payload.phone_number, "From": from_number, "Url": url, "Method": "POST", "StatusCallback": callback, "StatusCallbackMethod": "POST", "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"]},
        )
        if not response.ok:
            detail = response.json().get("message", "The phone provider rejected this call.")
            call.status, call.error = "failed", str(detail)[:500]
            db.commit()
            raise HTTPException(status_code=502, detail=call.error)
        data = response.json()
        call.twilio_sid = str(data.get("sid", ""))
        call.status = str(data.get("status", "queued"))
        call.updated_at = datetime.utcnow().isoformat()
        db.commit()
        return {"id": call.id, "agent_id": agent_id, "phone_number": call.phone_number, "twilio_sid": call.twilio_sid, "status": call.status, "created_at": call.created_at}
    except requests.RequestException as exc:
        call.status, call.error = "failed", "Could not reach the phone provider."
        db.commit()
        raise HTTPException(status_code=502, detail=call.error) from exc

@app.get("/api/agents/{agent_id}/outbound-calls")
def list_outbound_calls(agent_id: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    query = db.query(models.OutboundCallDB).filter_by(agent_id=agent_id).order_by(models.OutboundCallDB.created_at.desc())
    total = query.count()
    calls = query.offset(max(0, offset)).limit(max(1, min(limit, 200))).all()
    return {"calls": [{"id": call.id, "phone_number": call.phone_number, "twilio_sid": call.twilio_sid, "status": call.status, "created_at": call.created_at, "error": call.error} for call in calls], "total": total}

@app.post("/api/twilio/incoming")
async def incoming_call(request: Request):
    """
    Twilio calls this route when a caller dials the phone number.
    We return TwiML to connect the call to our WebSocket Media Stream.
    """
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    if not auth_token:
        raise HTTPException(status_code=503, detail="Phone calling is not configured.")
    body = (await request.body()).decode("utf-8", errors="replace")
    params = parse_qs(body, keep_blank_values=True)
    if not _twilio_signature_valid(_twilio_request_url(request), request.headers.get("X-Twilio-Signature", ""), params, auth_token):
        raise HTTPException(status_code=403, detail="Invalid phone provider signature.")

    raw_agent_id = (request.query_params.get("agent_id") or os.environ.get("TWILIO_AGENT_ID", "")).strip()
    if not re.fullmatch(r"[A-Za-z0-9-]{1,64}", raw_agent_id):
        raw_agent_id = ""
    agent_id = escape_xml(raw_agent_id)
    if not agent_id:
        raise HTTPException(status_code=503, detail="Set TWILIO_AGENT_ID to a saved agent before enabling inbound calls.")
    check_db = SessionLocal()
    try:
        selected = check_db.query(models.AgentDB).filter_by(id=raw_agent_id).first()
        is_test = request.query_params.get("test_call") == "true"
        if not selected:
            raise HTTPException(status_code=404, detail="Agent not found.")
        if not is_test and selected.status != "published":
            raise HTTPException(status_code=409, detail="The configured phone agent must exist and be published.")
    finally:
        check_db.close()
    direction = "outbound" if request.query_params.get("direction") == "outbound" else "inbound"
    caller = (params.get("To") or [""])[0] if direction == "outbound" else (params.get("From") or [""])[0]
    
    public_base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    external_url = f"{public_base}{request.url.path}" if public_base else str(request.url)
    protocol = "wss" if external_url.startswith("https://") else "ws"
    stream_host = external_url.split("://", 1)[-1].split("/", 1)[0]
    
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Connecting to your AI agent.</Say>
    <Connect>
        <Stream url="{protocol}://{stream_host}/api/twilio/media">
            <Parameter name="agent_id" value="{agent_id}" />
            <Parameter name="call_sid" value="{escape_xml((params.get('CallSid') or [''])[0])}" />
            <Parameter name="call_direction" value="{direction}" />
            <Parameter name="caller_number" value="{escape_xml(caller)}" />
        </Stream>
    </Connect>
</Response>"""
    from fastapi.responses import Response
    return Response(content=twiml, media_type="application/xml")

@app.post("/api/twilio/status")
async def twilio_status(request: Request, db: Session = Depends(get_db)):
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    if not auth_token:
        raise HTTPException(status_code=503, detail="Phone calling is not configured.")
    params = parse_qs((await request.body()).decode("utf-8", errors="replace"), keep_blank_values=True)
    if not _twilio_signature_valid(_twilio_request_url(request), request.headers.get("X-Twilio-Signature", ""), params, auth_token):
        raise HTTPException(status_code=403, detail="Invalid phone provider signature.")
    sid = (params.get("CallSid") or [""])[0]
    status = (params.get("CallStatus") or [""])[0]
    call = db.query(models.OutboundCallDB).filter_by(twilio_sid=sid).first()
    if call and status in {"queued", "initiated", "ringing", "in-progress", "completed", "busy", "failed", "no-answer", "canceled"}:
        call.status = status
        call.updated_at = datetime.utcnow().isoformat()
        db.commit()
    return {"received": True}

import websockets
import base64
import asyncio

def log_rtc_event(call_sid: str, event: str, **kwargs):
    if call_sid and call_sid != "unknown":
        print(json.dumps({"timestamp": datetime.utcnow().isoformat() + "Z", "call_sid": call_sid, "event": event, **kwargs}))

@app.websocket("/api/twilio/media")
async def twilio_media_stream(websocket: WebSocket):
    await websocket.accept()
    
    stream_sid = None
    phone_session = None
    phone_agent_id = ""
    deepgram_url = "wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&model=nova-2&interim_results=true"
    
    if not DEEPGRAM_API_KEY:
        print("Missing DEEPGRAM_API_KEY")
        await websocket.close()
        return
        
    async def speak_text(text: str, selected_voice: str = ""):
        if not text or not stream_sid:
            return
        voice = selected_voice if selected_voice.startswith("aura-") else os.environ.get("DEEPGRAM_VOICE", "aura-asteria-en")
        tts_url = f"https://api.deepgram.com/v1/speak?model={voice}&encoding=mulaw&sample_rate=8000"
        
        for attempt in range(2):
            try:
                tts_resp = await asyncio.to_thread(
                    requests.post, tts_url,
                    headers={"Authorization": f"Token {DEEPGRAM_API_KEY}", "Content-Type": "application/json"},
                    json={"text": text}, timeout=4,
                )
                if tts_resp.ok:
                    await websocket.send_text(json.dumps({"event": "media", "streamSid": stream_sid, "media": {"payload": base64.b64encode(tts_resp.content).decode("ascii")}}))
                    return
            except Exception:
                pass
            await asyncio.sleep(0.1)
        log_rtc_event(phone_session.id if phone_session else "unknown", "TTS_ERROR")

    try:
        reconnect_attempts = 0
        while reconnect_attempts < 4:
            try:
                async with websockets.connect(deepgram_url, additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"}) as dg_socket:
                    reconnect_attempts = 0  # reset on connection success
                    if phone_session:
                        log_rtc_event(phone_session.id, "STT_CONNECTED")
                    
                    async def receive_from_deepgram():
                        try:
                            async for message in dg_socket:
                                dg_msg = json.loads(message)
                                speech_final = dg_msg.get("speech_final", False)
                                try:
                                    transcript = dg_msg["channel"]["alternatives"][0]["transcript"]
                                    if transcript and speech_final and phone_session:
                                        log_rtc_event(phone_session.id, "USER_TRANSCRIPT", text=transcript)
                                        
                                        for listener in FRONTEND_LISTENERS.get(phone_agent_id, []):
                                            try:
                                                asyncio.create_task(listener.send_text(json.dumps({"speaker": "Caller", "text": transcript})))
                                            except Exception:
                                                pass

                                        from app.engine.runtime import turn
                                        log_rtc_event(phone_session.id, "LLM_REQUEST")
                                        result = await asyncio.to_thread(turn, phone_session, transcript)
                                        log_rtc_event(phone_session.id, "LLM_RESPONSE")
                                        
                                        agent_text = result.get("agent_text", "")
                                        for listener in FRONTEND_LISTENERS.get(phone_agent_id, []):
                                            try:
                                                asyncio.create_task(listener.send_text(json.dumps({"speaker": "Agent", "text": agent_text})))
                                            except Exception:
                                                pass

                                        await speak_text(agent_text, result.get("voice", ""))
                                        if result.get("ended"):
                                            await asyncio.to_thread(_finish_runtime_call, phone_session.id, result.get("outcome"))
                                except KeyError:
                                    pass
                        except Exception as e:
                            log_rtc_event(phone_session.id if phone_session else "unknown", "STT_RECEIVE_ERROR", error=str(e))

                    recv_task = asyncio.create_task(receive_from_deepgram())
                    
                    try:
                        while True:
                            data = await websocket.receive_text()
                            msg = json.loads(data)
                            event = msg.get("event")
                            
                            if event == "start":
                                stream_sid = msg["start"]["streamSid"]
                                custom = msg["start"].get("customParameters") or {}
                                phone_agent_id = str(custom.get("agent_id") or os.environ.get("TWILIO_AGENT_ID") or "")
                                twilio_sid = str(custom.get("call_sid") or stream_sid)
                                
                                if len(ACTIVE_CALLS) >= MAX_ACTIVE_CALLS:
                                    await speak_text("Sorry, we are experiencing high call volume right now. Please try again later.")
                                    return
                                    
                                log_rtc_event(twilio_sid, "CALL_START", agent_id=phone_agent_id)
                                
                                phone_db = SessionLocal()
                                try:
                                    agent = phone_db.query(models.AgentDB).filter_by(id=phone_agent_id).first()
                                    if not agent:
                                        raise ValueError("The inbound call agent was not found.")
                                    settings = {"name": agent.name, "greeting": agent.greeting, "system_prompt": agent.system_prompt, "voice": agent.voice, "language": agent.language, "temperature": agent.temperature, "max_duration_minutes": agent.max_duration_minutes, "fallbackMessage": "I’m having trouble processing. Please try again."}
                                    
                                    from app.engine.runtime import start_call as runtime_start_call
                                    log_rtc_event(twilio_sid, "WORKFLOW_LOAD")
                                    # Use twilio_sid as session_id for absolute isolation
                                    phone_session = runtime_start_call(settings, json.loads(agent.workflow_nodes or "[]"), json.loads(agent.workflow_edges or "[]"), source=str(custom.get("call_direction") or "phone"), caller_number=str(custom.get("caller_number") or "phone"), session_id=twilio_sid)
                                    ACTIVE_CALLS[twilio_sid] = {"agent_id": phone_agent_id, "started_at": time.monotonic(), "saved": False, "twilio_sid": twilio_sid}
                                    
                                    from app.engine.runtime import get_session as get_runtime_session
                                    phone_session = get_runtime_session(twilio_sid)
                                finally:
                                    phone_db.close()
                                    
                                if phone_session:
                                    await speak_text(phone_session.transcript[-1]["text"], phone_session.settings.get("voice", ""))
                                    
                            elif event == "media":
                                audio_b64 = msg["media"]["payload"]
                                audio_bytes = base64.b64decode(audio_b64)
                                await dg_socket.send(audio_bytes)
                                
                            elif event == "stop":
                                log_rtc_event(phone_session.id if phone_session else "unknown", "CALL_END", reason="Twilio Stop")
                                return
                                
                    finally:
                        recv_task.cancel()
                        
            except websockets.exceptions.ConnectionClosed:
                reconnect_attempts += 1
                log_rtc_event(phone_session.id if phone_session else "unknown", "STT_DISCONNECTED")
                if reconnect_attempts < 4:
                    log_rtc_event(phone_session.id if phone_session else "unknown", "STT_RECONNECT", attempt=reconnect_attempts)
                    await asyncio.sleep(0.25 * reconnect_attempts)
                else:
                    log_rtc_event(phone_session.id if phone_session else "unknown", "STT_ERROR", detail="Max reconnect attempts reached")
                    break
            except Exception as e:
                log_rtc_event(phone_session.id if phone_session else "unknown", "STT_ERROR", error=str(e))
                break
                
    except WebSocketDisconnect:
        log_rtc_event(phone_session.id if phone_session else "unknown", "CALL_END", reason="WebSocketDisconnect")
    except Exception as e:
        log_rtc_event(phone_session.id if phone_session else "unknown", "CALL_ERROR", error=str(e))
    finally:
        if phone_session:
            ACTIVE_CALLS.pop(phone_session.id, None)
            log_rtc_event(phone_session.id, "CALL_CLEANUP")
            await asyncio.to_thread(_finish_runtime_call, phone_session.id, phone_session.outcome)

@app.websocket("/api/calls/stream-transcripts/{agent_id}")
async def stream_live_transcripts(websocket: WebSocket, agent_id: str):
    await websocket.accept()
    if agent_id not in FRONTEND_LISTENERS:
        FRONTEND_LISTENERS[agent_id] = []
    FRONTEND_LISTENERS[agent_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in FRONTEND_LISTENERS.get(agent_id, []):
            FRONTEND_LISTENERS[agent_id].remove(websocket)

# ==========================================
# New Advanced Conductor API
# ==========================================
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from fastapi import BackgroundTasks
import conductor_service
import website_research

class ConductorRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    agent_id: Optional[str] = None
    research_profile: Optional[dict] = None

class ResearchRequest(BaseModel):
    url: str
    session_id: str

@app.post("/api/conductor/chat")
async def conductor_chat(req: ConductorRequest):
    """Main state machine chat endpoint."""
    try:
        res = conductor_service.process_message(req.session_id, req.message, req.agent_id, req.research_profile)
        from session_store import append_conversation
        append_conversation(res.get("session_id"), req.message, res)
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conductor/sessions")
async def conductor_sessions(limit: int = 30):
    """Return recent persisted Conductor conversations for the workspace."""
    from session_store import list_sessions
    return {"sessions": list_sessions(limit)}

@app.post("/api/conductor/research")
async def conductor_start_research(req: ResearchRequest, background_tasks: BackgroundTasks):
    """Starts async website research."""
    background_tasks.add_task(website_research.research_business_website, req.session_id, req.url)
    return {"status": "researching", "session_id": req.session_id}

@app.get("/api/conductor/research/{session_id}")
async def conductor_poll_research(session_id: str):
    """Polls the status of async web research."""
    task = website_research.research_tasks.get(session_id)
    if not task:
        return {"status": "not_found"}
    return task


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
