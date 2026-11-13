import json
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.api import create_app
from app.db import Database
from app.config import Settings
from app import profile_banners as banners
from app import treasury

class BannerShopTests(unittest.TestCase):
    def test_expanded_catalog_assets_and_categories(self):
        from PIL import Image
        self.assertEqual(len(banners.BANNERS),66)
        self.assertEqual(len({b['id'] for b in banners.BANNERS}),66)
        self.assertEqual(len([b for b in banners.BANNERS if b['category']=='Города']),5)
        self.assertEqual(len([b for b in banners.BANNERS if b['category']=='Магия']),6)
        patterns=[b for b in banners.BANNERS if b['category']=='Киберпанк · Узоры']
        locations=[b for b in banners.BANNERS if b['category']=='Киберпанк · Локации']
        self.assertEqual(len(patterns),5);self.assertEqual(len(locations),9)
        for category,count in [('Киберпанк · Сеть',2),('Тёмное фэнтези',6),('Бездна и демоны',2)]:
            self.assertEqual(sum(b['category']==category for b in banners.BANNERS),count)
        self.assertTrue(all(b['price']==400 for b in patterns))
        self.assertTrue(all(b['price']==650 for b in locations))
        root=Path(__file__).resolve().parents[1]/'frontend'
        for entry in banners.BANNERS:
            self.assertGreater(entry['price'],0)
            for key in ('path','thumb_path'):
                file=root/entry[key].lstrip('/')
                with Image.open(file) as image:
                    self.assertGreater(image.width/image.height,2.8)
                    self.assertTrue(any(high-low>100 for low,high in image.convert('RGB').getextrema()))
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.db=Database(str(Path(self.tmp.name)/'test.sqlite3'));self.db.init_schema()
        self.client=TestClient(create_app(self.db,Settings(db_path=self.db.path,bot_token='',dev_mode=True)))
        self.headers={'X-Dev-Telegram-Id':'200'}
    def tearDown(self):
        self.client.close();self.db.conn.close();self.tmp.cleanup()
    def test_purchase_equip_discount_and_ownership(self):
        self.assertEqual(self.client.post('/api/shop/banners/ember/equip',headers=self.headers).status_code,400)
        self.assertEqual(self.client.post('/api/shop/purchase',headers=self.headers,json={'item_type':'banner','item_id':'ember'}).status_code,400)
        self.assertFalse(banners.shop_state(self.db,200)['banners'][0]['owned'])
        self.db.add_currency(200,1000)
        with self.db.conn:
            coupon=self.db.conn.execute('INSERT INTO treasury_items(user_id,reward_json,status,created_at) VALUES (?,?,?,?)',(200,json.dumps({'kind':'discount','percent':20,'name':'20%'}),'active',treasury.now())).lastrowid
        out=self.client.post('/api/shop/purchase',headers=self.headers,json={'item_type':'banner','item_id':'ember'})
        self.assertEqual(out.status_code,200,out.text);self.assertEqual(out.json()['price'],480)
        self.assertEqual(self.db.get_currency_balance(200),520)
        self.assertEqual(self.client.post('/api/shop/purchase',headers=self.headers,json={'item_type':'banner','item_id':'ember'}).status_code,200)
        self.assertEqual(self.db.get_currency_balance(200),520)
        self.assertEqual(self.client.post('/api/shop/banners/ember/equip',headers={'X-Dev-Telegram-Id':'300'}).status_code,400)
        self.assertEqual(self.client.post('/api/shop/banners/ember/equip',headers=self.headers).status_code,200)
        self.assertEqual(self.db.get_user_profile(200)['account_profile']['banner_path'],banners.BANNERS[0]['path'])
        self.assertEqual(self.db._one('SELECT status FROM treasury_items WHERE id=?',(coupon,))['status'],'used')
    def test_preserves_legacy_banner(self):
        with self.db.conn:self.db.conn.execute('INSERT INTO player_profiles VALUES (?,?)',(200,json.dumps({'banner_path':'/assets/profile-banners/ksael-green-scales.png'})))
        banners.init_schema(self.db);self.db.conn.commit()
        entry=next(b for b in banners.shop_state(self.db,200)['banners'] if b['id']=='snake-scales')
        self.assertTrue(entry['owned']);self.assertTrue(entry['selected'])
    def test_character_banners_are_independent_from_profile(self):
        game=self.db.create_campaign('Game',100)
        first=self.db.create_character(game['id'],'First',20,12);second=self.db.create_character(game['id'],'Second',20,12)
        self.db.link_character(first['id'],200);self.db.link_character(second['id'],300)
        self.db.add_currency(200,1000)
        with treasury.atomic(self.db):banners.purchase(self.db,200,'ember')
        response=self.client.post('/api/shop/banners/ember/equip',json={'character_id':first['id']},headers=self.headers)
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(self.db.get_character(first['id'])['custom_banner_id'],'ember')
        self.assertEqual(self.db.get_user_profile(200)['account_profile']['banner_path'],'')
        self.assertEqual(self.db.get_user_profile(200)['characters'][0]['banner_path'],banners.BANNERS[0]['path'])
        self.assertEqual(self.client.post('/api/shop/banners/ember/equip',json={'character_id':second['id']},headers=self.headers).status_code,400)
        self.assertEqual(self.db.get_character(second['id'])['custom_banner_id'],'')
        thumb=banners.BANNERS[0]['thumb_path']
        self.assertEqual(response.json()['party_banner_path'],thumb)
        state=self.client.get(f"/api/campaigns/{game['id']}/state",headers={'X-Dev-Telegram-Id':'300'})
        self.assertEqual(state.status_code,200,state.text)
        self.assertEqual({ch['id']:ch['party_banner_path'] for ch in state.json()['team_characters']},{first['id']:thumb,second['id']:''})
        reset=self.client.post('/api/shop/banners/default/equip',json={'character_id':first['id']},headers=self.headers)
        self.assertEqual(reset.json()['party_banner_path'],'')
