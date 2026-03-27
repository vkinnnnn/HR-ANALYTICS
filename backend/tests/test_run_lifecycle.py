"""Tests for pipeline run lifecycle transitions."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base, PipelineRun, PipelineArtifact


# Create in-memory test engine
test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
test_session_maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup_db(monkeypatch):
    """Create tables and patch async_session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Patch the session maker used by run_manager
    import app.services.run_manager as rm
    import app.database as db
    monkeypatch.setattr(rm, "async_session", test_session_maker)
    monkeypatch.setattr(db, "async_session", test_session_maker)
    yield


@pytest.mark.asyncio
async def test_create_run():
    from app.services.run_manager import create_run, get_run
    run = await create_run("data_reload", input_file="/data/test.csv")
    assert run.id is not None
    assert run.status == "pending"
    assert run.run_type == "data_reload"


@pytest.mark.asyncio
async def test_run_lifecycle_happy_path():
    from app.services.run_manager import create_run, start_run, complete_run, get_run
    run = await create_run("taxonomy_regen")
    assert run.status == "pending"

    await start_run(run.id)
    refreshed = await get_run(run.id)
    assert refreshed.status == "running"

    await complete_run(run.id, output_file="/output/result.zip", total_cost=0.05)
    refreshed = await get_run(run.id)
    assert refreshed.status == "done"
    assert refreshed.output_file == "/output/result.zip"


@pytest.mark.asyncio
async def test_run_lifecycle_failure():
    from app.services.run_manager import create_run, start_run, fail_run, get_run
    run = await create_run("flight_risk_train")
    await start_run(run.id)
    await fail_run(run.id, "Not enough data")

    refreshed = await get_run(run.id)
    assert refreshed.status == "failed"
    assert refreshed.error_detail == "Not enough data"


@pytest.mark.asyncio
async def test_run_cancellation():
    from app.services.run_manager import create_run, start_run, cancel_run, get_run
    run = await create_run("report_generate")
    await start_run(run.id)

    was_running = await cancel_run(run.id)
    assert was_running is True

    refreshed = await get_run(run.id)
    assert refreshed.status == "cancelled"
    assert refreshed.cancelled is True


@pytest.mark.asyncio
async def test_progress_updates():
    from app.services.run_manager import create_run, start_run, update_progress, get_run
    run = await create_run("data_reload")
    await start_run(run.id)

    await update_progress(run.id, 5, 10, "Halfway")
    refreshed = await get_run(run.id)
    assert refreshed.completed_steps == 5
    assert refreshed.progress_pct == 50.0


@pytest.mark.asyncio
async def test_append_log():
    from app.services.run_manager import create_run, append_log, get_run
    run = await create_run("data_reload")
    await append_log(run.id, "Starting...")
    await append_log(run.id, "Done!")

    refreshed = await get_run(run.id)
    assert "Starting..." in refreshed.log
    assert "Done!" in refreshed.log


@pytest.mark.asyncio
async def test_list_runs_ordering():
    from app.services.run_manager import create_run, list_runs
    await create_run("data_reload")
    await create_run("taxonomy_regen")
    await create_run("flight_risk_train")

    runs = await list_runs(limit=10)
    assert len(runs) == 3
    assert runs[0].run_type == "flight_risk_train"


@pytest.mark.asyncio
async def test_artifact_registration():
    from app.services.run_manager import create_run, register_artifact, get_artifacts
    run = await create_run("export_bundle")
    await register_artifact(run.id, "output", "export.zip", "/output/export.zip", 1024000)

    artifacts = await get_artifacts(run.id)
    assert len(artifacts) == 1
    assert artifacts[0].filename == "export.zip"


@pytest.mark.asyncio
async def test_get_nonexistent_run():
    from app.services.run_manager import get_run
    run = await get_run(9999)
    assert run is None
