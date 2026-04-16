"""Pytest configuration and shared fixtures."""

import pytest
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.data_loader import load_and_process, _data_cache

@pytest.fixture(scope="session")
def load_data():
    """Load data once for all tests."""
    try:
        load_and_process("wh_Dataset")
        return _data_cache
    except Exception as e:
        pytest.skip(f"Could not load data: {e}")
