"""
Pipeline Router — Run lifecycle management, artifact access, log polling.

Source capability: Regata3010 /api/pipeline/* endpoints
Local adaptation: workforce domain run_types, safe file handling, artifact registry
"""

import os
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..services import run_manager
from ..services.pipeline_runners import RUNNER_REGISTRY
from ..services.auth import require_auth, optional_auth
from ..data_loader import is_loaded

router = APIRouter()

# Safe directories for artifact access
SAFE_DIRS = {
    os.path.abspath(os.environ.get("OUTPUT_DIR", "output")),
    os.path.abspath(os.environ.get("CHECKPOINT_DIR", "checkpoints")),
}


class RunStartRequest(BaseModel):
    run_type: str
    config: dict | None = None


class CancelResponse(BaseModel):
    run_id: int
    status: str
    was_running: bool


# ── Run lifecycle ──

@router.post("/start")
async def start_run(req: RunStartRequest, user: dict = Depends(require_auth)):
    """Start a new pipeline run. Dispatches as background thread."""
    if req.run_type not in RUNNER_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown run_type '{req.run_type}'. Available: {list(RUNNER_REGISTRY.keys())}",
        )

    config = req.config or {}

    # Determine input based on run_type
    input_file = None
    if req.run_type == "data_reload":
        data_dir = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"))
        config["data_dir"] = data_dir
        input_file = data_dir

    # Create DB record
    run = await run_manager.create_run(
        run_type=req.run_type,
        input_file=input_file,
        config=config,
    )

    # Dispatch via ARQ (Redis) or thread fallback
    from ..services.job_queue import enqueue_job, is_redis_available
    job_id = await enqueue_job(req.run_type, run.id, **config)

    return {
        "run_id": run.id,
        "status": "pending",
        "run_type": req.run_type,
        "job_id": job_id,
        "queue": "arq" if is_redis_available() else "thread",
    }


@router.get("/runs")
async def list_runs(limit: int = Query(default=50, ge=1, le=200)):
    """List recent pipeline runs."""
    runs = await run_manager.list_runs(limit=limit)
    return {
        "runs": [
            {
                "id": r.id,
                "run_type": r.run_type,
                "status": r.status,
                "progress_pct": r.progress_pct,
                "completed_steps": r.completed_steps,
                "total_steps": r.total_steps,
                "total_cost": r.total_cost,
                "input_file": r.input_file,
                "output_file": r.output_file,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in runs
        ]
    }


@router.get("/runs/{run_id}")
async def get_run_detail(run_id: int):
    """Get full details of a pipeline run including config and error."""
    run = await run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    artifacts = await run_manager.get_artifacts(run_id)

    return {
        "id": run.id,
        "run_type": run.run_type,
        "status": run.status,
        "progress_pct": run.progress_pct,
        "completed_steps": run.completed_steps,
        "total_steps": run.total_steps,
        "input_file": run.input_file,
        "output_file": run.output_file,
        "config": run.config_json,
        "log": run.log,
        "error_detail": run.error_detail,
        "total_cost": run.total_cost,
        "cancelled": run.cancelled,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "artifacts": [
            {
                "id": a.id,
                "type": a.artifact_type,
                "filename": a.filename,
                "size_bytes": a.size_bytes,
            }
            for a in artifacts
        ],
    }


@router.get("/runs/{run_id}/log")
async def get_run_log(run_id: int):
    """Get run log for live polling. Lightweight endpoint."""
    run = await run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return {
        "run_id": run_id,
        "status": run.status,
        "progress_pct": run.progress_pct,
        "log": run.log or "",
    }


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: int, user: dict = Depends(require_auth)):
    """Cancel a running pipeline job."""
    run = await run_manager.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    if run.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel run in '{run.status}' state")

    was_running = await run_manager.cancel_run(run_id)
    return CancelResponse(run_id=run_id, status="cancelled", was_running=was_running)


@router.get("/runs/{run_id}/artifacts/{artifact_id}/download")
async def download_artifact(run_id: int, artifact_id: int):
    """Download a run artifact file. Only serves files from safe directories."""
    artifacts = await run_manager.get_artifacts(run_id)
    artifact = next((a for a in artifacts if a.id == artifact_id), None)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Security: verify file is in a safe directory
    abs_path = os.path.abspath(artifact.file_path)
    if not any(abs_path.startswith(safe) for safe in SAFE_DIRS):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Artifact file not found on disk")

    return FileResponse(abs_path, filename=artifact.filename)


# ── Run types info ──

@router.get("/run-types")
async def list_run_types():
    """List available run types with descriptions."""
    descriptions = {
        "data_reload": "Reload all CSV files and re-process the employee dataset",
        "taxonomy_regen": "Re-classify all grades, titles, functions, and career moves",
        "flight_risk_train": "Retrain the flight risk ML model on current data",
        "report_generate": "Generate an LLM-powered executive summary report",
        "export_bundle": "Create a ZIP export with all processed data for Power BI",
    }
    return {
        "run_types": [
            {"id": rt, "description": descriptions.get(rt, "")}
            for rt in RUNNER_REGISTRY.keys()
        ]
    }


# ── Dependency Chains ──

class ChainRequest(BaseModel):
    steps: list[str]  # e.g. ["data_reload", "taxonomy_regen", "flight_risk_train"]


@router.post("/chain")
async def start_chain(req: ChainRequest, user: dict = Depends(require_auth)):
    """Start a dependency chain. Each step runs after the previous completes."""
    for step in req.steps:
        if step not in RUNNER_REGISTRY:
            raise HTTPException(status_code=400, detail=f"Unknown run_type in chain: '{step}'")

    from ..services.scheduler import trigger_chain
    run_ids = await trigger_chain(req.steps)
    return {
        "chain_steps": req.steps,
        "run_ids": run_ids,
        "status": "started",
    }


# ── Scheduled Jobs Info ──

@router.get("/schedules")
async def list_schedules():
    """List all scheduled pipeline jobs."""
    from ..services.scheduler import get_scheduled_jobs
    return {"schedules": get_scheduled_jobs()}


# ── Queue Health ──

@router.get("/health")
async def queue_health():
    """Check job queue and scheduler health."""
    from ..services.job_queue import is_redis_available
    from ..services.scheduler import get_scheduled_jobs
    from ..services.auth import is_auth_enabled
    return {
        "redis_connected": is_redis_available(),
        "auth_enabled": is_auth_enabled(),
        "scheduled_jobs": len(get_scheduled_jobs()),
        "available_run_types": list(RUNNER_REGISTRY.keys()),
    }
