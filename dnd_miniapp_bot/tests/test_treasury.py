import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.db import Database
from app.api import create_app
from app.config import Settings
from app import treasury as t

class TreasuryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.db=Database(str(Path(self.tmp.name)/'test.sqlite3'));self.db.init_schema()
        self.game=self.db.create_campaign('Fantasy',100)
        self.ch=self.db.create_character(self.game['id'],'Hero',20,12);self.db.link_character(self.ch['id'],200)
        self.client=TestClient(create_app(self.db,Settings(db_path=self.db.path,bot_token='',dev_mode=True)))
    def tearDown(self):
        self.client.close();self.db.conn.close();self.tmp.cleanup()
    def item(self,kind,**extra):
        with self.db.conn:
            return self.db.conn.execute('INSERT INTO treasury_items(user_id,reward_json,created_at) VALUES (?,?,?)',(200,json.dumps(dict(kind=kind,name='Test',icon='*',rarity='rare',**extra)),t.now())).lastrowid
    def test_opening_is_idempotent_and_atomic(self):
        t.grant_keys(self.db,100,self.game['id'],200,1)
        with patch.object(t,'draw',return_value=dict(kind='sparks',name='50 искр',icon='*',amount=50,rarity='common')):
            first=t.open_chest(self.db,200,'same-request')
            second=t.open_chest(self.db,200,'same-request')
        self.assertEqual(first['opening_id'],second['opening_id']);self.assertTrue(second['replayed'])
        self.assertEqual(self.db.get_currency_balance(200),50);self.assertEqual(t.state(self.db,200)['keys'],0)
        with self.assertRaises(ValueError):t.open_chest(self.db,200,'other-request')
        self.assertEqual(len(t.state(self.db,200)['history']),1)
    def test_master_and_owner_guards(self):
        with self.assertRaises(ValueError):t.grant_keys(self.db,200,self.game['id'],200,1)
        with self.assertRaises(ValueError):t.grant_keys(self.db,100,self.game['id'],999,1)
        item=self.item('game')
        with self.assertRaises(ValueError):t.use_item(self.db,999,item,self.ch['id'])
        with self.assertRaises(ValueError):t.use_item(self.db,200,item,999)
        t.use_item(self.db,200,item,self.ch['id'])
        self.assertEqual(len(t.pending(self.db,100,self.game['id'])),1)
        with self.assertRaises(ValueError):t.decide(self.db,200,item,True,'Added')
        with self.assertRaises(ValueError):t.decide(self.db,100,item,True,'')
        t.decide(self.db,100,item,False,'Not suitable')
        self.assertEqual(t.state(self.db,200)['items'][0]['status'],'available')
        t.use_item(self.db,200,item,self.ch['id']);t.decide(self.db,100,item,True,'Added to character inventory')
        with self.assertRaises(ValueError):t.use_item(self.db,200,item,self.ch['id'])
    def test_coupon_only_consumed_on_success(self):
        self.db.unlock_cosmetic_effect(200,'wildfire')
        item=self.item('discount',percent=20);t.use_item(self.db,200,item)
        with self.assertRaises(ValueError):
            with t.atomic(self.db):self.db.purchase_effect_style(200,'wildfire','custom')
        self.assertEqual(t.state(self.db,200)['items'][0]['status'],'active')
        self.db.add_currency(200,300)
        with t.atomic(self.db):self.db.purchase_effect_style(200,'wildfire','custom')
        self.assertEqual(self.db.get_currency_balance(200),60)
        self.assertEqual(t.state(self.db,200)['items'][0]['status'],'used')
    def test_color_and_unique_vouchers(self):
        self.db.unlock_cosmetic_effect(200,'wildfire')
        color=self.item('color');t.use_item(self.db,200,color,effect_id='wildfire')
        self.assertIn('custom',self.db.effect_style_state(200)['wildfire'])
        unique=self.item('unique')
        with self.assertRaises(ValueError):t.claim_frame(self.db,200,t.FRAMES[0][0])
        t.use_item(self.db,200,unique)
        self.assertEqual(t.state(self.db,200)['frame_credits'],1)
        t.claim_frame(self.db,200,t.FRAMES[0][0])
        self.assertTrue(self.db.has_cosmetic_unlocked(200,t.FRAMES[0][0]));self.assertEqual(self.db.get_currency_balance(200),0)
        with self.assertRaises(ValueError):t.claim_frame(self.db,200,t.FRAMES[1][0])
    def test_http_and_probabilities(self):
        self.assertEqual(sum(r[2] for r in t.RARITIES),100)
        self.assertTrue(all(t.POOL[r[0]] for r in t.RARITIES))
        url=f"/api/campaigns/{self.game['id']}/treasury/keys"
        self.assertEqual(self.client.post(url,json={'user_id':200,'amount':1},headers={'X-Dev-Telegram-Id':'200'}).status_code,400)
        self.assertEqual(self.client.post(url,json={'user_id':200,'amount':1},headers={'X-Dev-Telegram-Id':'100'}).status_code,200)
        self.assertEqual(self.client.get('/api/treasury',headers={'X-Dev-Telegram-Id':'200'}).json()['keys'],1)
    def test_reward_roll_failure_restores_key(self):
        t.grant_keys(self.db,100,self.game['id'],200,1)
        with patch.object(t.secrets,'choice',side_effect=RuntimeError('test')):
            with self.assertRaises(RuntimeError):t.open_chest(self.db,200,'rollback-test')
        self.assertEqual(t.state(self.db,200)['keys'],1)
    def test_duplicate_reroll_replaces_reward_once_without_key(self):
        t.grant_keys(self.db,100,self.game['id'],200,2)
        value=dict(kind='game',name='Агат',icon='*',rarity='common')
        with patch.object(t,'draw',return_value=value):
            t.open_chest(self.db,200,'duplicate-first')
            second=t.open_chest(self.db,200,'duplicate-second')
        self.assertTrue(t.state(self.db,200)['history'][0]['can_reroll'])
        self.assertEqual(t.state(self.db,200)['stacks'][0]['count'],2)
        with patch.object(t,'draw',side_effect=RuntimeError('rollback')):
            with self.assertRaises(RuntimeError):t.reroll(self.db,200,second['opening_id'])
        self.assertEqual(t.state(self.db,200)['stacks'][0]['count'],2)
        with patch.object(t,'draw',return_value=dict(kind='sparks',name='15 искр',icon='*',rarity='common',amount=15)):
            t.reroll(self.db,200,second['opening_id'])
        self.assertEqual(t.state(self.db,200)['keys'],0)
        self.assertEqual(self.db.get_currency_balance(200),15)
        self.assertEqual(t.state(self.db,200)['stacks'][0]['count'],1)
        with self.assertRaises(ValueError):t.reroll(self.db,200,second['opening_id'])
    def test_sold_or_pending_reward_cannot_be_reused(self):
        item=self.item('game')
        with self.assertRaises(ValueError):t.sell_item(self.db,999,item)
        t.sell_item(self.db,200,item)
        self.assertEqual(self.db.get_currency_balance(200),40)
        with self.assertRaises(ValueError):t.sell_item(self.db,200,item)
        with self.assertRaises(ValueError):t.use_item(self.db,200,item,self.ch['id'])
        item=self.item('game');t.use_item(self.db,200,item,self.ch['id'])
        with self.assertRaises(ValueError):t.sell_item(self.db,200,item)
    def test_guarantee_and_enhanced_key_rewards(self):
        t.grant_keys(self.db,100,self.game['id'],200,10)
        with patch.object(t.secrets,'randbelow',return_value=0),patch.object(t.secrets,'choice',side_effect=lambda values:values[0]):
            for n in range(10):result=t.open_chest(self.db,200,'guarantee-'+str(n))
        self.assertEqual(result['reward']['rarity'],'rare')
        self.assertTrue(t.state(self.db,200)['history'][0]['guaranteed'])
        self.assertEqual(t.state(self.db,200)['until_guarantee'],10)
        t.grant_keys(self.db,100,self.game['id'],200,1,key_type='enhanced')
        with patch.object(t.secrets,'randbelow',return_value=0),patch.object(t.secrets,'choice',side_effect=lambda values:values[0]):
            result=t.open_chest(self.db,200,'enhanced-test','enhanced')
        self.assertEqual(result['reward']['rarity'],'uncommon')
        self.assertEqual(t.state(self.db,200)['boosts'],0)
        t.grant_keys(self.db,100,self.game['id'],200,1)
        with patch.object(t,'draw',return_value=dict(kind='keys',name='Ключи ×2',icon='*',rarity='rare',amount=2,key_type='enhanced')):
            t.open_chest(self.db,200,'key-reward-test')
        self.assertEqual(t.state(self.db,200)['boosts'],2)
        t.grant_keys(self.db,100,self.game['id'],200,1)
        with patch.object(t.secrets,'randbelow',return_value=0),patch.object(t.secrets,'choice',side_effect=lambda values:values[0]):
            boosted=t.open_chest(self.db,200,'automatic-boost')
        self.assertEqual(boosted['reward']['rarity'],'uncommon')
        self.assertEqual(t.state(self.db,200)['boosts'],1)
        self.assertEqual(t.state(self.db,200)['keys'],1)
    def test_currency_weights_and_links(self):
        with patch.object(t.secrets,'randbelow',side_effect=[0,39]),patch.object(t.secrets,'choice',side_effect=lambda values:values[0]):
            self.assertEqual(t.draw()['amount'],15)
        with patch.object(t.secrets,'randbelow',side_effect=[0,40]),patch.object(t.secrets,'choice',side_effect=lambda values:values[0]):
            self.assertEqual(t.draw()['amount'],5)
        for tier,_,_ in t.RARITIES:
            self.assertEqual(len([r for r in t.POOL[tier] if r.get('currency')=='gold']),2 if tier=='legendary' else 1)
        self.assertIn('61-potion-of-healing',t.enrich(dict(name='Большое зелье лечения'))['url'])
        self.assertNotIn('url',t.enrich(dict(name='Амулет памятного сна')))
        self.assertNotIn('rewards',t.state(self.db,200)['rarities'][0])
        pearl=t.enrich(dict(name='Жемчужина'))
        self.assertEqual(pearl['value_gp'],100);self.assertIn('100 зм',pearl['note'])
    def test_best_discount_and_generic_color_credit(self):
        for percent in (10,30,20):t.use_item(self.db,200,self.item('discount',percent=percent))
        self.assertEqual(t.quote(self.db,200,100)[0],70)
        credit=self.item('color');t.use_item(self.db,200,credit)
        self.assertEqual(t.benefits(self.db,200)['colors'],1)
        self.db.unlock_cosmetic_effect(200,'wildfire')
        with t.atomic(self.db):self.db.purchase_effect_style(200,'wildfire','custom')
        self.assertEqual(t.benefits(self.db,200)['colors'],0)
        self.assertEqual(t.quote(self.db,200,100)[0],70)
        self.assertIn('custom',self.db.effect_style_state(200)['wildfire'])
        self.db.add_currency(200,5000)
        with t.atomic(self.db):self.db.purchase_effect_style(200,'wildfire','gradient')
        self.assertEqual(t.quote(self.db,200,100)[0],80)
    def test_atomic_bundle_includes_palette_and_consumes_one_discount(self):
        from app.effect_catalog import STYLE_PRICES
        effect=self.db.purchasable_info(self.db.get_cosmetic_effect('wildfire'))
        t.use_item(self.db,200,self.item('discount',percent=20))
        before=5000;self.db.add_currency(200,before)
        with t.atomic(self.db):result=t.purchase_effect_bundle(self.db,200,'wildfire','custom')
        expected=((int(effect['price'])+STYLE_PRICES['custom'])*80+99)//100
        self.assertEqual(result['price'],expected)
        self.assertEqual(self.db.get_currency_balance(200),before-expected)
        self.assertTrue(self.db.has_effect_unlocked(200,'wildfire'))
        self.assertIn('custom',self.db.effect_style_state(200)['wildfire'])
        with t.atomic(self.db):result=t.purchase_effect_bundle(self.db,200,'wildfire','custom')
        self.assertEqual(result['price'],0)
    def test_failed_bundle_preserves_credit_and_discount(self):
        t.use_item(self.db,200,self.item('color'))
        t.use_item(self.db,200,self.item('discount',percent=30))
        with self.assertRaises(ValueError):
            with t.atomic(self.db):t.purchase_effect_bundle(self.db,200,'wildfire','custom')
        self.assertEqual(t.benefits(self.db,200)['colors'],1)
        self.assertEqual(t.benefits(self.db,200)['discount_percent'],30)
        self.assertFalse(self.db.has_effect_unlocked(200,'wildfire'))
    def test_http_bundle_redeems_color_and_returns_benefits(self):
        self.db.add_currency(200,5000)
        t.use_item(self.db,200,self.item('color'))
        response=self.client.post('/api/shop/purchase',headers={'X-Dev-Telegram-Id':'200'},json={'item_type':'effect','item_id':'wildfire','option_id':'custom'})
        self.assertEqual(response.status_code,200,response.text)
        result=response.json()
        self.assertIn('custom',result['effect_style_unlocks']['wildfire'])
        self.assertEqual(result['treasury_benefits']['colors'],0)
        self.assertEqual(result['price'],self.db.purchasable_info(self.db.get_cosmetic_effect('wildfire'))['price'])
    def test_unique_voucher_can_claim_achievement_frame(self):
        with self.db.conn:self.db.conn.execute("INSERT INTO cosmetics(id,name,rarity,category,purchasable) VALUES ('achievement_fixture','Achievement frame','unique','unique',0)")
        frame=self.db.get_cosmetic('achievement_fixture')
        t.use_item(self.db,200,self.item('unique'))
        t.claim_frame(self.db,200,frame['id'])
        self.assertTrue(self.db.has_cosmetic_unlocked(200,frame['id']))
        self.assertEqual(t.benefits(self.db,200)['frames'],0)
    def test_gold_duplicates_are_not_rerolled_and_item_window_is_five(self):
        t.grant_keys(self.db,100,self.game['id'],200,8)
        gold=dict(kind='game',name='5 золотых монет',currency='gold',icon='*',rarity='common')
        with patch.object(t,'draw',return_value=gold):
            t.open_chest(self.db,200,'gold-first')
            t.open_chest(self.db,200,'gold-second')
        self.assertFalse(t.state(self.db,200)['history'][0]['can_reroll'])
        for n in range(6):
            value=dict(kind='game',name='First' if n in (0,5) else 'Other'+str(n),icon='*',rarity='common')
            with patch.object(t,'draw',return_value=value):t.open_chest(self.db,200,'window-test-'+str(n))
        self.assertFalse(t.state(self.db,200)['history'][0]['can_reroll'])
    def test_choice_vouchers_validate_caps_and_preserve_old_items(self):
        item=self.item('game',choice_type='familiar',max_cr='1/4')
        with self.assertRaises(ValueError):t.use_item(self.db,200,item,self.ch['id'],selection={'name':'Test creature','cr':'1'})
        self.assertEqual(t.state(self.db,200)['items'][0]['status'],'available')
        t.use_item(self.db,200,item,self.ch['id'],selection={'name':'Test creature','cr':'1/8','source':'Test bestiary'})
        request=t.pending(self.db,100,self.game['id'])[0]
        self.assertIn('1/8',request['reward']['name']);self.assertIn('Test bestiary',request['reward']['note'])
        weapon=self.item('game',choice_type='weapon',bonus=2)
        with self.assertRaises(ValueError):t.use_item(self.db,200,weapon,self.ch['id'])
        t.use_item(self.db,200,weapon,self.ch['id'],selection={'name':'Рапира','source':'Книга правил'})
        self.assertEqual(t.state(self.db,200)['items'][0]['reward']['name'],'Рапира +2')
        armor=self.item('game',choice_type='armor',bonus=1)
        response=self.client.post(f'/api/treasury/items/{armor}/use',json={'character_id':self.ch['id'],'selection':{'name':'Кожаный доспех','source':'Правила кампании'}},headers={'X-Dev-Telegram-Id':'200'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['items'][0]['reward']['name'],'Кожаный доспех +1')
        old=self.item('game')
        t.use_item(self.db,200,old,self.ch['id'])
    def test_expanded_catalog_contains_healing_and_one_familiar_per_rarity(self):
        for rarity,cap in [('common','0'),('uncommon','1/8'),('rare','1/4'),('epic','1/2'),('legendary','1')]:
            familiar=[r for r in t.POOL[rarity] if r.get('choice_type')=='familiar']
            self.assertEqual(len(familiar),1);self.assertEqual(familiar[0]['max_cr'],cap)
        names=[r['name'] for pool in t.POOL.values() for r in pool]
        self.assertIn('Зелье лечения',names);self.assertIn('Набор ювелира',names)
        self.assertNotIn('Длинный меч +1',names)
