@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo DND MiniApp Bot - Cloudflare launcher v6
echo ==========================================
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo ERROR: powershell was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_bot_cloudflare.ps1"

echo.
echo Launcher finished.
pause
