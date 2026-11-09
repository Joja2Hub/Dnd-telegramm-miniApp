"""Local account profiles. Cosmetic choices never change character data."""
import json

STAT_LABELS = {
    'characters': 'Персонажи', 'games': 'Игры', 'achievements': 'Достижения',
    'spent': 'Потрачено искр', 'earned': 'Получено искр',
    'damage': 'Входящий урон по журналу',
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
    damage = 0
    for row in db._many("SELECT l.payload_json FROM log_events l JOIN characters c ON c.id=l.character_id WHERE c.telegram_user_id=? AND l.kind='damage'", (user_id,)):
        try:
            damage += max(0, int(json.loads(row['payload_json']).get('damage', 0)))
        except (ValueError, TypeError, AttributeError):
            pass
    values = {'characters': len(characters), 'games': len(games), 'achievements': len(achievements),
              'spent': wallet['spent'], 'earned': wallet['earned'], 'damage': damage}
    return [{'id': key, 'label': label, 'value': values[key]} for key, label in STAT_LABELS.items()]
