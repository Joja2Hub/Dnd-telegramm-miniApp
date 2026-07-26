@echo off
setlocal

echo.
echo Installing Cloudflare Tunnel helper...
echo.

where winget >nul 2>nul
if errorlevel 1 (
  echo ERROR: winget was not found. Install cloudflared manually from Cloudflare docs.
  pause
  exit /b 1
)

winget install --id Cloudflare.cloudflared
echo.
echo Done. Start public_host\START_PUBLIC_SERVER.bat after installation finishes.
pause
