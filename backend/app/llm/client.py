from __future__ import annotations

import json
from typing import Any

from groq import Groq
from openai import OpenAI

from app import config

DEFAULT_MAX_TOKENS = 512


class LLMError(RuntimeError):
    pass


def _groq_client() -> Groq:
    if not config.GROQ_API_KEY:
        raise LLMError("GROQ_API_KEY is not set.")
    return Groq(api_key=config.GROQ_API_KEY)


def _nvidia_client() -> OpenAI:
    if not config.NVIDIA_API_KEY:
        raise LLMError("NVIDIA_API_KEY is not set.")
    return OpenAI(api_key=config.NVIDIA_API_KEY, base_url=config.NVIDIA_BASE_URL)


def _complete(
    provider: str,
    messages: list[dict[str, str]],
    temperature: float,
    json_mode: bool,
    max_tokens: int,
    timeout: float = 8.0,
) -> str:
    kwargs: dict[str, Any] = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "timeout": timeout,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    if provider == "nvidia":
        kwargs["model"] = config.NVIDIA_MODEL
        resp = _nvidia_client().chat.completions.create(**kwargs)
    else:
        kwargs["model"] = config.GROQ_MODEL
        resp = _groq_client().chat.completions.create(**kwargs)

    content = resp.choices[0].message.content or ""
    return content.strip()


def _order() -> list[str]:
    primary = config.LLM_PROVIDER if config.LLM_PROVIDER in ("groq", "nvidia") else "groq"
    secondary = "nvidia" if primary == "groq" else "groq"
    order = [primary]
    if config.has_provider(secondary) and secondary != primary:
        order.append(secondary)
    return [p for p in order if config.has_provider(p)]


def chat(
    messages: list[dict[str, str]],
    temperature: float = 0.4,
    json_mode: bool = False,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    timeout: float = 8.0,
) -> tuple[str, str]:
    """Return (text, provider_used)."""
    errors: list[str] = []
    providers = _order()
    if not providers:
        raise LLMError("No LLM API key configured. Set GROQ_API_KEY and/or NVIDIA_API_KEY.")

    for provider in providers:
        try:
            text = _complete(provider, messages, temperature, json_mode, max_tokens, timeout=timeout)
            return text, provider
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{provider}: {exc}")
            continue
    raise LLMError("All LLM providers failed. " + " | ".join(errors))


def extract_json(text: str) -> dict[str, Any]:
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in model output")
    return json.loads(raw[start : end + 1])


def chat_json(
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    timeout: float = 8.0,
) -> tuple[dict[str, Any], str]:
    text, provider = chat(messages, temperature=temperature, json_mode=True, max_tokens=max_tokens, timeout=timeout)
    try:
        return extract_json(text), provider
    except Exception:
        repair = messages + [
            {"role": "assistant", "content": text},
            {
                "role": "user",
                "content": "Return ONLY valid JSON matching the schema. No markdown.",
            },
        ]
        text2, provider = chat(repair, temperature=0, json_mode=True, max_tokens=max_tokens, timeout=timeout)
        return extract_json(text2), provider
