from __future__ import annotations

import argparse
import asyncio
from datetime import date

from telegram import Bot
from telegram.request import HTTPXRequest

from app.config import get_settings
from app.db import Database
from app.session_summary import send_session_summaries


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Отправить игрокам снимки персонажей за сессию перед остановкой бота."
    )
    parser.add_argument(
        "--master-id",
        type=int,
        default=0,
        help="Telegram ID мастера. Если не задан, используется MAIN_MASTER_TG_ID; при нуле — все активные кампании за дату.",
    )
    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=None,
        help="Дата сессии по Москве в формате YYYY-MM-DD. По умолчанию сегодня.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Отправить повторно, даже если итог за эту дату уже был доставлен.",
    )
    return parser.parse_args()


async def run() -> int:
    args = parse_args()
    settings = get_settings()
    if not settings.bot_token:
        print("ОШИБКА: BOT_TOKEN не задан. Бот не будет остановлен.")
        return 2

    master_id = int(args.master_id or settings.main_master_tg_id or 0) or None
    db = Database(settings.db_path)
    db.init_schema()
    bot = Bot(settings.bot_token, request=HTTPXRequest(httpx_kwargs={"trust_env": False}))
    await bot.initialize()
    try:
        result = await send_session_summaries(
            db,
            bot,
            master_tg_id=master_id,
            session_day=args.date,
            force=bool(args.force),
        )
    finally:
        await bot.shutdown()

    print(f"Дата сессии: {result.session_date}")
    print(f"Найдено активных кампаний: {result.campaigns}")
    print(f"Отправлено персонажей: {result.sent_characters}")
    print(f"Уже было отправлено: {result.skipped_characters}")
    if result.errors:
        print("Ошибки отправки:")
        for error in result.errors:
            print(f"  - {error}")
    if result.failed_characters:
        print("Бот не остановлен: часть итогов не доставлена. Исправьте ошибки и запустите батник ещё раз.")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
