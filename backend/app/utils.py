"""Utility functions for serialization and data handling."""

import numpy as np
from datetime import datetime
from typing import Any

def serialize_numpy(obj: Any) -> Any:
    """Convert numpy types to Python native types for JSON serialization."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: serialize_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [serialize_numpy(item) for item in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj
