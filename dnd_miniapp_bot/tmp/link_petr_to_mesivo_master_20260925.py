from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path


db_path = Path('data/dnd_bot.sqlite3')
assert db_path.is_file(), db_path
backup_dir = Path('data/backups')
backup_dir.mkdir(exist_ok=True)
backup_path = backup_dir / f'dnd_bot_before_petr_link_{datetime.now():%Y%m%d_%H%M%S}.sqlite3'

with sqlite3.connect(db_path, timeout=60) as db:
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    petr = db.execute('SELECT id, name, campaign_id, telegram_user_id FROM characters WHERE id=24').fetchone()
    mesivo = db.execute('SELECT id, name, master_tg_id FROM campaigns WHERE id=3').fetchone()
    if not petr or (petr['name'], petr['campaign_id'], petr['telegram_user_id']) != ('Петр', 6, None):
        raise RuntimeError(f'Unexpected state for Petr: {dict(petr) if petr else None}')
    if not mesivo or (mesivo['name'], mesivo['master_tg_id']) != ('Месиво', 1249327502):
        raise RuntimeError(f'Unexpected state for Mesivo: {dict(mesivo) if mesivo else None}')
    if db.execute('SELECT 1 FROM characters WHERE campaign_id=6 AND telegram_user_id=1249327502').fetchone():
        raise RuntimeError('The master already owns a character in Cyberpunk | Cops')

    with sqlite3.connect(backup_path) as backup:
        db.backup(backup)

    db.execute('BEGIN IMMEDIATE')
    try:
        changed = db.execute(
            'UPDATE characters SET telegram_user_id=1249327502 '
            'WHERE id=24 AND name=? AND campaign_id=6 AND telegram_user_id IS NULL',
            ('Петр',),
        ).rowcount
        if changed != 1:
            raise RuntimeError('Petr was changed concurrently')
        db.execute(
            'INSERT INTO player_accounts(telegram_user_id, first_name, username) '
            'VALUES (1249327502, ?, ?) '
            'ON CONFLICT(telegram_user_id) DO UPDATE SET username=excluded.username',
            ('', 'SlavaFantast'),
        )
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Foreign key check failed')
        db.commit()
    except Exception:
        db.rollback()
        raise

    result = {
        'backup': str(backup_path),
        'petr': dict(db.execute('SELECT id, name, campaign_id, telegram_user_id FROM characters WHERE id=24').fetchone()),
        'mesivo': dict(db.execute('SELECT id, name, master_tg_id FROM campaigns WHERE id=3').fetchone()),
        'account': dict(db.execute('SELECT telegram_user_id, first_name, username FROM player_accounts WHERE telegram_user_id=1249327502').fetchone()),
        'integrity': db.execute('PRAGMA integrity_check').fetchone()[0],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
