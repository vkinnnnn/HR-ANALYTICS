"""
Pipeline Orchestrator — Wraps taxonomy generation + annotation pipeline.

Triggered by the chatbot when a user uploads a CSV or requests a pipeline run.
Reports progress per stage via a callback.
"""

import os
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    success: bool = False
    stages_completed: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    summary: str = ""
    records_processed: int = 0


ProgressCallback = Callable[[str, str, float], Awaitable[None]]


async def _noop_progress(stage: str, message: str, pct: float) -> None:
    pass


async def run_full_pipeline(
    file_path: str,
    progress_callback: ProgressCallback | None = None,
) -> PipelineResult:
    """Run the complete data pipeline: validate → load → compute → rebuild KB."""
    cb = progress_callback or _noop_progress
    result = PipelineResult()

    # Stage 1: Validate
    await cb("validate", "Validating file...", 0.0)
    if not os.path.exists(file_path):
        result.errors.append(f"File not found: {file_path}")
        result.summary = "Pipeline failed: file not found."
        return result

    import pandas as pd
    try:
        df = pd.read_csv(file_path, nrows=5, encoding="utf-8-sig")
        rows = len(pd.read_csv(file_path, encoding="utf-8-sig"))
        result.records_processed = rows
        await cb("validate", f"Valid CSV: {rows} rows, {len(df.columns)} columns", 0.1)
        result.stages_completed.append("validate")
    except Exception as e:
        result.errors.append(f"Validation failed: {e}")
        result.summary = f"Pipeline failed at validation: {e}"
        return result

    # Stage 2: Load and compute derived fields
    await cb("load", "Loading and computing derived fields...", 0.2)
    try:
        data_dir = os.path.dirname(file_path)
        from ..data_loader import load_and_process
        data_cache = load_and_process(data_dir)
        await cb("load", "Workforce data loaded and enriched", 0.5)
        result.stages_completed.append("load")

        from ..recognition_loader import load_recognition, is_recognition_loaded
        try:
            load_recognition(data_dir)
            await cb("load", "Recognition data loaded", 0.6)
        except Exception:
            await cb("load", "No recognition data found, skipping", 0.6)
    except Exception as e:
        result.errors.append(f"Data loading failed: {e}")
        result.summary = f"Pipeline failed at loading: {e}"
        return result

    # Stage 3: Rebuild knowledge base
    await cb("knowledge", "Rebuilding knowledge base...", 0.7)
    try:
        from .knowledge_base import rebuild_knowledge_base
        from ..recognition_loader import _recog_cache
        doc_count = rebuild_knowledge_base(data_cache, _recog_cache)
        await cb("knowledge", f"Knowledge base rebuilt: {doc_count} documents", 0.9)
        result.stages_completed.append("knowledge")
    except Exception as e:
        logger.warning(f"Knowledge base rebuild failed: {e}")
        await cb("knowledge", f"Knowledge base rebuild skipped: {e}", 0.9)

    # Stage 4: Complete
    await cb("complete", "Pipeline complete!", 1.0)
    result.stages_completed.append("complete")
    result.success = True

    emp_count = len(data_cache.get("employees", []))
    hist_count = len(data_cache.get("history", []))
    result.summary = (
        f"Pipeline complete. Processed {rows} records. "
        f"Loaded {emp_count} employees with {hist_count} history records."
    )
    return result


async def recompute_analytics() -> dict[str, Any]:
    """Recompute all analytics from current cached data and rebuild knowledge base."""
    from ..data_loader import _data_cache, is_loaded
    if not is_loaded():
        return {"success": False, "error": "No data loaded"}

    try:
        from .knowledge_base import rebuild_knowledge_base
        from ..recognition_loader import _recog_cache
        doc_count = rebuild_knowledge_base(_data_cache, _recog_cache)
        return {"success": True, "documents": doc_count}
    except Exception as e:
        return {"success": False, "error": str(e)}
