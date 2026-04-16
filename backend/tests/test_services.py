"""Tests for backend services."""

import pytest
from app.services.analytics_engine import get_analytics_engine
from app.services.report_generator import get_report_generator
from app.services.memory_manager import memory_manager
from app.data_loader import _data_cache

@pytest.fixture
def analytics(load_data):
    """Create analytics engine."""
    return get_analytics_engine(_data_cache)

@pytest.fixture
def report_gen(load_data):
    """Create report generator."""
    return get_report_generator(_data_cache)

class TestAnalyticsEngine:
    def test_headcount_summary(self, analytics):
        result = analytics.query("headcount_summary")
        assert "total" in result
        assert "active" in result
        assert result["total"] > 0

    def test_tenure_cohorts(self, analytics):
        result = analytics.query("tenure_cohorts")
        assert "<1yr" in result
        assert "10yr+" in result

class TestReportGenerator:
    def test_executive_summary(self, report_gen):
        summary = report_gen.generate_executive_summary()
        assert len(summary) > 0
        assert "WORKFORCE" in summary

    def test_kpi_export(self, report_gen):
        kpis = report_gen.get_kpi_export()
        assert "headcount" in kpis
        assert "tenure" in kpis

class TestMemoryManager:
    def test_save_retrieve(self):
        user = "test_user_mem"
        memory_manager.save(user, "Test fact")
        facts = memory_manager.get_all(user)
        assert len(facts) > 0
        memory_manager.clear(user)

    def test_search(self):
        user = "test_user_search"
        memory_manager.save(user, "Python is great")
        results = memory_manager.search(user, "python")
        assert len(results) > 0
        memory_manager.clear(user)
