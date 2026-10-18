from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import create_app
from app.config import Settings
from app.db import Database, MAX_OPEN_REQUESTS_PER_PLAYER


class RequestLimitTests(unittest.TestCase):
    def test_limit_counts_character_and_inventory_requests_together(self) -> None:
        db = Database(":memory:")
        db.init_schema()
        campaign = db.create_campaign("Test", 100)
        character = db.create_character(int(campaign["id"]), "Hero", 20, 12)
        db.link_character(int(character["id"]), 200)
        weapon = db.create_inventory_item(
            int(character["id"]),
            name="Pistol",
            item_type="weapon",
            mag_capacity=8,
            magazine_count=2,
        )
        magazine_id = int(weapon["magazines"][1]["id"])

        for _ in range(MAX_OPEN_REQUESTS_PER_PLAYER - 1):
            db.create_request(int(campaign["id"]), int(character["id"]), 200, "heal", {"hp_amount": 1})
        db.create_inventory_request(
            int(campaign["id"]), int(character["id"]), int(weapon["id"]), 200,
            "reload_weapon", {"magazine_id": magazine_id},
        )

        self.assertEqual(
            db.count_open_requests_by_player(int(campaign["id"]), 200),
            MAX_OPEN_REQUESTS_PER_PLAYER,
        )
        with self.assertRaisesRegex(ValueError, "5 активных заявок"):
            db.create_request(int(campaign["id"]), int(character["id"]), 200, "heal", {"hp_amount": 1})

        first_request = db.list_open_requests(int(campaign["id"]))[0]
        db.close_request(int(first_request["id"]), "rejected")
        created = db.create_request(int(campaign["id"]), int(character["id"]), 200, "heal", {"hp_amount": 1})
        self.assertEqual(created["status"], "open")
        db.conn.close()


class AmmoAndHealingApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.temp_dir.name) / "test.sqlite3")
        self.db = Database(self.db_path)
        self.db.init_schema()
        self.campaign = self.db.create_campaign("Cyber", 100, rule_type="cyberpunk")
        self.character = self.db.create_character(int(self.campaign["id"]), "Runner", 20, 12)
        self.db.link_character(int(self.character["id"]), 200)
        self.weapon = self.db.create_inventory_item(
            int(self.character["id"]),
            name="Pistol",
            item_type="weapon",
            reload_type="magazine",
            mag_capacity=8,
            magazine_count=2,
        )
        self.stock = self.db.add_weapon_shell_stock(
            int(self.weapon["id"]), ammo_type="обычные", quantity=12
        )
        self.settings = Settings(db_path=self.db_path, dev_mode=True)
        self.master_headers = {"X-Dev-Telegram-Id": "100"}
        self.player_headers = {"X-Dev-Telegram-Id": "200"}

    def tearDown(self) -> None:
        self.db.conn.close()
        self.temp_dir.cleanup()

    def test_loading_ammo_is_immediate_but_swapping_magazine_is_a_request(self) -> None:
        magazines = self.db.get_inventory_item(int(self.weapon["id"]))["magazines"]
        active_id = int(self.weapon["active_magazine_id"])
        spare = next(item for item in magazines if int(item["id"]) != active_id)

        with TestClient(create_app(self.db, self.settings)) as client:
            response = client.post(
                f"/api/inventory/items/{self.weapon['id']}/refill-request",
                headers=self.player_headers,
                json={"magazine_id": spare["id"], "stock_id": self.stock["id"], "amount": 5},
            )
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(self.db.list_inventory_requests(int(self.campaign["id"])), [])
            updated = self.db.get_inventory_item(int(self.weapon["id"]))
            updated_spare = next(item for item in updated["magazines"] if int(item["id"]) == int(spare["id"]))
            updated_stock = next(item for item in updated["shell_stocks"] if int(item["id"]) == int(self.stock["id"]))
            self.assertEqual(updated_spare["ammo_current"], 5)
            self.assertEqual(updated_stock["quantity"], 7)

            response = client.post(
                f"/api/inventory/items/{self.weapon['id']}/reload-request",
                headers=self.player_headers,
                json={"magazine_id": spare["id"]},
            )
            self.assertEqual(response.status_code, 200, response.text)
            requests = self.db.list_inventory_requests(int(self.campaign["id"]))
            self.assertEqual(len(requests), 1)
            self.assertEqual(requests[0]["request_type"], "reload_weapon")

            shell_weapon = self.db.create_inventory_item(
                int(self.character["id"]),
                name="Shotgun",
                item_type="weapon",
                reload_type="shell",
                mag_capacity=3,
                shell_stocks=[{"ammo_type": "buckshot", "quantity": 4}],
            )
            shell_stock = shell_weapon["shell_stocks"][0]
            response = client.post(
                f"/api/inventory/items/{shell_weapon['id']}/load-shells-request",
                headers=self.player_headers,
                json={"stock_id": shell_stock["id"], "count": 2},
            )
            self.assertEqual(response.status_code, 200, response.text)
            loaded = self.db.get_inventory_item(int(shell_weapon["id"]))
            self.assertEqual(len(loaded["loaded_shells"]), 2)
            self.assertEqual(loaded["shell_stocks"][0]["quantity"], 2)

            response = client.post(
                f"/api/inventory/items/{shell_weapon['id']}/refill-shell-stock-request",
                headers=self.player_headers,
                json={"stock_id": shell_stock["id"], "amount": 6},
            )
            self.assertEqual(response.status_code, 200, response.text)
            refilled = self.db.get_inventory_item(int(shell_weapon["id"]))
            self.assertEqual(refilled["shell_stocks"][0]["quantity"], 8)
            self.assertEqual(len(self.db.list_inventory_requests(int(self.campaign["id"]))), 1)

    def test_mass_healing_caps_player_and_enemy_hp(self) -> None:
        self.db.update_character_fields(int(self.character["id"]), current_hp=3)
        combat = self.db.create_combat(int(self.campaign["id"]))
        enemy = self.db.add_enemy_combatant(int(combat["id"]), "Drone", 15, 12, 10, "#ef4444")
        self.db.damage_enemy_combatant(int(enemy["id"]), 12)

        with TestClient(create_app(self.db, self.settings)) as client:
            player_heal = client.post(
                f"/api/campaigns/{self.campaign['id']}/heal/mass",
                headers=self.master_headers,
                json={"target_ids": [self.character["id"]], "amount": 100},
            )
            self.assertEqual(player_heal.status_code, 200, player_heal.text)
            self.assertEqual(self.db.get_character(int(self.character["id"]))["current_hp"], 20)

            enemy_heal = client.post(
                f"/api/campaigns/{self.campaign['id']}/combatants/enemies/heal/mass",
                headers=self.master_headers,
                json={"target_ids": [enemy["id"]], "amount": 100},
            )
            self.assertEqual(enemy_heal.status_code, 200, enemy_heal.text)
            self.assertEqual(self.db.get_combatant(int(enemy["id"]))["current_hp"], 15)

            denied = client.post(
                f"/api/campaigns/{self.campaign['id']}/heal/mass",
                headers=self.player_headers,
                json={"target_ids": [self.character["id"]], "amount": 1},
            )
            self.assertEqual(denied.status_code, 403)


if __name__ == "__main__":
    unittest.main()
