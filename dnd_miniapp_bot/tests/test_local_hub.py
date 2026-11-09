import tempfile
import io
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from app.config import Settings
from app.db import Database
from local_host.run_local import build_local_app
from PIL import Image


class LocalHubTests(unittest.TestCase):
    def test_hub_aggregates_only_owned_characters(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(str(Path(tmp) / 'hub.sqlite3'))
            try:
                db.init_schema()
                a = db.create_campaign('First', 100)
                b = db.create_campaign('Second', 100)
                for campaign in (a, b):
                    ch = db.create_character(campaign['id'], 'Mine', 20, 12)
                    db.link_character(ch['id'], 200)
                    other = db.create_character(campaign['id'], 'Other', 20, 12)
                    db.link_character(other['id'], 300)
                state_path = Path(tmp) / 'state.json'
                with TestClient(build_local_app(db, Settings(db_path=db.path, bot_token='', dev_mode=True), state_path=state_path)) as client:
                    data = client.get('/local-api/hub/200').json()
                    self.assertEqual(len(data['characters']), 2)
                    self.assertEqual(len(data['games']), 2)
                    self.assertTrue(all(ch['name'] == 'Mine' for ch in data['characters']))
                    self.assertEqual(data['balance'], 0)
                    self.assertTrue(data['models'])
                    self.assertTrue(all(m['id'] and m['path'] for m in data['models']))
                    self.assertEqual(client.get('/local-api/hub/999999').status_code, 404)
                    self.assertEqual(client.get('/local/hub.html').status_code, 200)
                    mine = data['characters'][0]['id']
                    profile = {'name': 'Test name', 'bio': 'Story', 'avatar_path': '', 'showcases': [
                        {'kind': 'stats', 'items': ['spent', 'damage']},
                        {'kind': 'characters', 'items': [str(mine)]},
                    ]}
                    url = '/local-api/hub/200/profile'
                    self.assertEqual(client.patch(url, json=profile).status_code, 403)
                    headers = {'X-Local-User': '200'}
                    saved = client.patch(url, json=profile, headers=headers)
                    self.assertEqual(saved.status_code, 200, saved.text)
                    self.assertEqual(client.get('/local-api/hub/200').json()['profile']['name'], 'Test name')
                    public = client.get('/local-api/hub/200/public').json()
                    self.assertEqual(len(public['characters']), 1)
                    self.assertNotIn('current_hp', public['characters'][0])
                    self.assertNotIn('balance', public)
                    self.assertNotIn('uploads', public['profile'])
                    profile['showcases'][1]['items'] = [str(other['id'])]
                    self.assertEqual(client.patch(url, json=profile, headers=headers).status_code, 400)
                    profile['showcases'][1]['items'] = [str(mine)]
                    profile['avatar_path'] = '/uploads/other.png'
                    self.assertEqual(client.patch(url, json=profile, headers=headers).status_code, 400)
                    self.assertEqual(client.post('/local-api/hub/200/avatar', files={'file': ('bad.png', b'bad', 'image/png')}, headers=headers).status_code, 400)
                    image = io.BytesIO()
                    Image.new('RGB', (64, 64), '#38bda3').save(image, 'PNG')
                    uploaded = client.post('/local-api/hub/200/avatar', files={'file': ('avatar.png', image.getvalue(), 'image/png')}, headers=headers)
                    self.assertEqual(uploaded.status_code, 200, uploaded.text)
                    self.assertEqual(uploaded.json()['profile']['avatar_path'], '')
                    profile['avatar_path'] = uploaded.json()['avatar_path']
                    self.assertEqual(client.patch(url, json=profile, headers=headers).status_code, 200)
                    listed_user = next(u for u in client.get('/local-api/users').json()['users'] if u['telegram_user_id'] == 200)
                    self.assertEqual(listed_user['avatar_path'], profile['avatar_path'])
                    db.add_currency(200, 100)
                    db.add_currency(200, -30)
                    db.log(a['id'], mine, 'damage', 'Test', {'damage': 17})
                    stats = {s['id']: s['value'] for s in client.get('/local-api/hub/200').json()['stats']}
                    self.assertEqual((stats['spent'], stats['earned'], stats['damage']), (30, 100, 17))
                    self.assertEqual(stats['largest_hit'],17)
                    self.assertEqual(stats['hits'],1)
                    self.assertIn('chests',stats)
                    self.assertIn('models',stats)
                    activate = '/local-api/hub/200/active-game'
                    self.assertEqual(client.post(activate, json={'campaign_id':a['id']}, headers=headers).status_code, 403)
                    self.assertFalse(state_path.exists())
                    result = client.post('/local-api/hub/100/active-game', json={'campaign_id':a['id']}, headers={'X-Local-User':'100'})
                    self.assertEqual(result.status_code, 200)
                    self.assertEqual([g['id'] for g in client.get('/local-api/hub/200').json()['games'] if g['active']], [a['id']])
                    sorted_chars=client.get('/local-api/hub/200').json()['characters']
                    self.assertEqual(sorted_chars[0]['campaign_id'],a['id'])
                    model=data['models'][0]['id']
                    profile['showcases']=[{'kind':'avatars','items':[model]}]
                    saved=client.patch(url,json=profile,headers=headers)
                    self.assertEqual(saved.status_code,200,saved.text)
                    public=client.get('/local-api/hub/200/public').json()
                    self.assertEqual([m['id'] for m in public['models']],[model])
                    profile['showcases'][0]['items']=['non-owned-model']
                    self.assertEqual(client.patch(url,json=profile,headers=headers).status_code,400)
            finally:
                db.conn.close()
