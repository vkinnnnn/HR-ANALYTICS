"""
Upload Router — CSV file upload, pipeline orchestration, data reload, and loading status.
"""

import os
import shutil
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from ..data_loader import get_employees, get_history, is_loaded, load_and_process, load_recognition, is_recognition_loaded, get_recognition, _data_cache
from ..services.knowledge_base import rebuild_knowledge_base
from ..services.pipeline_orchestrator import pipeline_orchestrator
from ..services.file_processor import process_file
from ..cache import invalidate_all as _invalidate_cache

router = APIRouter()

UPLOAD_DIR = os.environ.get(
    "UPLOAD_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"),
)

_upload_metadata: dict = {}
_pipeline_state: Dict[str, Any] = {
    "status": "idle",  # idle, running, completed, failed
    "current_stage": None,
    "progress_percent": 0,
    "file": None,
    "error": None,
    "start_time": None,
    "end_time": None,
}


@router.post("/csv")
async def upload_csv(file: UploadFile = File(...)):
    """Accept a CSV file upload, save it to the data directory, and trigger a reload."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    dest_path = os.path.join(UPLOAD_DIR, file.filename)

    try:
        contents = await file.read()
        with open(dest_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    file_size = len(contents)

    _upload_metadata[file.filename] = {
        "filename": file.filename,
        "size_bytes": file_size,
        "uploaded_at": datetime.now().isoformat(),
        "path": dest_path,
    }

    # Attempt to reload data after upload
    reload_status = "skipped"
    reload_error = None
    try:
        load_and_process(UPLOAD_DIR)
        load_recognition(UPLOAD_DIR)
        _invalidate_cache()
        reload_status = "success"
    except Exception as e:
        reload_error = str(e)
        reload_status = "failed"

    return {
        "status": "uploaded",
        "filename": file.filename,
        "size_bytes": file_size,
        "saved_to": dest_path,
        "reload_status": reload_status,
        "reload_error": reload_error,
    }


@router.get("/status")
async def get_status():
    """Return data loading status including row counts and load timestamp."""
    loaded = is_loaded()

    result = {
        "is_loaded": loaded,
        "employee_count": 0,
        "history_count": 0,
        "active_count": 0,
        "departed_count": 0,
        "loaded_at": None,
        "upload_dir": UPLOAD_DIR,
        "recent_uploads": list(_upload_metadata.values()),
    }

    if loaded:
        try:
            emp_df = get_employees()
            hist_df = get_history()
            result["employee_count"] = len(emp_df)
            result["history_count"] = len(hist_df)
            result["active_count"] = int(emp_df["is_active"].sum())
            result["departed_count"] = int((~emp_df["is_active"]).sum())
        except Exception:
            pass

        # Try to get loaded_at from data_loader cache
        from ..data_loader import _data_cache
        loaded_at = _data_cache.get("_loaded_at")
        if loaded_at is not None:
            result["loaded_at"] = str(loaded_at)

    # Recognition data status
    if is_recognition_loaded():
        try:
            rdf = get_recognition()
            result["recognition_count"] = len(rdf)
            result["recognition_categories"] = int(rdf["category_id"].nunique()) if len(rdf) > 0 else 0
            result["recognition_subcategories"] = int(rdf["subcategory_id"].nunique()) if len(rdf) > 0 else 0
            result["unique_recipients"] = int(rdf["recipient_title"].nunique()) if len(rdf) > 0 else 0
            result["unique_nominators"] = int(rdf["nominator_title"].nunique()) if len(rdf) > 0 else 0
        except Exception:
            pass

    return result


@router.post("/reload")
async def reload_data():
    """Re-trigger load_and_process() to refresh all cached data."""
    try:
        load_and_process(UPLOAD_DIR)
        load_recognition(UPLOAD_DIR)
        _invalidate_cache()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Data files not found in {UPLOAD_DIR}: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload data: {str(e)}",
        )

    emp_df = get_employees()
    hist_df = get_history()

    return {
        "status": "reloaded",
        "employee_count": len(emp_df),
        "history_count": len(hist_df),
        "active_count": int(emp_df["is_active"].sum()),
        "departed_count": int((~emp_df["is_active"]).sum()),
        "reloaded_at": datetime.now().isoformat(),
    }


@router.post("/pipeline/run")
async def run_pipeline(file: Optional[UploadFile] = File(None)):
    """Execute full pipeline: parse → validate → taxonomy → enrich → knowledge base rebuild."""
    global _pipeline_state

    if _pipeline_state["status"] == "running":
        raise HTTPException(status_code=409, detail="Pipeline already running")

    _pipeline_state = {
        "status": "running",
        "current_stage": "validating",
        "progress_percent": 0,
        "file": file.filename if file else "default",
        "error": None,
        "start_time": datetime.now().isoformat(),
        "end_time": None,
    }

    try:
        # ── Stage 1: Validate file or use default data ──
        csv_path = None
        if file:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            csv_path = os.path.join(UPLOAD_DIR, file.filename)
            contents = await file.read()
            with open(csv_path, "wb") as f:
                f.write(contents)
            _pipeline_state["progress_percent"] = 10
            _pipeline_state["current_stage"] = "processing"

        # ── Stage 2: Load and process data ──
        def progress_callback(stage: str, percent: int):
            _pipeline_state["current_stage"] = stage
            _pipeline_state["progress_percent"] = percent

        load_and_process(UPLOAD_DIR)
        progress_callback("taxonomy", 50)

        # ── Stage 3: Load recognition data ──
        load_recognition(UPLOAD_DIR)
        progress_callback("enrichment", 75)

        # ── Stage 4: Rebuild knowledge base ──
        _invalidate_cache()
        doc_count = rebuild_knowledge_base(_data_cache)
        progress_callback("knowledge_base", 95)

        _pipeline_state = {
            "status": "completed",
            "current_stage": "complete",
            "progress_percent": 100,
            "file": _pipeline_state["file"],
            "error": None,
            "start_time": _pipeline_state["start_time"],
            "end_time": datetime.now().isoformat(),
        }

        emp_df = get_employees()
        return {
            "status": "completed",
            "employee_count": len(emp_df),
            "document_count": doc_count,
            "pipeline_completed_at": _pipeline_state["end_time"],
            "message": "Data loaded, taxonomy generated, knowledge base rebuilt",
        }

    except Exception as e:
        _pipeline_state = {
            "status": "failed",
            "current_stage": "error",
            "progress_percent": _pipeline_state.get("progress_percent", 0),
            "file": _pipeline_state["file"],
            "error": str(e),
            "start_time": _pipeline_state["start_time"],
            "end_time": datetime.now().isoformat(),
        }
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")


@router.get("/pipeline/status")
async def get_pipeline_status():
    """Check pipeline execution status and progress."""
    return _pipeline_state
