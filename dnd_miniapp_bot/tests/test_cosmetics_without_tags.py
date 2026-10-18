from __future__ import annotations

import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import create_app
from app.config import Settings
from app.db import Database


class CosmeticsWithoutTagsTests(unittest.TestCase):
    def test_campaign_state_and_shop_do_not_expose_tags(self) -> None:
        with ExitStack() as stack:
            tmp = stack.enter_context(tempfile.TemporaryDirectory())
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            stack.callback(db.conn.close)
            db.init_schema()
            campaign = db.create_campaign("Test", 100)
            character = db.create_character(int(campaign["id"]), "Player", 20, 12)
            db.link_character(int(character["id"]), 200)
            settings = Settings(db_path=db_path, bot_token="", dev_mode=True)

            with TestClient(create_app(db, settings)) as client:
                player_headers = {"X-Dev-Telegram-Id": "200"}
                state = client.get(
                    f"/api/campaigns/{campaign['id']}/state",
                    headers=player_headers,
                )
                self.assertEqual(state.status_code, 200, state.text)
                self.assertNotIn("cosmetic_tags", state.json())
                self.assertNotIn("unlocked_tag_ids", state.json())

                purchase = client.post(
                    "/api/shop/purchase",
                    headers=player_headers,
                    json={"item_type": "tag", "item_id": "tag_shape_classic"},
                )
                self.assertEqual(purchase.status_code, 422)

    def test_legacy_tag_reward_fields_cannot_create_a_tag_reward(self) -> None:
        with ExitStack() as stack:
            tmp = stack.enter_context(tempfile.TemporaryDirectory())
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            stack.callback(db.conn.close)
            db.init_schema()
            campaign = db.create_campaign("Test", 100)
            settings = Settings(db_path=db_path, bot_token="", dev_mode=True)

            with TestClient(create_app(db, settings)) as client:
                response = client.post(
                    f"/api/campaigns/{campaign['id']}/achievements",
                    headers={"X-Dev-Telegram-Id": "100"},
                    json={
                        "title": "Achievement",
                        "tag_reward_id": "tag_shape_classic",
                        "custom_tag_name": "Legacy tag",
                    },
                )
                self.assertEqual(response.status_code, 200, response.text)
                self.assertIsNone(response.json()["achievement"].get("tag_reward_id"))


if __name__ == "__main__":
    unittest.main()
