from __future__ import annotations

import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import create_app
from app.config import Settings
from app.db import Database


class AchievementPlayerGrantTests(unittest.TestCase):
    def test_named_player_account_is_not_replaced_by_local_login(self) -> None:
        db = Database(':memory:')
        self.addCleanup(db.conn.close)
        db.init_schema()
        db.remember_player_account(200, 'Настя', '')
        db.remember_player_account(200, 'Робот', 'example_name')
        db.remember_player_account(200, 'Other', 'other_name')
        player = next(item for item in db.list_achievement_players() if item['telegram_user_id'] == 200)
        self.assertEqual(player['display_name'], 'Настя')
        self.assertEqual(player['username'], 'example_name')
        self.assertEqual(db.get_user_profile(200)['display_name'], 'Настя')

    def test_grant_targets_player_account_not_character_slot(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(str(Path(tmp) / "test.sqlite3"))
            db.init_schema()
            campaign = db.create_campaign("Киберпанк", 100, rule_type="cyberpunk")
            first = db.create_character(int(campaign["id"]), "Первый", 20, 12)
            second = db.create_character(int(campaign["id"]), "Второй", 20, 12)
            db.link_character(int(first["id"]), 200)
            db.link_character(int(second["id"]), 200)
            achievement = db.create_achievement(
                int(campaign["id"]),
                100,
                icon="🏆",
                title="Фарт",
                description="Выдано игроку, не слоту персонажа",
                tag="Киберпанк",
            )

            grant = db.grant_achievement_to_player(int(achievement["id"]), 200, int(campaign["id"]), 100)
            again = db.grant_achievement_to_player(int(achievement["id"]), 200, int(campaign["id"]), 100, "обновлено")
            grants = db.list_player_achievement_grants(200)

            self.assertEqual(len(grants), 1)
            self.assertEqual(int(grant["telegram_user_id"]), 200)
            self.assertEqual(int(again["telegram_user_id"]), 200)
            self.assertIsNone(grant["character_id"])
            self.assertEqual(grants[0]["master_comment"], "обновлено")
            db.conn.close()

    def test_global_recipients_and_rewards_without_character(self) -> None:
        with ExitStack() as stack:
            tmp = stack.enter_context(tempfile.TemporaryDirectory())
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            stack.callback(db.conn.close)
            db.init_schema()
            campaign = db.create_campaign("One-shot", 100)
            other = db.create_campaign("Cyberpunk", 300)
            for name in ("First", "Second"):
                character = db.create_character(int(other["id"]), name, 20, 12)
                db.link_character(int(character["id"]), 200)
            achievement = db.create_achievement(
                int(campaign["id"]), 100, icon="*", title="Luck",
                description="Account reward", tag="Cyberpunk", currency_reward=10,
            )
            starting_balance = db.top_up_master_sparks(100, 100)
            settings = Settings(db_path=db_path, bot_token='', dev_mode=True, main_master_tg_id=100)
            master = {"X-Dev-Telegram-Id": "100"}
            player = {"X-Dev-Telegram-Id": "400", "X-Dev-Telegram-First-Name": "Alex", "X-Dev-Telegram-Username": "alex"}
            base = f"/api/campaigns/{campaign['id']}"
            grant_url = f"{base}/achievements/{achievement['id']}"
            with TestClient(create_app(db, settings)) as client:
                self.assertEqual(client.get('/api/me', headers=player).status_code, 200)
                directory = client.get(f"{base}/achievement-players", headers=master)
                self.assertEqual(directory.status_code, 200)
                players = directory.json()['players']
                self.assertEqual({p['telegram_user_id'] for p in players}, {100, 200, 300, 400})
                self.assertEqual(len([p for p in players if p['telegram_user_id'] == 200]), 1)
                self.assertEqual(next(p for p in players if p['telegram_user_id'] == 400)['display_name'], 'Alex')
                self.assertEqual(client.get(f"{base}/achievement-players", headers=player).status_code, 403)
                self.assertEqual(client.post(f"{grant_url}/grant", headers=player, json={'telegram_user_id': 200}).status_code, 403)

                unknown = client.post(f"{grant_url}/grant-many", headers=master, json={'telegram_user_ids': [200, 999]})
                self.assertEqual(unknown.status_code, 400)
                self.assertEqual(db.list_player_achievement_grants(200), [])

                single = client.post(f"{grant_url}/grant", headers=master, json={'telegram_user_id': 200})
                self.assertEqual(single.status_code, 200, single.text)
                self.assertIsNone(single.json()['grant']['character_id'])
                bulk = client.post(f"{grant_url}/grant-many", headers=master, json={'telegram_user_ids': [200, 300, 400, 400]})
                self.assertEqual(bulk.status_code, 200, bulk.text)
                self.assertEqual(len(bulk.json()['grants']), 3)
                self.assertTrue(all(g['character_id'] is None for g in bulk.json()['grants']))
                self.assertEqual(len(db.list_player_achievement_grants(200)), 1)

                grant = db.list_player_achievement_grants(400)[0]
                for _ in range(2):
                    opened = client.post(f"/api/achievement-grants/{grant['id']}/open", headers=player)
                    self.assertEqual(opened.status_code, 200, opened.text)
                self.assertEqual(db.get_currency_balance(400), 10)
                self.assertEqual(db.get_master_spark_balance(100), starting_balance - 10)
                admin = client.post('/api/sparks/admin/players/400/achievements/grant', headers=master, json={'achievement_id': achievement['id']})
                self.assertEqual(admin.status_code, 200, admin.text)

    def test_local_player_can_open_account_achievement_from_another_campaign(self) -> None:
        with ExitStack() as stack:
            tmp = stack.enter_context(tempfile.TemporaryDirectory())
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            stack.callback(db.conn.close)
            db.init_schema()
            reward_campaign = db.create_campaign("Old game", 100)
            current_campaign = db.create_campaign("Current game", 300)
            current_character = db.create_character(int(current_campaign["id"]), "Current hero", 20, 12)
            db.link_character(int(current_character["id"]), 200)
            achievement = db.create_achievement(
                int(reward_campaign["id"]), 100, icon="*", title="Millionaire?",
                description="Cross-campaign reward", tag="Old game", currency_reward=10,
            )
            grant = db.grant_achievement_to_player(
                int(achievement["id"]), 200, int(reward_campaign["id"]), 100,
            )
            settings = Settings(db_path=db_path, bot_token='', dev_mode=True, main_master_tg_id=100)
            local_player = {
                "X-Dev-Telegram-Id": "300",
                "X-Dev-View-Character-Id": str(current_character["id"]),
            }

            with TestClient(create_app(db, settings)) as client:
                opened = client.post(f"/api/achievement-grants/{grant['id']}/open", headers=local_player)

            self.assertEqual(opened.status_code, 200, opened.text)
            self.assertEqual(db.get_currency_balance(200), 10)
            self.assertTrue(db.get_grant_by_achievement_user(int(achievement["id"]), 200)["opened_at"])

    def test_open_repairs_legacy_opened_grant_without_currency_reward(self) -> None:
        with ExitStack() as stack:
            tmp = stack.enter_context(tempfile.TemporaryDirectory())
            db_path = str(Path(tmp) / "test.sqlite3")
            db = Database(db_path)
            stack.callback(db.conn.close)
            db.init_schema()
            campaign = db.create_campaign("Campaign", 100)
            character = db.create_character(int(campaign["id"]), "Hero", 20, 12)
            db.link_character(int(character["id"]), 200)
            achievement = db.create_achievement(
                int(campaign["id"]), 100, icon="*", title="Legacy",
                description="Missing old reward", tag="Campaign", currency_reward=10,
            )
            grant = db.grant_achievement_to_player(
                int(achievement["id"]), 200, int(campaign["id"]), 100,
                character_id=int(character["id"]),
            )
            db.conn.execute(
                "UPDATE achievement_grants SET opened_at=? WHERE id=?",
                ("2026-01-01T00:00:00+00:00", int(grant["id"])),
            )
            db.conn.commit()
            settings = Settings(db_path=db_path, bot_token='', dev_mode=True, main_master_tg_id=100)
            player = {"X-Dev-Telegram-Id": "200"}

            with TestClient(create_app(db, settings)) as client:
                for _ in range(2):
                    opened = client.post(f"/api/achievement-grants/{grant['id']}/open", headers=player)
                    self.assertEqual(opened.status_code, 200, opened.text)

            self.assertEqual(db.get_currency_balance(200), 10)
            reward_rows = db._many(
                "SELECT id FROM currency_transactions WHERE telegram_user_id=? AND source='achievement' AND source_id=?",
                (200, int(grant["id"])),
            )
            self.assertEqual(len(reward_rows), 1)
            repaired_grant = db.get_grant_by_achievement_user(int(achievement["id"]), 200)
            self.assertEqual(int(repaired_grant["character_id"]), int(character["id"]))


if __name__ == "__main__":
    unittest.main()
