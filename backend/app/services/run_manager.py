"""
Run Manager — orchestrates pipeline run lifecycle.
Handles DB state transitions, log appending, background task dispatch.

Source capability: Regata3010 _set_status / _append_log / cancel flag pattern
Local adaptation: async DB operations, generic run types, artifact tracking
"""

import asyncio
import json
import logging
import threading
from datetime import datetime
from typing import Callable

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import PipelineRun, PipelineArtifact, async_session

logger = logging.getLogger(__name__)

# Cancel flag registry (adapted from Regata3010 Dict[int, threading.Event])
_cancel_flags: dict[int, threading.Event] = {}


async def create_run(
    run_type: str,
    input_file: str | None = None,
    config: dict | None = None,
    total_steps: int | None = None,
) -> PipelineRun:
    """Create a new pipeline run in pending state."""
    async with async_session() as session:
        run = PipelineRun(
            run_type=run_type,
            status="pending",
            input_file=input_file,
            config_json=json.dumps(config) if config else None,
            total_steps=total_steps,
            completed_steps=0,
            progress_pct=0.0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(run)
        await session.commit()
        await session.refresh(run)
        return run


async def start_run(run_id: int):
    """Transition run to 'running' state."""
    async with async_session() as session:
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(status="running", started_at=datetime.utcnow(), updated_at=datetime.utcnow())
        )
        await session.commit()
    _cancel_flags[run_id] = threading.Event()


async def complete_run(run_id: int, output_file: str | None = None, total_cost: float | None = None):
    """Transition run to 'done' state."""
    async with async_session() as session:
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(
                status="done",
                output_file=output_file,
                total_cost=total_cost,
                progress_pct=100.0,
                completed_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
        await session.commit()
    _cancel_flags.pop(run_id, None)


async def fail_run(run_id: int, error: str):
    """Transition run to 'failed' state."""
    async with async_session() as session:
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(
                status="failed",
                error_detail=error,
                completed_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        )
        await session.commit()
    _cancel_flags.pop(run_id, None)


async def cancel_run(run_id: int) -> bool:
    """Set cancel flag and update DB. Returns True if run was running."""
    ev = _cancel_flags.get(run_id)
    if ev:
        ev.set()
    async with async_session() as session:
        result = await session.execute(select(PipelineRun).where(PipelineRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return False
        was_running = run.status == "running"
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(status="cancelled", cancelled=True, completed_at=datetime.utcnow(), updated_at=datetime.utcnow())
        )
        await session.commit()
    _cancel_flags.pop(run_id, None)
    return was_running


async def update_progress(run_id: int, completed_steps: int, total_steps: int, message: str | None = None):
    """Update progress counters."""
    pct = round(completed_steps / total_steps * 100, 1) if total_steps > 0 else 0
    async with async_session() as session:
        values = {
            "completed_steps": completed_steps,
            "total_steps": total_steps,
            "progress_pct": pct,
            "updated_at": datetime.utcnow(),
        }
        await session.execute(update(PipelineRun).where(PipelineRun.id == run_id).values(**values))
        await session.commit()
    if message:
        await append_log(run_id, message)


async def append_log(run_id: int, message: str):
    """Append a line to the run's log field."""
    ts = datetime.utcnow().strftime("%H:%M:%S")
    line = f"[{ts}] {message}\n"
    async with async_session() as session:
        result = await session.execute(select(PipelineRun.log).where(PipelineRun.id == run_id))
        current_log = result.scalar_one_or_none() or ""
        await session.execute(
            update(PipelineRun)
            .where(PipelineRun.id == run_id)
            .values(log=current_log + line, updated_at=datetime.utcnow())
        )
        await session.commit()


async def register_artifact(run_id: int, artifact_type: str, filename: str, file_path: str, size_bytes: int = 0):
    """Register a file artifact produced by a run."""
    async with async_session() as session:
        artifact = PipelineArtifact(
            run_id=run_id,
            artifact_type=artifact_type,
            filename=filename,
            file_path=file_path,
            size_bytes=size_bytes,
        )
        session.add(artifact)
        await session.commit()


async def get_run(run_id: int) -> PipelineRun | None:
    """Fetch a single run by ID."""
    async with async_session() as session:
        result = await session.execute(select(PipelineRun).where(PipelineRun.id == run_id))
        return result.scalar_one_or_none()


async def list_runs(limit: int = 50) -> list[PipelineRun]:
    """List recent runs, newest first."""
    async with async_session() as session:
        result = await session.execute(
            select(PipelineRun).order_by(PipelineRun.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())


async def get_artifacts(run_id: int) -> list[PipelineArtifact]:
    """Get all artifacts for a run."""
    async with async_session() as session:
        result = await session.execute(
            select(PipelineArtifact).where(PipelineArtifact.run_id == run_id)
        )
        return list(result.scalars().all())


def get_cancel_event(run_id: int) -> threading.Event | None:
    """Get the cancel event for a running job."""
    return _cancel_flags.get(run_id)


def dispatch_background(run_id: int, runner_fn: Callable, **kwargs):
    """
    Dispatch a runner function in a background thread.
    The runner receives run_id + cancel_event + kwargs.
    Adapted from Regata3010 BackgroundTasks pattern, using threading for simplicity.
    """
    cancel_ev = _cancel_flags.get(run_id, threading.Event())
    _cancel_flags[run_id] = cancel_ev

    def _wrapper():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(start_run(run_id))
            loop.run_until_complete(append_log(run_id, f"Started {kwargs.get('run_type', 'run')}"))
            runner_fn(run_id=run_id, cancel_event=cancel_ev, loop=loop, **kwargs)
        except Exception as e:
            logger.error(f"Run {run_id} failed: {e}")
            loop.run_until_complete(fail_run(run_id, str(e)))
        finally:
            loop.close()

    thread = threading.Thread(target=_wrapper, name=f"pipeline-run-{run_id}", daemon=True)
    thread.start()
    return thread
