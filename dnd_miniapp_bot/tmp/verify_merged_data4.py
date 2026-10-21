from __future__ import annotations

import json
import shutil
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

from app.db import Database


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "data" / "dnd_bot.sqlite3"


def main() -> None:
    with closing(sqlite3.connect(f"file:{DATABASE.as_posix()}?mode=ro", uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        foreign_key_issues = [dict(row) for row in conn.execute("PRAGMA foreign_key_check")]
        characters = [
            dict(row)
            for row in conn.execute(
                "SELECT id, name, max_hp_base, current_hp, statuses_json "
                "FROM characters WHERE campaign_id=3 ORDER BY id"
            )
        ]
        recent_items = [
            dict(row)
            for row in conn.execute(
                "SELECT i.id, c.name AS character_name, i.name, i.quantity "
                "FROM inventory_items i JOIN characters c ON c.id=i.character_id "
                "WHERE c.campaign_id=3 AND i.id>=129 ORDER BY i.id"
            )
        ]
        recent_combats = [
            dict(row)
            for row in conn.execute(
                "SELECT id, status, round, created_at, started_at, ended_at FROM combats "
                "WHERE campaign_id=3 AND id>=26 ORDER BY id"
            )
        ]
        open_requests = conn.execute(
            "SELECT COUNT(*) FROM requests WHERE campaign_id=3 AND status='open'"
        ).fetchone()[0]

    with tempfile.TemporaryDirectory(dir=ROOT / "tmp") as temporary:
        verification_db = Path(temporary) / "schema_smoke.sqlite3"
        shutil.copy2(DATABASE, verification_db)
        db = Database(str(verification_db))
        try:
            db.init_schema()
            app_integrity = db.conn.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            db.conn.close()

    print(
        json.dumps(
            {
                "integrity": integrity,
                "foreign_key_issues": foreign_key_issues,
                "app_schema_smoke": app_integrity,
                "mesivo_characters": characters,
                "recent_mesivo_items": recent_items,
                "recent_mesivo_combats": recent_combats,
                "open_mesivo_requests": open_requests,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
