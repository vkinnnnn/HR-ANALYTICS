@echo off
REM Start the backend server on Windows

echo Starting Workforce IQ Backend...
echo ================================

REM Check for virtual environment
if not exist venv (
    echo [1] Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install dependencies if needed
echo [1] Installing dependencies...
pip install -r requirements.txt -q

REM Start server
echo [2] Starting FastAPI server on http://localhost:8000
uvicorn app.main:app --reload --port 8000

