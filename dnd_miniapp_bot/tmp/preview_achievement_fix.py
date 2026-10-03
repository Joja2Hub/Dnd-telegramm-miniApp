import sqlite3
from pathlib import Path
from unittest.mock import patch

import uvicorn
from fastapi.staticfiles import StaticFiles

from app.api import create_app
from app.config import Settings
from app.db import Database


preview_path = Path('tmp/achievement_review.sqlite3')
with sqlite3.connect('file:data/dnd_bot.sqlite3?mode=ro', uri=True) as source:
    with sqlite3.connect(preview_path) as destination:
        source.backup(destination)
db = Database(str(preview_path))
db.init_schema()
db.remember_player_account(9000000001, 'Тестовый игрок без персонажа', 'review_player')
settings = Settings(db_path=str(preview_path), bot_token='', dev_mode=True, main_master_tg_id=464302752)
with patch('app.api._optimize_existing_uploads'):
    app = create_app(db, settings)
for route in app.routes:
    if getattr(route, 'path', '') == '/uploads':
        route.app = StaticFiles(directory='data/uploads')
uvicorn.run(app, host='127.0.0.1', port=8765)
