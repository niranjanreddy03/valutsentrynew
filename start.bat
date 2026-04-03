@echo off
echo ================================
echo   Secret Sentry - Starting...
echo ================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install
)

REM Check if frontend node_modules exists
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

REM Check if Python venv exists and backend dependencies
echo.
echo NOTE: Make sure Python dependencies are installed:
echo   cd backend ^&^& pip install -r requirements.txt
echo.

echo Starting both servers...
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo ================================
echo.

npm run dev
