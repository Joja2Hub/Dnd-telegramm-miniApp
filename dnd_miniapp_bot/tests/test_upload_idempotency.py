from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from app.api import create_app
from app.config import Settings
from app.db import Database


class UploadIdempotencyTests(unittest.TestCase):
    def test_repeated_avatar_upload_is_processed_once(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            db.init_schema()
            campaign = db.create_campaign("Test", 100)
            character = db.create_character(int(campaign["id"]), "Hero", 20, 12)
            db.link_character(int(character["id"]), 200)
            settings = Settings(db_path=db_path, dev_mode=True)
            with TestClient(create_app(db, settings)) as client:
                image = Image.new("RGBA", (64, 64), (255, 0, 0, 255))
                raw = io.BytesIO()
                image.save(raw, format="PNG")
                content = raw.getvalue()
                headers = {
                    "X-Dev-Telegram-Id": "200",
                    "X-Upload-Id": "same-avatar-action",
                }
                url = f"/api/characters/{character['id']}/avatar"
                first = client.post(url, headers=headers, files={"file": ("avatar.png", content, "image/png")})
                second = client.post(url, headers=headers, files={"file": ("avatar.png", content, "image/png")})

                self.assertEqual(first.status_code, 200, first.text)
                self.assertEqual(second.status_code, 200, second.text)
                self.assertEqual(first.json()["avatar_path"], second.json()["avatar_path"])
                avatar_logs = db._one(
                    "SELECT COUNT(*) AS count FROM log_events WHERE campaign_id=? AND character_id=? AND kind='manual'",
                    (int(campaign["id"]), int(character["id"])),
                )
                self.assertEqual(int(avatar_logs["count"]), 1)
                records = db._one("SELECT COUNT(*) AS count FROM upload_dedup_records")
                self.assertEqual(int(records["count"]), 1)
            db.conn.close()


if __name__ == "__main__":
    unittest.main()
