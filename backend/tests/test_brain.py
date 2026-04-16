"""Tests for Brain agent functionality."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.data_loader import load_and_process, _data_cache

@pytest.fixture(scope="session", autouse=True)
def load_data():
    """Load data once for all tests."""
    load_and_process("wh_Dataset")

@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)

class TestBrainHealth:
    def test_health_check(self, client):
        response = client.get("/api/brain/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["workforce_loaded"] is True

class TestChatEndpoint:
    def test_chat_endpoint_exists(self, client):
        response = client.post("/api/brain/chat", json={
            "message": "Hello",
            "user_id": "test_user"
        })
        assert response.status_code == 200
        data = response.json()
        assert "response" in data

class TestReports:
    def test_executive_summary(self, client):
        response = client.get("/api/brain/report/summary")
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert len(data["summary"]) > 0

    def test_kpi_export(self, client):
        response = client.get("/api/brain/report/kpis")
        assert response.status_code == 200
        data = response.json()
        assert "headcount" in data
        assert "tenure" in data
        assert data["headcount"]["total"] > 0

class TestUpload:
    def test_upload_status(self, client):
        response = client.get("/api/upload/status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_loaded"] is True
        assert data["employee_count"] > 0
