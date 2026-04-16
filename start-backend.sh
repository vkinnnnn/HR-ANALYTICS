#!/bin/bash

# HR Analytics Platform - Backend Server Startup Script

set -e

echo "🚀 Starting HR Analytics Platform Backend Server"
echo "================================================"

# Navigate to backend directory
cd "$(dirname "$0")/backend"

echo "📦 Installing/updating dependencies..."
pip install -q -r requirements.txt 2>/dev/null || pip install -r requirements.txt

echo "✅ Dependencies ready"
echo ""
echo "🔧 Starting backend server on port 8119..."
echo ""
echo "-------------------------------------------"
echo "Backend Information:"
echo "-------------------------------------------"
echo "URL:      http://localhost:8119"
echo "API Docs: http://localhost:8119/docs"
echo "Port:     8119"
echo ""
echo "The server will:"
echo "✓ Load workforce data from wh_Dataset/"
echo "✓ Build ChromaDB knowledge base"
echo "✓ Initialize LangGraph agent"
echo "✓ Start listening for API requests"
echo ""
echo "Watch this terminal for startup messages..."
echo "-------------------------------------------"
echo ""

# Start the backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8119 --reload

