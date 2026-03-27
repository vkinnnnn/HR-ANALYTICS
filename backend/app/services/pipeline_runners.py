"""
Pipeline Runners — Concrete implementations for each run_type.
Each runner is dispatched as a background thread by run_manager.

Source capability: Regata3010 _sync_taxonomy_runner / _sync_annotation_runner
Local adaptation: workforce domain jobs (data reload, taxonomy, ML training, reports)
"""

import os
import io
import json
import time
import asyncio
import logging
import zipfile
import threading
from datetime import datetime

import pandas as pd

logger = logging.getLogger(__name__)


def data_reload_runner(run_id: int, cancel_event: threading.Event, loop: asyncio.AbstractEventLoop, **kwargs):
    """Full CSV reload + enrichment pipeline."""
    from ..data_loader import load_and_process, get_stats
    from . import run_manager

    data_dir = kwargs.get("data_dir")
    loop.run_until_complete(run_manager.append_log(run_id, f"Loading data from {data_dir}"))
    loop.run_until_complete(run_manager.update_progress(run_id, 1, 4, "Loading CSVs..."))

    if cancel_event.is_set():
        loop.run_until_complete(run_manager.cancel_run(run_id))
        return

    start = time.monotonic()
    result = load_and_process(data_dir)
    duration = round(time.monotonic() - start, 2)

    stats = get_stats()
    loop.run_until_complete(run_manager.update_progress(run_id, 4, 4, "Done"))
    loop.run_until_complete(run_manager.append_log(
        run_id,
        f"Loaded {stats.get('total_employees', 0)} employees, "
        f"{stats.get('history_records', 0)} history records in {duration}s"
    ))
    loop.run_until_complete(run_manager.complete_run(run_id))


def taxonomy_regen_runner(run_id: int, cancel_event: threading.Event, loop: asyncio.AbstractEventLoop, **kwargs):
    """Re-run taxonomy classification with batch processing."""
    from ..data_loader import get_employees, get_history, load_and_process
    from ..taxonomy import clear_taxonomy, run_taxonomy
    from .batch_processor import create_batches, run_sequential, BatchConfig
    from . import run_manager

    loop.run_until_complete(run_manager.append_log(run_id, "Starting taxonomy regeneration"))

    emp = get_employees()
    hist = get_history()
    total = len(emp) + len(hist)
    loop.run_until_complete(run_manager.update_progress(run_id, 0, 3, f"Processing {total} records"))

    if cancel_event.is_set():
        loop.run_until_complete(run_manager.cancel_run(run_id))
        return

    # Step 1: Clear cache
    clear_taxonomy()
    loop.run_until_complete(run_manager.update_progress(run_id, 1, 3, "Cache cleared"))

    # Step 2: Run taxonomy
    start = time.monotonic()
    result = run_taxonomy(emp, hist)
    duration = round(time.monotonic() - start, 2)

    summary = result.get("summary", {})
    loop.run_until_complete(run_manager.append_log(
        run_id,
        f"Classified {summary.get('unique_titles', 0)} titles, "
        f"{summary.get('total_career_moves', 0)} career moves in {duration}s"
    ))
    loop.run_until_complete(run_manager.update_progress(run_id, 2, 3, "Re-enriching employee data"))

    if cancel_event.is_set():
        loop.run_until_complete(run_manager.cancel_run(run_id))
        return

    # Step 3: Re-enrich employee DataFrame
    load_and_process()
    loop.run_until_complete(run_manager.update_progress(run_id, 3, 3, "Complete"))
    loop.run_until_complete(run_manager.append_log(run_id, f"Taxonomy regeneration complete"))
    loop.run_until_complete(run_manager.complete_run(run_id))


def flight_risk_train_runner(run_id: int, cancel_event: threading.Event, loop: asyncio.AbstractEventLoop, **kwargs):
    """Retrain flight risk ML model."""
    from ..data_loader import get_employees
    from . import run_manager

    loop.run_until_complete(run_manager.append_log(run_id, "Training flight risk model"))
    loop.run_until_complete(run_manager.update_progress(run_id, 0, 3, "Preparing features"))

    emp = get_employees()
    active = emp[emp["is_active"]]
    departed = emp[~emp["is_active"]]

    loop.run_until_complete(run_manager.append_log(
        run_id, f"Training on {len(departed)} departed, scoring {len(active)} active employees"
    ))
    loop.run_until_complete(run_manager.update_progress(run_id, 1, 3, "Training model"))

    if cancel_event.is_set():
        loop.run_until_complete(run_manager.cancel_run(run_id))
        return

    # Import and retrain
    from ..routers.predictions import _model_cache, _train_model
    _model_cache.clear()
    start = time.monotonic()
    _train_model()
    duration = round(time.monotonic() - start, 2)

    loop.run_until_complete(run_manager.update_progress(run_id, 3, 3, "Complete"))
    loop.run_until_complete(run_manager.append_log(run_id, f"Model trained in {duration}s"))
    loop.run_until_complete(run_manager.complete_run(run_id))


def report_generate_runner(run_id: int, cancel_event: threading.Event, loop: asyncio.AbstractEventLoop, **kwargs):
    """Generate executive summary report via LLM."""
    from . import run_manager

    loop.run_until_complete(run_manager.append_log(run_id, "Generating executive summary"))
    loop.run_until_complete(run_manager.update_progress(run_id, 0, 2, "Building context"))

    if cancel_event.is_set():
        loop.run_until_complete(run_manager.cancel_run(run_id))
        return

    # Build context and call LLM
    try:
        from ..routers.reports import _build_report_context, _llm_call

        context = _build_report_context()
        loop.run_until_complete(run_manager.update_progress(run_id, 1, 2, "Calling LLM"))

        system = "You are an HR analytics expert. Write a comprehensive executive summary."
        summary = loop.run_until_complete(_llm_call(system, context))

        # Save to file
        output_dir = os.environ.get("OUTPUT_DIR", "output")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"exec_summary_{run_id}.txt")
        with open(output_path, "w") as f:
            f.write(summary)

        loop.run_until_complete(run_manager.update_progress(run_id, 2, 2, "Complete"))
        loop.run_until_complete(run_manager.append_log(run_id, f"Report saved to {output_path}"))
        loop.run_until_complete(run_manager.complete_run(run_id, output_file=output_path))

    except Exception as e:
        loop.run_until_complete(run_manager.fail_run(run_id, str(e)))


def export_bundle_runner(run_id: int, cancel_event: threading.Event, loop: asyncio.AbstractEventLoop, **kwargs):
    """Generate Power BI export ZIP with all processed data."""
    from ..data_loader import get_employees, get_history
    from . import run_manager

    loop.run_until_complete(run_manager.append_log(run_id, "Building export bundle"))
    loop.run_until_complete(run_manager.update_progress(run_id, 0, 3, "Preparing data"))

    emp = get_employees()
    hist = get_history()

    output_dir = os.environ.get("OUTPUT_DIR", "output")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"export_bundle_{run_id}.zip")

    loop.run_until_complete(run_manager.update_progress(run_id, 1, 3, "Writing CSV files"))

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Employees
        csv_buf = io.StringIO()
        emp.to_csv(csv_buf, index=False)
        zf.writestr("employees.csv", csv_buf.getvalue())

        # History
        csv_buf = io.StringIO()
        hist.to_csv(csv_buf, index=False)
        zf.writestr("job_history.csv", csv_buf.getvalue())

        # Active employees
        csv_buf = io.StringIO()
        emp[emp["is_active"]].to_csv(csv_buf, index=False)
        zf.writestr("active_employees.csv", csv_buf.getvalue())

        # Departed
        csv_buf = io.StringIO()
        emp[~emp["is_active"]].to_csv(csv_buf, index=False)
        zf.writestr("departed_employees.csv", csv_buf.getvalue())

        # README
        readme = f"""Workforce Analytics Export — {datetime.utcnow().strftime('%Y-%m-%d')}
Total employees: {len(emp)}
Active: {emp['is_active'].sum()}
Departed: {(~emp['is_active']).sum()}
History records: {len(hist)}
"""
        zf.writestr("README.txt", readme)

    with open(output_path, "wb") as f:
        f.write(buffer.getvalue())

    size = os.path.getsize(output_path)
    loop.run_until_complete(run_manager.update_progress(run_id, 3, 3, "Complete"))
    loop.run_until_complete(run_manager.append_log(run_id, f"Export saved: {output_path} ({size // 1024}KB)"))
    loop.run_until_complete(run_manager.register_artifact(run_id, "output", f"export_bundle_{run_id}.zip", output_path, size))
    loop.run_until_complete(run_manager.complete_run(run_id, output_file=output_path))


# Registry mapping run_type → runner function
RUNNER_REGISTRY = {
    "data_reload": data_reload_runner,
    "taxonomy_regen": taxonomy_regen_runner,
    "flight_risk_train": flight_risk_train_runner,
    "report_generate": report_generate_runner,
    "export_bundle": export_bundle_runner,
}
