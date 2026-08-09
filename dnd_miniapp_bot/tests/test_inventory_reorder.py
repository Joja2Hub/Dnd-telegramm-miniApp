from __future__ import annotations

import unittest

from app.db import Database


class InventoryReorderTests(unittest.TestCase):
    def test_moves_item_directly_to_requested_index(self) -> None:
        db = Database(":memory:")
        db.init_schema()
        campaign = db.create_campaign("Test", 100)
        character = db.create_character(int(campaign["id"]), "Hero", 20, 12)
        items = [
            db.create_inventory_item(int(character["id"]), name=name)
            for name in ("A", "B", "C", "D")
        ]

        moved = db.move_inventory_item_to_index(int(items[2]["id"]), 3)
        self.assertEqual([item["name"] for item in moved], ["D", "B", "A", "C"])

        moved = db.move_inventory_item_to_index(int(items[0]["id"]), 0)
        self.assertEqual([item["name"] for item in moved], ["A", "D", "B", "C"])
        db.conn.close()


if __name__ == "__main__":
    unittest.main()
