import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


LLM_PROVIDER = _env("LLM_PROVIDER", "groq").lower()
GROQ_API_KEY = _env("GROQ_API_KEY")
NVIDIA_API_KEY = _env("NVIDIA_API_KEY")
NVIDIA_BASE_URL = _env("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")

GROQ_MODEL = _env("GROQ_MODEL", "qwen/qwen3.8-27b")
NVIDIA_MODEL = _env("NVIDIA_MODEL", "meta/llama-3.3-70b-instruct")

DATABASE_URL = _env("DATABASE_URL") or f"sqlite:///{(ROOT / 'voice_agent.db').as_posix()}"

TWILIO_ACCOUNT_SID = _env("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = _env("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = _env("TWILIO_PHONE_NUMBER")
PUBLIC_BASE_URL = _env("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")

ELEVENLABS_API_KEY = _env("ELEVENLABS_API_KEY")

CORS_ORIGINS = [o.strip() for o in _env("CORS_ORIGINS", "*").split(",") if o.strip()]


def active_model(provider: str | None = None) -> str:
    p = (provider or LLM_PROVIDER).lower()
    return NVIDIA_MODEL if p == "nvidia" else GROQ_MODEL


def has_provider(name: str) -> bool:
    if name == "groq":
        return bool(GROQ_API_KEY)
    if name == "nvidia":
        return bool(NVIDIA_API_KEY)
    return False
