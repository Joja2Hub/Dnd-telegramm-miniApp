from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl, unquote

from fastapi import Header, HTTPException


@dataclass(frozen=True)
class TelegramUser:
    id: int
    first_name: str = ""
    username: str | None = None


def _validate_init_data(init_data: str, bot_token: str, max_age_seconds: int = 24 * 60 * 60) -> TelegramUser:
    if not bot_token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN не задан, проверка Telegram initData невозможна")
    if not init_data:
        raise HTTPException(status_code=401, detail="Mini App не передал Telegram initData")

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="В initData нет hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        raise HTTPException(status_code=401, detail="initData не прошёл проверку подписи")

    auth_date = int(pairs.get("auth_date", "0") or 0)
    if auth_date and time.time() - auth_date > max_age_seconds:
        raise HTTPException(status_code=401, detail="initData устарел, перезапустите Mini App")

    raw_user = pairs.get("user")
    if not raw_user:
        raise HTTPException(status_code=401, detail="В initData нет пользователя")
    try:
        user = json.loads(unquote(raw_user))
    except Exception:
        user = json.loads(raw_user)
    return TelegramUser(id=int(user["id"]), first_name=user.get("first_name", ""), username=user.get("username"))


def get_current_user_factory(settings):
    async def get_current_user(
        x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
        x_dev_telegram_id: str | None = Header(default=None, alias="X-Dev-Telegram-Id"),
        x_dev_telegram_username: str | None = Header(default=None, alias="X-Dev-Telegram-Username"),
        x_dev_telegram_first_name: str | None = Header(default=None, alias="X-Dev-Telegram-First-Name"),
    ) -> TelegramUser:
        if x_telegram_init_data:
            return _validate_init_data(x_telegram_init_data, settings.bot_token)
        if settings.dev_mode and x_dev_telegram_id:
            try:
                username = (x_dev_telegram_username or "").strip()[:64] or None
                first_name = (x_dev_telegram_first_name or "").strip()[:80] or "DEV"
                return TelegramUser(id=int(x_dev_telegram_id), first_name=first_name, username=username)
            except ValueError:
                pass
        raise HTTPException(status_code=401, detail="Не удалось определить Telegram-пользователя")

    return get_current_user
