@echo off
setlocal

pushd "%~dp0.."
set "PROJECT_DIR=%CD%"

echo.
echo ==========================================
echo DND MiniApp - PUBLIC server launcher
echo ==========================================
echo.
echo This mode starts the Telegram bot + web server and opens a public HTTPS link through Cloudflare Tunnel.
echo Use local_host\START_LOCAL_SITE.bat instead when players are on the same Wi-Fi.
echo.

if not exist "%PROJECT_DIR%\START_BOT_CLOUDFLARE.bat" (
  echo ERROR: START_BOT_CLOUDFLARE.bat was not found in the project root.
  pause
  popd
  endlocal
  exit /b 1
)

call "%PROJECT_DIR%\START_BOT_CLOUDFLARE.bat"
set "LAUNCH_EXIT=%ERRORLEVEL%"

popd
endlocal
exit /b %LAUNCH_EXIT%
