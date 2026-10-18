@echo off
setlocal

pushd "%~dp0.."
set "PROJECT_DIR=%CD%"
set "LOCAL_PORT=8000"
set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"
set "PYTHONPATH="

if exist "%PYTHON_EXE%" (
  "%PYTHON_EXE%" --version >nul 2>nul
)
if not exist "%PYTHON_EXE%" goto find_fallback_python
if errorlevel 1 goto find_fallback_python
goto python_ready

:find_fallback_python
set "PYTHON_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%PYTHON_EXE%" (
  set "PYTHONPATH=%PROJECT_DIR%\.venv\Lib\site-packages"
  goto python_ready
)
set "PYTHON_EXE=python"
where python >nul 2>nul
if errorlevel 1 (
  echo ERROR: Python was not found. Reinstall Python 3.12 or recreate the .venv folder.
  pause
  popd
  exit /b 1
)

:python_ready

echo.
echo If phones cannot open the site, run local_host\ALLOW_FIREWALL_PORT_8000_AS_ADMIN.bat once.
echo.

echo Restarting local site on port %LOCAL_PORT%...
echo The old server will be stopped automatically if it is still running.
echo Waiting for the site to become ready before opening the browser...
start "" /b powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $url='http://127.0.0.1:%LOCAL_PORT%/local/'; $health='http://127.0.0.1:%LOCAL_PORT%/local-api/info'; for($i=0; $i -lt 120; $i++){ try { $response=Invoke-WebRequest -UseBasicParsing -Uri $health -TimeoutSec 2 -ErrorAction Stop; if($response.StatusCode -eq 200){ Start-Process ($url + '?fresh=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()); exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
"%PYTHON_EXE%" "%PROJECT_DIR%\local_host\run_local.py"

set "SERVER_EXIT=%ERRORLEVEL%"
if not "%SERVER_EXIT%"=="0" (
  echo.
  echo Local server stopped with error code %SERVER_EXIT%.
  echo The error above is the reason the site did not start.
  echo If port 8000 is busy, run local_host\KILL_PORT_8000_AS_ADMIN.bat and try again.
  echo.
)

pause
popd
endlocal & exit /b %SERVER_EXIT%
