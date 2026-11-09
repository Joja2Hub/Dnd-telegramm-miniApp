@echo off
setlocal
set "PROJECT_DIR=%~dp0"
if exist "%PROJECT_DIR%local_host\START_LOCAL_SITE.bat" goto launch
set "PROJECT_DIR=%~dp0dnd_miniapp_bot\"
if exist "%PROJECT_DIR%local_host\START_LOCAL_SITE.bat" goto launch
echo ERROR: The dnd_miniapp_bot project folder was not found next to this launcher.
pause
exit /b 1
:launch
call "%PROJECT_DIR%local_host\START_LOCAL_SITE.bat"
exit /b %ERRORLEVEL%
