@echo off
REM HR Analytics Platform - Windows Startup Script

echo.
echo ================================================================================
echo  HR Workforce Analytics Platform v2.0.0 - Deployment
echo ================================================================================
echo.
echo This script will start both the backend and frontend servers.
echo.
echo Backend:  http://localhost:8119
echo Frontend: http://localhost:3000
echo.
echo Press any key to continue...
pause > /dev/null

echo.
echo Checking for required tools...
python --version >/dev/null 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+ and add it to PATH.
    pause
    exit /b 1
)

node --version >/dev/null 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js 16+ and add it to PATH.
    pause
    exit /b 1
)

echo ✓ Python and Node.js found
echo.

echo Installing dependencies...
cd backend
echo [Backend] Installing Python dependencies...
pip install -q -r requirements.txt >/dev/null 2>&1
if errorlevel 1 (
    echo Error installing backend dependencies
    pause
    exit /b 1
)
cd ..

cd frontend
echo [Frontend] Installing Node dependencies...
call npm install -q >/dev/null 2>&1
if errorlevel 1 (
    echo Error installing frontend dependencies
    pause
    exit /b 1
)
cd ..

echo ✓ All dependencies installed
echo.

echo Starting servers...
echo.
echo NOTE: Two new windows will open - do not close them while using the application!
echo.

REM Start backend in new window
start "HR Analytics - Backend (port 8119)" cmd /k "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8119 --reload"

REM Wait a moment for backend to start
timeout /t 5 /nobreak

REM Start frontend in new window
start "HR Analytics - Frontend (port 3000)" cmd /k "cd frontend && npm run dev"

echo.
echo ================================================================================
echo  Servers Starting...
echo ================================================================================
echo.
echo Backend server starting on:  http://localhost:8119
echo Frontend server starting on: http://localhost:3000
echo.
echo Waiting for servers to be ready (this may take 30-60 seconds)...
echo.

timeout /t 10 /nobreak

echo.
echo ================================================================================
echo  Opening Application in Browser...
echo ================================================================================
echo.

start http://localhost:3000/app

echo.
echo ✓ Application launched!
echo.
echo Once loaded, press Cmd+K (or click the fire orb) to open the chat.
echo.
echo To stop the servers, close the terminal windows.
echo.
pause
