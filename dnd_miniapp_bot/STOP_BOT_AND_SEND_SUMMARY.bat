@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo Завершение DND-бота с итогами сессии
echo ==========================================
echo.

set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

echo Отправляю игрокам персонажей и инвентарь...
"%PYTHON_EXE%" "%~dp0shutdown_bot.py" %*
if errorlevel 1 (
  echo.
  echo Рассылка завершилась с ошибкой. Бот оставлен запущенным.
  echo После исправления ошибки запустите этот файл повторно.
  pause
  exit /b 1
)

set "PID_FILE=%~dp0data\dnd_bot.pid"
if not exist "%PID_FILE%" (
  echo.
  echo Итоги отправлены, но PID-файл не найден. Возможно, бот уже остановлен.
  pause
  exit /b 0
)

set /p BOT_PID=<"%PID_FILE%"
echo.
echo Останавливаю процесс бота PID %BOT_PID%...
if not exist "%~dp0data" mkdir "%~dp0data"
> "%~dp0data\shutdown_requested.flag" echo requested
taskkill /PID %BOT_PID% /T /F >nul 2>nul
if errorlevel 1 (
  del /q "%~dp0data\shutdown_requested.flag" >nul 2>nul
  echo Не удалось остановить процесс автоматически. Итоги игрокам уже отправлены.
  pause
  exit /b 1
)

del /q "%PID_FILE%" >nul 2>nul
echo Бот остановлен. Итоги сессии сохранены в чатах игроков.
timeout /t 3 /nobreak >nul
