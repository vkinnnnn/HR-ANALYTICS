"""Tests for pipeline API endpoint contracts."""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base
from app.main import app


test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
test_session_maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def setup(monkeypatch):
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    import app.services.run_manager as rm
    import app.database as db
    monkeypatch.setattr(rm, "async_session", test_session_maker)
    monkeypatch.setattr(db, "async_session", test_session_maker)
    yield


@pytest.mark.asyncio
async def test_list_run_types():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/pipeline/run-types")
    assert resp.status_code == 200
    ids = [rt["id"] for rt in resp.json()["run_types"]]
    assert "data_reload" in ids
    assert "taxonomy_regen" in ids


@pytest.mark.asyncio
async def test_start_invalid_run_type():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/pipeline/start", json={"run_type": "nonexistent"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_start_run_and_list():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/pipeline/start", json={"run_type": "data_reload"})
        assert resp.status_code == 200
        run_id = resp.json()["run_id"]

        resp = await client.get("/api/pipeline/runs")
        assert resp.status_code == 200
        runs = resp.json()["runs"]
        assert any(r["id"] == run_id for r in runs)


@pytest.mark.asyncio
async def test_get_run_detail():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/pipeline/start", json={"run_type": "taxonomy_regen"})
        run_id = resp.json()["run_id"]

        resp = await client.get(f"/api/pipeline/runs/{run_id}")
        assert resp.status_code == 200
        assert resp.json()["run_type"] == "taxonomy_regen"


@pytest.mark.asyncio
async def test_get_run_log():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/pipeline/start", json={"run_type": "data_reload"})
        run_id = resp.json()["run_id"]

        resp = await client.get(f"/api/pipeline/runs/{run_id}/log")
        assert resp.status_code == 200
        assert "status" in resp.json()


@pytest.mark.asyncio
async def test_cancel_nonexistent_run():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/pipeline/runs/99999/cancel")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_existing_endpoints_intact():
    """Verify pipeline additions don't break existing API."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/")
        assert resp.status_code == 200
        assert "Workforce" in resp.json()["message"]
