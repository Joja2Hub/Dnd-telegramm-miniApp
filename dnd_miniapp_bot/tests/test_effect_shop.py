import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.api import create_app
from app.config import Settings
from app.db import Database
from app.effect_catalog import LAB_BY_ID, ALIASES

class EffectShopTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=Database(str(Path(self.tmp.name)/'shop.sqlite3'))
        self.db.init_schema()
        c=self.db.create_campaign('Shop',100)
        self.ch=self.db.create_character(c['id'],'Player',20,12)
        self.db.link_character(self.ch['id'],200)
        self.client=TestClient(create_app(self.db,Settings(db_path=self.db.path,bot_token='',dev_mode=True)))
        self.headers={'X-Dev-Telegram-Id':'200'}
    def tearDown(self):
        self.client.close();self.db.conn.close();self.tmp.cleanup()
    def test_catalog_groups_prices_and_duplicates(self):
        items=self.db.list_cosmetic_effects()
        self.assertTrue(set(LAB_BY_ID)<={e['id'] for e in items})
        self.assertFalse(set(ALIASES)&{e['id'] for e in items})
        for e in items:
            self.assertTrue(e['group'])
            if e['id'] in LAB_BY_ID:
                self.assertIn(e['rarity'],['epic','legendary'])
                self.assertGreaterEqual(e['price'],350)
                self.assertTrue(e['is_new'])
    def test_atomic_paid_options_and_validation(self):
        self.db.unlock_cosmetic_effect(200,'wildfire')
        self.db.add_currency(200,1000)
        self.db.purchase_effect_style(200,'wildfire','gradient')
        self.assertEqual(self.db.get_currency_balance(200),500)
        self.db.purchase_effect_style(200,'wildfire','gradient')
        self.assertEqual(self.db.get_currency_balance(200),500)
        style={'mode':'gradient','colors':['#ff1122','#44ff77','#8888ff'],'angle':120}
        self.assertEqual(self.db.validate_effect_style(200,'wildfire',style),style)
        with self.assertRaises(ValueError):self.db.validate_effect_style(200,'wildfire',{'mode':'solid','colors':style['colors']})
        with self.assertRaises(ValueError):self.db.purchase_effect_style(201,'wildfire','custom')
        with self.assertRaises(ValueError):self.db.purchase_effect_style(200,'wildfire','preset:invalid')
    def test_insufficient_funds_does_not_grant(self):
        self.db.unlock_cosmetic_effect(200,'wildfire')
        with self.assertRaises(ValueError):self.db.purchase_effect_style(200,'wildfire','custom')
        self.assertNotIn('wildfire',self.db.effect_style_state(200))
        self.assertEqual(self.db.get_currency_balance(200),0)
    def test_wallet_reads_do_not_hold_a_write_transaction(self):
        self.db.conn.commit()
        self.assertEqual(self.db.get_currency_balance(999),0)
        self.assertEqual(self.db.get_master_spark_balance(999),2000)
        self.db.list_spark_masters()
        self.assertFalse(self.db.conn.in_transaction)
        self.db.add_currency(200,20)
        self.db.get_currency_balance(200)
        self.assertFalse(self.db.conn.in_transaction)
        other=Database(self.db.path)
        try:
            other.conn.execute('UPDATE user_wallets SET balance=balance WHERE telegram_user_id=200')
            other.conn.commit()
        finally:other.conn.close()
    def test_legacy_ownership_is_migrated_idempotently(self):
        self.db.conn.execute("INSERT INTO user_effect_unlocks VALUES (200,'matrix_rain_violet','shop',NULL,'old')")
        self.db.conn.execute("UPDATE characters SET custom_effect='matrix_rain_violet' WHERE id=?",(self.ch['id'],))
        self.db.conn.commit()
        self.db.init_effect_shop();self.db.init_effect_shop()
        self.assertTrue(self.db.has_effect_unlocked(200,'matrix_rain'))
        self.assertIn('preset:purple',self.db.effect_style_state(200)['matrix_rain'])
        ch=self.db.get_character(self.ch['id'])
        self.assertEqual(ch['custom_effect'],'matrix_rain')
        self.assertEqual(ch['effect_style']['preset'],'purple')
        self.assertEqual(self.db.get_currency_balance(200),0)
    def test_api_rejects_unpaid_style_and_saves_paid_style(self):
        self.db.unlock_cosmetic_effect(200,'wildfire');self.db.add_currency(200,800)
        body={'custom_effect':'wildfire','effect_style':{'mode':'preset','preset':'jade'}}
        url=f"/api/characters/{self.ch['id']}/self"
        self.assertEqual(self.client.patch(url,headers=self.headers,json=body).status_code,403)
        response=self.client.post('/api/shop/purchase',headers=self.headers,json={'item_type':'effect_style','item_id':'wildfire','option_id':'preset:jade'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['currency_balance'],680)
        response=self.client.patch(url,headers=self.headers,json=body)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['character']['effect_style']['preset'],'jade')
        state=self.client.get(f"/api/campaigns/{self.ch['campaign_id']}/state",headers=self.headers).json()
        self.assertIn('preset:jade',state['effect_style_unlocks']['wildfire'])
    def test_radius_is_free_validated_and_saved_per_effect(self):
        for effect in ['wildfire','fire-ring']:self.db.unlock_cosmetic_effect(200,effect)
        url=f"/api/characters/{self.ch['id']}/self"
        for effect,radius in [('wildfire',.85),('fire-ring',1.15)]:
            response=self.client.patch(url,headers=self.headers,json={'custom_effect':effect,'effect_style':{'mode':'original','radius_scale':radius}})
            self.assertEqual(response.status_code,200,response.text)
        saved=self.db.get_character(self.ch['id'])
        self.assertEqual(saved['effect_radii'],{'wildfire':.85,'fire-ring':1.15})
        self.assertEqual(saved['effect_style']['radius_scale'],1.15)
        response=self.client.patch(url,headers=self.headers,json={'custom_effect':'wildfire','effect_style':{'mode':'original'}})
        self.assertEqual(response.json()['character']['effect_style']['radius_scale'],.85)
        for radius in [.5,1.8,True]:
            response=self.client.patch(url,headers=self.headers,json={'effect_style':{'mode':'original','radius_scale':radius}})
            self.assertEqual(response.status_code,403)
        self.assertEqual(self.db.get_currency_balance(200),0)
    def test_layer_is_free_saved_and_independent(self):
        for effect in ['wildfire','fire-ring']:self.db.unlock_cosmetic_effect(200,effect)
        url=f"/api/characters/{self.ch['id']}/self"
        for effect,layer in [('wildfire','between'),('fire-ring','front')]:
            response=self.client.patch(url,headers=self.headers,json={'custom_effect':effect,'effect_style':{'mode':'original','layer':layer}})
            self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.db.get_character(self.ch['id'])['effect_layers'],{'wildfire':'between','fire-ring':'front'})
        response=self.client.patch(url,headers=self.headers,json={'custom_effect':'wildfire','effect_style':{'mode':'original'}})
        self.assertEqual(response.json()['character']['effect_style']['layer'],'between')
        self.assertEqual(self.db.get_currency_balance(200),0)
        self.assertEqual(self.client.patch(url,headers=self.headers,json={'effect_style':{'mode':'original','layer':['bad']}}).status_code,403)
    def test_welcome_gift_is_once_per_account_and_persistent(self):
        self.assertTrue(self.db.shop_gift_available(200))
        response=self.client.post('/api/shop/welcome-gift',headers=self.headers,json={'amount':99999})
        self.assertEqual(response.status_code,200,response.text)
        self.assertTrue(response.json()['claimed']);self.assertEqual(response.json()['amount'],500)
        repeat=self.client.post('/api/shop/welcome-gift',headers=self.headers)
        self.assertFalse(repeat.json()['claimed']);self.assertEqual(repeat.json()['amount'],0)
        self.assertEqual(self.db.get_currency_balance(200),500)
        self.assertEqual(len(self.db.list_currency_transactions(200)),1)
        other=self.db.create_campaign('Second',100)
        char=self.db.create_character(other['id'],'Second player',20,12);self.db.link_character(char['id'],200)
        reopened=Database(self.db.path)
        try:
            reopened.init_schema();self.assertFalse(reopened.shop_gift_available(200))
        finally:reopened.conn.close()
        self.assertFalse(self.client.get('/api/me',headers=self.headers).json()['shop_gift_available'])
    def test_welcome_gift_rejects_non_player_and_supports_dev_player_view(self):
        response=self.client.post('/api/shop/welcome-gift',headers={'X-Dev-Telegram-Id':'999'})
        self.assertEqual(response.status_code,400)
        response=self.client.post('/api/shop/welcome-gift',headers={'X-Dev-Telegram-Id':'100','X-Dev-View-Character-Id':str(self.ch['id'])})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.db.get_currency_balance(200),500);self.assertEqual(self.db.get_currency_balance(100),0)
    def test_welcome_gift_rolls_back_if_credit_fails(self):
        self.db.conn.execute("CREATE TRIGGER deny_gift BEFORE INSERT ON currency_transactions WHEN NEW.source='shop-welcome' BEGIN SELECT RAISE(ABORT,'test failure'); END")
        self.db.conn.commit()
        with self.assertRaises(sqlite3.IntegrityError):self.db.claim_shop_gift(200)
        self.assertTrue(self.db.shop_gift_available(200));self.assertEqual(self.db.get_currency_balance(200),0)
    def test_requested_gift_replay_does_not_award_again(self):
        self.db.claim_shop_gift(200)
        self.db.conn.execute("INSERT INTO user_shop_gift_replays VALUES (200,'requested')");self.db.conn.commit()
        self.assertTrue(self.db.shop_gift_available(200))
        out=self.db.claim_shop_gift(200)
        self.assertTrue(out['replayed']);self.assertFalse(out['claimed']);self.assertEqual(out['amount'],0)
        self.assertEqual(out['currency_balance'],500);self.assertEqual(len(out['currency_transactions']),1)
        self.assertFalse(self.db.shop_gift_available(200));self.assertFalse(self.db.claim_shop_gift(200)['replayed'])
