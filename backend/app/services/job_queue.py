"""
Job Queue — ARQ + Redis with thread fallback.
Uses ARQ when Redis is available, falls back to daemon threads otherwise.

This provides persistent, restartable jobs via Redis while maintaining
backward compatibility on environments without Redis.
"""

import os
import logging
import asyncio
from typing import Any

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
_arq_available = False
_redis_pool = None


async def init_queue():
    """Try to connect to Redis. Sets _arq_available flag."""
    global _arq_available, _redis_pool
    try:
        from arq import create_pool
        from arq.connections import RedisSettings
        _redis_pool = await create_pool(RedisSettings.from_dsn(REDIS_URL))
        await _redis_pool.ping(b"healthcheck")
        _arq_available = True
        logger.info(f"ARQ connected to Redis at {REDIS_URL}")
    except Exception as e:
        _arq_available = False
        _redis_pool = None
        logger.warning(f"Redis unavailable ({e}), using thread fallback for jobs")


async def enqueue_job(func_name: str, run_id: int, **kwargs) -> str:
    """
    Enqueue a job. Uses ARQ if Redis available, otherwise dispatches thread.
    Returns job_id string.
    """
    if _arq_available and _redis_pool:
        try:
            job = await _redis_pool.enqueue_job(func_name, run_id=run_id, **kwargs)
            logger.info(f"Enqueued ARQ job {job.job_id} for run {run_id}")
            return job.job_id
        except Exception as e:
            logger.warning(f"ARQ enqueue failed ({e}), falling back to thread")

    # Thread fallback
    from .run_manager import dispatch_background
    from .pipeline_runners import RUNNER_REGISTRY
    runner = RUNNER_REGISTRY.get(func_name)
    if runner:
        dispatch_background(run_id, runner, run_type=func_name, **kwargs)
        return f"thread-{run_id}"
    raise ValueError(f"Unknown job function: {func_name}")


def is_redis_available() -> bool:
    return _arq_available


# ── ARQ Worker Task Definitions ──
# These are registered with the ARQ worker process.

async def arq_data_reload(ctx: dict, run_id: int, **kwargs):
    """ARQ task wrapper for data_reload."""
    from .pipeline_runners import data_reload_runner
    from . import run_manager
    cancel_ev = run_manager.get_cancel_event(run_id) or __import__("threading").Event()
    loop = asyncio.get_event_loop()
    await run_manager.start_run(run_id)
    await run_manager.append_log(run_id, "Started via ARQ worker")
    try:
        data_reload_runner(run_id=run_id, cancel_event=cancel_ev, loop=loop, **kwargs)
    except Exception as e:
        await run_manager.fail_run(run_id, str(e))
        raise


async def arq_taxonomy_regen(ctx: dict, run_id: int, **kwargs):
    """ARQ task wrapper for taxonomy_regen."""
    from .pipeline_runners import taxonomy_regen_runner
    from . import run_manager
    cancel_ev = run_manager.get_cancel_event(run_id) or __import__("threading").Event()
    loop = asyncio.get_event_loop()
    await run_manager.start_run(run_id)
    await run_manager.append_log(run_id, "Started via ARQ worker")
    try:
        taxonomy_regen_runner(run_id=run_id, cancel_event=cancel_ev, loop=loop, **kwargs)
    except Exception as e:
        await run_manager.fail_run(run_id, str(e))
        raise


async def arq_flight_risk_train(ctx: dict, run_id: int, **kwargs):
    from .pipeline_runners import flight_risk_train_runner
    from . import run_manager
    cancel_ev = run_manager.get_cancel_event(run_id) or __import__("threading").Event()
    loop = asyncio.get_event_loop()
    await run_manager.start_run(run_id)
    try:
        flight_risk_train_runner(run_id=run_id, cancel_event=cancel_ev, loop=loop, **kwargs)
    except Exception as e:
        await run_manager.fail_run(run_id, str(e))
        raise


async def arq_report_generate(ctx: dict, run_id: int, **kwargs):
    from .pipeline_runners import report_generate_runner
    from . import run_manager
    cancel_ev = run_manager.get_cancel_event(run_id) or __import__("threading").Event()
    loop = asyncio.get_event_loop()
    await run_manager.start_run(run_id)
    try:
        report_generate_runner(run_id=run_id, cancel_event=cancel_ev, loop=loop, **kwargs)
    except Exception as e:
        await run_manager.fail_run(run_id, str(e))
        raise


async def arq_export_bundle(ctx: dict, run_id: int, **kwargs):
    from .pipeline_runners import export_bundle_runner
    from . import run_manager
    cancel_ev = run_manager.get_cancel_event(run_id) or __import__("threading").Event()
    loop = asyncio.get_event_loop()
    await run_manager.start_run(run_id)
    try:
        export_bundle_runner(run_id=run_id, cancel_event=cancel_ev, loop=loop, **kwargs)
    except Exception as e:
        await run_manager.fail_run(run_id, str(e))
        raise


# ARQ function registry (maps run_type → ARQ function name)
ARQ_FUNCTIONS = {
    "data_reload": arq_data_reload,
    "taxonomy_regen": arq_taxonomy_regen,
    "flight_risk_train": arq_flight_risk_train,
    "report_generate": arq_report_generate,
    "export_bundle": arq_export_bundle,
}
