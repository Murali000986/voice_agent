"""
Adaptive discovery question engine using Groq.
Maintains a structured JSON understanding of the business profile.
Evaluates completeness deterministically.
"""
import json
import os
import re
from groq import Groq

GROQ_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_CLIENT = Groq(api_key=GROQ_KEY) if GROQ_KEY else None
MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")

# Required fields for a generic agent
ESSENTIAL_FIELDS = [
    "business_objective",
    "agent_purpose",
    "target_audience",
    "call_direction"
]

def check_completeness(profile: dict) -> dict:
    """
    Deterministic completeness check.
    Returns:
    {
      "is_complete": bool,
      "missing_fields": list[str]
    }
    """
    missing = []
    for field in ESSENTIAL_FIELDS:
        if not profile.get(field):
            missing.append(field)
            
    # Conditional checks
    if "book" in str(profile.get("business_objective", "")).lower() or "appointment" in str(profile.get("business_objective", "")).lower():
        if not profile.get("calendar_system"):
            missing.append("calendar_system")
            
    if "inbound" in str(profile.get("call_direction", "")).lower():
        if not profile.get("inbound_routing"):
            missing.append("inbound_routing (How callers arrive and what they need)")
            
    if "outbound" in str(profile.get("call_direction", "")).lower():
        if not profile.get("lead_source"):
            missing.append("lead_source (Where leads come from)")
            
    if "lead" in str(profile.get("business_objective", "")).lower():
        if not profile.get("qualification_criteria"):
            missing.append("qualification_criteria")

    # Only mark complete if nothing essential is missing
    is_complete = len(missing) == 0
    return {
        "is_complete": is_complete,
        "missing_fields": missing
    }

def run_adaptive_discovery(session_profiles: dict, message: str, chat_history: list = None) -> dict:
    """
    Process the user message to update the profile and generate the next question.
    """
    if chat_history is None:
        chat_history = []
        
    validation = check_completeness(session_profiles)
    
    system_prompt = f"""You are Conductor, an expert Voice AI agent designer.
Your goal is to understand the user's business and build a voice agent.
Currently, this is what we know about the business:
{json.dumps(session_profiles, indent=2)}

Crucial missing information that prevents us from finishing:
{json.dumps(validation["missing_fields"])}

Analyze the user's message.
Return a STRICT JSON response (no markdown blocks, no other text) with the following schema:
{{
  "updated_fields": {{ 
    "key": "value" // Extract any new information explicitly provided into appropriate keys. Do NOT invent facts.
  }},
  "next_question": "Your conversational follow-up question asking for 1 missing detail. Be natural and concise.",
  "suggestions": ["Quick", "Reply", "Chips"]
}}

Rules:
- Do not repeat questions already answered.
- If everything is answered, next_question can be null.
- Be concise. Explain why you need info if it's not obvious.
"""

    resp = GROQ_CLIENT.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ],
        temperature=0.3,
        max_tokens=512,
    )
    
    raw = resp.choices[0].message.content.strip()
    try:
        # qwen sometimes wraps in ```json
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            data = json.loads(m.group(0))
        else:
            data = json.loads(raw)
            
        return data
    except Exception as e:
        # Fallback if parsing fails
        return {
            "updated_fields": {},
            "next_question": "Could you provide more details about your agent's primary goal and who it will call?",
            "suggestions": []
        }

def generate_agent_plan(profile: dict) -> dict:
    """
    Generate the rich agent plan card using the confirmed profile.
    """
    system_prompt = f"""You are Conductor, an expert Voice AI engineer.
The user has finished discovery. Here is the complete business profile:
{json.dumps(profile, indent=2)}

Create a detailed Agent Plan. Output EXACTLY a JSON document matching this schema:
{{
  "agent_name": "Name",
  "business_objective": "Goal summary",
  "target_audience": "Audience summary",
  "call_direction": "Inbound, outbound, or both",
  "qualification_criteria": ["Specific signal 1", "Specific signal 2"],
  "workflow_outline": ["Step 1", "Step 2", "Step 3"],
  "test_scenarios": ["Scenario 1", "Scenario 2"],
  "assumptions": ["Assumption 1"],
  "required_integrations": ["Integration 1 or None"]
}}

Use only facts present in the profile. Include explicit budget, timeline, role, and pain-point criteria when provided. If a calendar, CRM, or phone transfer integration is not configured, list it as required and do not claim it is active. Include an outbound opt-out and an inbound help path in the outline when the direction is both.
"""

    try:
        if GROQ_CLIENT is None:
            raise RuntimeError("Groq is not configured")
        resp = GROQ_CLIENT.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Generate the agent plan."}
            ],
            temperature=0.2,
            max_tokens=512,
        )
        raw = resp.choices[0].message.content.strip()
        m = re.search(r"\{[\s\S]*\}", raw)
        plan = json.loads(m.group(0)) if m else json.loads(raw)
        if not isinstance(plan, dict):
            raise ValueError("Plan response must be a JSON object")
    except Exception:
        plan = {}

    objective = str(profile.get("business_objective") or profile.get("agent_purpose") or "Qualify sales leads")
    audience = profile.get("target_audience") or "Business decision makers"
    direction = profile.get("call_direction") or "Inbound and outbound"
    criteria = profile.get("qualification_criteria") or []
    if isinstance(criteria, str):
        criteria = [item.strip() for item in re.split(r"[,;\n]", criteria) if item.strip()]
    if not isinstance(criteria, list):
        criteria = [str(criteria)]
    defaults = {
        "agent_name": (f"{profile.get('business_name') or 'Business'} FAQ & Demo Assistant" if profile.get("website_url") and "faq" in objective.lower() else f"{profile.get('business_name') or 'Business'} Lead Qualifier"),
        "business_objective": objective,
        "target_audience": audience,
        "call_direction": direction,
        "qualification_criteria": criteria,
        "workflow_outline": [
            "Handle inbound enquiries and identify outbound calls clearly",
            "Understand the caller's organization, needs, and preferred next step",
            "Ask relevant qualification questions about role, budget, timeline, or other criteria",
            "Route suitable callers to the right follow-up and close other conversations politely",
            "Respect opt-out requests and end the call immediately",
        ],
        "test_scenarios": [
            "Inbound prospect with an urgent need relevant to the business",
            "Outbound prospect is busy and requests a callback",
            "Prospect asks not to be contacted again",
            "Interested prospect does not meet the confirmed qualification criteria",
        ],
        "assumptions": [
            "The business team will confirm meeting availability; no calendar is connected yet",
            "The agent must not invent business pricing, services, or performance results",
        ],
        "required_integrations": [
            "Calendar integration for automatic appointment booking",
            "CRM integration for lead and qualification field sync",
        ],
    }
    for key, value in defaults.items():
        if not plan.get(key):
            plan[key] = value
    if profile.get("website_url") and "faq" in objective.lower():
        plan["test_scenarios"] = [
            "A caller asks a frequently asked question answered on the website",
            "A caller asks for a detail that is not on the website and needs team confirmation",
            "A prospect requests a demo and shares a preferred time and contact method",
            "A prospect declines to share contact details or declines follow-up",
        ]
        plan["workflow_outline"] = [
            "Welcome callers and route questions to the FAQ path or demo request path",
            "Answer FAQs using facts gathered from the business website; offer team confirmation for unknown details",
            "Understand the prospect's goal and requested service before a demo",
            "With permission, capture contact details and preferred meeting times",
            "Tell the caller the team will confirm availability because no calendar is connected",
        ]
        plan["assumptions"] = [
            "Website content is the source of truth for public business facts",
            "No calendar is connected; the agent records demo requests for team confirmation",
        ]
        plan["required_integrations"] = ["Calendar connection for automatic appointment confirmation"]
    return plan
