@echo off
setlocal

pushd "%~dp0.."
set "PROJECT_DIR=%CD%"
set "LOCAL_PORT=8000"
set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
  set "PYTHON_EXE=python"
)

echo.
echo If phones cannot open the site, run local_host\ALLOW_FIREWALL_PORT_8000_AS_ADMIN.bat once.
echo.

echo Restarting local site on port %LOCAL_PORT%...
call :StopPortProcess %LOCAL_PORT%
call :IsPortListening %LOCAL_PORT%
if not errorlevel 1 (
  echo.
  echo Port %LOCAL_PORT% is still busy and could not be stopped from this window.
  echo Run local_host\KILL_PORT_8000_AS_ADMIN.bat, accept the UAC prompt, then start this file again.
  echo.
  pause
  popd
  endlocal
  exit /b 1
)

start "" cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:%LOCAL_PORT%/local/"
"%PYTHON_EXE%" "%PROJECT_DIR%\local_host\run_local.py"

pause
popd
endlocal
exit /b 0

:StopPortProcess
echo Looking for old server processes on port %1...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%1 .*LISTENING"') do (
  if not "%%P"=="0" (
    echo Killing process %%P on port %1...
    taskkill /PID %%P /F /T >nul 2>nul
  )
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$portPids = @(Get-NetTCPConnection -LocalPort %1 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if ($portPids.Count) { Write-Host ('Force stopping remaining process on port %1: ' + ($portPids -join ', ')); foreach ($processId in $portPids) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 1 }"
timeout /t 2 /nobreak >nul
exit /b 0

:IsPortListening
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Get-NetTCPConnection -LocalPort %1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
exit /b %errorlevel%
