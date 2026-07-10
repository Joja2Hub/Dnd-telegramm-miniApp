@echo off
setlocal
cd /d "%~dp0"

fltmc >nul 2>nul
if errorlevel 1 (
  echo Requesting administrator access for temporary Cloudflare VPN bypass routes...
  powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ==========================================
echo DND MiniApp Bot - adaptive VPN-safe Cloudflare launcher
echo ==========================================
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo ERROR: powershell was not found.
  pause
  exit /b 1
)

:restart
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_bot_cloudflare.ps1"
set "LAUNCH_EXIT=%ERRORLEVEL%"

if "%LAUNCH_EXIT%"=="75" (
  echo.
  echo Connection or server was lost. Retrying in 8 seconds...
  timeout /t 8 /nobreak >nul
  goto restart
)

echo.
if not "%LAUNCH_EXIT%"=="0" (
  echo Launcher stopped with error %LAUNCH_EXIT%.
  pause
  exit /b %LAUNCH_EXIT%
)
echo Launcher finished normally.
