"""
Database models — SQLAlchemy 2.0 async.
SQLite for pipeline run metadata + artifacts registry only. NOT for HR analytics data.

Adapted from Regata3010/HR-Analytics PipelineRun model, extended with:
- cancelled flag, progress tracking, artifact registry
- run_type expanded for workforce analytics domain
"""

from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, DateTime, Text, Boolean, Integer, ForeignKey

from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class PipelineRun(Base):
    """
    Tracks every pipeline execution.
    Source capability: Regata3010 PipelineRun model
    Local adaptation: extended with cancelled, progress, error_detail, artifacts
    """
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_type: Mapped[str] = mapped_column(String(50))
    # run_type values for workforce domain:
    #   "data_reload"      — full CSV reload + enrichment
    #   "taxonomy_regen"   — re-classify grades/titles/moves
    #   "flight_risk_train"— retrain ML model
    #   "report_generate"  — LLM executive summary
    #   "export_bundle"    — Power BI ZIP generation
    #   "batch_enrich"     — batch LLM title standardization

    status: Mapped[str] = mapped_column(String(20), default="pending")
    # States: pending → running → done | failed | cancelled

    input_file: Mapped[str | None] = mapped_column(String(500), nullable=True)
    output_file: Mapped[str | None] = mapped_column(String(500), nullable=True)
    config_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    log: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_cost: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Progress tracking
    total_steps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_steps: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    progress_pct: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)

    # Cancellation
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PipelineArtifact(Base):
    """
    Tracks files produced or consumed by pipeline runs.
    Source capability: Regata3010 output_file field
    Local adaptation: separate table for multiple artifacts per run
    """
    __tablename__ = "pipeline_artifacts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("pipeline_runs.id"))
    artifact_type: Mapped[str] = mapped_column(String(50))  # "input", "output", "checkpoint", "log"
    filename: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
