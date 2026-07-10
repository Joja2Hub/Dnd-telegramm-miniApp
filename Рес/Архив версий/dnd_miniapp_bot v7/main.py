from __future__ import annotations

import asyncio

import uvicorn

from app.api import create_app
from app.bot import build_bot
from app.config import get_settings
from app.db import Database


async def run_bot(bot_app) -> None:
    await bot_app.initialize()
    await bot_app.start()
    await bot_app.updater.start_polling()
    try:
        await asyncio.Event().wait()
    finally:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()


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

    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
