"""Account-owned banner cosmetics and their shop operations."""
import json
from datetime import datetime, timezone

BANNERS = [
  {
    "id": "ember",
    "name": "Сердце пламени",
    "category": "Стихии",
    "path": "/assets/profile-banners/ember.webp",
    "thumb_path": "/assets/profile-banners/ember-thumb.webp",
    "aliases": []
  },
  {
    "id": "tide",
    "name": "Глубокий прилив",
    "category": "Стихии",
    "path": "/assets/profile-banners/tide.webp",
    "thumb_path": "/assets/profile-banners/tide-thumb.webp",
    "aliases": []
  },
  {
    "id": "storm",
    "name": "Грозовой фронт",
    "category": "Стихии",
    "path": "/assets/profile-banners/storm.webp",
    "thumb_path": "/assets/profile-banners/storm-thumb.webp",
    "aliases": []
  },
  {
    "id": "arcane",
    "name": "Обсерватория мага",
    "category": "Классы",
    "path": "/assets/profile-banners/arcane.webp",
    "thumb_path": "/assets/profile-banners/arcane-thumb.webp",
    "aliases": []
  },
  {
    "id": "oath",
    "name": "Свет клятвы",
    "category": "Классы",
    "path": "/assets/profile-banners/oath.webp",
    "thumb_path": "/assets/profile-banners/oath-thumb.webp",
    "aliases": []
  },
  {
    "id": "bard",
    "name": "Последний аккорд",
    "category": "Классы",
    "path": "/assets/profile-banners/bard.webp",
    "thumb_path": "/assets/profile-banners/bard-thumb.webp",
    "aliases": []
  },
  {
    "id": "forest",
    "name": "Древний лес",
    "category": "Биомы",
    "path": "/assets/profile-banners/forest.webp",
    "thumb_path": "/assets/profile-banners/forest-thumb.webp",
    "aliases": []
  },
  {
    "id": "desert",
    "name": "Пески забытого царства",
    "category": "Биомы",
    "path": "/assets/profile-banners/desert.webp",
    "thumb_path": "/assets/profile-banners/desert-thumb.webp",
    "aliases": []
  },
  {
    "id": "frost",
    "name": "Северное сияние",
    "category": "Биомы",
    "path": "/assets/profile-banners/frost.webp",
    "thumb_path": "/assets/profile-banners/frost-thumb.webp",
    "aliases": []
  },
  {
    "id": "snake-scales",
    "name": "Змеиная чешуя",
    "category": "Текстуры",
    "path": "/assets/profile-banners/snake-scales.webp",
    "thumb_path": "/assets/profile-banners/snake-scales-thumb.webp",
    "aliases": [
      "/assets/profile-banners/ksael-green-scales.png"
    ]
  }
]

BANNERS += [
  {
    "id": "baldurs-gate",
    "name": "Врата Балдура · Серая гавань",
    "category": "Города",
    "path": "/assets/profile-banners/baldurs-gate.webp",
    "thumb_path": "/assets/profile-banners/baldurs-gate-thumb.webp",
    "aliases": []
  },
  {
    "id": "calimport",
    "name": "Калимпорт · город куполов",
    "category": "Города",
    "path": "/assets/profile-banners/calimport.webp",
    "thumb_path": "/assets/profile-banners/calimport-thumb.webp",
    "aliases": []
  },
  {
    "id": "suzail",
    "name": "Сузейл · королевская столица",
    "category": "Города",
    "path": "/assets/profile-banners/suzail.webp",
    "thumb_path": "/assets/profile-banners/suzail-thumb.webp",
    "aliases": []
  },
  {
    "id": "swamp",
    "name": "Туманные топи",
    "category": "Биомы",
    "path": "/assets/profile-banners/swamp.webp",
    "thumb_path": "/assets/profile-banners/swamp-thumb.webp",
    "aliases": []
  },
  {
    "id": "jungle",
    "name": "Затерянные джунгли",
    "category": "Биомы",
    "path": "/assets/profile-banners/jungle.webp",
    "thumb_path": "/assets/profile-banners/jungle-thumb.webp",
    "aliases": []
  },
  {
    "id": "underdark",
    "name": "Сады Подземья",
    "category": "Биомы",
    "path": "/assets/profile-banners/underdark.webp",
    "thumb_path": "/assets/profile-banners/underdark-thumb.webp",
    "aliases": []
  },
  {
    "id": "autumn",
    "name": "Золотая долина",
    "category": "Биомы",
    "path": "/assets/profile-banners/autumn.webp",
    "thumb_path": "/assets/profile-banners/autumn-thumb.webp",
    "aliases": []
  },
  {
    "id": "rogue",
    "name": "Тень плута",
    "category": "Классы",
    "path": "/assets/profile-banners/rogue.webp",
    "thumb_path": "/assets/profile-banners/rogue-thumb.webp",
    "aliases": []
  },
  {
    "id": "ranger",
    "name": "Тропа следопыта",
    "category": "Классы",
    "path": "/assets/profile-banners/ranger.webp",
    "thumb_path": "/assets/profile-banners/ranger-thumb.webp",
    "aliases": []
  },
  {
    "id": "druid",
    "name": "Круг друида",
    "category": "Классы",
    "path": "/assets/profile-banners/druid.webp",
    "thumb_path": "/assets/profile-banners/druid-thumb.webp",
    "aliases": []
  },
  {
    "id": "artificer",
    "name": "Мастерская изобретателя",
    "category": "Классы",
    "path": "/assets/profile-banners/artificer.webp",
    "thumb_path": "/assets/profile-banners/artificer-thumb.webp",
    "aliases": []
  },
  {
    "id": "astral",
    "name": "Астральное море",
    "category": "Магия",
    "path": "/assets/profile-banners/astral.webp",
    "thumb_path": "/assets/profile-banners/astral-thumb.webp",
    "aliases": []
  },
  {
    "id": "cryomancy",
    "name": "Сердце ледяных чар",
    "category": "Магия",
    "path": "/assets/profile-banners/cryomancy.webp",
    "thumb_path": "/assets/profile-banners/cryomancy-thumb.webp",
    "aliases": []
  },
  {
    "id": "necromancy",
    "name": "Шёпот некроманта",
    "category": "Магия",
    "path": "/assets/profile-banners/necromancy.webp",
    "thumb_path": "/assets/profile-banners/necromancy-thumb.webp",
    "aliases": []
  },
  {
    "id": "fey-magic",
    "name": "Фейское переплетение",
    "category": "Магия",
    "path": "/assets/profile-banners/fey-magic.webp",
    "thumb_path": "/assets/profile-banners/fey-magic-thumb.webp",
    "aliases": []
  }
]

BANNERS += [
  {
    "id": "cp-corporate",
    "name": "Корпоративный протокол",
    "category": "Киберпанк · Узоры",
    "path": "/assets/profile-banners/cp-corporate.webp",
    "thumb_path": "/assets/profile-banners/cp-corporate-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-black-red",
    "name": "Чёрный контракт",
    "category": "Киберпанк · Узоры",
    "path": "/assets/profile-banners/cp-black-red.webp",
    "thumb_path": "/assets/profile-banners/cp-black-red-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-circuit",
    "name": "Нефритовая сеть",
    "category": "Киберпанк · Узоры",
    "path": "/assets/profile-banners/cp-circuit.webp",
    "thumb_path": "/assets/profile-banners/cp-circuit-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-iridescent",
    "name": "Хромовый перелив",
    "category": "Киберпанк · Узоры",
    "path": "/assets/profile-banners/cp-iridescent.webp",
    "thumb_path": "/assets/profile-banners/cp-iridescent-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-alley",
    "name": "После дождя",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-alley.webp",
    "thumb_path": "/assets/profile-banners/cp-alley-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-slums",
    "name": "Нижние этажи",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-slums.webp",
    "thumb_path": "/assets/profile-banners/cp-slums-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-downtown",
    "name": "Стеклянный центр",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-downtown.webp",
    "thumb_path": "/assets/profile-banners/cp-downtown-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-club",
    "name": "За закрытой дверью",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-club.webp",
    "thumb_path": "/assets/profile-banners/cp-club-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-office",
    "name": "Выше облаков",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-office.webp",
    "thumb_path": "/assets/profile-banners/cp-office-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-netrunner",
    "name": "Убежище нетраннера",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-netrunner.webp",
    "thumb_path": "/assets/profile-banners/cp-netrunner-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-market",
    "name": "Ночной рынок",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-market.webp",
    "thumb_path": "/assets/profile-banners/cp-market-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-badlands",
    "name": "Последняя заправка",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/cp-badlands.webp",
    "thumb_path": "/assets/profile-banners/cp-badlands-thumb.webp",
    "aliases": []
  }
]

BANNERS += [
  {
    "id": "cp-yellow",
    "name": "Жёлтый сигнал",
    "category": "Киберпанк · Узоры",
    "path": "/assets/profile-banners/cp-yellow.webp",
    "thumb_path": "/assets/profile-banners/cp-yellow-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-netspace",
    "name": "Глубокая Сеть",
    "category": "Киберпанк · Сеть",
    "path": "/assets/profile-banners/cp-netspace.webp",
    "thumb_path": "/assets/profile-banners/cp-netspace-thumb.webp",
    "aliases": []
  },
  {
    "id": "cp-blackwall",
    "name": "Чёрный заслон",
    "category": "Киберпанк · Сеть",
    "path": "/assets/profile-banners/cp-blackwall.webp",
    "thumb_path": "/assets/profile-banners/cp-blackwall-thumb.webp",
    "aliases": []
  },
  {
    "id": "dark-moor",
    "name": "Пустошь забытых клятв",
    "category": "Тёмное фэнтези",
    "path": "/assets/profile-banners/dark-moor.webp",
    "thumb_path": "/assets/profile-banners/dark-moor-thumb.webp",
    "aliases": []
  },
  {
    "id": "dark-castle",
    "name": "Замок без короля",
    "category": "Тёмное фэнтези",
    "path": "/assets/profile-banners/dark-castle.webp",
    "thumb_path": "/assets/profile-banners/dark-castle-thumb.webp",
    "aliases": []
  },
  {
    "id": "dark-coast",
    "name": "Берег последнего огня",
    "category": "Тёмное фэнтези",
    "path": "/assets/profile-banners/dark-coast.webp",
    "thumb_path": "/assets/profile-banners/dark-coast-thumb.webp",
    "aliases": []
  },
  {
    "id": "infernal-forge",
    "name": "Кузня преисподней",
    "category": "Бездна и демоны",
    "path": "/assets/profile-banners/infernal-forge.webp",
    "thumb_path": "/assets/profile-banners/infernal-forge-thumb.webp",
    "aliases": []
  },
  {
    "id": "abyss-seal",
    "name": "Печать Бездны",
    "category": "Бездна и демоны",
    "path": "/assets/profile-banners/abyss-seal.webp",
    "thumb_path": "/assets/profile-banners/abyss-seal-thumb.webp",
    "aliases": []
  },
  {
    "id": "sunken-cathedral",
    "name": "Затонувший собор",
    "category": "Тёмное фэнтези",
    "path": "/assets/profile-banners/sunken-cathedral.webp",
    "thumb_path": "/assets/profile-banners/sunken-cathedral-thumb.webp",
    "aliases": []
  }
]

BANNERS += [
  {
    "id": "fighter",
    "name": "Зал боевых знамён",
    "category": "Классы",
    "path": "/assets/profile-banners/fighter.webp",
    "thumb_path": "/assets/profile-banners/fighter-thumb.webp",
    "aliases": []
  },
  {
    "id": "barbarian",
    "name": "Клятва северного клана",
    "category": "Классы",
    "path": "/assets/profile-banners/barbarian.webp",
    "thumb_path": "/assets/profile-banners/barbarian-thumb.webp",
    "aliases": []
  },
  {
    "id": "cleric",
    "name": "Тихая молитва",
    "category": "Классы",
    "path": "/assets/profile-banners/cleric.webp",
    "thumb_path": "/assets/profile-banners/cleric-thumb.webp",
    "aliases": []
  },
  {
    "id": "monk",
    "name": "Безмолвие горного храма",
    "category": "Классы",
    "path": "/assets/profile-banners/monk.webp",
    "thumb_path": "/assets/profile-banners/monk-thumb.webp",
    "aliases": []
  },
  {
    "id": "sorcerer",
    "name": "Пробуждение крови",
    "category": "Классы",
    "path": "/assets/profile-banners/sorcerer.webp",
    "thumb_path": "/assets/profile-banners/sorcerer-thumb.webp",
    "aliases": []
  },
  {
    "id": "warlock",
    "name": "Цена договора",
    "category": "Классы",
    "path": "/assets/profile-banners/warlock.webp",
    "thumb_path": "/assets/profile-banners/warlock-thumb.webp",
    "aliases": []
  },
  {
    "id": "dragon-ruins",
    "name": "Хранитель разрушенного престола",
    "category": "Драконы и чудовища",
    "path": "/assets/profile-banners/dragon-ruins.webp",
    "thumb_path": "/assets/profile-banners/dragon-ruins-thumb.webp",
    "aliases": []
  },
  {
    "id": "dragon-frost",
    "name": "Спящий подо льдом",
    "category": "Драконы и чудовища",
    "path": "/assets/profile-banners/dragon-frost.webp",
    "thumb_path": "/assets/profile-banners/dragon-frost-thumb.webp",
    "aliases": []
  },
  {
    "id": "beholder-vault",
    "name": "Взгляд из глубины",
    "category": "Драконы и чудовища",
    "path": "/assets/profile-banners/beholder-vault.webp",
    "thumb_path": "/assets/profile-banners/beholder-vault-thumb.webp",
    "aliases": []
  },
  {
    "id": "kraken-depths",
    "name": "Хозяин чёрных вод",
    "category": "Драконы и чудовища",
    "path": "/assets/profile-banners/kraken-depths.webp",
    "thumb_path": "/assets/profile-banners/kraken-depths-thumb.webp",
    "aliases": []
  },
  {
    "id": "colossus-graveyard",
    "name": "Кладбище колоссов",
    "category": "Тёмное фэнтези",
    "path": "/assets/profile-banners/colossus-graveyard.webp",
    "thumb_path": "/assets/profile-banners/colossus-graveyard-thumb.webp",
    "aliases": []
  },
  {
    "id": "wandering-caravan",
    "name": "Последний привал",
    "category": "Биомы",
    "path": "/assets/profile-banners/wandering-caravan.webp",
    "thumb_path": "/assets/profile-banners/wandering-caravan-thumb.webp",
    "aliases": []
  },
  {
    "id": "buried-library",
    "name": "Библиотека под корнями",
    "category": "Магия",
    "path": "/assets/profile-banners/buried-library.webp",
    "thumb_path": "/assets/profile-banners/buried-library-thumb.webp",
    "aliases": []
  }
]

BANNERS += [
  {
    "id": "calimshan-palace",
    "name": "Дворцовая ночь в Калимшане",
    "category": "Города",
    "path": "/assets/profile-banners/calimshan-palace.webp",
    "thumb_path": "/assets/profile-banners/calimshan-palace-thumb.webp",
    "aliases": []
  },
  {
    "id": "atm-getaway",
    "name": "Банкомат на буксире",
    "category": "Киберпанк · Локации",
    "path": "/assets/profile-banners/atm-getaway.webp",
    "thumb_path": "/assets/profile-banners/atm-getaway-thumb.webp",
    "aliases": []
  },
  {
    "id": "pitvin-lights",
    "name": "Огни Питвина",
    "category": "Города",
    "path": "/assets/profile-banners/pitvin-lights.webp",
    "thumb_path": "/assets/profile-banners/pitvin-lights-thumb.webp",
    "aliases": []
  },
  {
    "id": "moonwood-goblins",
    "name": "Гоблинские леса Мунвуда",
    "category": "Биомы",
    "path": "/assets/profile-banners/moonwood-goblins.webp",
    "thumb_path": "/assets/profile-banners/moonwood-goblins-thumb.webp",
    "aliases": []
  },
  {
    "id": "moon-wormwood",
    "name": "Лунная полынь у озера",
    "category": "Биомы",
    "path": "/assets/profile-banners/moon-wormwood.webp",
    "thumb_path": "/assets/profile-banners/moon-wormwood-thumb.webp",
    "aliases": []
  },
  {
    "id": "cave-king-crown",
    "name": "Корона пещерного короля",
    "category": "Магия",
    "path": "/assets/profile-banners/cave-king-crown.webp",
    "thumb_path": "/assets/profile-banners/cave-king-crown-thumb.webp",
    "aliases": []
  },
  {
    "id": "dark-dreams-castle",
    "name": "Замок Тёмных Снов над Миринджаром",
    "category": "Тёмное фэнтези",
    "path": "/assets/profile-banners/dark-dreams-castle.webp",
    "thumb_path": "/assets/profile-banners/dark-dreams-castle-thumb.webp",
    "aliases": []
  }
]

def allowed_banner_paths():
    return {''} | {b['path'] for b in BANNERS} | {path for b in BANNERS for path in b['aliases']}

for banner in BANNERS:
    banner['price']={'Стихии':600,'Классы':650,'Биомы':500,'Текстуры':350,'Города':700,'Магия':600,'Киберпанк · Узоры':400,'Киберпанк · Локации':650,'Киберпанк · Сеть':600,'Тёмное фэнтези':600,'Бездна и демоны':650,'Драконы и чудовища':700}[banner['category']]

def init_schema(db):
    db.conn.execute('CREATE TABLE IF NOT EXISTS user_banner_unlocks(user_id INTEGER NOT NULL,banner_id TEXT NOT NULL,source TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,banner_id))')
    migrate='custom_banner_id' not in {r['name'] for r in db._many('PRAGMA table_info(characters)')}
    if migrate:db.conn.execute("ALTER TABLE characters ADD COLUMN custom_banner_id TEXT NOT NULL DEFAULT ''")
    for row in db._many('SELECT telegram_user_id,profile_json FROM player_profiles'):
        value=json.loads(row['profile_json']).get('banner_path','')
        banner=next((b for b in BANNERS if value==b['path'] or value in b['aliases']),None)
        if banner:db.conn.execute('INSERT OR IGNORE INTO user_banner_unlocks VALUES (?,?,?,?)',(row['telegram_user_id'],banner['id'],'existing-profile',datetime.now(timezone.utc).isoformat()))
        if banner and migrate:db.conn.execute('UPDATE characters SET custom_banner_id=? WHERE telegram_user_id=?',(banner['id'],row['telegram_user_id']))

def owned_paths(db,user):
    owned={r['banner_id'] for r in db._many('SELECT banner_id FROM user_banner_unlocks WHERE user_id=?',(user,))}
    return {''}|{path for b in BANNERS if b['id'] in owned for path in [b['path'],*b['aliases']]}

def shop_state(db,user):
    from .player_profiles import read_profile
    from .treasury import quote
    owned={row['banner_id'] for row in db._many('SELECT banner_id FROM user_banner_unlocks WHERE user_id=?',(user,))}
    current=read_profile(db,user)['banner_path']
    return {'banners':[{**b,'owned':b['id'] in owned,'selected':current==b['path'] or current in b['aliases'],'final_price':quote(db,user,b['price'])[0]} for b in BANNERS],'banner_path':current,'characters':db._many('SELECT id,name,custom_banner_id FROM characters WHERE telegram_user_id=?',(user,))}

def purchase(db,user,banner_id):
    from .treasury import quote,consume
    banner=next((b for b in BANNERS if b['id']==banner_id),None)
    if not banner:raise ValueError('Баннер не найден')
    if db._one('SELECT 1 FROM user_banner_unlocks WHERE user_id=? AND banner_id=?',(user,banner_id)):return {'message':'Баннер уже открыт'}
    price,coupon=quote(db,user,banner['price'])
    if db.get_currency_balance(user)<price:raise ValueError('Недостаточно искр для баннера')
    consume(db,coupon)
    db.add_currency(user,-price,reason='Баннер: '+banner['name'],source='shop')
    db.conn.execute('INSERT INTO user_banner_unlocks VALUES (?,?,?,?)',(user,banner_id,'shop',datetime.now(timezone.utc).isoformat()))
    return {'message':'Баннер открыт','price':price}

def equip(db,user,banner_id,character_id=None):
    from .player_profiles import read_profile,write_profile
    banner=next((b for b in BANNERS if b['id']==banner_id),None)
    if banner_id and (not banner or not db._one('SELECT 1 FROM user_banner_unlocks WHERE user_id=? AND banner_id=?',(user,banner_id))):raise ValueError('Сначала открой этот баннер в магазине')
    if character_id is not None:
        if not db.conn.execute('UPDATE characters SET custom_banner_id=? WHERE id=? AND telegram_user_id=?',(banner_id,character_id,user)).rowcount:raise ValueError('Выбери своего персонажа')
        return {'message':'Баннер персонажа применён','character_id':character_id,'banner_path':banner['path'] if banner else ''}
    profile=read_profile(db,user);profile['banner_path']=banner['path'] if banner else ''
    write_profile(db,user,profile)
    return {'message':'Баннер применён','banner_path':profile['banner_path']}
