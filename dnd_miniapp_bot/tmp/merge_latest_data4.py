from __future__ import annotations

import json
import os
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "data" / "dnd_bot.sqlite3"
INCOMING = ROOT / "tmp" / "incoming_data4_20261020_134149" / "data" / "dnd_bot.sqlite3"
BACKUP_DIR = ROOT / "data" / "backups"
STAGED = ROOT / "tmp" / "dnd_bot_merged_mesivo.sqlite3"


def connect_readonly(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def tables(connection: sqlite3.Connection) -> list[str]:
    return [
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]


def primary_key_columns(connection: sqlite3.Connection, table: str) -> list[str]:
    quoted = table.replace('"', '""')
    info = list(connection.execute(f'PRAGMA table_info("{quoted}")'))
    return [row[1] for row in sorted((row for row in info if row[5]), key=lambda row: row[5])]


def rows_by_key(connection: sqlite3.Connection, table: str) -> dict[tuple[object, ...], tuple[object, ...]]:
    quoted = table.replace('"', '""')
    rows = list(connection.execute(f'SELECT * FROM "{quoted}"'))
    keys = primary_key_columns(connection, table)
    columns = [description[0] for description in connection.execute(f'SELECT * FROM "{quoted}" LIMIT 0').description]
    key_indexes = [columns.index(column) for column in keys]
    if not key_indexes:
        return {(index,): tuple(row) for index, row in enumerate(rows)}
    return {tuple(row[index] for index in key_indexes): tuple(row) for row in rows}


def schema_signature(connection: sqlite3.Connection) -> list[tuple[str, str]]:
    return [
        (row[0], row[1] or "")
        for row in connection.execute(
            "SELECT name, sql FROM sqlite_master "
            "WHERE type IN ('table','index','trigger','view') AND name NOT LIKE 'sqlite_%' "
            "ORDER BY type, name"
        )
    ]


def assert_valid_source() -> dict[str, int]:
    with closing(connect_readonly(CURRENT)) as current, closing(connect_readonly(INCOMING)) as incoming:
        if current.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Current database failed integrity_check")
        if incoming.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Incoming database failed integrity_check")
        if schema_signature(current) != schema_signature(incoming):
            raise RuntimeError("Database schemas differ")

        summary = {"added": 0, "changed": 0, "removed": 0}
        for table in tables(current):
            current_rows = rows_by_key(current, table)
            incoming_rows = rows_by_key(incoming, table)
            summary["added"] += len(incoming_rows.keys() - current_rows.keys())
            summary["removed"] += len(current_rows.keys() - incoming_rows.keys())
            summary["changed"] += sum(
                current_rows[key] != incoming_rows[key]
                for key in current_rows.keys() & incoming_rows.keys()
            )
        if summary["removed"]:
            raise RuntimeError(f"Incoming database would remove {summary['removed']} rows")
        return summary


def sqlite_backup(source_path: Path, destination_path: Path) -> None:
    if destination_path.exists():
        destination_path.unlink()
    with closing(connect_readonly(source_path)) as source, closing(sqlite3.connect(destination_path)) as destination:
        source.backup(destination)


def main() -> None:
    if not CURRENT.exists() or not INCOMING.exists():
        raise FileNotFoundError("Current or incoming database is missing")

    diff_summary = assert_valid_source()
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"dnd_bot_before_merge_mesivo_{stamp}.sqlite3"

    with closing(sqlite3.connect(CURRENT, timeout=5)) as lock_check:
        lock_check.execute("PRAGMA busy_timeout=5000")
        lock_check.execute("BEGIN EXCLUSIVE")
        lock_check.rollback()

    sqlite_backup(CURRENT, backup_path)
    sqlite_backup(INCOMING, STAGED)
    with closing(connect_readonly(STAGED)) as staged:
        if staged.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Staged merged database failed integrity_check")

    try:
        os.replace(STAGED, CURRENT)
        with closing(connect_readonly(CURRENT)) as merged:
            integrity = merged.execute("PRAGMA integrity_check").fetchone()[0]
            campaign = dict(merged.execute("SELECT * FROM campaigns WHERE id=3").fetchone())
            characters = merged.execute("SELECT COUNT(*) FROM characters WHERE campaign_id=3").fetchone()[0]
            inventory_items = merged.execute(
                "SELECT COUNT(*) FROM inventory_items "
                "WHERE character_id IN (SELECT id FROM characters WHERE campaign_id=3)"
            ).fetchone()[0]
            combats = merged.execute("SELECT COUNT(*) FROM combats WHERE campaign_id=3").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError("Merged database failed integrity_check")
    except Exception:
        shutil.copy2(backup_path, CURRENT)
        raise

    print(
        json.dumps(
            {
                "backup": str(backup_path.relative_to(ROOT)),
                "merged_database": str(CURRENT.relative_to(ROOT)),
                "diff": diff_summary,
                "integrity": integrity,
                "campaign": campaign,
                "mesivo_characters": characters,
                "mesivo_inventory_items": inventory_items,
                "mesivo_combats": combats,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
