"""
Memory Manager — Per-user persistent memory.

Uses mem0ai when available, falls back to an in-memory dict.
Stores user preferences, conversation patterns, and session context.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

_fallback_store: dict[str, list[dict[str, str]]] = {}

_mem0_client: Any = None
_mem0_available = False


def _init_mem0() -> bool:
    global _mem0_client, _mem0_available
    if _mem0_available:
        return True
    try:
        from mem0 import Memory
        _mem0_client = Memory()
        _mem0_available = True
        logger.info("Mem0 memory initialized")
        return True
    except Exception as e:
        logger.info(f"Mem0 not available, using in-memory fallback: {e}")
        _mem0_available = False
        return False


def search_memory(user_id: str, query: str, limit: int = 5) -> list[str]:
    """Retrieve relevant memories for a user."""
    if _init_mem0() and _mem0_client is not None:
        try:
            results = _mem0_client.search(query, user_id=user_id, limit=limit)
            return [r.get("memory", r.get("text", "")) for r in results.get("results", results) if r]
        except Exception as e:
            logger.warning(f"Mem0 search failed: {e}")

    user_mems = _fallback_store.get(user_id, [])
    if not user_mems:
        return []

    query_lower = query.lower()
    scored = []
    for mem in user_mems:
        text = mem.get("text", "")
        words = query_lower.split()
        score = sum(1 for w in words if w in text.lower())
        if score > 0:
            scored.append((score, text))
    scored.sort(key=lambda x: -x[0])
    return [s[1] for s in scored[:limit]]


def save_memory(user_id: str, fact: str) -> bool:
    """Persist a user fact for future sessions."""
    if not fact or not fact.strip():
        return False

    if _init_mem0() and _mem0_client is not None:
        try:
            _mem0_client.add(fact, user_id=user_id)
            return True
        except Exception as e:
            logger.warning(f"Mem0 save failed: {e}")

    if user_id not in _fallback_store:
        _fallback_store[user_id] = []

    for existing in _fallback_store[user_id]:
        if existing.get("text") == fact:
            return False

    _fallback_store[user_id].append({"text": fact})
    if len(_fallback_store[user_id]) > 100:
        _fallback_store[user_id] = _fallback_store[user_id][-100:]
    return True


def get_memories(user_id: str) -> list[str]:
    """Get all memories for a user."""
    if _init_mem0() and _mem0_client is not None:
        try:
            results = _mem0_client.get_all(user_id=user_id)
            return [r.get("memory", r.get("text", "")) for r in results.get("results", results) if r]
        except Exception as e:
            logger.warning(f"Mem0 get_all failed: {e}")

    return [m.get("text", "") for m in _fallback_store.get(user_id, [])]


def clear_memories(user_id: str) -> bool:
    """Clear all memories for a user (GDPR compliance)."""
    if _init_mem0() and _mem0_client is not None:
        try:
            _mem0_client.delete_all(user_id=user_id)
        except Exception as e:
            logger.warning(f"Mem0 delete failed: {e}")

    _fallback_store.pop(user_id, None)
    return True
