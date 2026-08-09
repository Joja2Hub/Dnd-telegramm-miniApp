from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.db import Database


class InventoryModelAccessTests(unittest.TestCase):
    def test_only_stock_models_are_free_and_revoke_resets_unique_selections(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(str(Path(tmp) / "test.sqlite3"))
            db.init_schema()
            fantasy = db.create_campaign("Месиво", 100, rule_type="fantasy")
            cyberpunk = db.create_campaign("Киберпанк", 100, rule_type="cyberpunk")
            fantasy_character = db.create_character(int(fantasy["id"]), "Mage", 20, 12)
            cyberpunk_character = db.create_character(int(cyberpunk["id"]), "Runner", 20, 12)
            db.link_character(int(fantasy_character["id"]), 200)
            db.link_character(int(cyberpunk_character["id"]), 300)

            initially_available = set(db.list_unlocked_inventory_model_ids(300))
            self.assertIn("cyberpunk_female", initially_available)
            self.assertIn("cyberpunk_male", initially_available)
            self.assertNotIn("cyberpunk_eclipse_look", initially_available)

            db.unlock_inventory_model(200, "mesivo_kavushka", source="test")
            db.unlock_inventory_model(300, "cyberpunk_hex_pistol_car", source="test")
            db.set_character_inventory_model(int(fantasy_character["id"]), "mesivo_kavushka")
            db.set_character_inventory_model(int(cyberpunk_character["id"]), "cyberpunk_hex_pistol_car")

            result = db.revoke_nonstandard_inventory_models()

            self.assertEqual(result["removed_unlocks"], 2)
            self.assertEqual(result["reset_characters"], 2)
            self.assertFalse(db.has_inventory_model_unlocked(200, "mesivo_kavushka"))
            self.assertFalse(db.has_inventory_model_unlocked(300, "cyberpunk_hex_pistol_car"))
            self.assertEqual(db.get_character(int(fantasy_character["id"]))["selected_inventory_model_id"], "fantasy_default")
            self.assertEqual(db.get_character(int(cyberpunk_character["id"]))["selected_inventory_model_id"], "cyberpunk_male")
            db.conn.close()


if __name__ == "__main__":
    unittest.main()
