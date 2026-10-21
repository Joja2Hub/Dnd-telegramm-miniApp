from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "data" / "dnd_bot.sqlite3"
INCOMING = ROOT / "tmp" / "incoming_data4_20261020_134149" / "data" / "dnd_bot.sqlite3"


def connect(path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_names(conn: sqlite3.Connection) -> list[str]:
    return [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]


def table_columns(conn: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    quoted = table.replace('"', '""')
    return list(conn.execute(f'PRAGMA table_info("{quoted}")'))


def primary_key_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    info = table_columns(conn, table)
    return [row[1] for row in sorted((row for row in info if row[5]), key=lambda row: row[5])]


def table_rows(conn: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    quoted = table.replace('"', '""')
    return [dict(row) for row in conn.execute(f'SELECT * FROM "{quoted}"')]


def normalized(value: Any) -> Any:
    if isinstance(value, bytes):
        return {"blob_hex": value.hex()}
    return value


def row_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {key: normalized(value) for key, value in row.items()}


def key_for(row: dict[str, Any], keys: list[str], fallback_index: int) -> tuple[Any, ...]:
    if keys:
        return tuple(row[key] for key in keys)
    return (fallback_index,)


def main() -> None:
    with connect(CURRENT) as current, connect(INCOMING) as incoming:
        report: dict[str, Any] = {}
        for table in table_names(current):
            keys = primary_key_columns(current, table)
            current_rows = table_rows(current, table)
            incoming_rows = table_rows(incoming, table)
            current_map = {key_for(row, keys, index): row for index, row in enumerate(current_rows)}
            incoming_map = {key_for(row, keys, index): row for index, row in enumerate(incoming_rows)}

            added_keys = sorted(incoming_map.keys() - current_map.keys(), key=str)
            removed_keys = sorted(current_map.keys() - incoming_map.keys(), key=str)
            changed_keys = sorted(
                (
                    key
                    for key in current_map.keys() & incoming_map.keys()
                    if current_map[key] != incoming_map[key]
                ),
                key=str,
            )
            if not (added_keys or removed_keys or changed_keys):
                continue

            details: dict[str, Any] = {
                "primary_key": keys,
                "counts": {
                    "current": len(current_rows),
                    "incoming": len(incoming_rows),
                    "added": len(added_keys),
                    "removed": len(removed_keys),
                    "changed": len(changed_keys),
                },
            }
            total = len(added_keys) + len(removed_keys) + len(changed_keys)
            if total <= 80:
                details["added"] = [row_payload(incoming_map[key]) for key in added_keys]
                details["removed"] = [row_payload(current_map[key]) for key in removed_keys]
                details["changed"] = [
                    {
                        "key": list(key),
                        "current": row_payload(current_map[key]),
                        "incoming": row_payload(incoming_map[key]),
                    }
                    for key in changed_keys
                ]
            else:
                details["sample_added"] = [row_payload(incoming_map[key]) for key in added_keys[:10]]
                details["sample_removed"] = [row_payload(current_map[key]) for key in removed_keys[:10]]
                details["sample_changed"] = [
                    {
                        "key": list(key),
                        "current": row_payload(current_map[key]),
                        "incoming": row_payload(incoming_map[key]),
                    }
                    for key in changed_keys[:10]
                ]
            report[table] = details

        if "--summary" in sys.argv:
            output = {table: details["counts"] for table, details in report.items()}
        elif "--table" in sys.argv:
            index = sys.argv.index("--table")
            table = sys.argv[index + 1]
            output = {table: report.get(table)}
        else:
            output = report
        print(json.dumps(output, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
