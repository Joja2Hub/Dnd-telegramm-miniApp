from __future__ import annotations

import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "data" / "dnd_bot.sqlite3"
INCOMING = ROOT / "tmp" / "incoming_data4_20261020_134149" / "data" / "dnd_bot.sqlite3"


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def tables(conn: sqlite3.Connection) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]


def row_counts(conn: sqlite3.Connection) -> dict[str, int]:
    result: dict[str, int] = {}
    for table in tables(conn):
        quoted = table.replace('"', '""')
        result[table] = conn.execute(f'SELECT COUNT(*) FROM "{quoted}"').fetchone()[0]
    return result


def columns(conn: sqlite3.Connection, table: str) -> list[dict[str, object]]:
    quoted = table.replace('"', '""')
    return [dict(row) for row in conn.execute(f'PRAGMA table_info("{quoted}")')]


def rows(conn: sqlite3.Connection, table: str) -> list[dict[str, object]]:
    quoted = table.replace('"', '""')
    return [dict(row) for row in conn.execute(f'SELECT * FROM "{quoted}"')]


def main() -> None:
    with connect(CURRENT) as current, connect(INCOMING) as incoming:
        current_tables = set(tables(current))
        incoming_tables = set(tables(incoming))
        current_counts = row_counts(current)
        incoming_counts = row_counts(incoming)

        changed_counts = {
            table: {
                "current": current_counts.get(table),
                "incoming": incoming_counts.get(table),
            }
            for table in sorted(current_tables | incoming_tables)
            if current_counts.get(table) != incoming_counts.get(table)
        }

        campaign_rows = {}
        for name, conn in (("current", current), ("incoming", incoming)):
            for candidate in ("campaigns", "games"):
                if candidate in tables(conn):
                    campaign_rows[name] = rows(conn, candidate)
                    break

        interesting_schema = {}
        keywords = (
            "campaign",
            "session",
            "character",
            "inventory",
            "item",
            "weapon",
            "armor",
            "combat",
            "request",
            "injur",
            "achievement",
            "spark",
            "ammo",
        )
        for table in sorted(current_tables | incoming_tables):
            if any(keyword in table.lower() for keyword in keywords):
                conn = incoming if table in incoming_tables else current
                interesting_schema[table] = columns(conn, table)

        report = {
            "integrity": {
                "current": current.execute("PRAGMA integrity_check").fetchone()[0],
                "incoming": incoming.execute("PRAGMA integrity_check").fetchone()[0],
            },
            "tables_only_current": sorted(current_tables - incoming_tables),
            "tables_only_incoming": sorted(incoming_tables - current_tables),
            "changed_counts": changed_counts,
            "campaigns": campaign_rows,
            "interesting_schema": interesting_schema,
        }
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
