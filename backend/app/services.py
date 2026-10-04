from __future__ import annotations

import json
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import CallRecord, KnowledgeChunk


def retrieve_knowledge(db: Session, agent_id: str, query: str, extra: list[str] | None = None, limit: int = 6) -> list[str]:
    chunks: list[str] = list(extra or [])
    q = (query or "").lower()
    rows = db.query(KnowledgeChunk).all() if not agent_id else db.query(KnowledgeChunk).filter(
        (KnowledgeChunk.agent_id == agent_id) | (KnowledgeChunk.agent_id == "")
    ).all()

    scored: list[tuple[int, str]] = []
    words = [w for w in q.replace("\n", " ").split() if len(w) > 2]
    for row in rows:
        blob = f"{row.title} {row.text}".lower()
        score = sum(1 for w in words if w in blob) if words else 1
        if score or not words:
            scored.append((score, f"{row.title}: {row.text}" if row.title else row.text))
    scored.sort(key=lambda x: x[0], reverse=True)
    for _, text in scored[:limit]:
        if text not in chunks:
            chunks.append(text)
    return chunks[:limit]


def persist_call(
    db: Session,
    *,
    agent_id: str = "",
    source: str,
    caller_number: str,
    duration_seconds: int,
    outcome: str,
    sentiment: str,
    summary: str,
    transcript: list,
    twilio_sid: str = "",
    call_id: str | None = None,
) -> CallRecord:
    rec = CallRecord(
        id=call_id or str(uuid.uuid4()),
        agent_id=agent_id,
        source=source,
        caller_number=caller_number,
        duration_seconds=duration_seconds,
        outcome=outcome or "unknown",
        sentiment=sentiment or "neutral",
        summary=summary or "",
        transcript_json=json.dumps(transcript or [], ensure_ascii=False),
        twilio_sid=twilio_sid,
        created_at=datetime.utcnow(),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec


def call_to_dict(rec: CallRecord) -> dict:
    try:
        transcript = json.loads(rec.transcript_json or "[]")
    except json.JSONDecodeError:
        transcript = []
    created = rec.created_at or datetime.utcnow()
    mins, secs = divmod(rec.duration_seconds or 0, 60)
    return {
        "id": rec.id,
        "date": created.strftime("%Y-%m-%d"),
        "time": created.strftime("%I:%M %p").lstrip("0"),
        "persona": rec.source,
        "phone": rec.caller_number or "—",
        "duration": f"{mins}m {secs:02d}s",
        "outcome": rec.outcome if rec.outcome in ("qualified", "callback", "not-a-fit", "voicemail") else "callback",
        "sentiment": rec.sentiment if rec.sentiment in ("positive", "neutral", "negative") else "neutral",
        "summary": rec.summary,
        "transcript": transcript,
        "source": rec.source,
        "twilio_sid": rec.twilio_sid,
    }
