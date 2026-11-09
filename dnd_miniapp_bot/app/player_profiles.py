"""Local account profiles. Cosmetic choices never change character data."""
import json

STAT_LABELS = {
    'characters': 'Персонажи', 'games': 'Игры', 'achievements': 'Достижения',
    'spent': 'Потрачено искр', 'earned': 'Получено искр',
    'damage': 'Входящий урон по журналу',
    'largest_hit': 'Самый сильный полученный удар', 'hits': 'Полученные удары по журналу',
    'master_games': 'Игр в роли мастера', 'fantasy_games': 'Фэнтези-кампании', 'cyberpunk_games': 'Киберпанк-кампании',
    'models': 'Модели в коллекции', 'frames': 'Открыто рамок', 'effects': 'Открыто эффектов',
    'chests': 'Открыто сундуков', 'epic_drops': 'Эпические находки', 'legendary_drops': 'Легендарные находки',
    'treasure_sparks': 'Искры из сундуков', 'largest_spark_drop': 'Самая большая находка искр',
    'treasures_given': 'Сокровищ передано персонажам', 'treasures_sold': 'Продано сокровищ',
    'shop_spent': 'Потрачено в магазине',
}


def read_profile(db, user_id):
    row = db._one('SELECT profile_json FROM player_profiles WHERE telegram_user_id=?', (user_id,))
    data = json.loads(row['profile_json']) if row else {}
    return {'name': '', 'bio': '', 'avatar_path': '', 'uploads': [],
            'showcases': [{'kind': 'achievements', 'items': []}, {'kind': 'characters', 'items': []}], **data}


def write_profile(db, user_id, data):
    with db.conn:
        db.conn.execute('INSERT INTO player_profiles VALUES (?,?) ON CONFLICT(telegram_user_id) DO UPDATE SET profile_json=excluded.profile_json',
                        (user_id, json.dumps(data, ensure_ascii=False)))


def profile_stats(db, user_id, characters, games, achievements):
    wallet = db._one('SELECT COALESCE(SUM(CASE WHEN amount<0 THEN -amount ELSE 0 END),0) spent, COALESCE(SUM(CASE WHEN amount>0 THEN amount ELSE 0 END),0) earned FROM currency_transactions WHERE telegram_user_id=?', (user_id,))
    damage = largest_hit = hits = 0
    for row in db._many("SELECT l.payload_json FROM log_events l JOIN characters c ON c.id=l.character_id WHERE c.telegram_user_id=? AND l.kind='damage'", (user_id,)):
        try:
            hit=max(0, int(json.loads(row['payload_json']).get('damage', 0)))
            damage += hit;largest_hit=max(largest_hit,hit);hits+=int(hit>0)
        except (ValueError, TypeError, AttributeError):
            pass
    values = {'characters': len(characters), 'games': len(games), 'achievements': len(achievements),
              'spent': wallet['spent'], 'earned': wallet['earned'], 'damage': damage,'largest_hit':largest_hit,'hits':hits,
              'master_games':sum(bool(g.get('master')) for g in games),
              'fantasy_games':sum(g.get('rule_type')=='fantasy' for g in games),'cyberpunk_games':sum(g.get('rule_type')=='cyberpunk' for g in games),
              'models':len(db.list_unlocked_inventory_model_ids(user_id)),
              'frames':len(db.list_unlocked_cosmetic_ids(user_id)),
              'effects':len([id for id in db.list_unlocked_effect_ids(user_id) if id!='effect_none'])}
    openings=[]
    for row in db._many('SELECT reward_json FROM treasury_openings WHERE user_id=?',(user_id,)):
        try:openings.append(json.loads(row['reward_json']))
        except (ValueError,TypeError):pass
    sparks=[int(r.get('amount',0)) for r in openings if r.get('kind')=='sparks']
    values.update(chests=len(openings),epic_drops=sum(r.get('rarity')=='epic' for r in openings),legendary_drops=sum(r.get('rarity')=='legendary' for r in openings),treasure_sparks=sum(sparks),largest_spark_drop=max(sparks,default=0))
    values['treasures_given']=db._one("SELECT COUNT(*) n FROM treasury_items WHERE user_id=? AND status='used' AND character_id IS NOT NULL",(user_id,))['n']
    values['treasures_sold']=db._one("SELECT COUNT(*) n FROM treasury_items WHERE user_id=? AND status='sold'",(user_id,))['n']
    values['shop_spent']=db._one("SELECT COALESCE(SUM(-amount),0) n FROM currency_transactions WHERE telegram_user_id=? AND amount<0 AND source IN ('shop','effect-style')",(user_id,))['n']
    return [{'id': key, 'label': label, 'value': values[key]} for key, label in STAT_LABELS.items()]
