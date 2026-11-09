"""Remove import annotations and supply missing icons only in the red-dragon game."""
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.config import Settings
from app.db import Database, utc_now
from tools.create_red_dragon_campaign import NAME, ITEM_EMOJIS


def main():
    db = Database(Settings().db_path)
    try:
        rows = db._many('''SELECT i.* FROM inventory_items i JOIN characters c ON c.id=i.character_id
            JOIN campaigns g ON g.id=c.campaign_id WHERE g.name=?''', (NAME,))
        if not rows:
            raise RuntimeError('Campaign inventory not found')
        backup = ROOT / 'data/backups/manual' / ('before_red_dragon_inventory_polish_'+datetime.now().strftime('%Y%m%d_%H%M%S')+'.sqlite3')
        backup.parent.mkdir(parents=True,exist_ok=True)
        with sqlite3.connect(backup) as target:
            db.conn.backup(target)
        with db.conn:
            for row in rows:
                description = '\n'.join(line for line in row['description'].splitlines() if not line.lstrip().startswith('Источник:')).strip()
                emoji = row['emoji'] or ITEM_EMOJIS.get(row['name'], '🎒')
                db.conn.execute('UPDATE inventory_items SET description=?,emoji=?,updated_at=? WHERE id=?',
                                (description,emoji,utc_now(),row['id']))
        print('Updated items:',len(rows))
        print('Backup:',backup)
    finally:
        db.conn.close()


if __name__ == '__main__':
    main()
