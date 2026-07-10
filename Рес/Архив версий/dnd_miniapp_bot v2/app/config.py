from __future__ import annotations

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass


@dataclass(frozen=True)
class Settings:
    bot_token: str = os.getenv("BOT_TOKEN", "").strip()
    base_url: str = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
    db_path: str = os.getenv("DB_PATH", "data/dnd_miniapp.sqlite3")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    dev_mode: bool = os.getenv("DEV_MODE", "1").strip().lower() in {"1", "true", "yes", "on"}


def get_settings() -> Settings:
    return Settings()
