# Multi-stage build for frontend and backend

# Stage 1: Build frontend
FROM node:20-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM python:3.13-slim as backend
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/app/ app/
COPY wh_Dataset/ wh_Dataset/

# Stage 3: Production runtime
FROM python:3.13-slim
WORKDIR /app

# Install minimal dependencies
RUN pip install --no-cache-dir fastapi uvicorn

# Copy from backend stage
COPY --from=backend /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=backend /app/app app/
COPY --from=backend /app/wh_Dataset wh_Dataset/

# Copy frontend from frontend-builder (optional - for serving static files)
COPY --from=frontend-builder /app/frontend/dist /app/static

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/brain/health').read()" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
