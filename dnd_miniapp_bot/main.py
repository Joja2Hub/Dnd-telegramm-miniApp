from __future__ import annotations

import asyncio
import ctypes
import os
from pathlib import Path

import uvicorn
from telegram import MenuButtonWebApp, WebAppInfo

from app.api import create_app
from app.bot import build_bot
from app.config import get_settings
from app.db import Database


async def run_bot(bot_app) -> None:
    await bot_app.initialize()
    await bot_app.start()
    settings = bot_app.bot_data.get("settings")
    if settings and settings.base_url:
        try:
            await bot_app.bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Открыть приложение",
                    web_app=WebAppInfo(url=settings.base_url),
                )
            )
            print(f"Telegram Mini App menu updated: {settings.base_url}")
        except Exception as exc:
            print(f"Could not update Telegram Mini App menu: {exc}")
    await bot_app.updater.start_polling()
    try:
        await asyncio.Event().wait()
    finally:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()


def _process_is_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        try:
            exit_code = ctypes.c_ulong()
            return bool(kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))) and exit_code.value == 259
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


async def watch_cloudflared_process(pid_path: Path) -> None:
    failures = 0
    await asyncio.sleep(10)
    while True:
        try:
            pid = int(pid_path.read_text(encoding="ascii").strip())
            running = _process_is_running(pid)
        except (OSError, ValueError):
            running = False
        failures = 0 if running else failures + 1
        if failures >= 6:
            raise RuntimeError(f"cloudflared process is no longer running: {pid_path}")
        await asyncio.sleep(5)


async def main() -> None:
    settings = get_settings()
    db = Database(settings.db_path)
    db.init_schema()
    bot_app = build_bot(settings, db)
    telegram_bot = bot_app.bot if bot_app else None
    fastapi_app = create_app(db, settings, telegram_bot)

    config = uvicorn.Config(fastapi_app, host=settings.host, port=settings.port, log_level="info")
    server = uvicorn.Server(config)

    tasks = [asyncio.create_task(server.serve())]
    if bot_app:
        tasks.append(asyncio.create_task(run_bot(bot_app)))
    else:
        print("BOT_TOKEN не задан: запущен только web/API. Для dev-тестов используйте DEV_MODE=1.")

    cloudflared_pid_path = os.getenv("CLOUDFLARED_PID_PATH", "").strip()
    if cloudflared_pid_path:
        tasks.append(asyncio.create_task(watch_cloudflared_process(Path(cloudflared_pid_path))))

    pid_path = Path(os.getenv("BOT_PID_PATH", "data/dnd_bot.pid"))
    pid_path.parent.mkdir(parents=True, exist_ok=True)
    pid_path.write_text(str(os.getpid()), encoding="ascii")
    try:
        await asyncio.gather(*tasks)
    finally:
        try:
            if pid_path.exists() and pid_path.read_text(encoding="ascii").strip() == str(os.getpid()):
                pid_path.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    asyncio.run(main())
