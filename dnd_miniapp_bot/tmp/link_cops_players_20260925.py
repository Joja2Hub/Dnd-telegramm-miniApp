from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path


db_path = Path('data/dnd_bot.sqlite3')
assert db_path.is_file(), db_path
backup_dir = Path('data/backups')
backup_dir.mkdir(exist_ok=True)
backup_path = backup_dir / f'dnd_bot_before_cops_player_links_{datetime.now():%Y%m%d_%H%M%S}.sqlite3'

links = (
    (22, 'Евгения Акимова', 1029098597),
    (23, 'Кира', 1239713475),
)

with sqlite3.connect(db_path, timeout=30) as db:
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    for character_id, name, telegram_id in links:
        row = db.execute(
            'SELECT id, name, campaign_id, telegram_user_id FROM characters WHERE id=?',
            (character_id,),
        ).fetchone()
        if not row or row['name'] != name or row['campaign_id'] != 6 or row['telegram_user_id'] is not None:
            raise RuntimeError(f'Unexpected current state for character {character_id}: {dict(row) if row else None}')
        if db.execute(
            'SELECT 1 FROM characters WHERE campaign_id=6 AND telegram_user_id=?',
            (telegram_id,),
        ).fetchone():
            raise RuntimeError(f'Telegram user {telegram_id} already has a character in campaign 6')
    owner = db.execute('SELECT master_tg_id FROM campaigns WHERE id=3 AND name=?', ('Месиво',)).fetchone()
    if not owner or owner['master_tg_id'] != 1249327502:
        raise RuntimeError('Mesivo owner has changed; stop and inspect before updating')

    with sqlite3.connect(backup_path) as backup:
        db.backup(backup)

    db.execute('BEGIN IMMEDIATE')
    try:
        for character_id, name, telegram_id in links:
            changed = db.execute(
                'UPDATE characters SET telegram_user_id=? WHERE id=? AND campaign_id=6 AND name=? AND telegram_user_id IS NULL',
                (telegram_id, character_id, name),
            ).rowcount
            if changed != 1:
                raise RuntimeError(f'Could not link character {character_id}')
            db.execute(
                'INSERT INTO player_accounts(telegram_user_id, first_name, username) VALUES (?, ?, ?) '
                'ON CONFLICT(telegram_user_id) DO NOTHING',
                (telegram_id, name, ''),
            )
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Foreign key validation failed')
        db.commit()
    except Exception:
        db.rollback()
        raise

    result = [dict(row) for row in db.execute(
        'SELECT id, name, telegram_user_id FROM characters WHERE id IN (22, 23, 24) ORDER BY id'
    )]
    print(json.dumps({'backup': str(backup_path), 'characters': result, 'master_mesivo': owner['master_tg_id'], 'integrity': db.execute('PRAGMA integrity_check').fetchone()[0]}, ensure_ascii=False, indent=2))
