import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .data_loader import load_and_process, is_loaded
from .routers import (
    workforce,
    turnover,
    tenure,
    careers,
    managers,
    org,
    predictions,
    chat,
    reports,
    upload,
    taxonomy_router,
    pipeline_router,
    ws,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB
    await init_db()

    # Initialize job queue (ARQ+Redis or thread fallback)
    from .services.job_queue import init_queue
    await init_queue()

    # Initialize Sentry (if DSN configured)
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            sentry_sdk.init(dsn=sentry_dsn, integrations=[FastApiIntegration(), SqlalchemyIntegration()], traces_sample_rate=0.2)
            print(f"Sentry initialized")
        except Exception as e:
            print(f"Sentry init failed: {e}")

    # Initialize scheduler
    from .services.scheduler import init_scheduler
    scheduler = init_scheduler()

    # Auto-load data if dataset directory exists
    data_dir = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"))
    if os.path.isdir(data_dir):
        try:
            load_and_process(data_dir)
            print(f"Data loaded from {data_dir}")
        except Exception as e:
            print(f"Warning: Could not auto-load data: {e}")

    yield

    # Shutdown
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="HR Workforce Analytics Platform",
    version="2.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:3000",
]
extra_origins = os.environ.get("CORS_ORIGINS", "")
if extra_origins:
    allowed_origins.extend(extra_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workforce.router, prefix="/api/workforce", tags=["Workforce"])
app.include_router(turnover.router, prefix="/api/turnover", tags=["Turnover"])
app.include_router(tenure.router, prefix="/api/tenure", tags=["Tenure"])
app.include_router(careers.router, prefix="/api/careers", tags=["Careers"])
app.include_router(managers.router, prefix="/api/managers", tags=["Managers"])
app.include_router(org.router, prefix="/api/org", tags=["Org Structure"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(taxonomy_router.router, prefix="/api/taxonomy", tags=["Taxonomy"])
app.include_router(pipeline_router.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(ws.router, tags=["WebSocket"])


@app.get("/")
async def root():
    from .data_loader import get_stats
    return {"message": "HR Workforce Analytics Platform", "version": "2.0.0", "data": get_stats()}
