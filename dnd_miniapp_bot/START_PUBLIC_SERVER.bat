@echo off
setlocal
cd /d "%~dp0"

call "%~dp0public_host\START_PUBLIC_SERVER.bat"
exit /b %ERRORLEVEL%
