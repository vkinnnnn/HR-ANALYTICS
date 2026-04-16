import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

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
    reports,
    upload,
    settings,
    taxonomy_router,
    pipeline_router,
    ws,
    brain_router,
    chat_stream,
    simple_chat,
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
            print(f"Workforce data loaded from {data_dir}")
        except Exception as e:
            print(f"Warning: Could not auto-load workforce data: {e}")

    # Build ChromaDB knowledge base from loaded data
    try:
        from .services.knowledge_base import rebuild_knowledge_base
        from .data_loader import _data_cache
        doc_count = rebuild_knowledge_base(_data_cache)
        print(f"[OK] Knowledge base built: {doc_count} documents")
    except Exception as e:
        print(f"[WARNING] Knowledge base build failed: {e}")

    yield

    # Shutdown
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)


from .middleware import ProfilingMiddleware, router as profiling_router
from .error_handlers import configure_error_handlers, setup_logging

# Setup logging
setup_logging()

app = FastAPI(
    title="HR Workforce Analytics Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure error handlers
configure_error_handlers(app)

# Profiling middleware (before CORS so it wraps everything)
app.add_middleware(ProfilingMiddleware)
# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
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
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])
app.include_router(taxonomy_router.router, prefix="/api/taxonomy", tags=["Taxonomy"])
app.include_router(pipeline_router.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(brain_router.router, prefix="/api/brain", tags=["Brain AI"])
app.include_router(chat_stream.router, prefix="/api/chat", tags=["Chat Streaming"])
app.include_router(simple_chat.router, prefix="/api", tags=["Chat"])
app.include_router(profiling_router, prefix="/api", tags=["Profiling"])
app.include_router(ws.router, tags=["WebSocket"])


@app.get("/")
async def root():
    from .data_loader import get_stats
    return {"message": "HR Workforce Analytics Platform", "version": "2.0.0", "data": get_stats()}
