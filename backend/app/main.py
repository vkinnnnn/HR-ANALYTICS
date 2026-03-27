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
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    # Auto-load data if dataset directory exists
    data_dir = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "wh_Dataset"))
    if os.path.isdir(data_dir):
        try:
            load_and_process(data_dir)
            print(f"Data loaded from {data_dir}")
        except Exception as e:
            print(f"Warning: Could not auto-load data: {e}")
    yield


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


@app.get("/")
async def root():
    from .data_loader import get_stats
    return {"message": "HR Workforce Analytics Platform", "version": "2.0.0", "data": get_stats()}
