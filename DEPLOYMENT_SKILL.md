# DEPLOYMENT SKILL — Google Cloud Run + Firebase Hosting

## Project: Workforce IQ
## Infrastructure: Backend on Cloud Run, Frontend on Firebase Hosting
## Project ID: hr-analytics-f23c0
## Region: us-central1

---

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────┐     ┌──────────────────────────────────┐
│     Firebase Hosting            │     │     Google Cloud Run              │
│     (Static Frontend)           │     │     (Backend API)                 │
│                                 │     │                                  │
│  React 18 + Vite + Tailwind    │────▶│  FastAPI + LangGraph + ChromaDB  │
│  Built → dist/ → deployed      │     │  Dockerized → deployed           │
│                                 │     │                                  │
│  URL: hr-analytics-f23c0       │     │  Service: hr-analytics-backend   │
│       .web.app                 │     │  URL: hr-analytics-backend-      │
│                                 │     │       ymez3d52nq-uc.a.run.app   │
└─────────────────────────────────┘     └──────────────────────────────────┘
```

---

## 2. KNOWN FAILURE MODES (FROM REAL DEPLOYMENTS)

| Failure | Root Cause | Solution |
|---------|-----------|----------|
| DNS resolution error | Running gcloud from restricted network | Always run deploy from local terminal with internet access |
| Docker build timeout | `sentence-transformers` pulls PyTorch (~2GB), exceeds 10-min default | Use `--timeout=1200` (20 min) on gcloud builds |
| numpy version conflict | `scikit-learn` and `sentence-transformers` require incompatible versions | Pin exact compatible versions |
| numpy==2.0.0rc1 not found | Transitive dependency resolves to release candidate | Pin `numpy>=1.26,<2.1` |
| Cloud Build OOM | Large ML packages exhaust build machine memory | Use `--machine-type=e2-highcpu-8` for builds |
| CORS errors after deploy | Backend URL changes or CORS not configured | Always include both Firebase URLs in CORS origins |
| DATA_DIR wrong in container | Env var points to local path | Set `DATA_DIR=/app/wh_Dataset` explicitly |
| gcloud env var escaping | Comma in CORS origins breaks command | Use `^;;^` delimiter for gcloud env vars |
| Cold start timeout | Cloud Run min-instances=0 means first request takes 10-15s | Acceptable for dev; set `--min-instances=1` for production |

---

## 3. SPLIT REQUIREMENTS (Docker Layer Caching)

### `backend/requirements-base.txt` (Heavy ML deps — cached)
```
# ── Core Framework ──
fastapi==0.115.0
uvicorn[standard]==0.32.0
sqlalchemy[asyncio]==2.0.31
aiosqlite==0.20.0
pydantic-settings==2.3.4

# ── Data ──
pandas==2.2.2
numpy>=1.26.0,<2.1.0
scikit-learn==1.5.2
openpyxl>=3.1.0

# ── ML/NLP (CPU-only PyTorch saves 1.5GB)
--extra-index-url https://download.pytorch.org/whl/cpu
torch==2.4.1+cpu
sentence-transformers==3.1.1

# ── Vector Store ──
chromadb==0.5.23

# ── LLM ──
openai>=1.55.0
langchain>=0.3.0
langchain-openai>=0.2.0
langchain-community>=0.3.0
langgraph>=0.2.0

# ── Graph ──
networkx>=3.3
```

### `backend/requirements-app.txt` (Light app deps — changes frequently)
```
# ── API utilities ──
python-multipart==0.0.9
python-dotenv==1.0.1
orjson>=3.10.0
sse-starlette>=2.0.0
httpx>=0.27.0

# ── File processing ──
PyMuPDF>=1.24.0
Pillow>=10.0.0

# ── Analytics ──
umap-learn==0.5.6
```

---

## 4. DEPLOYMENT COMMANDS

### Full deployment (backend + frontend):
```bash
bash deploy.sh
```

### Frontend-only (fastest):
```bash
cd frontend
VITE_API_URL=https://hr-analytics-backend-ymez3d52nq-uc.a.run.app npm run build
cd ..
firebase deploy --only hosting --project hr-analytics-f23c0
```

### Backend-only:
```bash
cd backend
gcloud run deploy hr-analytics-backend \
    --source . \
    --project hr-analytics-f23c0 \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --build-timeout 1200 \
    --machine-type=e2-highcpu-8 \
    --set-env-vars "^;;^DATA_DIR=/app/wh_Dataset;;PYTHONPATH=/app;;CORS_ORIGINS=https://hr-analytics-f23c0.web.app,http://localhost:3000"
```

### Rollback frontend:
```bash
firebase hosting:rollback --project hr-analytics-f23c0
```

### Rollback backend:
```bash
# List revisions
gcloud run revisions list --service hr-analytics-backend --region us-central1

# Route traffic to previous revision
gcloud run services update-traffic hr-analytics-backend \
    --to-revisions=REVISION_NAME=100 \
    --region us-central1
```

---

## 5. MONITORING

```bash
# Backend health
curl -s https://hr-analytics-backend-ymez3d52nq-uc.a.run.app/health | python -m json.tool

# Cloud Run logs
gcloud run services logs read hr-analytics-backend --limit 50

# Cloud Build history
gcloud builds list --project hr-analytics-f23c0 --limit 5

# Firebase deploy history
firebase hosting:channel:list --project hr-analytics-f23c0
```

---

## 6. CHECKLIST BEFORE DEPLOYMENT

```
[ ] gcloud auth login
[ ] gcloud config set project hr-analytics-f23c0
[ ] firebase login
[ ] backend/.env has OPENAI_API_KEY
[ ] backend/requirements-base.txt uses CPU-only torch
[ ] frontend npm run build succeeds
[ ] Network connectivity to Google APIs OK
```
