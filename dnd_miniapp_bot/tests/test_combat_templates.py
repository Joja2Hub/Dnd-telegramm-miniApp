from __future__ import annotations

import unittest
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import create_app
from app.config import Settings
from app.db import Database


class CombatTemplateTests(unittest.TestCase):
    def test_scene_stores_enemy_snapshot_and_starts_without_initiative(self) -> None:
        db = Database(":memory:")
        db.init_schema()
        campaign = db.create_campaign("Осколок", 100)
        other_campaign = db.create_campaign("Киберпанк", 200, rule_type="cyberpunk")
        db.create_character(int(campaign["id"]), "Герой", 30, 15)

        enemy = db.create_combat_enemy_template(
            int(campaign["id"]),
            100,
            name="Страж",
            hp=24,
            ac=14,
            color="#ef4444",
            hidden_hp=True,
            public_note="Тяжёлая броня",
        )
        scene = db.create_combat_scene_template(
            int(campaign["id"]),
            100,
            name="Ворота",
            enemies=[
                {**enemy, "source_enemy_template_id": enemy["id"], "name": "Страж 1"},
                {**enemy, "source_enemy_template_id": enemy["id"], "name": "Страж 2"},
            ],
        )

        db.update_combat_enemy_template(int(enemy["id"]), hp=99)
        stored_scene = db.get_combat_scene_template(int(scene["id"]))
        self.assertEqual([item["hp"] for item in stored_scene["enemies"]], [24, 24])
        self.assertEqual(db.list_combat_scene_templates(int(other_campaign["id"])), [])

        combat = db.create_combat_from_scene(int(campaign["id"]), int(scene["id"]))
        enemies = [item for item in combat["combatants"] if item["kind"] == "enemy"]
        self.assertEqual([item["name"] for item in enemies], ["Страж 1", "Страж 2"])
        self.assertTrue(all(item["initiative"] is None for item in combat["combatants"]))
        self.assertTrue(all(item["hidden_hp"] for item in enemies))

        with self.assertRaisesRegex(ValueError, "активный бой"):
            db.create_combat_from_scene(int(campaign["id"]), int(scene["id"]))
        with self.assertRaisesRegex(ValueError, "этой кампании"):
            db.create_combat_from_scene(int(other_campaign["id"]), int(scene["id"]))

        db.conn.close()

    def test_template_api_is_master_only_and_scene_keeps_initiative_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            db.init_schema()
            campaign = db.create_campaign("Киберпанк", 100, rule_type="cyberpunk")
            character = db.create_character(int(campaign["id"]), "Runner", 20, 12)
            db.link_character(int(character["id"]), 200)
            settings = Settings(db_path=db_path, dev_mode=True)
            master_headers = {"X-Dev-Telegram-Id": "100"}
            player_headers = {"X-Dev-Telegram-Id": "200"}

            with TestClient(create_app(db, settings)) as client:
                library_url = f"/api/campaigns/{campaign['id']}/combat-templates"
                self.assertEqual(client.get(library_url, headers=player_headers).status_code, 403)

                enemy_response = client.post(
                    f"/api/campaigns/{campaign['id']}/combat-enemy-templates",
                    headers=master_headers,
                    json={"name": "Дрон", "hp": 18, "ac": 13, "color": "#ef4444", "hidden_hp": False, "public_note": "Летает"},
                )
                self.assertEqual(enemy_response.status_code, 200, enemy_response.text)
                enemy_id = int(enemy_response.json()["enemy_template"]["id"])

                scene_response = client.post(
                    f"/api/campaigns/{campaign['id']}/combat-scene-templates",
                    headers=master_headers,
                    json={"name": "Крыша", "description": "Два дрона", "enemies": [{"enemy_template_id": enemy_id, "quantity": 2}]},
                )
                self.assertEqual(scene_response.status_code, 200, scene_response.text)
                scene_id = int(scene_response.json()["scene_template"]["id"])

                start_response = client.post(
                    f"/api/campaigns/{campaign['id']}/combat/start-from-scene/{scene_id}",
                    headers=master_headers,
                )
                self.assertEqual(start_response.status_code, 200, start_response.text)
                combatants = start_response.json()["combat"]["combatants"]
                self.assertEqual([item["name"] for item in combatants if item["kind"] == "enemy"], ["Дрон 1", "Дрон 2"])
                self.assertTrue(all(item["initiative"] is None for item in combatants))

            db.conn.close()


if __name__ == "__main__":
    unittest.main()
