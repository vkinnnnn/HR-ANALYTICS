@echo off
REM Start the frontend development server on Windows

echo Starting Workforce IQ Frontend...
echo ===================================

REM Install dependencies if needed
if not exist node_modules (
    echo [1] Installing dependencies...
    call npm install
)

REM Start dev server
echo [2] Starting Vite dev server on http://localhost:3000
call npm run dev

