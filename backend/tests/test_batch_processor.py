"""Tests for batch_processor utility."""

import pytest
import threading
from app.services.batch_processor import (
    create_batches,
    run_sequential,
    run_parallel,
    BatchConfig,
    BatchResult,
    ProcessingResult,
)


def test_create_batches():
    items = list(range(10))
    batches = create_batches(items, 3)
    assert len(batches) == 4
    assert batches[0] == [0, 1, 2]
    assert batches[-1] == [9]


def test_create_batches_exact_fit():
    items = list(range(9))
    batches = create_batches(items, 3)
    assert len(batches) == 3
    assert all(len(b) == 3 for b in batches)


def test_create_batches_empty():
    assert create_batches([], 5) == []


def test_sequential_basic():
    processed = []

    def process_fn(batch_id, batch):
        processed.append(batch_id)
        return sum(batch)

    batches = create_batches(list(range(10)), 3)
    result = run_sequential(batches, process_fn, config=BatchConfig(max_retries=0))

    assert result.total_batches == 4
    assert result.completed == 4
    assert result.failed == 0
    assert result.cancelled is False
    assert len(processed) == 4


def test_sequential_with_retry():
    call_counts = {}

    def flaky_fn(batch_id, batch):
        call_counts[batch_id] = call_counts.get(batch_id, 0) + 1
        if call_counts[batch_id] < 2:
            raise ValueError("transient error")
        return len(batch)

    batches = create_batches(list(range(6)), 3)
    config = BatchConfig(max_retries=3, retry_backoff=0.01)
    result = run_sequential(batches, flaky_fn, config=config)

    assert result.completed == 2
    assert result.failed == 0
    assert all(r.retries_used >= 1 for r in result.results)


def test_sequential_permanent_failure():
    def fail_fn(batch_id, batch):
        raise ValueError("permanent error")

    batches = create_batches(list(range(3)), 3)
    config = BatchConfig(max_retries=1, retry_backoff=0.01)
    result = run_sequential(batches, fail_fn, config=config)

    assert result.completed == 0
    assert result.failed == 1
    assert result.results[0].success is False
    assert "permanent error" in result.results[0].error


def test_sequential_cancel():
    cancel_ev = threading.Event()
    processed = []

    def slow_fn(batch_id, batch):
        processed.append(batch_id)
        if batch_id == 1:
            cancel_ev.set()  # Cancel after 2nd batch
        return len(batch)

    batches = create_batches(list(range(15)), 3)
    result = run_sequential(batches, slow_fn, cancel_event=cancel_ev)

    assert result.cancelled is True
    assert len(processed) <= 3  # Should stop shortly after cancel


def test_sequential_checkpoint():
    checkpoints = []

    def process_fn(batch_id, batch):
        return sum(batch)

    def checkpoint_fn(batch_id, accumulated):
        checkpoints.append((batch_id, len(accumulated)))

    batches = create_batches(list(range(20)), 2)
    config = BatchConfig(checkpoint_every=2)
    result = run_sequential(batches, process_fn, config=config, checkpoint_fn=checkpoint_fn)

    assert len(checkpoints) > 0
    assert result.checkpoints_saved == len(checkpoints)


def test_sequential_resume():
    processed = []

    def process_fn(batch_id, batch):
        processed.append(batch_id)
        return len(batch)

    batches = create_batches(list(range(15)), 3)
    config = BatchConfig(resume_from_batch=3)
    result = run_sequential(batches, process_fn, config=config)

    assert result.skipped == 3
    assert result.completed == 2  # Batches 3 and 4
    assert 0 not in processed
    assert 1 not in processed
    assert 2 not in processed


def test_sequential_progress_callback():
    progress_updates = []

    def process_fn(batch_id, batch):
        return len(batch)

    def progress_fn(completed, total, message):
        progress_updates.append((completed, total))

    batches = create_batches(list(range(9)), 3)
    run_sequential(batches, process_fn, progress_fn=progress_fn)

    assert len(progress_updates) == 3
    assert progress_updates[-1] == (3, 3)


def test_parallel_basic():
    def process_fn(batch_id, batch):
        return sum(batch)

    batches = create_batches(list(range(12)), 3)
    config = BatchConfig(max_workers=2, max_retries=0)
    result = run_parallel(batches, process_fn, config=config)

    assert result.total_batches == 4
    assert result.completed == 4
    assert result.failed == 0


def test_parallel_cancel():
    cancel_ev = threading.Event()

    def slow_fn(batch_id, batch):
        import time
        time.sleep(0.1)
        if batch_id >= 2:
            cancel_ev.set()
        return len(batch)

    batches = create_batches(list(range(30)), 3)
    config = BatchConfig(max_workers=2, max_retries=0)
    result = run_parallel(batches, slow_fn, config=config, cancel_event=cancel_ev)

    assert result.cancelled is True
