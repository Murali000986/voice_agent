"""ElevenLabs Text-to-Speech integration.

Curated voice list with 20+ voices covering male/female, multiple accents
and use-cases. Falls back gracefully when the API key is not configured.
"""
from __future__ import annotations

import urllib.request
import urllib.error
import json
from typing import Optional

from app import config

# ── Curated voice catalogue ──────────────────────────────────────────────────
# Each entry: voice_id, name, gender, accent, use_case
# IDs from the ElevenLabs pre-built library (always available on any account).
ELEVENLABS_VOICES: list[dict] = [
    {"voice_id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel",      "gender": "female", "accent": "american",   "use_case": "narration"},
    {"voice_id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi",        "gender": "female", "accent": "american",   "use_case": "narration"},
    {"voice_id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella",       "gender": "female", "accent": "american",   "use_case": "narration"},
    {"voice_id": "ErXwobaYiN019PkySvjV", "name": "Antoni",       "gender": "male",   "accent": "american",   "use_case": "narration"},
    {"voice_id": "MF3mGyEYCl7XYWbV9V6O", "name": "Elli",        "gender": "female", "accent": "american",   "use_case": "conversational"},
    {"voice_id": "TxGEqnHWrfWFTfGW9XjX", "name": "Josh",        "gender": "male",   "accent": "american",   "use_case": "conversational"},
    {"voice_id": "VR6AewLTigWG4xSOukaG", "name": "Arnold",      "gender": "male",   "accent": "american",   "use_case": "narration"},
    {"voice_id": "pNInz6obpgDQGcFmaJgB", "name": "Adam",        "gender": "male",   "accent": "american",   "use_case": "narration"},
    {"voice_id": "yoZ06aMxZJJ28mfd3POQ", "name": "Sam",         "gender": "male",   "accent": "american",   "use_case": "conversational"},
    {"voice_id": "onwK4e9ZLuTAKqWW03F9", "name": "Daniel",      "gender": "male",   "accent": "british",    "use_case": "news_presenter"},
    {"voice_id": "g5CIjZEefAph4nQFvHAz", "name": "Ethan",       "gender": "male",   "accent": "american",   "use_case": "conversational"},
    {"voice_id": "piTKgcLEGmPE4e6mEKli", "name": "Nicole",      "gender": "female", "accent": "american",   "use_case": "meditation"},
    {"voice_id": "SOYHLrjzK2X1ezoPC6cr", "name": "Harry",       "gender": "male",   "accent": "american",   "use_case": "conversational"},
    {"voice_id": "TX3LPaxmHKxFdv7VOQHJ", "name": "Liam",        "gender": "male",   "accent": "american",   "use_case": "narration"},
    {"voice_id": "XB0fDUnXU5powFXDhCwa", "name": "Charlotte",   "gender": "female", "accent": "swedish",    "use_case": "conversational"},
    {"voice_id": "Xb7hH8MSUJpSbSDYk0k2", "name": "Alice",       "gender": "female", "accent": "british",    "use_case": "news_presenter"},
    {"voice_id": "XrExE9yKIg1WjnnlVkGX", "name": "Matilda",     "gender": "female", "accent": "american",   "use_case": "narration"},
    {"voice_id": "bVMeCyTHy58xNoL34h3p", "name": "Jeremy",      "gender": "male",   "accent": "american",   "use_case": "conversational"},
    {"voice_id": "flq6f7yk4E4fJM5XTYuZ", "name": "Michael",     "gender": "male",   "accent": "american",   "use_case": "audiobook"},
    {"voice_id": "jBpfuIE2acCO8z3wKNLl", "name": "Freya",       "gender": "female", "accent": "american",   "use_case": "conversational"},
    {"voice_id": "jsCqWAovK2LkecY7zXl4", "name": "Fin",         "gender": "male",   "accent": "irish",      "use_case": "conversational"},
    {"voice_id": "oWAxZDx7w5VEj9dCyTzz", "name": "Grace",       "gender": "female", "accent": "southern_us","use_case": "conversational"},
    {"voice_id": "t0jbNlBVZ17f02VDIeMI", "name": "Jessie",      "gender": "male",   "accent": "american",   "use_case": "conversational"},
    {"voice_id": "wViXBPUzp2ZZixB1xQuM", "name": "Serena",      "gender": "female", "accent": "american",   "use_case": "interactive"},
    {"voice_id": "z9fAnlkpzviPz146aGWa", "name": "Glinda",      "gender": "female", "accent": "american",   "use_case": "narration"},
    {"voice_id": "zrHiDhphv9ZnVXBqCLjz", "name": "Giovanni",    "gender": "male",   "accent": "italian",    "use_case": "narration"},
]

# ── API helpers ──────────────────────────────────────────────────────────────

def _api_key() -> str:
    return config.ELEVENLABS_API_KEY


def is_configured() -> bool:
    key = _api_key()
    return bool(key) and len(key) >= 20


def list_voices() -> list[dict]:
    """Return the curated voice list always. If a valid key is set, merge in
    any custom voices from the user's account."""
    base = list(ELEVENLABS_VOICES)
    if not is_configured():
        return base
    try:
        req = urllib.request.Request(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": _api_key(), "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read())
            known_ids = {v["voice_id"] for v in base}
            for v in data.get("voices", []):
                if v.get("voice_id") not in known_ids:
                    labels = v.get("labels") or {}
                    base.append({
                        "voice_id": v["voice_id"],
                        "name": v.get("name", "Custom"),
                        "gender": labels.get("gender", ""),
                        "accent": labels.get("accent", ""),
                        "use_case": labels.get("use_case", "custom"),
                    })
    except Exception:
        pass  # custom fetch failure is non-fatal
    return base


def synthesize_speech(
    text: str,
    voice_id: str = "21m00Tcm4TlvDq8ikWAM",
    model_id: str = "eleven_turbo_v2_5",   # highly compatible and fast
    stability: float = 0.45,
    similarity_boost: float = 0.80,
) -> bytes:
    """Synthesize text → raw MP3 bytes. Raises RuntimeError if not configured."""
    if not is_configured():
        raise RuntimeError(
            "ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in backend/.env"
        )
    body = json.dumps({
        "text": text[:5000],
        "model_id": model_id,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
        },
    }).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?optimize_streaming_latency=3",
        data=body,
        headers={
            "xi-api-key": _api_key(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"ElevenLabs TTS error {exc.code}: {detail}") from exc
