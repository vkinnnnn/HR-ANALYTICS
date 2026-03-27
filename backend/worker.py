"""
ARQ Worker Process — run separately from the FastAPI server.
Usage: arq worker.WorkerSettings

This handles long-running pipeline jobs via Redis queue.
Falls back gracefully if Redis unavailable (jobs run in-process threads instead).
"""

import os
from arq import cron
from arq.connections import RedisSettings

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")


class WorkerSettings:
    """ARQ worker configuration."""

    redis_settings = RedisSettings.from_dsn(REDIS_URL)

    # Register all task functions
    functions = []

    @staticmethod
    def on_startup(ctx):
        """Initialize data on worker startup."""
        import asyncio
        from app.database import init_db
        from app.data_loader import load_and_process
        asyncio.get_event_loop().run_until_complete(init_db())
        data_dir = os.environ.get("DATA_DIR", "wh_Dataset")
        if os.path.isdir(data_dir):
            load_and_process(data_dir)

    # Import and register functions lazily to avoid circular imports
    @classmethod
    def _load_functions(cls):
        from app.services.job_queue import ARQ_FUNCTIONS
        cls.functions = list(ARQ_FUNCTIONS.values())

    # Cron jobs for scheduled pipeline runs
    cron_jobs = []

    @classmethod
    def _load_cron(cls):
        """Add scheduled jobs if configured."""
        schedule_reload = os.environ.get("SCHEDULE_DATA_RELOAD")  # e.g. "0 2 * * *" (2am daily)
        if schedule_reload:
            parts = schedule_reload.split()
            if len(parts) == 5:
                cls.cron_jobs.append(
                    cron(
                        cls.functions[0] if cls.functions else None,
                        minute={int(parts[0])} if parts[0] != "*" else None,
                        hour={int(parts[1])} if parts[1] != "*" else None,
                        day={int(parts[2])} if parts[2] != "*" else None,
                        month={int(parts[3])} if parts[3] != "*" else None,
                        weekday={int(parts[4])} if parts[4] != "*" else None,
                    )
                )


# Load functions at import time
try:
    WorkerSettings._load_functions()
    WorkerSettings._load_cron()
except Exception:
    pass  # Functions will be loaded on worker startup
