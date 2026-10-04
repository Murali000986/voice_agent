@echo off
setlocal
cd /d "%~dp0"

if exist ".venv-live\Scripts\python.exe" (
  ".venv-live\Scripts\python.exe" -c "import fastapi, sqlalchemy, groq" >nul 2>nul
  if not errorlevel 1 goto ready
)

where py >nul 2>nul
if not errorlevel 1 (
  py -3.12 -m venv .venv-live >nul 2>nul
  if not errorlevel 1 goto install
  py -3.11 -m venv .venv-live >nul 2>nul
  if not errorlevel 1 goto install
  py -3 -m venv .venv-live >nul 2>nul
  if not errorlevel 1 goto install
)

where python >nul 2>nul
if not errorlevel 1 (
  python -m venv .venv-live
  if not errorlevel 1 goto install
)

echo Python 3.11 or newer was not found. Install Python from python.org, enable the launcher, then run setup.bat again.
pause
exit /b 1

:install
echo Installing backend packages. This step needs an internet connection on first run.
.venv-live\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 goto failed
.venv-live\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 goto failed

:ready
echo Backend setup is ready. Use start.bat to launch the API.
pause
exit /b 0

:failed
echo Package installation failed. Check your internet connection and rerun setup.bat.
pause
exit /b 1
