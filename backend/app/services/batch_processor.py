"""
Generic Batch Processor — reusable utility for chunked processing with:
- Configurable batch_size, workers, retries, backoff
- Checkpointing every N batches for resumability
- Cancel flag for cooperative interruption
- Progress callback for live tracking

Source capability: Regata3010 ThreadPoolExecutor + checkpoint pattern
Local adaptation: generic utility not tied to LLM/taxonomy domain
"""

import os
import json
import time
import logging
import traceback
from typing import Callable, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from threading import Event

logger = logging.getLogger(__name__)

CHECKPOINT_DIR = os.environ.get("CHECKPOINT_DIR", "checkpoints")


@dataclass
class BatchConfig:
    batch_size: int = int(os.environ.get("DEFAULT_BATCH_SIZE", "50"))
    max_workers: int = min(int(os.environ.get("MAX_WORKERS", "4")), 8)
    max_retries: int = int(os.environ.get("MAX_RETRIES", "3"))
    retry_backoff: float = 2.0  # exponential backoff base
    checkpoint_every: int = int(os.environ.get("CHECKPOINT_EVERY_N_BATCHES", "5"))
    resume_from_batch: int = 0


@dataclass
class BatchResult:
    batch_id: int
    success: bool
    data: Any = None
    error: str | None = None
    retries_used: int = 0
    duration_ms: int = 0


@dataclass
class ProcessingResult:
    total_batches: int = 0
    completed: int = 0
    failed: int = 0
    skipped: int = 0
    results: list[BatchResult] = field(default_factory=list)
    checkpoints_saved: int = 0
    resumed_from: int = 0
    cancelled: bool = False
    total_duration_ms: int = 0


def create_batches(items: list, batch_size: int) -> list[list]:
    """Split a list into batches of batch_size."""
    return [items[i:i + batch_size] for i in range(0, len(items), batch_size)]


def run_sequential(
    batches: list[list],
    process_fn: Callable[[int, list], Any],
    config: BatchConfig = BatchConfig(),
    cancel_event: Event | None = None,
    progress_fn: Callable[[int, int, str], None] | None = None,
    checkpoint_fn: Callable[[int, Any], None] | None = None,
    run_id: str | None = None,
) -> ProcessingResult:
    """
    Process batches sequentially with retry, checkpoint, and cancel support.
    Adapted from Regata3010 taxonomy runner sequential pattern.

    Args:
        batches: list of item batches
        process_fn: function(batch_id, batch_items) → result
        config: BatchConfig with retry/checkpoint settings
        cancel_event: threading.Event to check for cancellation
        progress_fn: callback(completed, total, message)
        checkpoint_fn: callback(batch_id, accumulated_results) to save checkpoint
        run_id: identifier for checkpoint filenames
    """
    result = ProcessingResult(
        total_batches=len(batches),
        resumed_from=config.resume_from_batch,
    )
    start_time = time.monotonic()
    accumulated = []

    for batch_id, batch in enumerate(batches):
        if batch_id < config.resume_from_batch:
            result.skipped += 1
            continue

        if cancel_event and cancel_event.is_set():
            result.cancelled = True
            logger.info(f"Run {run_id}: cancelled at batch {batch_id}")
            break

        batch_result = _process_with_retry(batch_id, batch, process_fn, config)
        result.results.append(batch_result)

        if batch_result.success:
            result.completed += 1
            accumulated.append(batch_result.data)
        else:
            result.failed += 1
            logger.warning(f"Run {run_id}: batch {batch_id} failed after {config.max_retries} retries: {batch_result.error}")

        # Checkpoint
        if checkpoint_fn and (batch_id + 1) % config.checkpoint_every == 0:
            try:
                checkpoint_fn(batch_id, accumulated)
                result.checkpoints_saved += 1
            except Exception as e:
                logger.warning(f"Checkpoint save failed at batch {batch_id}: {e}")

        # Progress callback
        if progress_fn:
            pct = round((batch_id + 1) / len(batches) * 100, 1)
            progress_fn(batch_id + 1, len(batches), f"Batch {batch_id + 1}/{len(batches)} ({pct}%)")

    result.total_duration_ms = int((time.monotonic() - start_time) * 1000)
    return result


def run_parallel(
    batches: list[list],
    process_fn: Callable[[int, list], Any],
    config: BatchConfig = BatchConfig(),
    cancel_event: Event | None = None,
    progress_fn: Callable[[int, int, str], None] | None = None,
    run_id: str | None = None,
) -> ProcessingResult:
    """
    Process batches in parallel with ThreadPoolExecutor.
    Adapted from Regata3010 annotation runner parallel pattern.
    """
    result = ProcessingResult(total_batches=len(batches))
    start_time = time.monotonic()

    effective_workers = min(config.max_workers, len(batches))

    with ThreadPoolExecutor(max_workers=effective_workers) as executor:
        future_to_batch = {}
        for batch_id, batch in enumerate(batches):
            if batch_id < config.resume_from_batch:
                result.skipped += 1
                continue
            future = executor.submit(_process_with_retry, batch_id, batch, process_fn, config)
            future_to_batch[future] = batch_id

        for future in as_completed(future_to_batch):
            if cancel_event and cancel_event.is_set():
                result.cancelled = True
                executor.shutdown(wait=False, cancel_futures=True)
                break

            batch_result = future.result()
            result.results.append(batch_result)

            if batch_result.success:
                result.completed += 1
            else:
                result.failed += 1

            if progress_fn:
                done = result.completed + result.failed
                pct = round(done / result.total_batches * 100, 1)
                progress_fn(done, result.total_batches, f"Completed {done}/{result.total_batches} ({pct}%)")

    result.total_duration_ms = int((time.monotonic() - start_time) * 1000)
    return result


def _process_with_retry(
    batch_id: int,
    batch: list,
    process_fn: Callable,
    config: BatchConfig,
) -> BatchResult:
    """Execute process_fn with exponential backoff retry."""
    last_error = None
    for attempt in range(config.max_retries + 1):
        start = time.monotonic()
        try:
            data = process_fn(batch_id, batch)
            duration = int((time.monotonic() - start) * 1000)
            return BatchResult(batch_id=batch_id, success=True, data=data, retries_used=attempt, duration_ms=duration)
        except Exception as e:
            last_error = str(e)
            if attempt < config.max_retries:
                sleep_time = config.retry_backoff ** attempt
                logger.info(f"Batch {batch_id} attempt {attempt + 1} failed, retrying in {sleep_time}s: {e}")
                time.sleep(sleep_time)

    duration = int((time.monotonic() - start) * 1000)
    return BatchResult(batch_id=batch_id, success=False, error=last_error, retries_used=config.max_retries, duration_ms=duration)


def save_checkpoint(run_id: str, batch_id: int, data: Any, checkpoint_dir: str = CHECKPOINT_DIR):
    """Save checkpoint to disk for resumability."""
    os.makedirs(checkpoint_dir, exist_ok=True)
    path = os.path.join(checkpoint_dir, f"checkpoint_{run_id}_batch_{batch_id}.json")
    with open(path, "w") as f:
        json.dump({"run_id": run_id, "batch_id": batch_id, "data": data}, f, default=str)
    return path


def load_checkpoint(run_id: str, checkpoint_dir: str = CHECKPOINT_DIR) -> tuple[int, Any] | None:
    """Load latest checkpoint for a run. Returns (batch_id, data) or None."""
    if not os.path.isdir(checkpoint_dir):
        return None
    checkpoints = sorted(
        [f for f in os.listdir(checkpoint_dir) if f.startswith(f"checkpoint_{run_id}_")],
        reverse=True,
    )
    if not checkpoints:
        return None
    path = os.path.join(checkpoint_dir, checkpoints[0])
    with open(path) as f:
        cp = json.load(f)
    return cp["batch_id"], cp.get("data")
