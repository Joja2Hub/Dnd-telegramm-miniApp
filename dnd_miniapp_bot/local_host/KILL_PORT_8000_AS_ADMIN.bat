@echo off
setlocal

net session >nul 2>nul
if not "%errorlevel%"=="0" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Stopping processes that listen on port 8000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
  echo Killing PID %%P
  taskkill /PID %%P /F /T
)

echo Done.
pause
endlocal
