"""
Bounded in-memory TTL cache for expensive endpoint responses.
Invalidated on data upload/reload/pipeline refresh.
"""
import time, hashlib, json
from functools import wraps
from typing import Any

_cache: dict[str, tuple[float, Any]] = {}
_default_ttl = 120  # seconds
_version = 0  # bumped on invalidate


def invalidate_all():
    """Clear all cached responses. Called on upload/reload/pipeline completion."""
    global _version
    _version += 1
    _cache.clear()


def cached_response(ttl: int = _default_ttl):
    """Decorator for async endpoint functions. Caches response by route + query params."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build deterministic cache key from function name + sorted kwargs + version
            key_parts = [func.__name__, str(_version)]
            if kwargs:
                key_parts.append(hashlib.md5(json.dumps(sorted(kwargs.items()), default=str).encode()).hexdigest())
            key = ":".join(key_parts)

            now = time.time()
            if key in _cache:
                ts, data = _cache[key]
                if now - ts < ttl:
                    return data

            result = await func(*args, **kwargs)
            _cache[key] = (now, result)

            # Bound cache size (LRU-ish: just cap at 100 entries)
            if len(_cache) > 100:
                oldest_key = min(_cache, key=lambda k: _cache[k][0])
                del _cache[oldest_key]

            return result
        return wrapper
    return decorator
