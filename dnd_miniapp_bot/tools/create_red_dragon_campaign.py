"""Import the four supplied LEGO character sheets; dry-run unless --apply is set."""
import argparse
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.config import Settings
from app.db import Database
from app.image_utils import optimize_upload

NAME = 'Сказания о красном драконе'
MASTER = 464302752
ITEM_EMOJIS = {
    'Инструменты вора':'🗝️', 'Кошель':'👝', 'Золотые монеты':'🪙', 'Кинжал':'🗡️',
    'Лёгкий арбалет':'🏹', 'Арбалетные болты':'🎯', 'Кожаный доспех':'🦺',
    'Маскировочный набор':'🎭', 'Комплект взломщика':'🧰', 'Набор для подделки':'✒️',
    'Короткий меч':'⚔️', 'Плащ':'🧥', 'Боевой молот':'🔨', 'Молитвослов':'📜',
    'Кольчуга с наплечниками':'🛡️', 'Палочки благовоний':'🕯️', 'Комплект священника':'🙏',
    'Повседневная одежда':'👕', 'Символ религии':'☀️', 'Длинный меч':'🗡️',
    'Игровой набор для драконьих шахмат':'♟️', 'Колода карт':'🃏', 'Праща':'🪢',
    'Ядра для пращи':'🪨', 'Кольчужно-латный доспех':'🛡️', 'Щит':'🛡️',
    'Книга заклинаний':'📖', 'Свиток: Волшебная стрела':'📜', 'Комплект учёного':'🎓',
    'Свиток: Магический доспех':'📜', 'Свиток: Невидимость':'📜',
    'Мистический фокусирующий предмет (скипетр)':'🪄', 'Жемчужина':'⚪',
}
SHEETS = Path('C:/Users/erush/Desktop/Творчество/DND/Кампании и ваншоты/Лего приключение')
# Bundled equipment remains a single item, exactly as listed in the sheets.
PARTY = [
    dict(key='orc', name='Орк', user=1066701240, hp=28, ac=15, pdf='Плут.pdf', image=1, width=230, height=320, color='#619a83',
         items=[('Инструменты вора',1,''),('Кошель',1,''),('Золотые монеты',15,''),('Кинжал',2,'Атака +7; урон 1d4 + 4 колющего; дистанция 20/60 футов.'),
                ('Лёгкий арбалет',1,'Атака +7; урон 1d8 + 4 колющего; дистанция 80/320 футов.'),('Арбалетные болты',20,''),('Кожаный доспех',1,''),
                ('Маскировочный набор',1,''),('Комплект взломщика',1,''),('Набор для подделки',1,''),('Короткий меч',1,'Атака +7; урон 1d6 + 4 колющего.'),('Плащ',1,'')],
         slots={'armor':'Кожаный доспех','weapon-1':'Короткий меч','weapon-2':'Лёгкий арбалет','accessory-1':'Плащ'}),
    dict(key='dwarf', name='Дварф', user=1029098597, hp=30, ac=16, pdf='Жрец.pdf', image=0, width=230, height=310, color='#dbac57',
         items=[('Боевой молот',1,'Атака +5; урон 1d8 + 2 дробящего, двумя руками 1d10 + 2.'),('Молитвослов',1,''),('Кольчуга с наплечниками',1,''),
                ('Палочки благовоний',5,''),('Комплект священника',1,''),('Повседневная одежда',1,''),('Кошель',1,''),('Золотые монеты',15,''),('Символ религии',1,'')],
         slots={'armor':'Кольчуга с наплечниками','weapon-1':'Боевой молот','accessory-1':'Символ религии'}),
    dict(key='gnome', name='Гном', user=1249327502, hp=44, ac=17, pdf='Гном.pdf', image=1, width=220, height=320, color='#81a6db',
         items=[('Длинный меч',1,'Атака +7; урон 1d8 + 4 режущего, двумя руками 1d10 + 4.'),('Кошель',1,''),('Золотые монеты',20,''),
                ('Игровой набор для драконьих шахмат',1,''),('Повседневная одежда',1,''),('Колода карт',1,''),('Праща',1,'Атака +4; урон 1d4 + 1 дробящего; дистанция 30/120 футов.'),
                ('Ядра для пращи',20,''),('Кольчужно-латный доспех',1,''),('Щит',1,'')],
         slots={'armor':'Кольчужно-латный доспех','weapon-1':'Длинный меч','weapon-2':'Щит'}),
    dict(key='elf', name='Эльф Мага', user=290280695, hp=22, ac=13, pdf='Мага.pdf', image=1, width=190, height=330, color='#a38cda',
         items=[('Книга заклинаний',1,''),('Свиток: Волшебная стрела',1,''),('Комплект учёного',1,''),('Свиток: Магический доспех',1,''),
                ('Кошель',1,''),('Золотые монеты',10,''),('Свиток: Невидимость',1,''),('Мистический фокусирующий предмет (скипетр)',1,''),
                ('Жемчужина',5,'Для заклинания «Опознание».'),('Повседневная одежда',1,'')],
         slots={'armor':'Повседневная одежда','weapon-1':'Мистический фокусирующий предмет (скипетр)','accessory-1':'Книга заклинаний'}),
]


class DeferredCommits:
    """Keep existing DB helpers inside one atomic import transaction."""
    def __init__(self, connection):
        self.connection = connection

    def commit(self):
        pass

    def __getattr__(self, name):
        return getattr(self.connection, name)


def create_party(db, assets):
    if db._one('SELECT id FROM campaigns WHERE name=?', (NAME,)):
        raise ValueError('Кампания уже существует: повторный импорт остановлен.')
    real_connection = db.conn
    real_connection.execute('BEGIN IMMEDIATE')
    db.conn = DeferredCommits(real_connection)
    try:
        campaign = db.create_campaign(NAME, MASTER, rule_type='fantasy', injuries_enabled=False)
        result = []
        for spec in PARTY:
            character = db.create_character(campaign['id'], spec['name'], spec['hp'], spec['ac'], color=spec['color'])
            db.link_character(character['id'], spec['user'])
            asset = assets[spec['key']]
            model_id = 'red_dragon_' + spec['key']
            db.conn.execute('''INSERT INTO inventory_models
                (id,campaign_id,name,description,asset_path,thumb_path,rarity,category,width_px,height_px,offset_y,glow_css,sort_order)
                VALUES (?,?,?,?,?,?,'unique','campaign',?,?,0,'',?)''',
                (model_id,campaign['id'],spec['name'],'Иллюстрация из листа персонажа LEGO: '+NAME,
                 asset['model'],asset['model'],spec['width'],spec['height'],800+len(result)))
            db.unlock_inventory_model(spec['user'], model_id, source='campaign_setup', source_id=campaign['id'])
            db.update_character_fields(character['id'], selected_inventory_model_id=model_id,
                                       avatar_path=asset['avatar'], avatar_thumb_path=asset['thumb'])
            item_ids = {}
            for name, quantity, description in spec['items']:
                item = db.create_inventory_item(character['id'], name=name, quantity=quantity,
                    description=description, emoji=ITEM_EMOJIS[name])
                item_ids[name] = item['id']
            for slot, name in spec['slots'].items():
                db.set_cyber_inventory_slot(character['id'], 'fantasy', slot, item_ids[name])
            result.append({'id':character['id'],'name':spec['name'],'player':spec['user'],
                           'hp':spec['hp'],'ac':spec['ac'],'inventory_entries':len(item_ids),'model':model_id})
        db.log(campaign['id'], None, 'campaign', 'Кампания и снаряжение созданы по листам персонажей LEGO', {'characters':result})
        real_connection.commit()
        return {'campaign_id':campaign['id'],'campaign_name':NAME,'master':MASTER,'characters':result}
    except Exception:
        real_connection.rollback()
        raise
    finally:
        db.conn = real_connection


def prepare_assets(upload_root):
    from pypdf import PdfReader
    directory = ROOT / 'frontend/assets/inventory-models/red-dragon'
    directory.mkdir(parents=True, exist_ok=True)
    assets = {}
    for spec in PARTY:
        image = PdfReader(SHEETS / spec['pdf']).pages[0].images[spec['image']].image
        assert image.mode == 'RGBA' and image.getextrema()[-1] == (0,255)
        model_file = directory / (spec['key']+'.png')
        image.save(model_file)
        avatar = optimize_upload(model_file.read_bytes(), upload_root=upload_root, kind='avatar', stem='red_dragon_'+spec['key'])
        assets[spec['key']] = {'model':'/assets/inventory-models/red-dragon/'+model_file.name,
                                'avatar':avatar.asset_path,'thumb':avatar.thumb_path}
    return assets


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    path = Path(Settings().db_path).resolve()
    db = Database(str(path))
    try:
        accounts = {row['telegram_user_id']:row['first_name'] for row in db._many('SELECT * FROM player_accounts')}
        assert accounts[MASTER] == 'Ваня'
        for spec, expected in zip(PARTY, ['Саня','Лаура','Слава','Дамир']):
            assert accounts[spec['user']] == expected
        assert not db._one('SELECT id FROM campaigns WHERE name=?', (NAME,)), 'Campaign already exists'
        if not args.apply:
            print(json.dumps({'name':NAME,'party':PARTY},ensure_ascii=False,indent=2))
            return
        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup = ROOT / 'backups' / ('before_red_dragon_'+stamp+'.sqlite3')
        backup.parent.mkdir(exist_ok=True)
        with sqlite3.connect(backup) as target:
            db.conn.backup(target)
        assets = prepare_assets(path.parent / 'uploads')
        result = create_party(db, assets)
        assert db.conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        receipt = ROOT / 'backups' / ('red_dragon_created_'+stamp+'.json')
        receipt.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False,indent=2))
        print('Backup:',backup)
    finally:
        db.conn.close()


if __name__ == '__main__':
    main()
