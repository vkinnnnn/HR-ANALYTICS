#!/bin/bash
# Start the backend server with proper configuration

set -e

echo "Starting Workforce IQ Backend..."
echo "================================"

# Check environment
if [ -z "$OPENAI_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ]; then
    echo "[WARNING] No LLM API key configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY"
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "[1] Creating virtual environment..."
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "[2] Starting FastAPI server..."
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0

