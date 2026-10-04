"""
SQLite-backed session store for Conductor AI.
Survives FastAPI restarts. Safe for single-worker local dev.
"""
import json
import sqlite3
import uuid
import time
import os
from typing import Optional

def _database_path() -> str:
    try:
        from app.config import DATABASE_URL
        if DATABASE_URL.startswith("sqlite:///"):
            raw_path = DATABASE_URL.removeprefix("sqlite:///")
            if raw_path and raw_path != ":memory:":
                return os.path.abspath(raw_path.replace("/", os.sep))
    except Exception:
        pass
    return os.path.join(os.path.dirname(__file__), "conductor_sessions.db")


DB_PATH = _database_path()

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id   TEXT PRIMARY KEY,
    stage        TEXT NOT NULL DEFAULT 'UNDERSTAND',
    business_profile TEXT,
    answers      TEXT,
    workflow_draft TEXT,
    prev_workflow  TEXT,
    messages_json TEXT,
    agent_id TEXT,
    created_at   REAL,
    updated_at   REAL
)
"""

def _conn():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with _conn() as c:
        c.execute(SCHEMA)
        columns = {row[1] for row in c.execute("PRAGMA table_info(sessions)").fetchall()}
        for column, definition in (("messages_json", "TEXT"), ("agent_id", "TEXT")):
            if column not in columns:
                c.execute(f"ALTER TABLE sessions ADD COLUMN {column} {definition}")
    old_path = os.path.join(os.path.dirname(__file__), "conductor_sessions.db")
    if os.path.abspath(old_path) != os.path.abspath(DB_PATH) and os.path.exists(old_path):
        try:
            with sqlite3.connect(old_path) as old_db:
                old_db.row_factory = sqlite3.Row
                old_rows = old_db.execute("SELECT * FROM sessions").fetchall()
            if old_rows:
                fields = ("session_id", "stage", "business_profile", "answers", "workflow_draft", "prev_workflow", "messages_json", "agent_id", "created_at", "updated_at")
                with _conn() as target:
                    target_fields = {row[1] for row in target.execute("PRAGMA table_info(sessions)")}
                    old_fields = set(old_rows[0].keys())
                    fields = tuple(field for field in fields if field in target_fields and field in old_fields)
                    marks = ", ".join("?" for _ in fields)
                    target.executemany(
                        f"INSERT OR IGNORE INTO sessions ({', '.join(fields)}) VALUES ({marks})",
                        [[row[field] for field in fields] for row in old_rows],
                    )
        except sqlite3.Error:
            pass

init_db()


def create_session() -> str:
    sid = str(uuid.uuid4())
    now = time.time()
    with _conn() as c:
        c.execute(
            "INSERT INTO sessions(session_id, stage, answers, created_at, updated_at) VALUES (?,?,?,?,?)",
            (sid, "UNDERSTAND", json.dumps({}), now, now)
        )
    return sid


def get_session(session_id: str) -> Optional[dict]:
    with _conn() as c:
        row = c.execute("SELECT * FROM sessions WHERE session_id=?", (session_id,)).fetchone()
    if not row:
        return None
    return {
        "session_id": row["session_id"],
        "stage": row["stage"],
        "business_profile": json.loads(row["business_profile"]) if row["business_profile"] else None,
        "answers": json.loads(row["answers"]) if row["answers"] else {},
        "workflow_draft": json.loads(row["workflow_draft"]) if row["workflow_draft"] else None,
        "prev_workflow": json.loads(row["prev_workflow"]) if row["prev_workflow"] else None,
        "agent_id": row["agent_id"] if "agent_id" in row.keys() else None,
    }


def update_session(session_id: str, **kwargs):
    """Update one or more session fields. JSON-encode dicts automatically."""
    allowed = {"stage", "business_profile", "answers", "workflow_draft", "prev_workflow", "agent_id"}
    unexpected = set(kwargs) - allowed
    if unexpected:
        raise ValueError(f"Unsupported session fields: {', '.join(sorted(unexpected))}")
    now = time.time()
    fields = []
    values = []
    for k, v in kwargs.items():
        fields.append(f"{k}=?")
        values.append(json.dumps(v) if isinstance(v, (dict, list)) else v)
    values.extend([now, session_id])
    sql = f"UPDATE sessions SET {', '.join(fields)}, updated_at=? WHERE session_id=?"
    with _conn() as c:
        c.execute(sql, values)


def append_conversation(session_id: str, user_message: str, result: dict):
    """Persist visible chat messages so planning history survives browser changes."""
    if not session_id:
        return
    with _conn() as c:
        row = c.execute("SELECT messages_json FROM sessions WHERE session_id=?", (session_id,)).fetchone()
        if not row:
            return
        try:
            messages = json.loads(row["messages_json"] or "[]")
            if not isinstance(messages, list):
                messages = []
        except (TypeError, json.JSONDecodeError):
            messages = []

        if user_message and not user_message.startswith("__") and user_message != "Research complete. Continue to next step.":
            messages.append({"id": str(uuid.uuid4()), "role": "user", "content": user_message})
        assistant = {
            "id": str(uuid.uuid4()),
            "role": "assistant",
            "content": str(result.get("reply") or ""),
        }
        if result.get("suggestions"):
            assistant["suggestions"] = result["suggestions"]
        if result.get("agent_plan") or result.get("agentPlan"):
            assistant["agentPlan"] = result.get("agent_plan") or result.get("agentPlan")
        if result.get("agent_created"):
            created = result["agent_created"]
            assistant["agentCreated"] = {
                "agentId": created.get("agent_id") or created.get("agentId"),
                "name": created.get("name") or "Voice agent",
                "description": created.get("description") or "",
                "test_results": created.get("test_results"),
            }
        messages.append(assistant)
        messages = messages[-80:]
        c.execute(
            "UPDATE sessions SET messages_json=?, agent_id=COALESCE(?, agent_id), updated_at=? WHERE session_id=?",
            (json.dumps(messages, ensure_ascii=False), (result.get("agent_created") or {}).get("agent_id"), time.time(), session_id),
        )


def list_sessions(limit: int = 30) -> list[dict]:
    safe_limit = max(1, min(int(limit), 100))
    with _conn() as c:
        rows = c.execute(
            "SELECT session_id, stage, messages_json, agent_id, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?",
            (safe_limit,),
        ).fetchall()
    result = []
    for row in rows:
        try:
            messages = json.loads(row["messages_json"] or "[]")
            if not isinstance(messages, list):
                messages = []
        except (TypeError, json.JSONDecodeError):
            messages = []
        if not messages:
            continue
        first_user = next((m for m in messages if isinstance(m, dict) and m.get("role") == "user"), {})
        result.append({
            "id": row["session_id"],
            "sessionId": row["session_id"],
            "title": str(first_user.get("content") or "New agent conversation")[:52],
            "stage": row["stage"],
            "agentId": row["agent_id"],
            "ts": int((row["updated_at"] or row["created_at"] or time.time()) * 1000),
            "messages": messages,
        })
    return result


def delete_session(session_id: str):
    with _conn() as c:
        c.execute("DELETE FROM sessions WHERE session_id=?", (session_id,))
