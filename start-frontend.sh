#!/bin/bash

# HR Analytics Platform - Frontend Server Startup Script

set -e

echo "🚀 Starting HR Analytics Platform Frontend Server"
echo "=================================================="

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

echo "📦 Installing/updating dependencies..."
npm install -q 2>/dev/null || npm install

echo "✅ Dependencies ready"
echo ""
echo "🔧 Starting frontend dev server on port 3000..."
echo ""
echo "-------------------------------------------"
echo "Frontend Information:"
echo "-------------------------------------------"
echo "URL:        http://localhost:3000"
echo "App URL:    http://localhost:3000/app"
echo "Port:       3000"
echo "Backend:    http://localhost:8119"
echo ""
echo "The server will:"
echo "✓ Compile React + TypeScript"
echo "✓ Start Vite dev server"
echo "✓ Enable hot module reloading"
echo "✓ Connect to backend API"
echo ""
echo "Once ready, open browser to: http://localhost:3000/app"
echo "Press Cmd+K to open chat"
echo ""
echo "Watch this terminal for compilation messages..."
echo "-------------------------------------------"
echo ""

# Start the frontend dev server
npm run dev

