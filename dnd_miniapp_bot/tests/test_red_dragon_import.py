import tempfile
import unittest
from pathlib import Path
from app.db import Database
from tools.create_red_dragon_campaign import create_party, PARTY, NAME, MASTER


class RedDragonImportTests(unittest.TestCase):
    def test_exact_inventory_and_atomic_creation(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(str(Path(tmp) / 'campaign.sqlite3'))
            try:
                db.init_schema()
                assets = {p['key']:{'model':'/model.png','avatar':'/avatar.webp','thumb':'/thumb.webp'} for p in PARTY}
                result = create_party(db, assets)
                campaign = db.get_campaign(result['campaign_id'])
                self.assertEqual(campaign['master_tg_id'], MASTER)
                self.assertFalse(campaign['injuries_enabled'])
                self.assertEqual(campaign['rule_type'], 'fantasy')
                for spec, created in zip(PARTY, result['characters']):
                    ch = db.get_character(created['id'])
                    self.assertEqual((ch['current_hp'],ch['ac'],ch['telegram_user_id']), (spec['hp'],spec['ac'],spec['user']))
                    self.assertEqual({i['name']:i['quantity'] for i in db.list_inventory(ch['id'])}, {name:qty for name,qty,_ in spec['items']})
                    self.assertTrue(all(i['emoji'] and 'Источник:' not in i['description'] for i in db.list_inventory(ch['id'])))
                    self.assertEqual(ch['selected_inventory_model_id'],'red_dragon_'+spec['key'])
                    self.assertTrue(db.has_inventory_model_unlocked(spec['user'],ch['selected_inventory_model_id']))
                with self.assertRaises(ValueError):
                    create_party(db,assets)
            finally:
                db.conn.close()

    def test_failure_rolls_back_all_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            db=Database(str(Path(tmp)/'rollback.sqlite3'))
            try:
                db.init_schema()
                with self.assertRaises(KeyError):
                    create_party(db,{})
                self.assertIsNone(db._one('SELECT id FROM campaigns WHERE name=?',(NAME,)))
                self.assertEqual(db._one('SELECT COUNT(*) n FROM characters')['n'],0)
            finally:
                db.conn.close()
