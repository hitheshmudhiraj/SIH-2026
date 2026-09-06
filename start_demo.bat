@echo off
echo ===================================================================
echo   RailBlock AI: Intelligent Railway Maintenance Block Planning
echo   Smart India Hackathon Prototype Launcher
echo ===================================================================
echo.

echo Starting FastAPI Backend on http://localhost:8000 ...
start "RailBlock AI - FastAPI Backend" cmd /k "cd backend && python main.py"

timeout /t 3 /nobreak >nul

echo Starting React Frontend on http://localhost:5173 ...
start "RailBlock AI - React Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================================
echo   Services are running!
echo   Frontend: http://localhost:5173
echo   Backend API & Swagger Docs: http://localhost:8000/docs
echo ===================================================================
pause
