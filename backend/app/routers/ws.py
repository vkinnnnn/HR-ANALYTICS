"""
WebSocket Router — Real-time log streaming for pipeline runs.
Replaces 3-second polling with push-based updates.
"""

import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services import run_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/pipeline/{run_id}/logs")
async def pipeline_log_stream(websocket: WebSocket, run_id: int):
    """
    Stream pipeline run logs via WebSocket.
    Sends new log lines + status updates every 500ms.
    Closes when run reaches a terminal state (done/failed/cancelled).
    """
    await websocket.accept()
    last_log_len = 0
    last_status = None

    try:
        while True:
            run = await run_manager.get_run(run_id)
            if not run:
                await websocket.send_json({"error": f"Run {run_id} not found"})
                break

            current_log = run.log or ""
            current_status = run.status

            # Send updates only when something changed
            if len(current_log) > last_log_len or current_status != last_status:
                new_lines = current_log[last_log_len:]
                await websocket.send_json({
                    "run_id": run_id,
                    "status": current_status,
                    "progress_pct": run.progress_pct or 0,
                    "completed_steps": run.completed_steps or 0,
                    "total_steps": run.total_steps or 0,
                    "new_log": new_lines,
                    "full_log_length": len(current_log),
                })
                last_log_len = len(current_log)
                last_status = current_status

            # Close on terminal state
            if current_status in ("done", "failed", "cancelled"):
                await websocket.send_json({
                    "run_id": run_id,
                    "status": current_status,
                    "progress_pct": run.progress_pct or 0,
                    "final": True,
                    "error": run.error_detail,
                    "output_file": run.output_file,
                })
                break

            await asyncio.sleep(0.5)

    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected for run {run_id}")
    except Exception as e:
        logger.error(f"WebSocket error for run {run_id}: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except Exception:
            pass


@router.websocket("/ws/pipeline/all")
async def all_runs_stream(websocket: WebSocket):
    """
    Stream status updates for all active runs.
    Useful for the Pipeline Hub overview.
    """
    await websocket.accept()
    last_snapshot = {}

    try:
        while True:
            runs = await run_manager.list_runs(limit=20)
            current_snapshot = {}

            for run in runs:
                key = run.id
                current_snapshot[key] = {
                    "id": run.id,
                    "run_type": run.run_type,
                    "status": run.status,
                    "progress_pct": run.progress_pct or 0,
                }

            # Only send if changed
            if current_snapshot != last_snapshot:
                await websocket.send_json({
                    "runs": list(current_snapshot.values()),
                })
                last_snapshot = current_snapshot

            # Check if any are still active
            has_active = any(r["status"] in ("pending", "running") for r in current_snapshot.values())
            if not has_active and last_snapshot:
                await asyncio.sleep(5)  # Slow poll when idle
            else:
                await asyncio.sleep(1)  # Fast poll when jobs running

    except WebSocketDisconnect:
        logger.debug("All-runs WebSocket disconnected")
    except Exception as e:
        logger.error(f"All-runs WebSocket error: {e}")
