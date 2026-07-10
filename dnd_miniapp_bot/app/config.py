from __future__ import annotations

import os
from dataclasses import dataclass, field

try:
    from dotenv import load_dotenv
    load_dotenv(override=True)
except Exception:
    pass


@dataclass(frozen=True)
class Settings:
    bot_token: str = field(default_factory=lambda: os.getenv("BOT_TOKEN", "").strip())
    base_url: str = field(default_factory=lambda: os.getenv("BASE_URL", "http://localhost:8000").rstrip("/"))
    db_path: str = field(default_factory=lambda: os.getenv("DB_PATH", "data/dnd_miniapp.sqlite3"))
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))
    dev_mode: bool = field(
        default_factory=lambda: os.getenv("DEV_MODE", "1").strip().lower() in {"1", "true", "yes", "on"}
    )
    main_master_tg_id: int = field(default_factory=lambda: int(os.getenv("MAIN_MASTER_TG_ID", "0") or 0))


def get_settings() -> Settings:
    return Settings()
