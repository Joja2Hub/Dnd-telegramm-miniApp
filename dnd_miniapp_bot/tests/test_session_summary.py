from __future__ import annotations

import unittest
from datetime import datetime

from app.db import Database
from app.session_summary import MSK, send_session_summaries


class FakeBot:
    def __init__(self) -> None:
        self.messages: list[tuple[int, str]] = []

    async def send_message(self, *, chat_id: int, text: str) -> None:
        self.messages.append((int(chat_id), str(text)))


class SessionSummaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_sends_only_active_campaign_and_does_not_duplicate(self) -> None:
        db = Database(":memory:")
        db.init_schema()
        master_id = 100
        active = db.create_campaign("Активная игра", master_id)
        inactive = db.create_campaign("Без сессии", master_id)
        hero = db.create_character(int(active["id"]), "Герой", 25, 14)
        spectator = db.create_character(int(inactive["id"]), "Другой", 10, 10)
        db.link_character(int(hero["id"]), 200)
        db.link_character(int(spectator["id"]), 300)
        db.create_inventory_item(
            int(hero["id"]),
            name="Аптечка",
            description="Восстанавливает здоровье",
            emoji="🩹",
            quantity=2,
        )
        db.create_inventory_item(
            int(hero["id"]),
            name="Пистолет",
            item_type="weapon",
            weapon_type="пистолет",
            reload_type="magazine",
            mag_capacity=12,
            fire_modes=[{"name": "Выстрел", "ammo_cost": 1}],
            magazines=[{"name": "Основной", "ammo_current": 7, "ammo_max": 12, "ammo_type": "обычные"}],
        )
        db.log(int(active["id"]), int(hero["id"]), "damage", "Игровой урон")
        db.log(int(inactive["id"]), None, "campaign", "Только настройка кампании")

        fake_bot = FakeBot()
        today = datetime.now(MSK).date()
        first = await send_session_summaries(
            db,
            fake_bot,
            master_tg_id=master_id,
            session_day=today,
        )
        self.assertEqual(first.campaigns, 1)
        self.assertEqual(first.sent_characters, 1)
        self.assertEqual(first.failed_characters, 0)
        self.assertTrue(fake_bot.messages)
        self.assertTrue(all(chat_id == 200 for chat_id, _ in fake_bot.messages))
        combined = "\n".join(text for _, text in fake_bot.messages)
        self.assertIn("Герой", combined)
        self.assertIn("Инвентарь", combined)
        self.assertIn("Аптечка", combined)
        self.assertIn("Пистолет", combined)

        second = await send_session_summaries(
            db,
            fake_bot,
            master_tg_id=master_id,
            session_day=today,
        )
        self.assertEqual(second.sent_characters, 0)
        self.assertEqual(second.skipped_characters, 1)


if __name__ == "__main__":
    unittest.main()
