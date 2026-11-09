"""Back up the configured SQLite database before the effect-shop upgrade."""
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.config import Settings
from app.db import Database

if __name__=='__main__':
    path=Path(Settings().db_path).resolve()
    if not path.is_file():
        raise SystemExit('Database not found; no changes made.')
    backup=ROOT/'data/backups/manual'/('before_effect_shop_'+datetime.now().strftime('%Y%m%d_%H%M%S')+'.sqlite3')
    backup.parent.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(path) as source,sqlite3.connect(backup) as target:
        source.backup(target)
    db=Database(str(path))
    try:
        before=db.conn.execute('SELECT COUNT(*) FROM user_effect_unlocks').fetchone()[0]
        db.init_schema()
        after=db.conn.execute('SELECT COUNT(*) FROM user_effect_unlocks').fetchone()[0]
        assert after>=before
        assert db.conn.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        print('Backup:',backup)
        print('Effect catalog:',len(db.list_cosmetic_effects()),'; ownership rows:',before,'->',after)
    finally:
        db.conn.close()
