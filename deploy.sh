#!/bin/bash
# ════════════════════════════════════════════════════════════════
# Deploy HR Analytics Platform
#   - Backend  → Google Cloud Run
#   - Frontend → Firebase Hosting
#
# Prerequisites:
#   1. gcloud CLI installed: https://cloud.google.com/sdk/docs/install
#   2. firebase CLI installed: npm install -g firebase-tools
#   3. Logged in: gcloud auth login && firebase login
#   4. Project set: gcloud config set project hr-analytics-f23c0
# ════════════════════════════════════════════════════════════════

set -e

PROJECT_ID="hr-analytics-f23c0"
REGION="us-central1"
BACKEND_SERVICE="hr-analytics-backend"

echo "═══════════════════════════════════════════"
echo "  Deploying HR Analytics Platform"
echo "  Project: $PROJECT_ID"
echo "═══════════════════════════════════════════"
echo ""

# ─── Step 1: Deploy Backend to Cloud Run ───
echo "▸ Step 1: Building & deploying backend to Cloud Run..."
echo ""

cd backend

# Read LLM keys from local .env file (these must NOT be committed to git)
if [ -f .env ]; then
  export $(grep -E '^(LLM_PROVIDER|OPENROUTER_API_KEY|OPENROUTER_MODEL|OPENAI_API_KEY|OPENAI_MODEL)=' .env | xargs)
fi

if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
  echo "⚠ WARNING: No LLM API keys found in backend/.env"
  echo "  AI features (chat, reports) will use generic local fallback."
  echo "  Set OPENROUTER_API_KEY or OPENAI_API_KEY in backend/.env to enable AI."
  echo ""
fi

# Build and deploy in one command (uses Cloud Build)
gcloud run deploy $BACKEND_SERVICE \
  --source . \
  --project $PROJECT_ID \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "^;;^CORS_ORIGINS=https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com;;DATABASE_URL=sqlite+aiosqlite:///./hr_platform.db;;DATA_DIR=/app/wh_Dataset;;LLM_PROVIDER=${LLM_PROVIDER:-openrouter};;OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-};;OPENROUTER_MODEL=${OPENROUTER_MODEL:-nvidia/nemotron-3-super-120b-a12b:free};;OPENAI_API_KEY=${OPENAI_API_KEY:-};;OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o-mini}" \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300

cd ..

# Get the Cloud Run URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE \
  --project $PROJECT_ID \
  --region $REGION \
  --format "value(status.url)")

echo ""
echo "✅ Backend deployed at: $BACKEND_URL"
echo ""

# ─── Step 2: Build Frontend with production API URL ───
echo "▸ Step 2: Building frontend with API URL: $BACKEND_URL"
echo ""

cd frontend

# Write the production env file with actual Cloud Run URL
echo "VITE_API_URL=$BACKEND_URL" > .env.production

# Install deps and build
npm install
npm run build

cd ..

echo ""
echo "✅ Frontend built successfully"
echo ""

# ─── Step 3: Deploy Frontend to Firebase Hosting ───
echo "▸ Step 3: Deploying frontend to Firebase Hosting..."
echo ""

firebase deploy --only hosting --project $PROJECT_ID

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo ""
echo "  Frontend: https://${PROJECT_ID}.web.app"
echo "  Backend:  $BACKEND_URL"
echo "  API Docs: $BACKEND_URL/docs"
echo "═══════════════════════════════════════════"
