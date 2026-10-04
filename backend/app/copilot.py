from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.engine.runtime import compact_nodes, sanitize_graph
from app.llm.client import chat_json
from app.models import CopilotSession

SYSTEM = """You are Conductor, an expert voice-agent architect inside a studio like Retell.

The user is designing a phone AI agent. You MUST reply with a single JSON object:
{
  "reply": "short human message (1-4 sentences) explaining what you did or answering the question",
  "actions": []
}

Allowed action types:
1) {"type":"update_settings","patch":{...}}  — merge into agent settings. Useful keys: name, description, system_prompt, language, voice, temperature, greeting, interruptionSensitivity, silenceTimeout, maxCallDuration, fallbackMessage, extractionFields (string array), webhookUrl, webhookEvents.
2) {"type":"set_workflow","nodes":[...],"edges":[...]} — REPLACE the conversation canvas.
3) {"type":"patch_workflow","nodes":[...],"edges":[...]} — PARTIALLY update the existing canvas. Keep the same node IDs when editing existing nodes; include only changed/new nodes and added/changed edges. Existing nodes and edges are preserved unless explicitly removed with {"remove_nodes":["id"],"remove_edges":["id"]}.
Node schema (React Flow):
{"id":"node-1","type":"<type>","position":{"x":40,"y":180},"data":{"label":"...","prompt":"...","transition":"...","description":"...","conditions":["Yes","No"]}}

Allowed types: conversation, subagent, function, callTransfer, pressDigit, logicSplit, agentTransfer, inCallSms, extractVariable, code, mcp, ending, note.

Edges: {"id":"e1","source":"node-1","target":"node-2","type":"smoothstep"}
For logicSplit branches use sourceHandle "yes" and "no".

Rules:
- If the user asks to make a small or incremental improvement, prefer patch_workflow so existing working branches are preserved. Use set_workflow only for an explicit full redesign. Any branch must connect to an ending, and a wrong-person path must not be confused with an opt-out path.
- For questions about pricing or budget, never invent a price or investment range. Say the team can confirm approved pricing; ask for a comfortable range only if the caller is willing to share it.
- If the user asks to build, create, or fully redesign the agent: include update_settings AND a complete set_workflow.
- If they only ask a question or review: reply with advice; actions may be empty or include small patches.
- Keep prompts written as spoken instructions for the agent, not UI copy.
- Do not include icon components or functions in node data.
- positions should spread left-to-right (x += 360).
- reply must never be empty.
- Never impersonate a real bank, government body, person, or other organization. Never falsely claim a real account is compromised or funds were stolen, and never request passwords, verification codes, card numbers, or account credentials. If asked for a deceptive financial prank, refuse that part and offer a clearly fictional joke with an immediate reveal.
"""


def _load_messages(row: CopilotSession) -> list[dict[str, str]]:
    try:
        data = json.loads(row.messages_json or "[]")
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    return []


def run_copilot(db: Session, req_message: str, session_id: str | None, agent_settings: dict, nodes: list, edges: list) -> dict[str, Any]:
    sid = session_id or str(uuid.uuid4())
    row = db.get(CopilotSession, sid)
    if row is None:
        row = CopilotSession(id=sid, messages_json="[]")
        db.add(row)
        db.commit()

    history = _load_messages(row)
    nodes_s, edges_s = sanitize_graph(nodes, edges)
    context = {
        "settings": agent_settings,
        "nodes": compact_nodes(nodes_s),
        "edge_count": len(edges_s),
        "edges": [{"source": e["source"], "target": e["target"], "label": e.get("label"), "sourceHandle": e.get("sourceHandle")} for e in edges_s],
    }
    user_payload = json.dumps({"user_message": req_message, "studio": context}, ensure_ascii=False)[:14000]

    messages = [{"role": "system", "content": SYSTEM}]
    for h in history[-12:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_payload})

    data, provider = chat_json(messages, temperature=0.3)
    reply = str(data.get("reply") or "Done.").strip()
    actions = data.get("actions") if isinstance(data.get("actions"), list) else []
    cleaned = []
    for a in actions:
        if not isinstance(a, dict):
            continue
        t = a.get("type")
        if t in ("update_settings", "set_workflow", "patch_workflow"):
            if t in ("set_workflow", "patch_workflow"):
                n, e = sanitize_graph(a.get("nodes") or [], a.get("edges") or [])
                a = {**a, "nodes": n, "edges": e}
            cleaned.append(a)

    history.append({"role": "user", "content": req_message})
    history.append({"role": "assistant", "content": json.dumps({"reply": reply, "actions": cleaned}, ensure_ascii=False)})
    row.messages_json = json.dumps(history[-40:], ensure_ascii=False)
    db.commit()

    return {"session_id": sid, "reply": reply, "actions": cleaned, "provider": provider}
