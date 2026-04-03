"""
Request profiling middleware — logs per-route latency, status, response size.
Collects p50/p95/p99 stats accessible via GET /api/profiling/report.
"""
import time, statistics
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import APIRouter

router = APIRouter()

# Store latency samples per route (bounded to last 200)
_stats: dict[str, list[float]] = defaultdict(list)
_sizes: dict[str, list[int]] = defaultdict(list)
_errors: dict[str, int] = defaultdict(int)
MAX_SAMPLES = 200


class ProfilingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        path = request.url.path
        # Only profile /api routes
        if path.startswith("/api"):
            # Normalize parameterized routes
            key = path.rstrip("/")
            samples = _stats[key]
            samples.append(elapsed_ms)
            if len(samples) > MAX_SAMPLES:
                _stats[key] = samples[-MAX_SAMPLES:]

            # Track response size from content-length header
            size = int(response.headers.get("content-length", 0))
            _sizes[key].append(size)
            if len(_sizes[key]) > MAX_SAMPLES:
                _sizes[key] = _sizes[key][-MAX_SAMPLES:]

            if response.status_code >= 400:
                _errors[key] += 1

        return response


def get_report() -> list[dict]:
    """Generate hotspot report sorted by p95 latency descending."""
    report = []
    for route, samples in _stats.items():
        if not samples:
            continue
        sorted_s = sorted(samples)
        n = len(sorted_s)
        sizes = _sizes.get(route, [0])
        report.append({
            "route": route,
            "calls": n,
            "p50_ms": round(sorted_s[n // 2], 1),
            "p95_ms": round(sorted_s[int(n * 0.95)] if n >= 5 else sorted_s[-1], 1),
            "p99_ms": round(sorted_s[int(n * 0.99)] if n >= 10 else sorted_s[-1], 1),
            "max_ms": round(sorted_s[-1], 1),
            "avg_size_kb": round(statistics.mean(sizes) / 1024, 1) if sizes else 0,
            "errors": _errors.get(route, 0),
        })
    report.sort(key=lambda x: x["p95_ms"], reverse=True)
    return report


def clear_stats():
    _stats.clear()
    _sizes.clear()
    _errors.clear()


@router.get("/profiling/report")
async def profiling_report():
    """Return per-route performance hotspot report."""
    return {"routes": get_report(), "note": "Sorted by p95 latency descending"}


@router.post("/profiling/clear")
async def profiling_clear():
    """Clear all profiling stats."""
    clear_stats()
    return {"status": "cleared"}
