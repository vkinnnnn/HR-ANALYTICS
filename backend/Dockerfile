# ══════════════════════════════════════════════════════════════
# Stage 1: Install heavy ML dependencies (CACHED between deploys)
# ══════════════════════════════════════════════════════════════
FROM python:3.11-slim AS base

# System deps for building native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install heavy deps FIRST (this layer is cached unless requirements-base.txt changes)
COPY requirements-base.txt .
RUN pip install --no-cache-dir -r requirements-base.txt

# ══════════════════════════════════════════════════════════════
# Stage 2: Install light deps + copy app code
# ══════════════════════════════════════════════════════════════
FROM base AS app

# Install light deps (fast, changes more often)
COPY requirements-app.txt .
RUN pip install --no-cache-dir -r requirements-app.txt

# Copy application code
COPY app/ ./app/
COPY services/ ./services/

# Copy data files
COPY wh_Dataset/ ./wh_Dataset/ 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
# Stage 3: Production image (minimal)
# ══════════════════════════════════════════════════════════════
FROM python:3.11-slim AS production

# Runtime-only system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from build stage
COPY --from=app /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=app /usr/local/bin /usr/local/bin

# Copy application
COPY --from=app /app /app

# Environment
ENV PORT=8119
ENV DATA_DIR=/app/wh_Dataset
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8119

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8119/ || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8119", "--workers", "1"]
