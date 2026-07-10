from __future__ import annotations

from typing import Any

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes
from telegram.request import HTTPXRequest

from app.config import Settings
from app.db import Database


def open_app_keyboard(settings: Settings) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("Открыть Mini App", web_app=WebAppInfo(url=settings.base_url))]])


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings: Settings = context.application.bot_data["settings"]
    text = (
        "Привет! Это D&D Mini App для кампаний.\n\n"
        "Открой приложение кнопкой ниже.\n"
        "Игрок может подключиться командой: /join КОД\n"
        "Мастер создаёт кампании прямо в Mini App."
    )
    await update.effective_message.reply_text(text, reply_markup=open_app_keyboard(settings))


async def app_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    settings: Settings = context.application.bot_data["settings"]
    await update.effective_message.reply_text("Открыть панель:", reply_markup=open_app_keyboard(settings))


async def join(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db: Database = context.application.bot_data["db"]
    settings: Settings = context.application.bot_data["settings"]
    user = update.effective_user
    if not context.args:
        await update.effective_message.reply_text(
            "Введи код кампании так:\n/join ABC123\n\nИли открой Mini App.",
            reply_markup=open_app_keyboard(settings),
        )
        return
    code = context.args[0].strip().upper()
    campaign = db.get_campaign_by_invite(code)
    if not campaign:
        await update.effective_message.reply_text("Кампания с таким кодом не найдена.")
        return
    if int(campaign["master_tg_id"]) == int(user.id):
        await update.effective_message.reply_text("Ты мастер этой кампании. Открой Mini App.", reply_markup=open_app_keyboard(settings))
        return
    existing = db.get_character_by_player(int(campaign["id"]), int(user.id))
    if existing:
        await update.effective_message.reply_text(f"Ты уже привязан к персонажу {existing['name']}.", reply_markup=open_app_keyboard(settings))
        return
    free = db.unlinked_characters(int(campaign["id"]))
    if not free:
        await update.effective_message.reply_text("В кампании нет свободных персонажей. Попроси мастера создать персонажа.")
        return
    buttons = [[InlineKeyboardButton(ch["name"], callback_data=f"join:{campaign['id']}:{ch['id']}")] for ch in free[:20]]
    await update.effective_message.reply_text(
        f"Кампания: {campaign['name']}\nВыбери своего персонажа:",
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def join_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    db: Database = context.application.bot_data["db"]
    settings: Settings = context.application.bot_data["settings"]
    query = update.callback_query
    await query.answer()
    _, campaign_id_s, character_id_s = query.data.split(":")
    campaign_id = int(campaign_id_s)
    character_id = int(character_id_s)
    free_ids = {int(ch["id"]) for ch in db.unlinked_characters(campaign_id)}
    if character_id not in free_ids:
        await query.edit_message_text("Этот персонаж уже занят или недоступен.")
        return
    db.link_character(character_id, query.from_user.id)
    ch = db.get_character(character_id)
    db.log(campaign_id, character_id, "join", f"Игрок привязался к {ch['name'] if ch else character_id}")
    await query.edit_message_text(
        f"Готово! Ты привязан к персонажу {ch['name'] if ch else character_id}.\nОткрой Mini App для карточки персонажа.",
        reply_markup=open_app_keyboard(settings),
    )


def build_bot(settings: Settings, db: Database) -> Application | None:
    if not settings.bot_token:
        return None
    # System-wide proxy variables are often set by Windows VPN clients. Some of
    # them advertise SOCKS4, which HTTPX does not support and which used to make
    # the bot crash before it could even start. Telegram traffic uses a direct
    # connection so unrelated system proxy settings cannot break the bot.
    request = HTTPXRequest(httpx_kwargs={"trust_env": False})
    updates_request = HTTPXRequest(httpx_kwargs={"trust_env": False})
    app = (
        Application.builder()
        .token(settings.bot_token)
        .request(request)
        .get_updates_request(updates_request)
        .build()
    )
    app.bot_data["settings"] = settings
    app.bot_data["db"] = db
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("app", app_cmd))
    app.add_handler(CommandHandler("join", join))
    app.add_handler(CallbackQueryHandler(join_callback, pattern=r"^join:"))
    return app
