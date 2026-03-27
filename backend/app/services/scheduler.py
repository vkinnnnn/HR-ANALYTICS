"""
Pipeline Scheduler — APScheduler-based cron scheduling + dependency chains.
Supports:
- Cron-based periodic runs (e.g., data_reload every day at 2am)
- Dependency chains (data_reload → taxonomy_regen → flight_risk_train)
"""

import os
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

_scheduler = None


def init_scheduler():
    """Initialize APScheduler with configured cron jobs."""
    global _scheduler

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning("APScheduler not installed, scheduler disabled")
        return None

    _scheduler = AsyncIOScheduler()

    # Load schedule config from env vars
    # Format: SCHEDULE_{RUN_TYPE}=cron_expression
    # Example: SCHEDULE_DATA_RELOAD="0 2 * * *"  (2am daily)
    schedule_configs = {
        "data_reload": os.environ.get("SCHEDULE_DATA_RELOAD"),
        "taxonomy_regen": os.environ.get("SCHEDULE_TAXONOMY_REGEN"),
        "flight_risk_train": os.environ.get("SCHEDULE_FLIGHT_RISK_TRAIN"),
    }

    for run_type, cron_expr in schedule_configs.items():
        if cron_expr:
            try:
                trigger = CronTrigger.from_crontab(cron_expr)
                _scheduler.add_job(
                    _scheduled_run,
                    trigger=trigger,
                    args=[run_type],
                    id=f"scheduled_{run_type}",
                    name=f"Scheduled {run_type}",
                    replace_existing=True,
                )
                logger.info(f"Scheduled {run_type} with cron: {cron_expr}")
            except Exception as e:
                logger.error(f"Failed to schedule {run_type}: {e}")

    # Check for chain config
    chain_config = os.environ.get("PIPELINE_CHAIN")  # e.g. "data_reload,taxonomy_regen,flight_risk_train"
    chain_schedule = os.environ.get("SCHEDULE_CHAIN")  # e.g. "0 2 * * *"
    if chain_config and chain_schedule:
        try:
            trigger = CronTrigger.from_crontab(chain_schedule)
            steps = [s.strip() for s in chain_config.split(",")]
            _scheduler.add_job(
                _run_chain,
                trigger=trigger,
                args=[steps],
                id="scheduled_chain",
                name=f"Scheduled chain: {' → '.join(steps)}",
                replace_existing=True,
            )
            logger.info(f"Scheduled chain: {' → '.join(steps)} at {chain_schedule}")
        except Exception as e:
            logger.error(f"Failed to schedule chain: {e}")

    try:
        _scheduler.start()
        jobs = _scheduler.get_jobs()
        if jobs:
            logger.info(f"Scheduler started with {len(jobs)} jobs")
        return _scheduler
    except Exception as e:
        logger.warning(f"Scheduler start failed: {e}")
        return None


async def _scheduled_run(run_type: str):
    """Execute a single scheduled pipeline run."""
    from . import run_manager
    from .job_queue import enqueue_job

    logger.info(f"Scheduled run triggered: {run_type}")

    config = {}
    if run_type == "data_reload":
        config["data_dir"] = os.environ.get("DATA_DIR", "wh_Dataset")

    run = await run_manager.create_run(
        run_type=run_type,
        config={"source": "scheduler", **config},
    )
    await enqueue_job(run_type, run.id, **config)
    logger.info(f"Scheduled run {run.id} ({run_type}) enqueued")


async def _run_chain(steps: list[str]):
    """
    Execute a dependency chain: each step runs after the previous completes.
    E.g., data_reload → taxonomy_regen → flight_risk_train
    """
    from . import run_manager
    from .job_queue import enqueue_job

    logger.info(f"Chain triggered: {' → '.join(steps)}")

    for i, run_type in enumerate(steps):
        config = {}
        if run_type == "data_reload":
            config["data_dir"] = os.environ.get("DATA_DIR", "wh_Dataset")

        run = await run_manager.create_run(
            run_type=run_type,
            config={"source": "chain", "chain_step": i + 1, "chain_total": len(steps), **config},
        )
        await run_manager.append_log(run.id, f"Chain step {i + 1}/{len(steps)}: {run_type}")
        await enqueue_job(run_type, run.id, **config)

        # Wait for completion before starting next step
        max_wait = 600  # 10 minute timeout per step
        waited = 0
        while waited < max_wait:
            await asyncio.sleep(2)
            waited += 2
            current = await run_manager.get_run(run.id)
            if not current:
                break
            if current.status == "done":
                logger.info(f"Chain step {i + 1}/{len(steps)} ({run_type}) completed")
                break
            if current.status in ("failed", "cancelled"):
                logger.error(f"Chain aborted at step {i + 1} ({run_type}): {current.status}")
                return  # Stop the chain

        if waited >= max_wait:
            logger.error(f"Chain step {i + 1} ({run_type}) timed out after {max_wait}s")
            return

    logger.info(f"Chain completed: {' → '.join(steps)}")


# ── Manual chain trigger (callable from API) ──

async def trigger_chain(steps: list[str]) -> list[int]:
    """
    Manually trigger a dependency chain. Returns list of run IDs.
    """
    from . import run_manager
    from .job_queue import enqueue_job

    run_ids = []
    for i, run_type in enumerate(steps):
        config = {}
        if run_type == "data_reload":
            config["data_dir"] = os.environ.get("DATA_DIR", "wh_Dataset")

        run = await run_manager.create_run(
            run_type=run_type,
            config={"source": "manual_chain", "chain_step": i + 1, "chain_total": len(steps), **config},
        )
        run_ids.append(run.id)

    # Start the first step, subsequent steps will be triggered by the chain runner
    if run_ids:
        asyncio.create_task(_run_chain_from_runs(steps, run_ids))

    return run_ids


async def _run_chain_from_runs(steps: list[str], run_ids: list[int]):
    """Execute chain from pre-created runs."""
    from . import run_manager
    from .job_queue import enqueue_job

    for i, (run_type, run_id) in enumerate(zip(steps, run_ids)):
        config = {}
        if run_type == "data_reload":
            config["data_dir"] = os.environ.get("DATA_DIR", "wh_Dataset")

        await run_manager.append_log(run_id, f"Chain step {i + 1}/{len(steps)}: starting")
        await enqueue_job(run_type, run_id, **config)

        # Wait for completion
        max_wait = 600
        waited = 0
        while waited < max_wait:
            await asyncio.sleep(2)
            waited += 2
            current = await run_manager.get_run(run_id)
            if current and current.status in ("done", "failed", "cancelled"):
                break

        if current and current.status != "done":
            await run_manager.append_log(run_id, f"Chain aborted: {current.status}")
            # Mark remaining runs as cancelled
            for remaining_id in run_ids[i + 1:]:
                await run_manager.cancel_run(remaining_id)
            return


def get_scheduled_jobs() -> list[dict]:
    """Return list of scheduled jobs for the API."""
    if not _scheduler:
        return []
    return [
        {
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        }
        for job in _scheduler.get_jobs()
    ]
