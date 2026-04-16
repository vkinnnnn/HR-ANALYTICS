#!/bin/bash
# Start the frontend development server

set -e

echo "Starting Workforce IQ Frontend..."
echo "=================================="

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "[1] Installing dependencies..."
    npm install
fi

echo "[2] Starting Vite dev server..."
npm run dev

