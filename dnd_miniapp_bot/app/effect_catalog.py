"""Shared shop metadata and validated, paid effect color options."""
import json
import re
from pathlib import Path

LAB_EFFECTS = json.loads((Path(__file__).resolve().parent.parent / 'frontend/effect-catalog.json').read_text(encoding='utf-8'))
LAB_BY_ID = {e['id']: e for e in LAB_EFFECTS}
ALIASES = {
    'matrix_rain_cyan': ('matrix_rain', 'ice'),
    'matrix_rain_violet': ('matrix_rain', 'purple'),
    'matrix_rain_gold': ('matrix_rain', 'gold'),
    'diamond_shimmer': ('silver_glint', 'ice'),
    'gem_grotto': ('silver_glint', 'pearl'),
    'golden_glint': ('silver_glint', 'gold'),
    'black_rain': ('heavy_rain', 'obsidian'),
    'toxic_drizzle': ('heavy_rain', 'jade'),
}
PRESETS = [
    {'id': key, 'name': name, 'colors': colors.split(',')}
    for key, name, colors in [
        ('gold', 'Золото', '#fde047,#fbbf24,#fff4b4'),
        ('ice', 'Лёд', '#22d3ee,#7dd3fc,#e0f2fe'),
        ('purple', 'Аметист', '#c4b5fd,#a78bfa,#e9d5ff'),
        ('jade', 'Нефрит', '#74dfac,#277f80,#e4ffd2'),
        ('rose', 'Роза', '#f19ac7,#a34f85,#ffe2ee'),
        ('ember', 'Угли', '#ff934c,#ae3658,#fff1b5'),
        ('silver', 'Серебро', '#c7d5e2,#79899f,#ffffff'),
        ('ocean', 'Океан', '#48c8db,#3545a4,#c2fff5'),
        ('blood', 'Багрянец', '#e85068,#732958,#ffc4af'),
        ('lime', 'Кислота', '#b9ed63,#438d66,#f2ffd5'),
        ('sunset', 'Закат', '#ffae78,#a45bc8,#ffd9ce'),
        ('pearl', 'Перламутр', '#dca8e8,#7abacb,#fff0bf'),
        ('obsidian', 'Обсидиан', '#0f172a,#1e293b,#4c1d95'),
    ]
]
PRESETS += [dict(id='solid_'+p['id'], name=p['name'], colors=[p['colors'][0]]*3, kind='solid') for p in list(PRESETS)]
STYLE_PRICES = {'preset': 120, 'custom': 300, 'gradient': 500}
LEGENDARY = {'wildfire', 'fire-ring', 'ref-summoning', 'ref-black-hole', 'ref-blue-portal', 'ref-future-interface', 'nebula-smoke', 'woven-spell', 'lunar-eclipse'}
GROUPS = {
    'nature': {'dew_drift'}, 'weather': {'heavy_rain','snow_squall','black_rain','midnight_snow','soot_rain','toxic_drizzle'},
    'smoke': {'soft_mist','shadow_dust','necrotic_ash'},
    'cosmos': {'star_chorus','meridian_orbit','nightfall','low_equator_orbit'},
    'energy': {'storm_lash','thunder_throne'},
    'light': {'silver_motes','golden_glint','silver_glint','amethyst_dust','halo_of_dawn','diamond_shimmer','gem_grotto','ring_glints'},
    'scifi': {'neon_rain','holo_glitch','quantum_pixels','brutalist_hud','corporate_veil','gear_orbit','red_equator_scan','matrix_rain','matrix_orbit','quantum_hex','hex_beacon','holo_iris'},
}

def canonical(effect_id):
    return ALIASES.get(effect_id, (effect_id, 'original'))[0]

def metadata(item):
    result = dict(item)
    effect_id = result['id']
    lab = LAB_BY_ID.get(effect_id)
    result.update(group=lab['category'] if lab else next((k for k,v in GROUPS.items() if effect_id in v), 'magic'),
                  is_new=bool(lab), colorizable=True, style_prices=STYLE_PRICES, color_presets=PRESETS,
                  renderer=lab)
    return result

def normalize_style(value):
    if not isinstance(value, dict):
        raise ValueError('Некорректная окраска')
    mode = value.get('mode', 'original')
    radius = value.get('radius_scale', 1)
    if isinstance(radius,bool) or not isinstance(radius,(int,float)) or not .8 <= radius <= 1.2:
        raise ValueError('Радиус должен быть от 80 до 120 процентов')
    sizing = {'radius_scale':radius} if 'radius_scale' in value else {}
    layer=value.get('layer','auto')
    if not isinstance(layer,str) or layer not in {'auto','front','between','back'}:
        raise ValueError('Неизвестное расположение эффекта')
    if 'layer' in value:sizing['layer']=layer
    if not isinstance(mode,str) or mode not in {'original', 'preset', 'solid', 'gradient'}:
        raise ValueError('Неизвестный режим окраски')
    if mode == 'original':
        return {'mode': 'original', **sizing}
    if mode == 'preset':
        preset = next((p for p in PRESETS if p['id'] == value.get('preset')), None)
        if not preset:
            raise ValueError('Неизвестная палитра')
        return {'mode': mode, 'preset': preset['id'], 'colors': preset['colors'], 'angle': 45, **sizing}
    colors = value.get('colors')
    if not isinstance(colors, list) or len(colors) != 3 or not all(isinstance(c,str) and re.fullmatch(r'#[0-9a-fA-F]{6}',c) for c in colors):
        raise ValueError('Нужны три корректных цвета HEX')
    angle = value.get('angle', 45)
    if not isinstance(angle,(int,float)) or not 0 <= angle <= 360:
        raise ValueError('Некорректное направление градиента')
    return {'mode': mode, 'colors': colors if mode == 'gradient' else [colors[0]]*3, 'angle': angle, **sizing}

def style_entitlement(style):
    return 'preset:'+style['preset'] if style['mode']=='preset' else {'solid':'custom','gradient':'gradient','original':'original'}[style['mode']]

class EffectShopMixin:
    def init_effect_shop(self):
        self.conn.execute('''CREATE TABLE IF NOT EXISTS user_effect_styles (
            telegram_user_id INTEGER NOT NULL, effect_id TEXT NOT NULL,
            option_id TEXT NOT NULL, PRIMARY KEY(telegram_user_id,effect_id,option_id))''')
        self.conn.execute('''CREATE TABLE IF NOT EXISTS user_shop_gifts (
            telegram_user_id INTEGER PRIMARY KEY, claimed_at TEXT NOT NULL,
            amount INTEGER NOT NULL CHECK(amount=500))''')
        self.conn.execute('''CREATE TABLE IF NOT EXISTS user_shop_gift_replays (
            telegram_user_id INTEGER PRIMARY KEY, requested_at TEXT NOT NULL)''')
        cols = {r[1] for r in self.conn.execute('PRAGMA table_info(characters)')}
        if 'effect_style_json' not in cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN effect_style_json TEXT NOT NULL DEFAULT '{}'")
        if 'effect_radii_json' not in cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN effect_radii_json TEXT NOT NULL DEFAULT '{}'")
        if 'effect_layers_json' not in cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN effect_layers_json TEXT NOT NULL DEFAULT '{}'")
        for old, (base, preset) in ALIASES.items():
            self.conn.execute('''INSERT OR IGNORE INTO user_effect_unlocks
                (telegram_user_id,effect_id,source,source_id,unlocked_at)
                SELECT telegram_user_id,?,source,source_id,unlocked_at FROM user_effect_unlocks WHERE effect_id=?''',(base,old))
            self.conn.execute('''INSERT OR IGNORE INTO user_effect_styles
                SELECT telegram_user_id,?,? FROM user_effect_unlocks WHERE effect_id=?''',(base,'preset:'+preset,old))
            style = json.dumps(normalize_style({'mode':'preset','preset':preset}))
            self.conn.execute('UPDATE characters SET custom_effect=?,effect_style_json=? WHERE custom_effect=?',(base,style,old))
        self.conn.commit()

    def effect_style_state(self, user_id):
        result = {}
        for row in self._many('SELECT effect_id,option_id FROM user_effect_styles WHERE telegram_user_id=?',(int(user_id),)):
            result.setdefault(row['effect_id'], []).append(row['option_id'])
        return result

    def shop_gift_available(self,user_id):
        return bool(self._one('SELECT 1 FROM characters WHERE telegram_user_id=? LIMIT 1',(int(user_id),))) and (not bool(self._one('SELECT 1 FROM user_shop_gifts WHERE telegram_user_id=?',(int(user_id),))) or bool(self._one('SELECT 1 FROM user_shop_gift_replays WHERE telegram_user_id=?',(int(user_id),))))

    def claim_shop_gift(self,user_id):
        if not self._one('SELECT 1 FROM characters WHERE telegram_user_id=? LIMIT 1',(int(user_id),)):
            raise ValueError('Подарок доступен только игрокам с персонажем')
        from .db import utc_now
        with self.conn:
            claimed=self.conn.execute('INSERT OR IGNORE INTO user_shop_gifts VALUES (?,?,500)',(int(user_id),utc_now())).rowcount==1
            replayed=self.conn.execute('DELETE FROM user_shop_gift_replays WHERE telegram_user_id=?',(int(user_id),)).rowcount==1 and not claimed
            if claimed:
                self.ensure_wallet(user_id)
                self.conn.execute('UPDATE user_wallets SET balance=balance+500,updated_at=? WHERE telegram_user_id=?',(utc_now(),int(user_id)))
                self.conn.execute('INSERT INTO currency_transactions(telegram_user_id,amount,reason,source,created_at) VALUES (?,500,?,?,?)',(int(user_id),'Подарок: обновление магазина эффектов','shop-welcome',utc_now()))
        return {'claimed':claimed,'replayed':replayed,'amount':500 if claimed else 0,'currency_balance':self.get_currency_balance(user_id),'currency_transactions':self.list_currency_transactions(user_id,20)}

    def validate_effect_style(self, user_id, effect_id, value):
        effect_id = canonical(effect_id)
        if not self.has_effect_unlocked(user_id,effect_id):
            raise ValueError('Сначала открой эффект')
        style = normalize_style(value)
        option = style_entitlement(style)
        if option != 'original' and option not in self.effect_style_state(user_id).get(effect_id,[]):
            raise ValueError('Эта окраска ещё не куплена')
        return style

    def purchase_effect_style(self, user_id, effect_id, option):
        effect_id = canonical(effect_id)
        if not self.get_cosmetic_effect(effect_id) or not self.has_effect_unlocked(user_id,effect_id):
            raise ValueError('Сначала открой эффект')
        if option.startswith('preset:') and option[7:] in {p['id'] for p in PRESETS}:
            price = STYLE_PRICES['preset']
        elif option in {'custom','gradient'}:
            price = STYLE_PRICES[option]
        else:
            raise ValueError('Неизвестная окраска')
        with self.conn:
            if self._one('SELECT 1 FROM user_effect_styles WHERE telegram_user_id=? AND effect_id=? AND option_id=?',(int(user_id),effect_id,option)):
                return {'message':'Окраска уже открыта'}
            self.ensure_wallet(user_id)
            changed=self.conn.execute('UPDATE user_wallets SET balance=balance-? WHERE telegram_user_id=? AND balance>=?',(price,int(user_id),price))
            if changed.rowcount != 1:
                raise ValueError('Недостаточно искр')
            self.conn.execute('INSERT INTO user_effect_styles VALUES (?,?,?)',(int(user_id),effect_id,option))
            from .db import utc_now
            self.conn.execute('INSERT INTO currency_transactions(telegram_user_id,amount,reason,source,created_at) VALUES (?,?,?,?,?)',(int(user_id),-price,'Окраска: '+effect_id+' / '+option,'effect-style',utc_now()))
        return {'message':'Окраска открыта'}
