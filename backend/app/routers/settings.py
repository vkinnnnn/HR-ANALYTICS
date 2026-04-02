"""
Settings Router — LLM provider configuration and platform settings.
"""

import os
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings
from ..llm import is_llm_available

router = APIRouter()

AVAILABLE_MODELS = {
    "openrouter": [
        {"id": "nvidia/nemotron-3-super-120b-a12b:free", "name": "Nvidia Nemotron 120B", "tier": "free"},
        {"id": "meta-llama/llama-3.3-8b-instruct:free", "name": "Llama 3.3 8B", "tier": "free"},
        {"id": "deepseek/deepseek-chat-v3-0324:free", "name": "DeepSeek V3", "tier": "free"},
        {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash", "tier": "free"},
        {"id": "qwen/qwen3-235b-a22b:free", "name": "Qwen 3 235B", "tier": "free"},
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "tier": "paid"},
        {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini (via OR)", "tier": "paid"},
        {"id": "openai/gpt-4o", "name": "GPT-4o (via OR)", "tier": "paid"},
    ],
    "openai": [
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tier": "paid"},
        {"id": "gpt-4o", "name": "GPT-4o", "tier": "paid"},
        {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini", "tier": "paid"},
        {"id": "gpt-4.1", "name": "GPT-4.1", "tier": "paid"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "tier": "paid"},
        {"id": "o3-mini", "name": "o3-mini (Reasoning)", "tier": "paid"},
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

    # Check if OpenAI key is available (for report generation)
    has_openai = bool(os.environ.get("OPENAI_API_KEY", settings.OPENAI_API_KEY))
    has_openrouter = bool(os.environ.get("OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY))

    return {
        "provider": provider,
        "model": model,
        "has_key": has_key,
        "has_openai_key": has_openai,
        "has_openrouter_key": has_openrouter,
        "is_available": is_llm_available(),
        "available_models": AVAILABLE_MODELS.get(provider, []),
        "available_providers": ["openrouter", "openai"],
    }


class LLMUpdate(BaseModel):
    provider: str | None = None
    model: str | None = None


@router.post("/llm")
def update_llm_settings(update: LLMUpdate):
    """Update LLM provider and/or model at runtime."""
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


class APIKeyUpdate(BaseModel):
    provider: str
    api_key: str


@router.post("/api-key")
def update_api_key(update: APIKeyUpdate):
    """Update an LLM provider's API key at runtime."""
    if update.provider == "openrouter":
        os.environ["OPENROUTER_API_KEY"] = update.api_key
    elif update.provider == "openai":
        os.environ["OPENAI_API_KEY"] = update.api_key
    else:
        return {"error": f"Unknown provider: {update.provider}"}

    # Mask key for response
    masked = "..." + update.api_key[-4:] if len(update.api_key) > 4 else "****"
    return {"status": "saved", "provider": update.provider, "masked_key": masked}


@router.post("/test-connection")
async def test_connection():
    """Test the current LLM connection with a minimal call."""
    import time
    from ..llm import _get_client_and_model

    client, model = _get_client_and_model()
    if client is None:
        return {"success": False, "error": "No API key configured", "latency_ms": 0, "model": ""}

    start = time.time()
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello in 3 words."}],
            max_tokens=10,
            temperature=0,
        )
        latency = int((time.time() - start) * 1000)
        return {
            "success": True,
            "latency_ms": latency,
            "model": model,
            "response": response.choices[0].message.content[:50],
        }
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return {"success": False, "error": str(e)[:200], "latency_ms": latency, "model": model}


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
