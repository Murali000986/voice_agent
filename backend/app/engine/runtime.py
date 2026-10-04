from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.llm.client import chat, chat_json


ALLOWED_NODE_TYPES = {
    "conversation",
    "subagent",
    "function",
    "callTransfer",
    "pressDigit",
    "logicSplit",
    "agentTransfer",
    "inCallSms",
    "extractVariable",
    "code",
    "mcp",
    "ending",
    "note",
}


def sanitize_graph(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> tuple[list[dict], list[dict]]:
    clean_nodes = []
    for i, n in enumerate(nodes or []):
        nid = str(n.get("id") or f"node-{i+1}")
        ntype = str(n.get("type") or "conversation")
        if ntype not in ALLOWED_NODE_TYPES:
            ntype = "conversation"
        pos = n.get("position") or {"x": 80 + i * 280, "y": 160}
        data = n.get("data") if isinstance(n.get("data"), dict) else {}
        data = {k: v for k, v in data.items() if k != "icon" and not callable(v)}
        if "label" not in data:
            data["label"] = ntype
        clean_nodes.append({"id": nid, "type": ntype, "position": pos, "data": data})

    ids = {n["id"] for n in clean_nodes}
    clean_edges = []
    for i, e in enumerate(edges or []):
        src, tgt = e.get("source"), e.get("target")
        if src not in ids or tgt not in ids:
            continue
        clean_edges.append(
            {
                "id": str(e.get("id") or f"edge-{i+1}"),
                "source": src,
                "target": tgt,
                "type": e.get("type") or "smoothstep",
                "sourceHandle": e.get("sourceHandle"),
                "targetHandle": e.get("targetHandle"),
                "label": e.get("label") or "",
            }
        )
    return clean_nodes, clean_edges


def compact_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for n in nodes:
        data = n.get("data") or {}
        out.append(
            {
                "id": n.get("id"),
                "type": n.get("type"),
                "label": data.get("label"),
                "prompt": (data.get("prompt") or "")[:800],
                "transition": (data.get("transition") or "")[:400],
                "description": (data.get("description") or "")[:400],
                "conditions": data.get("conditions"),
            }
        )
    return out


def _node_map(nodes: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {n["id"]: n for n in nodes}


def _outgoing(edges: list[dict[str, Any]], node_id: str) -> list[dict[str, Any]]:
    return [e for e in edges if e.get("source") == node_id]


def start_node_id(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> str | None:
    if not nodes:
        return None
    targets = {e.get("target") for e in edges}
    for n in nodes:
        if n["id"] not in targets:
            return n["id"]
    return nodes[0]["id"]


def knowledge_block(chunks: list[str]) -> str:
    if not chunks:
        return ""
    joined = "\n---\n".join(chunks[:8])
    return f"\nKnowledge base (use only if relevant):\n{joined}\n"


@dataclass
class CallSession:
    id: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    settings: dict[str, Any]
    knowledge: list[str]
    current_node_id: str | None
    transcript: list[dict[str, str]] = field(default_factory=list)
    ended: bool = False
    outcome: str = "unknown"
    source: str = "browser"
    caller_number: str = ""
    started_monotonic: float = field(default_factory=time.monotonic)


SESSIONS: dict[str, CallSession] = {}


def create_session(
    settings: dict[str, Any],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    knowledge: list[str] | None = None,
    source: str = "browser",
    caller_number: str = "",
    session_id: str | None = None,
) -> CallSession:
    nodes, edges = sanitize_graph(nodes, edges)
    sid = session_id or str(uuid.uuid4())
    nid = start_node_id(nodes, edges)
    sess = CallSession(
        id=sid,
        nodes=nodes,
        edges=edges,
        settings=settings or {},
        knowledge=knowledge or [],
        current_node_id=nid,
        source=source,
        caller_number=caller_number,
    )
    SESSIONS[sid] = sess
    return sess


def get_session(session_id: str) -> CallSession | None:
    return SESSIONS.get(session_id)


def greeting_text(sess: CallSession) -> str:
    g = (sess.settings.get("greeting") or "").strip()
    if g:
        return g
    name = sess.settings.get("name") or "the assistant"
    return f"Hi, this is {name}. How can I help you today?"


def node_voice(sess: CallSession, node_id: str | None = None) -> str:
    node = _node_map(sess.nodes).get(node_id or sess.current_node_id or "") or {}
    data = node.get("data") or {}
    return str(data.get("voice") or sess.settings.get("voice") or "")


def _history(sess: CallSession) -> str:
    lines = []
    for t in sess.transcript[-16:]:
        lines.append(f"{t.get('speaker')}: {t.get('text')}")
    return "\n".join(lines)


def _advance(sess: CallSession, choice: str | None = None) -> None:
    if not sess.current_node_id:
        sess.ended = True
        return
    outs = _outgoing(sess.edges, sess.current_node_id)
    if not outs:
        node = _node_map(sess.nodes).get(sess.current_node_id) or {}
        if node.get("type") == "ending":
            sess.ended = True
        return
    if len(outs) == 1:
        sess.current_node_id = outs[0]["target"]
        return
    node = _node_map(sess.nodes).get(sess.current_node_id) or {}
    if node.get("type") == "logicSplit":
        normalized = str(choice or "").strip().lower()
        aliases = {"yes": {"yes", "true", "qualified", "fit", "positive", "1"}, "no": {"no", "false", "not qualified", "not-a-fit", "negative", "0"}}
        branch = "yes" if normalized in aliases["yes"] else "no" if normalized in aliases["no"] else None
        if branch is None:
            return
        for edge in outs:
            handle = str(edge.get("sourceHandle") or edge.get("label") or "").strip().lower()
            if handle == branch or (branch == "yes" and handle in ("true", "1")) or (branch == "no" and handle in ("false", "0")):
                sess.current_node_id = edge["target"]
                return
        # Do not silently send a caller down the wrong branch when the graph is incomplete.
        return
    sess.current_node_id = outs[0]["target"]


def _maybe_end(sess: CallSession) -> None:
    node = _node_map(sess.nodes).get(sess.current_node_id or "")
    if not node:
        sess.ended = True
        return
    if node.get("type") == "ending" and len(_outgoing(sess.edges, node["id"])) == 0:
        # stay so we can still speak the ending once
        pass


def turn(sess: CallSession, user_text: str) -> dict[str, Any]:
    if sess.ended:
        return {
            "session_id": sess.id,
            "agent_text": sess.settings.get("fallbackMessage") or "This call has already ended.",
            "ended": True,
            "outcome": sess.outcome,
            "node_id": sess.current_node_id,
            "transcript": sess.transcript,
        }

    max_minutes = sess.settings.get("max_duration_minutes") or sess.settings.get("maxCallDuration") or 0
    try:
        max_seconds = max(0, float(max_minutes) * 60)
    except (TypeError, ValueError):
        max_seconds = 0
    if max_seconds and time.monotonic() - sess.started_monotonic >= max_seconds:
        sess.ended = True
        sess.outcome = "callback"
        closing = "We’ve reached the time limit for this call. Thank you for speaking with me. Goodbye."
        sess.transcript.append({"speaker": "Agent", "text": closing, "ts": ""})
        return {"session_id": sess.id, "agent_text": closing, "ended": True, "outcome": sess.outcome, "node_id": sess.current_node_id, "voice": node_voice(sess), "transcript": sess.transcript}

    if user_text.strip():
        sess.transcript.append({"speaker": "Caller", "text": user_text.strip(), "ts": ""})

    node = _node_map(sess.nodes).get(sess.current_node_id or "")
    if not node:
        sess.ended = True
        sess.outcome = "unknown"
        return {
            "session_id": sess.id,
            "agent_text": "Thanks for your time. Goodbye.",
            "ended": True,
            "outcome": sess.outcome,
            "node_id": None,
            "transcript": sess.transcript,
        }

    data = node.get("data") or {}
    ntype = node.get("type")
    response_voice = node_voice(sess, node.get("id"))
    kb = knowledge_block(sess.knowledge)
    settings_blob = json.dumps(
        {
            "name": sess.settings.get("name"),
            "language": sess.settings.get("language"),
            "greeting": sess.settings.get("greeting"),
            "fallback": sess.settings.get("fallbackMessage"),
        },
        ensure_ascii=False,
    )

    prompt = f"""You are a live voice agent on a phone call. Stay in character. Keep replies to 1-3 spoken sentences.
CRITICAL: You must ALWAYS speak in {sess.settings.get('language') or 'English'}. If the user speaks in another language, firmly switch back to {sess.settings.get('language') or 'English'} or answer them in {sess.settings.get('language') or 'English'}.

Agent settings: {settings_blob}
Agent instructions: {(sess.settings.get('system_prompt') or '').strip()[:6000]}
Current node type: {ntype}
Node label: {data.get('label')}
Node prompt: {data.get('prompt') or data.get('description') or ''}
Transition when: {data.get('transition') or "the caller answered the node's question"}
{kb}

Transcript:
{_history(sess)}

Return JSON:
{{
  "agent_text": "what the agent says now",
  "transition_met": true or false,
  "branch": "yes" or "no" or null,
  "end_call": true or false,
  "outcome": "qualified" | "callback" | "not-a-fit" | "voicemail" | "unknown"
}}
If node type is function, code, mcp, or extractVariable: briefly acknowledge and continue (do not invent CRM facts).
If node type is ending: wrap up and set end_call true with a fitting outcome.
If node type is logicSplit: set branch yes/no based on the conversation vs node description.
Never mention JSON, nodes, or that you are an AI model.
"""

    try:
        payload, _ = chat_json(
            [
                {"role": "system", "content": "You output only JSON for a voice agent turn."},
                {"role": "user", "content": prompt},
            ],
            temperature=float(sess.settings.get("temperature") if sess.settings.get("temperature") is not None else 0.4),
            max_tokens=384,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        if user_text.strip() and sess.transcript and sess.transcript[-1].get("speaker") == "Caller":
            # pop the caller turn so they can try saying it again safely
            sess.transcript.pop()
        payload = {"agent_text": sess.settings.get("fallbackMessage") or "I am having a little trouble connecting. One moment please."}

    agent_text = str(payload.get("agent_text") or "").strip() or "Could you say that again?"
    sess.transcript.append({"speaker": "Agent", "text": agent_text, "ts": ""})

    end_call = bool(payload.get("end_call"))
    if ntype == "ending":
        end_call = True

    if payload.get("transition_met") or ntype in ("function", "code", "mcp", "extractVariable", "inCallSms", "pressDigit"):
        _advance(sess, str(payload.get("branch") or "yes"))
        nxt = _node_map(sess.nodes).get(sess.current_node_id or "")
        if nxt and nxt.get("type") == "ending" and payload.get("transition_met"):
            pass

    if end_call:
        sess.ended = True
        sess.outcome = str(payload.get("outcome") or "unknown")

    _maybe_end(sess)
    return {
        "session_id": sess.id,
        "agent_text": agent_text,
        "ended": sess.ended,
        "outcome": sess.outcome,
        "node_id": sess.current_node_id,
        "voice": response_voice,
        "transcript": sess.transcript,
    }


def start_call(
    settings: dict[str, Any],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    knowledge: list[str] | None = None,
    source: str = "browser",
    caller_number: str = "",
    session_id: str | None = None,
) -> dict[str, Any]:
    sess = create_session(settings, nodes, edges, knowledge, source, caller_number, session_id)
    text = greeting_text(sess)
    sess.transcript.append({"speaker": "Agent", "text": text, "ts": "0:00"})
    return {
        "session_id": sess.id,
        "agent_text": text,
        "ended": False,
        "outcome": "unknown",
        "node_id": sess.current_node_id,
        "voice": node_voice(sess),
        "transcript": sess.transcript,
    }


def simulate_dialog(
    persona: str,
    script: str,
    expected_outcome: str,
    settings: dict[str, Any],
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    knowledge: list[str] | None = None,
    max_turns: int = 8,
) -> dict[str, Any]:
    sess = create_session(settings, nodes, edges, knowledge, source="simulation")
    greeting = greeting_text(sess)
    sess.transcript.append({"speaker": "Agent", "text": greeting, "ts": "0:00"})

    caller_so_far = ""
    for i in range(max_turns):
        if sess.ended:
            break
        caller_prompt = f"""You are a test caller.
Persona: {persona}
Script / goals: {script}
What the agent just said: {sess.transcript[-1]['text'] if sess.transcript else ''}
Prior caller lines: {caller_so_far}

Return JSON {{ "caller_text": "...", "hang_up": false }}
Speak naturally in 1-2 sentences. Follow the persona. Do not be the agent.
"""
        cjson, _ = chat_json(
            [
                {"role": "system", "content": "Output JSON only."},
                {"role": "user", "content": caller_prompt},
            ],
            temperature=0.7,
        )
        caller_text = str(cjson.get("caller_text") or "").strip()
        if not caller_text:
            break
        caller_so_far += caller_text + " "
        result = turn(sess, caller_text)
        if result["ended"] or cjson.get("hang_up"):
            if cjson.get("hang_up"):
                sess.ended = True
            break

    judge_prompt = f"""Judge this simulated voice call.
Expected outcome: {expected_outcome or 'reasonable professional handling'}
Transcript:
{_history(sess)}
Final engine outcome: {sess.outcome}

Return JSON {{ "passed": true or false, "reason": "one sentence" }}
"""
    verdict, _ = chat_json(
        [
            {"role": "system", "content": "Output JSON only."},
            {"role": "user", "content": judge_prompt},
        ],
        temperature=0,
    )
    passed = bool(verdict.get("passed"))
    turns = []
    for idx, t in enumerate(sess.transcript):
        turns.append(
            {
                "id": str(idx + 1),
                "speaker": t["speaker"],
                "text": t["text"],
                "ts": f"0:{idx * 8:02d}",
            }
        )
    return {
        "status": "passed" if passed else "failed",
        "passed": passed,
        "reason": verdict.get("reason") or "",
        "outcome": sess.outcome,
        "turns": turns,
        "session_id": sess.id,
    }


def summarize_sentiment(transcript: list[dict[str, str]]) -> tuple[str, str]:
    blob = "\n".join(f"{t.get('speaker')}: {t.get('text')}" for t in transcript[-20:])
    if not blob.strip():
        return "neutral", ""
    try:
        data, _ = chat_json(
            [
                {"role": "system", "content": "Output JSON only."},
                {
                    "role": "user",
                    "content": f"Summarize this call in one sentence and sentiment.\n{blob}\nJSON: {{ \"summary\": \"...\", \"sentiment\": \"positive\"|\"neutral\"|\"negative\" }}",
                },
            ],
            temperature=0,
        )
        sent = str(data.get("sentiment") or "neutral")
        if sent not in ("positive", "neutral", "negative"):
            sent = "neutral"
        return sent, str(data.get("summary") or "")
    except Exception:
        return "neutral", ""
