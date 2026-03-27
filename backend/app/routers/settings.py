"""
Settings Router — LLM provider configuration and platform settings.
"""

import os
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..llm import is_llm_available

router = APIRouter()

# Available models for each provider
AVAILABLE_MODELS = {
    "openrouter": [
        {"id": "nvidia/nemotron-3-super-120b-a12b:free", "name": "Nvidia Nemotron 120B (Free)", "tier": "free"},
        {"id": "meta-llama/llama-3.3-8b-instruct:free", "name": "Llama 3.3 8B (Free)", "tier": "free"},
        {"id": "deepseek/deepseek-chat-v3-0324:free", "name": "DeepSeek V3 (Free)", "tier": "free"},
        {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash (Free)", "tier": "free"},
        {"id": "qwen/qwen3-235b-a22b:free", "name": "Qwen 3 235B (Free)", "tier": "free"},
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "tier": "paid"},
        {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "tier": "paid"},
        {"id": "openai/gpt-4o", "name": "GPT-4o", "tier": "paid"},
    ],
    "openai": [
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tier": "paid"},
        {"id": "gpt-4o", "name": "GPT-4o", "tier": "paid"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "tier": "paid"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "tier": "paid"},
    ],
}


@router.get("/llm")
def get_llm_settings():
    """Get current LLM configuration."""
    provider = os.environ.get("LLM_PROVIDER", settings.LLM_PROVIDER)
    if provider == "openrouter":
        model = os.environ.get("OPENROUTER_MODEL", settings.OPENROUTER_MODEL)
        has_key = bool(os.environ.get("OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY))
    else:
        model = os.environ.get("OPENAI_MODEL", settings.OPENAI_MODEL)
        has_key = bool(os.environ.get("OPENAI_API_KEY", settings.OPENAI_API_KEY))

    return {
        "provider": provider,
        "model": model,
        "has_key": has_key,
        "is_available": is_llm_available(),
        "available_models": AVAILABLE_MODELS.get(provider, []),
        "available_providers": ["openrouter", "openai"],
    }


class LLMUpdate(BaseModel):
    provider: str | None = None
    model: str | None = None


@router.post("/llm")
def update_llm_settings(update: LLMUpdate):
    """Update LLM provider and/or model at runtime (in-memory, resets on restart)."""
    if update.provider:
        if update.provider not in ("openrouter", "openai"):
            return {"error": f"Unknown provider: {update.provider}"}
        os.environ["LLM_PROVIDER"] = update.provider

    if update.model:
        provider = os.environ.get("LLM_PROVIDER", settings.LLM_PROVIDER)
        if provider == "openrouter":
            os.environ["OPENROUTER_MODEL"] = update.model
        else:
            os.environ["OPENAI_MODEL"] = update.model

    return get_llm_settings()


@router.get("/platform")
def get_platform_settings():
    """Get overall platform configuration status."""
    provider = os.environ.get("LLM_PROVIDER", settings.LLM_PROVIDER)
    return {
        "data_directory": os.environ.get("DATA_DIR", "") or "wh_Dataset (default)",
        "database_url": "SQLite (hr_platform.db)",
        "llm_provider": provider,
        "llm_available": is_llm_available(),
        "redis_available": _check_redis(),
        "sentry_enabled": bool(os.environ.get("SENTRY_DSN")),
        "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_MB,
    }


def _check_redis() -> bool:
    try:
        import arq
        return True
    except ImportError:
        return False
