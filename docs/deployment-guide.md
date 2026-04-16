# Deployment Guide — Workforce IQ

How to run Workforce IQ locally for development, and deploy to production.

---

## Local Development Setup

### Requirements
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (production) or SQLite (dev default)
- 2GB free disk space
- macOS, Linux, or Windows (WSL2)

### 1. Clone & Setup

```bash
git clone <repo>
cd HR_ANALYTICS_PLATFORM
```

### 2. Backend (Port 8119)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt

# Run migrations (if using PostgreSQL)
alembic upgrade head

# Start server
python -m uvicorn app.main:app --reload --port 8119 --host 0.0.0.0
```

**Expected startup output:**
```
✓ Workforce data loaded: 2,466 employees
✓ Knowledge base built: 25+ documents
✓ Application startup complete
Uvicorn running on http://0.0.0.0:8119
```

### 3. Frontend (Port 3000)

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### 4. Load Sample Data

Place CSV files in `wh_Dataset/`:
```
wh_Dataset/
├── function_wh.csv         (2,466 employees)
├── wh_history_full.csv     (11,803 job changes)
└── wh_user_history_v2.csv  (100 enriched subset)
```

Backend auto-loads on startup. Check `/api` health endpoint:
```bash
curl http://localhost:8119/api/
```

---

## Production Deployment

### Docker (Recommended)

#### Build & Run with Docker Compose

```bash
docker-compose up -d
```

This runs:
- **Backend** on port 8119 (FastAPI)
- **Frontend** on port 3000 (React)
- **PostgreSQL** on port 5432
- **Redis** for caching & job queue

#### Manual Docker Build

**Backend:**
```bash
cd backend
docker build -t workforce-iq-backend:latest .
docker run -p 8119:8119 \
  -e DATABASE_URL=postgresql://user:pass@db:5432/workforce \
  -e OPENAI_API_KEY=sk-... \
  -v /data/wh_Dataset:/app/data \
  workforce-iq-backend:latest
```

**Frontend:**
```bash
cd frontend
docker build -t workforce-iq-frontend:latest .
docker run -p 3000:3000 \
  -e VITE_API_URL=http://localhost:8119/api \
  workforce-iq-frontend:latest
```

---

### Cloud Run (Google Cloud)

#### 1. Authenticate

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

#### 2. Build & Push

```bash
gcloud builds submit backend --tag gcr.io/YOUR_PROJECT/workforce-iq-backend
gcloud builds submit frontend --tag gcr.io/YOUR_PROJECT/workforce-iq-frontend
```

#### 3. Deploy Backend

```bash
gcloud run deploy workforce-iq-backend \
  --image gcr.io/YOUR_PROJECT/workforce-iq-backend:latest \
  --port 8119 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --set-env-vars DATABASE_URL=postgresql://...,OPENAI_API_KEY=sk-... \
  --allow-unauthenticated
```

#### 4. Deploy Frontend

```bash
gcloud run deploy workforce-iq-frontend \
  --image gcr.io/YOUR_PROJECT/workforce-iq-frontend:latest \
  --port 3000 \
  --memory 512Mi \
  --set-env-vars VITE_API_URL=https://backend-service-url/api \
  --allow-unauthenticated
```

---

### Environment Variables

**Backend (`backend/.env`):**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/workforce
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-...  # Alternative LLM provider
DATA_DIR=/data/wh_Dataset
REDIS_URL=redis://localhost:6379
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
SENTRY_DSN=https://...@sentry.io/...
```

**Frontend (`frontend/.env.production`):**
```bash
VITE_API_URL=https://api.yourdomain.com/api
VITE_APP_NAME=Workforce IQ
```

---

### Database Setup

#### PostgreSQL (Production)

```bash
# Create database
createdb workforce_db

# Run migrations
cd backend
alembic upgrade head

# Seed with sample data (optional)
python -c "from app.data_loader import load_and_process; load_and_process('/data/wh_Dataset')"
```

#### SQLite (Development)

Automatically created at `backend/workforce.db`. No setup needed.

---

### Data Upload

#### Via API

```bash
# Single file upload
curl -X POST http://localhost:8119/api/upload/csv \
  -F "file=@wh_Dataset/function_wh.csv"

# Response: { "status": "processing", "job_id": "job_123" }

# Check status
curl http://localhost:8119/api/upload/status/job_123
```

#### Via UI

1. Navigate to **Data Upload** page in Workforce IQ
2. Drag & drop CSV files or select manually
3. Click **Upload**
4. Wait for taxonomy classification (2-5 minutes)

---

### Performance Tuning

#### Backend

**Gunicorn workers** (production):
```bash
gunicorn -w 4 -b 0.0.0.0:8119 app.main:app --timeout 600
```

**Connection pooling** (PostgreSQL):
```bash
export SQLALCHEMY_POOL_SIZE=20
export SQLALCHEMY_MAX_OVERFLOW=40
```

**Caching with Redis:**
```python
# Enable in config
REDIS_CACHE=true
CACHE_TTL=3600  # 1 hour
```

#### Frontend

**Build optimization:**
```bash
npm run build
# Output: dist/ (~200KB gzipped)
```

**Serve with compression:**
```bash
npm install -g http-server
http-server dist/ -g -c-1 -p 3000
```

---

### Monitoring & Logging

#### Sentry (Error Tracking)

```python
# Already integrated in backend
# Set SENTRY_DSN env var
```

#### Logs

**Backend logs:**
```bash
tail -f backend/logs/app.log
```

**Docker logs:**
```bash
docker-compose logs -f backend
```

**Cloud Run logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=workforce-iq-backend" --limit=50
```

---

### Backup & Recovery

#### Database Backup (PostgreSQL)

```bash
# Full backup
pg_dump -h localhost -U user workforce_db > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U user workforce_db < backup_20240415.sql
```

#### Data Files

```bash
# Backup CSV uploads
tar -czf wh_dataset_backup.tar.gz wh_Dataset/

# Restore
tar -xzf wh_dataset_backup.tar.gz
```

---

### Troubleshooting

#### Backend won't start
```bash
# Check port 8119 is free
lsof -i :8119
kill -9 <PID>

# Check Python version
python --version  # Must be 3.10+

# Check database connection
export DATABASE_URL=postgresql://...
psql $DATABASE_URL -c "SELECT 1"
```

#### Frontend can't reach backend
```bash
# Verify API URL
grep VITE_API_URL .env.development

# Test API directly
curl http://localhost:8119/api/

# Check CORS headers
curl -i http://localhost:8119/api/ | grep -i "access-control"
```

#### Data not loading
```bash
# Check file paths
ls -la wh_Dataset/

# Manually trigger load
curl -X POST http://localhost:8119/api/upload/process \
  -H "Content-Type: application/json" \
  -d '{"data_dir": "/data/wh_Dataset"}'
```

---

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Build & Push Backend
        run: |
          gcloud builds submit backend \
            --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/workforce-iq-backend
      
      - name: Deploy Backend
        run: |
          gcloud run deploy workforce-iq-backend \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/workforce-iq-backend \
            --allow-unauthenticated
```

---

## Security Checklist

- [ ] Set `OPENAI_API_KEY` in secrets (never in git)
- [ ] Enable HTTPS/TLS in production
- [ ] Set `CORS_ORIGINS` to your domain(s) only
- [ ] Enable database encryption at rest
- [ ] Use strong database passwords
- [ ] Enable audit logging for data access
- [ ] Set up VPN or private network for database
- [ ] Enable API authentication (JWT tokens)
- [ ] Rate limit `/chat` endpoint to prevent abuse
- [ ] Run security scans: `bandit`, `safety check`
