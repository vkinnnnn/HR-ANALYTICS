"""
Unified LLM client — supports OpenAI, OpenRouter, and local fallback.
OpenRouter uses the OpenAI-compatible API so we use the same AsyncOpenAI client.
"""

import os
from openai import AsyncOpenAI

from .config import settings


def _get_client_and_model() -> tuple[AsyncOpenAI | None, str]:
    """Return (client, model) based on configured provider. Returns (None, "") if no key available."""
    provider = os.environ.get("LLM_PROVIDER", settings.LLM_PROVIDER)

    if provider == "openrouter":
        api_key = os.environ.get("OPENROUTER_API_KEY", settings.OPENROUTER_API_KEY)
        if not api_key:
            return None, ""
        base_url = os.environ.get("OPENROUTER_BASE_URL", settings.OPENROUTER_BASE_URL)
        model = os.environ.get("OPENROUTER_MODEL", settings.OPENROUTER_MODEL)
        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        return client, model

    # Default: OpenAI
    api_key = os.environ.get("OPENAI_API_KEY", settings.OPENAI_API_KEY)
    if not api_key:
        return None, ""
    model = os.environ.get("OPENAI_MODEL", settings.OPENAI_MODEL)
    client = AsyncOpenAI(api_key=api_key)
    return client, model


async def llm_call(system: str, user: str, temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """Make an LLM call. Raises ValueError if no API key is configured."""
    client, model = _get_client_and_model()
    if client is None:
        raise ValueError("No LLM API key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.")

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def is_llm_available() -> bool:
    """Check if an LLM provider is configured with a valid key."""
    client, _ = _get_client_and_model()
    return client is not None
