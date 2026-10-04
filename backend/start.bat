@echo off
setlocal
cd /d "%~dp0"

if exist ".venv-live\Scripts\python.exe" (
  ".venv-live\Scripts\python.exe" -c "import fastapi, sqlalchemy, groq" >nul 2>nul
  if not errorlevel 1 goto run_backend
)

echo Backend Python environment is not ready.
echo Run setup.bat first. It creates a clean environment and installs backend packages.
pause
exit /b 1

:run_backend
echo Starting Voice Agent Studio API on http://localhost:8000
".venv-live\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
