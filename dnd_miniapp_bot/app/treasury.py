"""Account-level treasure, atomic openings, vouchers and master handover requests."""
import json
import secrets
from contextlib import contextmanager
from datetime import datetime, timezone
from fractions import Fraction
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

RARITIES = [('common','Обычное',50),('uncommon','Необычное',30),('rare','Редкое',15),('epic','Эпическое',4),('legendary','Легендарное',1)]

def reward(name, icon, kind='game', **extra):
    return dict(name=name,icon=icon,kind=kind,**extra)

POOL = {
 'common': [reward('50 искр','✨','sparks',amount=50),reward('5 золотых монет','🪙'),reward('10 золотых монет','🪙'),reward('25 золотых монет','🪙'),
            reward('Агат','💎'),reward('Инструменты плотника','🪚'),reward('Инструменты повара','🍳'),reward('Набор травника','🌿'),
            reward('Зелье лечения','🧪'),reward('Свиток: Свет','📜'),reward('Самонагревающаяся кружка','☕'),reward('Компас, указывающий домой','🧭')],
 'uncommon': [reward('100 искр','✨','sparks',amount=100),reward('Скидка 10%','🎟️','discount',percent=10),reward('50 золотых монет','🪙'),
              reward('Гранат','💎'),reward('Инструменты вора','🗝️'),reward('Инструменты алхимика','⚗️'),reward('Зелье лазания','🧪'),
              reward('Свиток: Обнаружение магии','📜'),reward('Свиток: Понимание языков','📜'),reward('Плащ, меняющий цвет','🧥'),
              reward('Фамильяр: кот','🐈',note='Малый компаньон; возможности определяет мастер.'),reward('Фамильяр: ворон','🐦',note='Малый компаньон; возможности определяет мастер.')],
 'rare': [reward('200 искр','✨','sparks',amount=200),reward('Скидка 20%','🎟️','discount',percent=20),reward('Бесплатный свой цвет','🎨','color'),
          reward('75 золотых монет','🪙'),reward('100 золотых монет','🪙'),reward('Жемчужина','⚪'),reward('Зелье невидимости','🧪'),
          reward('Свиток: Левитация','📜'),reward('Свиток: Невидимость','📜'),reward('Щит +1','🛡️'),reward('Длинный меч +1','⚔️'),
          reward('Фамильяр: сова','🦉',note='Малый компаньон; без автоматического боевого усиления.')],
 'epic': [reward('350 искр','✨','sparks',amount=350),reward('Скидка 30%','🎟️','discount',percent=30),reward('Бесплатный свой градиент','🌈','gradient'),
          reward('Кольчуга +1','🛡️'),reward('Короткий лук +1','🏹'),reward('Кинжал +1','🗡️'),
          reward('Фамильяр: лунный мотылёк','🦋',note='Редкий декоративный компаньон. Способности согласуются с мастером.')],
 'legendary': [reward('500 искр','✨','sparks',amount=500),reward('Право выкупить уникальную рамку','🗝️','unique'),
               reward('Длинный меч +2','⚔️'),reward('Фамильяр: искристый дракончик','🐉',note='Небольшой компаньон, не полноценный боевой дракон. Только с согласия мастера.')],
}
FRAMES = [('treasury_gilded_seal','Золотая печать','frame-gold',750),('treasury_arcane_seal','Печать арканиста','frame-base-arcane',900)]
POOL['common'] += [reward('Кольцо тёплого прикосновения','💍',note='Слегка согревает руку. Не защищает от холода и не наносит урон.'),
                   reward('Амулет светящейся искры','📿',note='Слабое декоративное свечение; не заменяет факел.'),
                   reward('Плащ аккуратного путника','🧥',note='Легко очищается от обычной дорожной пыли.')]
POOL['uncommon'] += [reward('Кольцо меняющейся гравировки','💍',note='Владелец меняет короткую декоративную надпись. Не подделывает печати.'),
                     reward('Плащ от мелкого дождя','🧥',note='Сохраняет одежду сухой под небольшим дождём; не защищает от погружения.'),
                     reward('Амулет памятного голоса','📿',note='Хранит одно короткое голосовое послание; условия использования согласует мастер.'),
                     reward('Перчатки чистописца','🧤',note='Пишут аккуратно, но не дают бонусов к проверкам и не копируют чужой почерк.')]
POOL['rare'] += [reward('Кольцо ночного чтения','💍',note='Подсвечивает книгу в руках; не даёт тёмного зрения.'),
                reward('Плащ театрального выхода','🧥',note='Создаёт короткий декоративный шлейф искр или лепестков без игрового урона.'),
                reward('Амулет семейного очага','📿',note='Сохраняет знакомый аромат дома. Не телепортирует и не показывает местоположение.')]

# Choice vouchers replace only future drops. Existing item snapshots remain intact.
for rarity,cap in [('common','0'),('uncommon','1/8'),('rare','1/4'),('epic','1/2'),('legendary','1')]:
    POOL[rarity]=[r for r in POOL[rarity] if not r['name'].startswith('Фамильяр:') and r['name'] not in {'Щит +1','Длинный меч +1','Кольчуга +1','Короткий лук +1','Кинжал +1','Длинный меч +2'}]
    POOL[rarity].append(reward('Фамильяр на выбор · угроза до '+cap,'🐾',choice_type='familiar',max_cr=cap,
        note='Выбери существо из бестиария вашей игры. Угроза не выше '+cap+'. Источник, способности и роль компаньона проверяет мастер; это не автоматическое применение заклинания «Поиск фамильяра».'))
POOL['rare'].append(reward('Оружие +1 на выбор','⚔️',choice_type='weapon',bonus=1,note='Выбери базовое оружие по правилам кампании. Награда даёт только бонус +1, не дополнительные свойства именованных магических предметов.'))
POOL['epic'].append(reward('Броня +1 на выбор','🛡️',choice_type='armor',bonus=1,note='Выбери базовый доспех. Только бонус +1, без дополнительных свойств именованной магической брони.'))
POOL['legendary'].append(reward('Оружие +2 на выбор','⚔️',choice_type='weapon',bonus=2,note='Выбери базовое оружие по правилам кампании. Только бонус +2, без дополнительных магических свойств.'))
POOL['common'] += [reward('Зелье плавания','🧪'),reward('Противоядие','🧴'),reward('Набор лекаря','🩹'),reward('Набор путешественника','🎒'),
    reward('Инструменты сапожника','👞'),reward('Инструменты гончара','🏺'),reward('Инструменты кожевника','🧵'),
    reward('Мел, пишущий разными цветами','🖍️',note='Декоративные надписи без магических печатей.'),
    reward('Закладка верной страницы','🔖',note='Всегда раскрывает книгу на отмеченной владельцем странице.'),
    reward('Пуговица с тихой мелодией','🎵',note='Проигрывает короткую знакомую мелодию; не влияет на существ.')]
POOL['uncommon'] += [reward('Большое зелье лечения','🧪'),reward('Зелье дружбы с животными','🧪'),reward('Зелье водного дыхания','🧪'),
    reward('Зелье ночного зрения','🧪'),reward('Зелье бодрого шага','🧪',note='Небольшое дорожное преимущество согласует мастер; не даёт дополнительных действий.'),
    reward('Набор плута','🗝️',note='Инструменты вора, мел и небольшое зеркальце. Без магических бонусов к проверкам.'),
    reward('Набор ювелира','💎',note='Инструменты ювелира, лупа и маленькие весы; драгоценные камни не включены.'),
    reward('Набор картографа','🗺️'),reward('Набор каллиграфа','✒️'),reward('Набор охотника','🏕️'),reward('Набор дипломата','✉️'),
    reward('Кольцо смены цвета волос','💍',note='Меняет только цвет волос владельца; не даёт маскировку и бонусы к проверкам.'),
    reward('Плащ приятного ветерка','🧥',note='Слегка колышется без ветра. Не позволяет летать и не отклоняет атаки.'),
    reward('Амулет знакомого аромата','📿',note='Воспроизводит один выбранный аромат, не скрывает запах владельца от выслеживания.'),
    reward('Чернильница меняющегося цвета','🖋️',note='Меняет цвет имеющихся чернил; не создаёт бесконечные чернила.')]
POOL['rare'] += [reward('Отличное зелье лечения','🧪'),reward('Зелье сопротивления огню','🧪'),reward('Зелье сопротивления холоду','🧪'),
    reward('Зелье увеличения','🧪'),reward('Зелье уменьшения','🧪'),reward('Набор полевого алхимика','⚗️'),
    reward('Кольцо сухого письма','💍',note='Сохраняет написанное владельцем письмо сухим при обычной сырости, но не под водой.'),
    reward('Амулет памятного сна','📿',note='Помогает вспомнить один собственный сон. Не предсказывает будущее.'),
    reward('Плащ звёздной подкладки','🧥',note='На внутренней стороне медленно мерцают декоративные созвездия.')]
POOL['epic'] += [reward('Превосходное зелье лечения','🧪'),reward('Зелье полёта','🧪'),reward('Зелье жизненной силы','🧪'),
    reward('Кольцо карманного представления','💍',note='Создаёт небольшую декоративную иллюстрацию над ладонью, без урона и механических бонусов; ограничения задаёт мастер.')]

SALE_PRICES = dict(common=8, uncommon=18, rare=40, epic=100, legendary=220)
PITY = [('rare','Редкое',75),('epic','Эпическое',20),('legendary','Легендарное',5)]
ENHANCED = [('uncommon','Необычное',55),('rare','Редкое',35),('epic','Эпическое',8),('legendary','Легендарное',2)]
for tier, amounts, gold in [('common',[15,25,35,50],[5]),('uncommon',[60,75,100],[10]),('rare',[125,150,200],[25]),('epic',[250,350],[50]),('legendary',[500],[75,100])]:
    POOL[tier] = [r for r in POOL[tier] if r['kind']!='sparks' and 'золотых монет' not in r['name']]
    POOL[tier] += [reward(str(n)+' искр','✨','sparks',amount=n) for n in amounts]
    POOL[tier] += [reward(str(n)+' золотых монет','🪙',currency='gold',amount=n) for n in gold]
for tier, amount, enhanced in [('uncommon',1,False),('rare',2,False),('epic',3,False),('epic',1,True),('legendary',2,True)]:
    POOL[tier].append(reward(('Буст открытия' if enhanced else 'Ключи')+' ×'+str(amount),'✨' if enhanced else '🗝️','keys',amount=amount,key_type='boost' if enhanced else 'normal'))

CYBER_GEAR = {
    'common': [
        ('Полевой медпакет', '🩹', 'Расходник для первой помощи по правилам кампании.'),
        ('Ремкомплект имплантов', '🧰', 'Расходники для обслуживания, не повышают уровень импланта.'),
        ('Портативный аккумулятор', '🔋', 'Резервное питание для совместимого устройства.'),
        ('Неоновая нашивка', '🧥', 'Меняет рисунок подсветки, не даёт игровых бонусов.'),
    ],
    'uncommon': [
        ('Умные линзы', '👓', 'Приближение и фильтр бликов; не дают ночного зрения автоматически.'),
        ('Карманный проектор «Фантом»', '📽️', 'Показывает статичные голограммы, не создаёт боевого двойника.'),
        ('Набор техника', '🧰', 'Полевой комплект для диагностики электроники и имплантов.'),
        ('Маячок «Крошка»', '📡', 'Одноразовая метка для отслеживания в пределах сцены, условия задаёт мастер.'),
    ],
    'rare': [
        ('Дрон-разведчик «Мотылёк»', '📷', 'Малый дрон с камерой, без вооружения.'),
        ('Набор полевой кибермедицины', '🩺', 'Комплект стабилизации и диагностики; эффект определяют правила игры.'),
        ('Изолированный терминал «Кокон»', '💻', 'Автономное устройство для чтения игровых носителей и хранения улик.'),
    ],
    'epic': [
        ('Плащ «Призма»', '🧥', 'Подстраивает расцветку под окружение, не делает владельца невидимым.'),
        ('Дрон поддержки «Стриж»', '📡', 'Переносит мелкое снаряжение и передаёт видео; параметры согласует мастер.'),
        ('Кибердека «Глухой контур»', '💻', 'Редкая платформа для игровых скриптов; характеристики задаёт мастер.'),
    ],
    'legendary': [
        ('Прототип «Двойник»', '📽️', 'Проецирует краткую иллюзию силуэта. Частоту и ограничения согласует мастер.'),
        ('Дека «Нулевая ночь»', '💻', 'Прототип с модульной памятью; не даёт автоматического доступа к сетям.'),
    ],
}
CYBER_POOL = {}
for tier, amounts in zip(CYBER_GEAR, ([500, 750], [1000, 1500], [2500, 3500], [5000, 7500], [10000])):
    CYBER_POOL[tier] = [
        {**r, 'name': r['name'].replace('Ключи', 'Щепки')}
        for r in POOL[tier] if r['kind'] != 'game'
    ] + [
        reward(f'{n:,} крипты'.replace(',', ' '), '💳', currency='crypto', amount=n,
               note='Игровая крипта. Передаётся выбранному персонажу через мастера.')
        for n in amounts
    ] + [reward(name, icon, note=note) for name, icon, note in CYBER_GEAR[tier]]
for tier, bonus in [('rare', 1), ('epic', 2), ('legendary', 3)]:
    CYBER_POOL[tier].append(reward(f'Улучшение импланта +{bonus}', '🦾', choice_type='implant', bonus=bonus,
                                  note='Выбери установленный имплант. Совместимость и эффект улучшения утверждает мастер.'))


def enrich(value):
    value=dict(value)
    name=value['name']
    if name in {'Агат','Гранат','Жемчужина'}:
        value['value_gp']={'Агат':10,'Гранат':100,'Жемчужина':100}[name]
        value['note']='Драгоценный камень. Стоимость: '+str(value['value_gp'])+' зм. Продажу и использование в игре согласует мастер.'
    elif 'золотых монет' in name:
        value['note']='Игровая валюта: '+str(value.get('amount',name.split()[0]))+' зм. Передаётся выбранному персонажу через мастера.'
    if 'золотых монет' in name: value['currency']='gold'
    if 'зелье лечения' in name.lower(): value['url']='https://dnd.su/items/61-potion-of-healing/'
    elif name=='Зелье невидимости': value['url']='https://www.dnd.su/items/62-potion-of-invisibility/'
    elif name=='Зелье лазания': value['url']='https://mail.dnd.su/items/60-potion-of-climbing/'
    elif name=='Зелье дружбы с животными': value['url']='https://dnd.su/items/58-potion-of-animal-friendship/'
    elif name=='Зелье водного дыхания': value['url']='https://next.dnd.su/items/16043-potion-of-water-breathing/'
    elif name=='Зелье увеличения': value['url']='https://dnd.su/items/70-potion-of-growth/'
    elif name=='Зелье уменьшения': value['url']='https://mail.dnd.su/items/71-potion-of-diminution/'
    elif name=='Зелье полёта': value['url']='https://www.dnd.su/items/66-potion-of-flying/'
    elif name.startswith('Зелье сопротивления'): value['url']='https://www.dnd.su/items/69-potion-of-resistance/'
    elif name.startswith('Свиток:'): value['url']='https://www.dnd.su/items/210-spell-scroll/'
    elif value.get('choice_type')=='weapon': value['url']='https://www.dnd.su/items/160-weapon-1-2-3/'
    elif name.startswith('Инструменты') or name=='Набор травника': value['url']='https://www.dnd.su/articles/inventory/100-tools/'
    elif name in {'Противоядие','Набор лекаря','Набор путешественника'}: value['url']='https://www.dnd.su/articles/inventory/147-armor-arms-equipment-tools/'
    return value

def now(): return datetime.now(timezone.utc).isoformat()

def init_schema(db):
    db.conn.executescript('''
      CREATE TABLE IF NOT EXISTS treasury_keys(user_id INTEGER PRIMARY KEY,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0));
      CREATE TABLE IF NOT EXISTS treasury_key_grants(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,master_id INTEGER NOT NULL,campaign_id INTEGER NOT NULL,amount INTEGER NOT NULL,comment TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS treasury_items(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,reward_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'available',character_id INTEGER,master_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS treasury_openings(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL,request_id TEXT NOT NULL,reward_json TEXT NOT NULL,item_id INTEGER,created_at TEXT NOT NULL,UNIQUE(user_id,request_id));
      CREATE INDEX IF NOT EXISTS treasury_items_owner ON treasury_items(user_id,status);
    ''')
    for table,column,definition in [('treasury_keys','enhanced_balance','INTEGER NOT NULL DEFAULT 0'),('treasury_key_grants','key_type',"TEXT NOT NULL DEFAULT 'normal'"),('treasury_openings','key_type',"TEXT NOT NULL DEFAULT 'normal'"),('treasury_openings','can_reroll','INTEGER NOT NULL DEFAULT 0'),('treasury_openings','rerolled','INTEGER NOT NULL DEFAULT 0'),('treasury_openings','guaranteed','INTEGER NOT NULL DEFAULT 0')]:
        if column not in {r['name'] for r in db._many('PRAGMA table_info('+table+')')}:
            db.conn.execute('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition)
    db.conn.execute('CREATE TABLE IF NOT EXISTS treasury_rerolls(id INTEGER PRIMARY KEY,opening_id INTEGER NOT NULL,old_reward TEXT NOT NULL,new_reward TEXT NOT NULL,created_at TEXT NOT NULL)')
    for table, column, definition in (
        ('treasury_keys', 'chips', 'INTEGER NOT NULL DEFAULT 0 CHECK(chips>=0)'),
        ('treasury_keys', 'chip_boosts', 'INTEGER NOT NULL DEFAULT 0 CHECK(chip_boosts>=0)'),
        ('treasury_openings', 'case_type', "TEXT NOT NULL DEFAULT 'fantasy'"),
    ):
        if column not in {r['name'] for r in db._many('PRAGMA table_info('+table+')')}:
            db.conn.execute('ALTER TABLE '+table+' ADD COLUMN '+column+' '+definition)
    for id,name,css,price in FRAMES:
        db.conn.execute("INSERT OR IGNORE INTO cosmetics(id,name,description,rarity,category,css_class,price,purchasable) VALUES (?,?,?,'unique','unique',?,?,0)",
                        (id,name,'Коллекция сокровищницы. Право выкупа выпадает из сундука.',css,price))

class DeferredConnection:
    def __init__(self, connection): self.connection=connection
    def __getattr__(self, key): return getattr(self.connection,key)
    def commit(self): pass
    def __enter__(self): return self
    def __exit__(self,*args): return False

@contextmanager
def atomic(db):
    conn=db.conn
    conn.execute('BEGIN IMMEDIATE')
    db.conn=DeferredConnection(conn)
    try:
        yield
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally: db.conn=conn

def state(db,user):
    key=db._one('SELECT * FROM treasury_keys WHERE user_id=?',(user,))
    items=db._many('SELECT * FROM treasury_items WHERE user_id=? ORDER BY id DESC',(user,))
    for item in items:
        item['reward']=enrich(json.loads(item.pop('reward_json')))
        item['sale_price']=SALE_PRICES.get(item['reward'].get('rarity'),8)
    stacks={}
    for item in items:
        if item['status'] not in ('available','pending','active','frame_credit','color_credit','gradient_credit'): continue
        identity=json.dumps(item['reward'],sort_keys=True,ensure_ascii=False) if item['status']=='available' else str(item['id'])
        if identity not in stacks: stacks[identity]={**item,'count':0}
        stacks[identity]['count']+=1
    count=db._one("SELECT COUNT(*) n FROM treasury_openings WHERE user_id=? AND case_type='fantasy'",(user,))['n']
    cyber_count=db._one("SELECT COUNT(*) n FROM treasury_openings WHERE user_id=? AND case_type='cyberpunk'",(user,))['n']
    return dict(keys=key['balance'] if key else 0,boosts=key['enhanced_balance'] if key else 0,items=items,stacks=list(stacks.values()),until_guarantee=10-count%10,guarantee_ready=count%10==9,
        cyberpunk=dict(keys=key['chips'] if key else 0,boosts=key['chip_boosts'] if key else 0,until_guarantee=10-cyber_count%10,guarantee_ready=cyber_count%10==9),
        frame_credits=sum(i['status']=='frame_credit' for i in items),
        discount_percent=max((i['reward']['percent'] for i in items if i['status']=='active'),default=0),shop_benefits=benefits(db,user),
        effect_style_unlocks=db.effect_style_state(user),unlocked_cosmetic_ids=db.list_unlocked_cosmetic_ids(user),
        characters=db._many('SELECT c.id,c.name,g.name campaign,g.rule_type FROM characters c JOIN campaigns g ON g.id=c.campaign_id WHERE c.telegram_user_id=?',(user,)),
        effects=[dict(id=e['id'],name=e['name']) for e in db.list_cosmetic_effects() if e['id']!='effect_none' and db.has_effect_unlocked(user,e['id'])],
        history=[dict(id=r['id'],case_type=r['case_type'],reward=enrich(json.loads(r['reward_json'])),can_reroll=bool(r['can_reroll'] and not r['rerolled'] and any(i['id']==r['item_id'] and i['status']=='available' for i in items)),guaranteed=bool(r['guaranteed']),created_at=r['created_at']) for r in db._many('SELECT * FROM treasury_openings WHERE user_id=? ORDER BY id DESC LIMIT 30',(user,))],
        rarities=[dict(id=id,name=name,chance=chance) for id,name,chance in RARITIES],
        frames=[dict(id=f['id'],name=f['name'],price=0) for f in db.list_cosmetics() if f.get('rarity')=='unique'],balance=db.get_currency_balance(user))

def grant_keys(db,master,campaign,user,amount,comment='',key_type='normal'):
    game=db.get_campaign(campaign)
    if not game or game['master_tg_id']!=master: raise ValueError('Только мастер этой игры может выдавать ключи')
    if not db.get_character_by_player(campaign,user): raise ValueError('Игрок не участвует в этой игре')
    if not 1<=amount<=100: raise ValueError('Можно выдать от 1 до 100 ключей')
    if key_type not in ('normal','boost','enhanced'): raise ValueError('Неизвестный вид награды')
    with atomic(db):
        add_keys(db,user,amount,key_type,game['rule_type'])
        db.conn.execute('INSERT INTO treasury_key_grants(user_id,master_id,campaign_id,amount,comment,created_at,key_type) VALUES (?,?,?,?,?,?,?)',(user,master,campaign,amount,comment,now(),key_type))

def key_column(case_type, boosted):
    if case_type == 'cyberpunk':
        return 'chip_boosts' if boosted else 'chips'
    return 'enhanced_balance' if boosted else 'balance'

def add_keys(db,user,amount,key_type,case_type='fantasy'):
    column=key_column(case_type,key_type in ('boost','enhanced'))
    db.conn.execute('INSERT INTO treasury_keys(user_id,'+column+') VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET '+column+'='+column+'+excluded.'+column,(user,amount))

def draw(key_type='normal',guaranteed=False,exclude=None,case_type='fantasy'):
    roll=secrets.randbelow(100)
    for rarity,_,chance in PITY if guaranteed else ENHANCED if key_type in ('boost','enhanced') else RARITIES:
        if roll<chance: break
        roll-=chance
    category=secrets.randbelow(100)
    catalog,currency=(CYBER_POOL,'crypto') if case_type=='cyberpunk' else (POOL,'gold')
    pool=[r for r in catalog[rarity] if (r['kind']=='sparks' if category<40 else r.get('currency')==currency if category<45 else r['kind']!='sparks' and r.get('currency')!=currency)]
    alternatives=[r for r in pool if r['name']!=exclude]
    return enrich({**secrets.choice(alternatives or pool),'rarity':rarity})

def deliver(db,user,selected):
    if selected['kind']=='sparks':
        db.add_currency(user,selected['amount'],reason='Сокровищница',source='treasury')
        return None
    if selected['kind']=='keys':
        add_keys(db,user,selected['amount'],selected['key_type'],selected.get('case_type','fantasy'))
        return None
    return db.conn.execute('INSERT INTO treasury_items(user_id,reward_json,created_at) VALUES (?,?,?)',(user,json.dumps(selected,ensure_ascii=False),now())).lastrowid

def open_chest(db,user,request_id,key_type='normal',case_type='fantasy'):
    if case_type not in ('fantasy','cyberpunk'):raise ValueError('Неизвестный тип кейса')
    with atomic(db):
        old=db._one('SELECT * FROM treasury_openings WHERE user_id=? AND request_id=?',(user,request_id))
        if old:
            if old['case_type']!=case_type:raise ValueError('Запрос уже использован для другого кейса')
            return dict(reward=enrich(json.loads(old['reward_json'])),opening_id=old['id'],replayed=True)
        wallet=db._one('SELECT * FROM treasury_keys WHERE user_id=?',(user,))
        key_type='boost' if wallet and wallet[key_column(case_type,True)]>0 else 'normal'
        column=key_column(case_type,key_type=='boost')
        if not db.conn.execute('UPDATE treasury_keys SET '+column+'='+column+'-1 WHERE user_id=? AND '+column+'>0',(user,)).rowcount:raise ValueError('Нет щепок' if case_type=='cyberpunk' else 'Нет ключей')
        count=db._one('SELECT COUNT(*) n FROM treasury_openings WHERE user_id=? AND case_type=?',(user,case_type))['n']
        guaranteed=(count+1)%10==0
        selected=draw(key_type,guaranteed,case_type=case_type)
        if case_type=='cyberpunk':selected={**selected,'case_type':case_type}
        encoded=json.dumps(selected,ensure_ascii=False)
        recent=db._many('SELECT reward_json FROM treasury_openings WHERE user_id=? AND case_type=? ORDER BY id DESC LIMIT 4',(user,case_type))
        duplicate=selected['kind'] not in ('sparks','keys') and not selected.get('currency') and any(json.loads(r['reward_json'])['name']==selected['name'] for r in recent)
        item_id=deliver(db,user,selected)
        opening_id=db.conn.execute('INSERT INTO treasury_openings(user_id,request_id,reward_json,item_id,created_at,key_type,can_reroll,guaranteed,case_type) VALUES (?,?,?,?,?,?,?,?,?)',(user,request_id,encoded,item_id,now(),key_type,int(duplicate),int(guaranteed),case_type)).lastrowid
    return dict(reward=selected,opening_id=opening_id,replayed=False)

def reroll(db,user,opening_id):
    with atomic(db):
        row=db._one('SELECT * FROM treasury_openings WHERE id=? AND user_id=?',(opening_id,user))
        if not row or not row['can_reroll'] or row['rerolled']:raise ValueError('Переоткрытие недоступно')
        if db.conn.execute("UPDATE treasury_items SET status='rerolled' WHERE id=? AND user_id=? AND status='available'",(row['item_id'],user)).rowcount!=1:raise ValueError('Награда уже использована')
        selected=draw(row['key_type'],bool(row['guaranteed']),json.loads(row['reward_json'])['name'],case_type=row['case_type'])
        if row['case_type']=='cyberpunk':selected={**selected,'case_type':'cyberpunk'}
        encoded=json.dumps(selected,ensure_ascii=False)
        item_id=deliver(db,user,selected)
        db.conn.execute('UPDATE treasury_openings SET reward_json=?,item_id=?,rerolled=1 WHERE id=?',(encoded,item_id,opening_id))
        db.conn.execute('INSERT INTO treasury_rerolls(opening_id,old_reward,new_reward,created_at) VALUES (?,?,?,?)',(opening_id,row['reward_json'],encoded,now()))
    return dict(reward=selected,opening_id=opening_id)

def sell_item(db,user,item_id):
    with atomic(db):
        row=db._one("SELECT * FROM treasury_items WHERE id=? AND user_id=? AND status='available'",(item_id,user))
        if not row:raise ValueError('Предмет недоступен для продажи')
        value=json.loads(row['reward_json'])
        db.conn.execute("UPDATE treasury_items SET status='sold' WHERE id=?",(item_id,))
        db.add_currency(user,SALE_PRICES.get(value.get('rarity'),8),reason='Продажа сокровища: '+value['name'],source='treasury')

def claim_frame(db,user,frame_id):
    with atomic(db):
        frame=db.get_cosmetic(frame_id)
        if not frame or frame.get('rarity')!='unique':raise ValueError('Выбери уникальную рамку')
        if db.has_cosmetic_unlocked(user,frame_id):raise ValueError('Рамка уже открыта')
        credit=db._one("SELECT id FROM treasury_items WHERE user_id=? AND status='frame_credit' ORDER BY id LIMIT 1",(user,))
        if not credit:raise ValueError('Сначала активируй право на рамку в инвентаре')
        db.conn.execute("UPDATE treasury_items SET status='used' WHERE id=?",(credit['id'],))
        db.unlock_cosmetic(user,frame_id,source='treasury')

def use_item(db,user,item_id,character_id=None,effect_id='',frame_id='',selection=None):
    with atomic(db):
        item=db._one("SELECT * FROM treasury_items WHERE id=? AND user_id=? AND status='available'",(item_id,user))
        if not item:raise ValueError('Предмет уже использован или недоступен')
        value=json.loads(item['reward_json']);kind=value['kind'];status='used'
        if kind=='game':
            if db._one("SELECT COUNT(*) n FROM treasury_items WHERE user_id=? AND status='pending'",(user,))['n']>=5:raise ValueError('Можно отправить до 5 заявок на сокровища одновременно')
            ch=db.get_character(character_id or 0)
            if not ch or ch.get('telegram_user_id')!=user:raise ValueError('Выбери своего персонажа')
            case_type=value.get('case_type','fantasy')
            if db.get_campaign(ch['campaign_id'])['rule_type']!=case_type:raise ValueError('Эта добыча предназначена для киберпанк-игры' if case_type=='cyberpunk' else 'Эта добыча предназначена для фэнтези-игры')
            if value.get('choice_type'):
                selection=selection or {}
                name=str(selection.get('name','')).strip()
                if not 2<=len(name)<=120:raise ValueError('Укажи выбранное существо или базовый предмет')
                if value['choice_type']=='familiar':
                    cr=str(selection.get('cr',''))
                    if cr not in {'0','1/8','1/4','1/2','1','2','3','4','5'} or Fraction(cr)>Fraction(value['max_cr']):raise ValueError('Угроза существа выше лимита награды или указана неверно')
                    value['name']='Фамильяр: '+name+' · угроза '+cr
                else:
                    value['name']=name+' +'+str(value['bonus'])
                value['selection']={'name':name,'cr':selection.get('cr',''),'source':str(selection.get('source','')).strip()[:300]}
                db.conn.execute('UPDATE treasury_items SET reward_json=? WHERE id=?',(json.dumps(value,ensure_ascii=False),item_id))
            status='pending'
        elif kind=='discount':
            status='active'
        elif kind in ('color','gradient'):
            if not effect_id:
                status=kind+'_credit'
                db.conn.execute('UPDATE treasury_items SET status=? WHERE id=?',(status,item_id))
                return
            from .effect_catalog import canonical
            effect_id=canonical(effect_id)
            option='custom' if kind=='color' else 'gradient'
            if not db.has_effect_unlocked(user,effect_id):raise ValueError('Сначала открой выбранный эффект')
            if option in db.effect_style_state(user).get(effect_id,[]):raise ValueError('Эта возможность уже открыта')
            db.conn.execute('INSERT INTO user_effect_styles VALUES (?,?,?)',(user,effect_id,option))
        elif kind=='unique':
            status='frame_credit'
        else:raise ValueError('Неизвестный предмет')
        db.conn.execute('UPDATE treasury_items SET status=?,character_id=? WHERE id=?',(status,character_id if kind=='game' else None,item_id))

def pending(db,master,campaign):
    if not db.get_campaign(campaign) or db.get_campaign(campaign)['master_tg_id']!=master:raise ValueError('Нет доступа к заявкам')
    rows=db._many("SELECT t.*,c.name character_name FROM treasury_items t JOIN characters c ON c.id=t.character_id WHERE c.campaign_id=? AND t.status='pending' ORDER BY t.id",(campaign,))
    for row in rows:
        row['reward']=enrich(json.loads(row.pop('reward_json')))
        selected=row['reward'].get('selection')
        if selected and selected.get('source'):
            row['reward']['note']=row['reward'].get('note','')+'\nИсточник выбора игрока: '+selected['source']
    return rows

def decide(db,master,item_id,approve,note):
    with atomic(db):
        item=db._one("SELECT t.*,c.campaign_id FROM treasury_items t JOIN characters c ON c.id=t.character_id WHERE t.id=? AND t.status='pending'",(item_id,))
        if not item or db.get_campaign(item['campaign_id'])['master_tg_id']!=master:raise ValueError('Заявка недоступна')
        if approve and not note.strip():raise ValueError('Укажи, что внесено в инвентарь персонажа')
        db.conn.execute('UPDATE treasury_items SET status=?,master_note=?,character_id=? WHERE id=?',('used' if approve else 'available',note,item['character_id'] if approve else None,item_id))

def quote(db,user,price):
    rows=db._many("SELECT * FROM treasury_items WHERE user_id=? AND status='active' ORDER BY id",(user,))
    item=max(rows,key=lambda row:json.loads(row['reward_json']).get('percent',0),default=None)
    if not item:return price,None
    value=json.loads(item['reward_json'])
    return (price*(100-value['percent'])+99)//100,item['id']

def benefits(db,user):
    rows=db._many("SELECT status,reward_json FROM treasury_items WHERE user_id=? AND status IN ('active','color_credit','gradient_credit','frame_credit')",(user,))
    return dict(discount_percent=max((json.loads(r['reward_json']).get('percent',0) for r in rows if r['status']=='active'),default=0),colors=sum(r['status']=='color_credit' for r in rows),gradients=sum(r['status']=='gradient_credit' for r in rows),frames=sum(r['status']=='frame_credit' for r in rows))

def style_credit(db,user,option):
    if option.startswith('preset:'):
        from .effect_catalog import PRESETS
        preset=next((p for p in PRESETS if p['id']==option[7:]),None)
        if preset:option='custom' if len(set(preset['colors']))==1 else 'gradient'
    if option not in ('custom','gradient'):return None
    status='color_credit' if option=='custom' else 'gradient_credit'
    row=db._one('SELECT id FROM treasury_items WHERE user_id=? AND status=? ORDER BY id LIMIT 1',(user,status))
    return row['id'] if row else None

def consume_credit(db,user,item_id):
    if item_id and db.conn.execute("UPDATE treasury_items SET status='used' WHERE id=? AND user_id=? AND status IN ('color_credit','gradient_credit')",(item_id,user)).rowcount!=1:raise ValueError('Купон уже использован')

def purchase_effect_bundle(db,user,effect_id,option='original'):
    from .effect_catalog import canonical,PRESETS,STYLE_PRICES
    effect_id=canonical(effect_id)
    item=db.get_cosmetic_effect(effect_id)
    if not item:raise ValueError('Эффект не найден')
    owned=db.has_effect_unlocked(user,effect_id)
    item=db.purchasable_info(item)
    if not owned and (item.get('rarity')=='unique' or not item.get('purchasable')):raise ValueError('Эффект нельзя купить')
    base=0 if owned else int(item.get('price') or 0)
    style=0;credit=None
    if option not in ('','original'):
        if option.startswith('preset:') and option[7:] in {p['id'] for p in PRESETS}:style=STYLE_PRICES['preset']
        elif option in ('custom','gradient'):style=STYLE_PRICES[option]
        else:raise ValueError('Неизвестная окраска')
        if option in db.effect_style_state(user).get(effect_id,[]):style=0
        else:
            credit=style_credit(db,user,option)
            if credit:style=0
    price,coupon=quote(db,user,base+style)
    if not base+style:coupon=None
    if db.get_currency_balance(user)<price:raise ValueError('Недостаточно искр для эффекта и выбранной окраски')
    consume(db,coupon);consume_credit(db,user,credit)
    if price:db.add_currency(user,-price,reason='Эффект и палитра: '+item['name'],source='shop')
    if not owned:db.unlock_cosmetic_effect(user,effect_id,source='shop')
    if option not in ('','original'):db.conn.execute('INSERT OR IGNORE INTO user_effect_styles VALUES (?,?,?)',(user,effect_id,option))
    return {'message':'Эффект и выбранная палитра открыты','price':price}

def consume(db,id):
    if id and db.conn.execute("UPDATE treasury_items SET status='used' WHERE id=? AND status='active'",(id,)).rowcount!=1:raise ValueError('Купон уже использован')

class GrantIn(BaseModel):
    user_id:int
    amount:int=Field(ge=1,le=100)
    comment:str=Field(default='',max_length=300)
    key_type:str='normal'
class OpenIn(BaseModel):
    request_id:str=Field(min_length=8,max_length=100)
    key_type:str='normal'
    case_type:str='fantasy'
class UseIn(BaseModel):
    character_id:int|None=None
    effect_id:str=Field(default='',max_length=100)
    frame_id:str=Field(default='',max_length=100)
    selection:dict[str,str]|None=None
class DecisionIn(BaseModel):
    approve:bool
    note:str=Field(default='',max_length=500)

def register(app,db,auth):
    def call(fn,*args):
        try:return fn(db,*args)
        except ValueError as error:raise HTTPException(400,str(error))
    @app.get('/api/treasury')
    async def get_state(user=Depends(auth)):return state(db,user.id)
    @app.post('/api/treasury/open')
    async def opening(data:OpenIn,user=Depends(auth)):return call(open_chest,user.id,data.request_id,data.key_type,data.case_type)
    @app.post('/api/treasury/openings/{opening_id}/reroll')
    async def reopening(opening_id:int,user=Depends(auth)):return call(reroll,user.id,opening_id)
    @app.post('/api/treasury/items/{item_id}/sell')
    async def selling(item_id:int,user=Depends(auth)):
        call(sell_item,user.id,item_id)
        return state(db,user.id)
    @app.post('/api/treasury/frames/{frame_id}/claim')
    async def claiming(frame_id:str,user=Depends(auth)):
        call(claim_frame,user.id,frame_id)
        return state(db,user.id)
    @app.post('/api/treasury/items/{item_id}/use')
    async def use(item_id:int,data:UseIn,user=Depends(auth)):
        call(use_item,user.id,item_id,data.character_id,data.effect_id,data.frame_id,data.selection)
        return state(db,user.id)
    @app.post('/api/campaigns/{campaign_id}/treasury/keys')
    async def grant(campaign_id:int,data:GrantIn,user=Depends(auth)):
        call(grant_keys,user.id,campaign_id,data.user_id,data.amount,data.comment,data.key_type)
        return {'message':'Щепки выданы' if db.get_campaign(campaign_id)['rule_type']=='cyberpunk' else 'Ключи выданы'}
    @app.get('/api/campaigns/{campaign_id}/treasury/requests')
    async def requests(campaign_id:int,user=Depends(auth)):
        waiting=call(pending,user.id,campaign_id)
        return {'requests':waiting,'grants':db._many('SELECT g.*,p.first_name FROM treasury_key_grants g LEFT JOIN player_accounts p ON p.telegram_user_id=g.user_id WHERE g.campaign_id=? ORDER BY g.id DESC LIMIT 30',(campaign_id,))}
    @app.post('/api/treasury/requests/{item_id}')
    async def decision(item_id:int,data:DecisionIn,user=Depends(auth)):
        call(decide,user.id,item_id,data.approve,data.note)
        return {'message':'Выдача отмечена' if data.approve else 'Предмет возвращён игроку'}
