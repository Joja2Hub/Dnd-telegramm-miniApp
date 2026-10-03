from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path


players = (
    (290280695, 'Дамир', 'damirdolma'),
    (464302752, 'Ваня', 'ivan_erushev'),
    (479601483, 'Макс', 'mattakvshi'),
    (824057091, 'Настя', ''),
    (1029098597, 'Лаура', 'lauraerusheva'),
    (1066701240, 'Саня', 'ss_salamatina'),
    (1239713475, 'Полина', 'polinabychok'),
    (1249327502, 'Слава', 'SlavaFantast'),
    (1417285766, 'Сережа', 'Fant6231'),
)

db_path = Path('data/dnd_bot.sqlite3')
assert db_path.is_file(), db_path
backup_dir = Path('data/backups')
backup_dir.mkdir(exist_ok=True)
backup_path = backup_dir / f'dnd_bot_before_player_names_robot_{datetime.now():%Y%m%d_%H%M%S}.sqlite3'

with sqlite3.connect(db_path, timeout=60) as db:
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    robot = db.execute('SELECT id, name, campaign_id, telegram_user_id FROM characters WHERE id=25').fetchone()
    if not robot or (robot['name'], robot['campaign_id'], robot['telegram_user_id']) != ('Робот', 6, None):
        raise RuntimeError(f'Unexpected Robot state: {dict(robot) if robot else None}')
    if db.execute('SELECT 1 FROM characters WHERE campaign_id=6 AND telegram_user_id=824057091').fetchone():
        raise RuntimeError('Настя already owns a character in Cyberpunk | Cops')
    known_ids = {int(row[0]) for row in db.execute('SELECT telegram_user_id FROM characters WHERE telegram_user_id IS NOT NULL')}
    if known_ids != {item[0] for item in players}:
        raise RuntimeError(f'Player set changed: {sorted(known_ids)}')

    with sqlite3.connect(backup_path) as backup:
        db.backup(backup)

    db.execute('BEGIN IMMEDIATE')
    try:
        for telegram_id, name, username in players:
            db.execute(
                'INSERT INTO player_accounts(telegram_user_id, first_name, username) VALUES (?, ?, ?) '
                'ON CONFLICT(telegram_user_id) DO UPDATE SET '
                'first_name=excluded.first_name, username=excluded.username',
                (telegram_id, name, username),
            )
        changed = db.execute(
            'UPDATE characters SET telegram_user_id=824057091 '
            'WHERE id=25 AND campaign_id=6 AND name=? AND telegram_user_id IS NULL',
            ('Робот',),
        ).rowcount
        if changed != 1:
            raise RuntimeError('Robot was changed concurrently')
        if db.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Foreign key check failed')
        db.commit()
    except Exception:
        db.rollback()
        raise

    saved = [dict(row) for row in db.execute(
        'SELECT telegram_user_id, first_name, username FROM player_accounts ORDER BY telegram_user_id'
    )]
    robot_after = dict(db.execute(
        'SELECT id, name, campaign_id, telegram_user_id FROM characters WHERE id=25'
    ).fetchone())
    print(json.dumps({
        'backup': str(backup_path),
        'accounts': saved,
        'robot': robot_after,
        'integrity': db.execute('PRAGMA integrity_check').fetchone()[0],
    }, ensure_ascii=False, indent=2))
