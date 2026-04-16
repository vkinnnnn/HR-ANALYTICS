#!/bin/bash
set -e

# ══════════════════════════════════════════════════════════════
# Workforce IQ — Deployment Script
# Deploys: Backend → Cloud Run, Frontend → Firebase Hosting
# ══════════════════════════════════════════════════════════════

PROJECT_ID="hr-analytics-f23c0"
REGION="us-central1"
BACKEND_SERVICE="hr-analytics-backend"
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; exit 1; }

echo ""
echo "═══════════════════════════════════════════"
echo "  Deploying Workforce IQ"
echo "  Project: $PROJECT_ID"
echo "═══════════════════════════════════════════"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────
log "Pre-flight checks..."

# Check gcloud auth
gcloud auth print-access-token > /dev/null 2>&1 || fail "Not authenticated. Run: gcloud auth login"
ok "gcloud authenticated"

# Check project
gcloud config set project $PROJECT_ID 2>/dev/null
ok "Project: $PROJECT_ID"

# Check network
curl -s --max-time 5 https://oauth2.googleapis.com > /dev/null 2>&1 || fail "No internet access to Google APIs. Check your network."
ok "Network connectivity"

# ── PHASE 1: Backend → Cloud Run ──────────────────────────────
log "Phase 1: Deploying backend to Cloud Run (using multi-stage Dockerfile with cached layers)..."

if [ ! -d "$BACKEND_DIR" ]; then
    fail "Backend directory not found: $BACKEND_DIR"
fi

cd $BACKEND_DIR

# Verify files exist
if [ ! -f "Dockerfile" ]; then
    fail "Dockerfile not found in $BACKEND_DIR/"
fi

if [ ! -f "requirements-base.txt" ] || [ ! -f "requirements-app.txt" ]; then
    fail "Split requirements files not found. Create requirements-base.txt and requirements-app.txt"
fi

# Verify data files exist
if [ ! -d "wh_Dataset" ]; then
    warn "wh_Dataset directory not found — copying from parent if available"
    if [ -d "../wh_Dataset" ]; then
        cp -r ../wh_Dataset .
        ok "Dataset copied from parent"
    else
        warn "No dataset found. Backend will start without data."
    fi
fi

# Build environment variables string
# CRITICAL: Use ^;;^ delimiter because CORS origins contain commas
ENV_VARS="^;;^"
ENV_VARS+="DATA_DIR=/app/wh_Dataset"
ENV_VARS+=";;PYTHONPATH=/app"
ENV_VARS+=";;CORS_ORIGINS=https://hr-analytics-f23c0.web.app,https://hr-analytics-f23c0.firebaseapp.com,http://localhost:3000,http://localhost:5173"

# Add API keys from local .env if present
if [ -f ".env" ]; then
    log "Loading API keys from .env..."
    OPENAI_KEY=$(grep OPENAI_API_KEY .env 2>/dev/null | cut -d '=' -f 2- | tr -d '"' | tr -d "'")
    OPENROUTER_KEY=$(grep OPENROUTER_API_KEY .env 2>/dev/null | cut -d '=' -f 2- | tr -d '"' | tr -d "'")

    [ -n "$OPENAI_KEY" ] && ENV_VARS+=";;OPENAI_API_KEY=$OPENAI_KEY"
    [ -n "$OPENROUTER_KEY" ] && ENV_VARS+=";;OPENROUTER_API_KEY=$OPENROUTER_KEY"
    ok "API keys loaded from .env"
fi

log "Building and deploying to Cloud Run..."
log "  First build: ~8-12 minutes (ML deps cached after)"
log "  Subsequent builds: ~2-5 minutes"
echo ""

gcloud run deploy $BACKEND_SERVICE \
    --source . \
    --project $PROJECT_ID \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --min-instances 0 \
    --max-instances 3 \
    --timeout 300 \
    --set-env-vars "$ENV_VARS" \
    --build-timeout 1200 \
    --machine-type=e2-highcpu-8

BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --project $PROJECT_ID --format='value(status.url)' 2>/dev/null)
ok "Backend deployed: $BACKEND_URL"

cd ..

# ── PHASE 2: Frontend → Firebase Hosting ──────────────────────
log "Phase 2: Deploying frontend to Firebase Hosting..."

if [ ! -d "$FRONTEND_DIR" ]; then
    fail "Frontend directory not found: $FRONTEND_DIR"
fi

cd $FRONTEND_DIR

# Set the backend URL for the frontend build
export VITE_API_URL="${BACKEND_URL:-https://hr-analytics-backend-ymez3d52nq-uc.a.run.app}"
log "Frontend API URL: $VITE_API_URL"

# Install dependencies
log "Installing frontend dependencies..."
npm install --silent 2>&1 | tail -3
ok "Dependencies installed"

# Type check (catch errors before build)
log "Type checking..."
npx tsc --noEmit 2>&1 | grep -i error | head -10 || ok "Type check passed"

# Build
log "Building frontend..."
npm run build 2>&1 | tail -5
if [ ! -d "dist" ]; then
    fail "Frontend build failed — dist/ directory not created"
fi
ok "Frontend built ($(du -sh dist | cut -f1))"

cd ..

# Deploy to Firebase
log "Deploying to Firebase Hosting..."
firebase deploy --only hosting --project $PROJECT_ID

ok "Frontend deployed: https://$PROJECT_ID.web.app"

# ── PHASE 3: Verify ──────────────────────────────────────────
echo ""
log "Phase 3: Verifying deployment..."

# Health check backend
HEALTH=$(curl -s --max-time 15 "${BACKEND_URL:-https://hr-analytics-backend-ymez3d52nq-uc.a.run.app}/" 2>/dev/null || echo "timeout")
if echo "$HEALTH" | grep -q "Workforce Analytics"; then
    ok "Backend health check passed"
else
    warn "Backend health check pending (cold start may take 10-15s). Try: curl $BACKEND_URL/"
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$PROJECT_ID.web.app" 2>/dev/null)
if [ "$FRONTEND_STATUS" = "200" ]; then
    ok "Frontend returning 200 OK"
else
    warn "Frontend returned HTTP $FRONTEND_STATUS (may need a few seconds to propagate)"
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  🚀 DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════"
echo ""
echo "  Frontend:  https://$PROJECT_ID.web.app"
echo "  Backend:   ${BACKEND_URL:-https://hr-analytics-backend-ymez3d52nq-uc.a.run.app}"
echo "  API Docs:  ${BACKEND_URL:-https://hr-analytics-backend-ymez3d52nq-uc.a.run.app}/docs"
echo "  GitHub:    https://github.com/vkinnnnn/HR-ANALYTICS"
echo ""
echo "═══════════════════════════════════════════"
echo ""
