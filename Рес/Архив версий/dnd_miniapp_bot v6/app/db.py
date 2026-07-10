from __future__ import annotations

import json
import os
import random
import sqlite3
import string
from datetime import datetime, timezone, timedelta
from typing import Any, Iterable


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def msk_time(iso_text: str) -> str:
    """Возвращает человекочитаемое время по Москве для журнала."""
    try:
        dt = datetime.fromisoformat(str(iso_text).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        msk = dt.astimezone(timezone(timedelta(hours=3)))
        return msk.strftime("%d.%m.%Y %H:%M МСК")
    except Exception:
        return str(iso_text)


def rows_to_dicts(rows: Iterable[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def normalize_color(value: Any) -> str:
    text = str(value or "#72a7ff").strip()
    if len(text) == 7 and text.startswith("#"):
        hexdigits = "0123456789abcdefABCDEF"
        if all(ch in hexdigits for ch in text[1:]):
            return text.lower()
    return "#72a7ff"



COSMETIC_LIBRARY = [
    # Базовая кастомизация: доступна всем.
    {"id": "base_glow", "name": "Мягкое свечение", "description": "Небольшое спокойное сияние вокруг аватарки.", "rarity": "common", "category": "base", "css_class": "frame-base-glow", "emoji": "▫️", "sort_order": 10},
    {"id": "base_silver", "name": "Серебро", "description": "Аккуратная серебряная рамка.", "rarity": "common", "category": "base", "css_class": "frame-base-silver", "emoji": "⚪", "sort_order": 20},
    {"id": "base_night", "name": "Ночной контур", "description": "Тёмная рамка с мягким синим контуром.", "rarity": "common", "category": "base", "css_class": "frame-base-night", "emoji": "🌙", "sort_order": 30},

    # Уникальная кастомизация: открывается достижениями.
    {"id": "aurora", "name": "Аврора", "description": "Переливы северного сияния.", "rarity": "rare", "category": "unique", "css_class": "frame-aurora", "emoji": "🌌", "sort_order": 110},
    {"id": "ruby", "name": "Рубин", "description": "Красное драгоценное сияние.", "rarity": "rare", "category": "unique", "css_class": "frame-ruby", "emoji": "♦️", "sort_order": 120},
    {"id": "emerald", "name": "Изумруд", "description": "Зелёная живая рамка.", "rarity": "rare", "category": "unique", "css_class": "frame-emerald", "emoji": "💚", "sort_order": 130},
    {"id": "sapphire", "name": "Сапфир", "description": "Холодное синее свечение.", "rarity": "rare", "category": "unique", "css_class": "frame-sapphire", "emoji": "🔷", "sort_order": 140},
    {"id": "gold", "name": "Золото", "description": "Тёплый золотой блеск.", "rarity": "epic", "category": "unique", "css_class": "frame-gold", "emoji": "✨", "sort_order": 150},
    {"id": "violet", "name": "Фиолет", "description": "Магическое фиолетовое мерцание.", "rarity": "epic", "category": "unique", "css_class": "frame-violet", "emoji": "💜", "sort_order": 160},
    {"id": "frost", "name": "Иней", "description": "Ледяная рамка с холодным отблеском.", "rarity": "epic", "category": "unique", "css_class": "frame-frost", "emoji": "❄️", "sort_order": 170},
    {"id": "fire", "name": "Пламя", "description": "Огненное пульсирующее свечение.", "rarity": "legendary", "category": "unique", "css_class": "frame-fire", "emoji": "🔥", "sort_order": 210},
    {"id": "ice", "name": "Лёд", "description": "Морозное сияние и кристальный блеск.", "rarity": "legendary", "category": "unique", "css_class": "frame-ice", "emoji": "🧊", "sort_order": 220},
    {"id": "shadow", "name": "Тень", "description": "Тёмная аура вокруг аватарки.", "rarity": "legendary", "category": "unique", "css_class": "frame-shadow", "emoji": "🌑", "sort_order": 230},
    {"id": "storm", "name": "Молния", "description": "Быстрые электрические вспышки.", "rarity": "legendary", "category": "unique", "css_class": "frame-storm", "emoji": "⚡", "sort_order": 240},
    {"id": "blood", "name": "Кровь", "description": "Густая красная рамка для тяжёлых побед.", "rarity": "legendary", "category": "unique", "css_class": "frame-blood", "emoji": "🩸", "sort_order": 250},
    {"id": "poison", "name": "Яд", "description": "Кислотно-зелёное токсичное сияние.", "rarity": "legendary", "category": "unique", "css_class": "frame-poison", "emoji": "☣️", "sort_order": 260},
    {"id": "astral", "name": "Астрал", "description": "Радужное магическое переливание.", "rarity": "legendary", "category": "unique", "css_class": "frame-astral", "emoji": "🌀", "sort_order": 270},
]


COSMETIC_EFFECT_LIBRARY = [
    # Базовые эффекты: доступны всем. Все эффекты рисуются ВНЕ рамки и не перекрывают её.
    {"id": "effect_none", "name": "Без эффекта", "description": "Только выбранная рамка без дополнительных частиц.", "rarity": "common", "category": "base", "css_class": "", "emoji": "○", "sort_order": 0},
    {"id": "soft_glow", "name": "Мягкое свечение", "description": "Спокойное внешнее сияние за рамкой.", "rarity": "common", "category": "base", "css_class": "effect-soft-glow", "emoji": "▫️", "sort_order": 10},
    {"id": "slow_sparkles", "name": "Тихие искры", "description": "Редкие маленькие искры по внешнему краю.", "rarity": "common", "category": "base", "css_class": "effect-slow-sparkles", "emoji": "✦", "sort_order": 20},
    {"id": "cold_breath", "name": "Холодное дыхание", "description": "Морозная дымка снаружи рамки.", "rarity": "rare", "category": "base", "css_class": "effect-cold-breath", "emoji": "❄️", "sort_order": 30},
    {"id": "dark_aura", "name": "Тёмная аура", "description": "Глубокая тень вокруг профиля, не закрывающая рамку.", "rarity": "rare", "category": "base", "css_class": "effect-dark-aura", "emoji": "🌑", "sort_order": 40},
    {"id": "embers", "name": "Угли", "description": "Медленно вспыхивающие оранжевые угольки вокруг рамки.", "rarity": "rare", "category": "base", "css_class": "effect-embers", "emoji": "🟠", "sort_order": 50},
    {"id": "mist", "name": "Лёгкий туман", "description": "Белёсая дымка по внешнему краю.", "rarity": "common", "category": "base", "css_class": "effect-mist", "emoji": "🌫️", "sort_order": 60},
    {"id": "leaf_swirl", "name": "Листья", "description": "Мягкое зелёное природное мерцание вокруг рамки.", "rarity": "rare", "category": "base", "css_class": "effect-leaf-swirl", "emoji": "🍃", "sort_order": 70},
    {"id": "star_dust", "name": "Звёздная пыль", "description": "Мелкие светлые точки и мягкие вспышки вокруг рамки.", "rarity": "rare", "category": "base", "css_class": "effect-star-dust", "emoji": "🌟", "sort_order": 80},
    {"id": "blue_static", "name": "Синяя статика", "description": "Тонкий синий шум по внешнему краю, без перекрытия рамки.", "rarity": "rare", "category": "base", "css_class": "effect-blue-static", "emoji": "🔷", "sort_order": 90},
    {"id": "fireflies", "name": "Светлячки", "description": "Маленькие тёплые огоньки вокруг рамки.", "rarity": "common", "category": "base", "css_class": "effect-fireflies", "emoji": "🟡", "sort_order": 95},
    {"id": "snowfall", "name": "Снег", "description": "Мягкие снежинки вокруг рамки.", "rarity": "common", "category": "base", "css_class": "effect-snowfall", "emoji": "❄️", "sort_order": 96},
    {"id": "ash_fall", "name": "Пепел", "description": "Тёмные пепельные точки вокруг профиля.", "rarity": "rare", "category": "base", "css_class": "effect-ash-fall", "emoji": "◾", "sort_order": 97},
    {"id": "prism_glint", "name": "Призма", "description": "Лёгкие радужные блики, не перекрывающие рамку.", "rarity": "rare", "category": "base", "css_class": "effect-prism-glint", "emoji": "💠", "sort_order": 98},
    {"id": "holy_dust", "name": "Святое сияние", "description": "Белые мягкие частицы и чистый ореол.", "rarity": "rare", "category": "base", "css_class": "effect-holy-dust", "emoji": "🤍", "sort_order": 99},

    # Уникальные эффекты: открываются достижениями. Они дополняют рамку, а не заменяют её.
    {"id": "gold_sparkles", "name": "Золотые искры", "description": "Вспышки удачи и золотые частицы вокруг рамки.", "rarity": "legendary", "category": "unique", "css_class": "effect-gold-sparkles", "emoji": "✨", "sort_order": 110},
    {"id": "red_target_scan", "name": "Красный захват цели", "description": "Внешнее HUD-сканирование по краям профиля.", "rarity": "legendary", "category": "unique", "css_class": "effect-red-target-scan", "emoji": "🎯", "sort_order": 120},
    {"id": "cyber_glitch", "name": "Цифровой глитч", "description": "Небольшие красные пиксели и сбои снаружи рамки.", "rarity": "legendary", "category": "unique", "css_class": "effect-cyber-glitch", "emoji": "🟥", "sort_order": 130},
    {"id": "stage_lights", "name": "Свет софитов", "description": "Сценический неон и лёгкие ноты вокруг рамки.", "rarity": "legendary", "category": "unique", "css_class": "effect-stage-lights", "emoji": "🎤", "sort_order": 140},
    {"id": "portal_distortion", "name": "Пространственный сбой", "description": "Портальная рябь и сине-фиолетовые всплески снаружи.", "rarity": "legendary", "category": "unique", "css_class": "effect-portal-distortion", "emoji": "🌀", "sort_order": 150},
    {"id": "flame_aura", "name": "Огненная аура", "description": "Внешнее пламя без перекрытия самой рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-flame-aura", "emoji": "🔥", "sort_order": 160},
    {"id": "lightning_burst", "name": "Разряд молнии", "description": "Короткие электрические вспышки по внешнему кругу.", "rarity": "epic", "category": "unique", "css_class": "effect-lightning-burst", "emoji": "⚡", "sort_order": 170},
    {"id": "blood_mist", "name": "Кровавый туман", "description": "Тёмно-красная дымка вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-blood-mist", "emoji": "🩸", "sort_order": 180},
    {"id": "violet_runes", "name": "Фиолетовые руны", "description": "Магические всполохи и рунический ореол вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-violet-runes", "emoji": "🔮", "sort_order": 190},
    {"id": "toxic_drops", "name": "Токсичные капли", "description": "Кислотно-зелёные капли и ядовитое сияние снаружи.", "rarity": "epic", "category": "unique", "css_class": "effect-toxic-drops", "emoji": "☣️", "sort_order": 200},
    {"id": "silver_moon", "name": "Лунное серебро", "description": "Серебристый лунный ореол вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-silver-moon", "emoji": "🌙", "sort_order": 210},
    {"id": "rose_petals", "name": "Лепестки", "description": "Мягкие розовые частицы по краям профиля.", "rarity": "epic", "category": "unique", "css_class": "effect-rose-petals", "emoji": "🌹", "sort_order": 220},
]


# v23: expanded frame and supplemental effect library.
COSMETIC_LIBRARY.extend([
    {"id": "base_copper", "name": "Медь", "description": "Тёплая медная рамка без лишнего шума.", "rarity": "common", "category": "base", "css_class": "frame-base-copper", "emoji": "🟤", "sort_order": 35},
    {"id": "base_teal", "name": "Бирюза", "description": "Чистый бирюзовый контур.", "rarity": "common", "category": "base", "css_class": "frame-base-teal", "emoji": "🟦", "sort_order": 36},
    {"id": "base_arcane", "name": "Аркана", "description": "Спокойная магическая обводка.", "rarity": "rare", "category": "base", "css_class": "frame-base-arcane", "emoji": "🔮", "sort_order": 37},
    {"id": "rainbow_spin", "name": "Радужный круг", "description": "Плавная переливающаяся рамка.", "rarity": "rare", "category": "unique", "css_class": "frame-rainbow-spin", "emoji": "🌈", "sort_order": 280},
    {"id": "cyan_orbit", "name": "Голубая орбита", "description": "Светлая вращающаяся кибер-орбита.", "rarity": "rare", "category": "unique", "css_class": "frame-cyan-orbit", "emoji": "💠", "sort_order": 290},
    {"id": "sunset_orbit", "name": "Закатная орбита", "description": "Оранжево-розовое вращение вокруг аватарки.", "rarity": "rare", "category": "unique", "css_class": "frame-sunset-orbit", "emoji": "🌅", "sort_order": 300},
    {"id": "black_gold", "name": "Чёрное золото", "description": "Тёмная премиальная рамка с золотым бликом.", "rarity": "epic", "category": "unique", "css_class": "frame-black-gold", "emoji": "🖤", "sort_order": 310},
    {"id": "pink_neon", "name": "Розовый неон", "description": "Яркая клубная неоновая рамка.", "rarity": "epic", "category": "unique", "css_class": "frame-pink-neon", "emoji": "💗", "sort_order": 320},
    {"id": "green_matrix", "name": "Зелёная матрица", "description": "Техно-рамка в зелёных оттенках.", "rarity": "epic", "category": "unique", "css_class": "frame-green-matrix", "emoji": "🟩", "sort_order": 330},
    {"id": "steel_rotate", "name": "Стальной ротор", "description": "Холодная вращающаяся металлическая рамка.", "rarity": "epic", "category": "unique", "css_class": "frame-steel-rotate", "emoji": "⚙️", "sort_order": 340},
    {"id": "cosmic_ring", "name": "Космическое кольцо", "description": "Глубокая космическая рамка с мягким свечением.", "rarity": "legendary", "category": "unique", "css_class": "frame-cosmic-ring", "emoji": "🌌", "sort_order": 350},
    {"id": "lava_flow", "name": "Лавовый поток", "description": "Горячая рамка с эффектом расплавленного металла.", "rarity": "legendary", "category": "unique", "css_class": "frame-lava-flow", "emoji": "🌋", "sort_order": 360},
    {"id": "diamond_shine", "name": "Алмазный блеск", "description": "Холодное бело-голубое сияние.", "rarity": "legendary", "category": "unique", "css_class": "frame-diamond-shine", "emoji": "💎", "sort_order": 370},
    {"id": "void_ring", "name": "Пустотное кольцо", "description": "Чёрно-фиолетовая рамка с глубокой тенью.", "rarity": "legendary", "category": "unique", "css_class": "frame-void-ring", "emoji": "🕳️", "sort_order": 380},
    {"id": "hologram_ring", "name": "Голограмма", "description": "Голографическая рамка с цифровым оттенком.", "rarity": "legendary", "category": "unique", "css_class": "frame-hologram-ring", "emoji": "🔷", "sort_order": 390},
    {"id": "royal_purple", "name": "Королевский пурпур", "description": "Пурпурная рамка с золотой искрой.", "rarity": "legendary", "category": "unique", "css_class": "frame-royal-purple", "emoji": "👑", "sort_order": 400},
])

COSMETIC_EFFECT_LIBRARY.extend([
    {"id": "shadow_bloom", "name": "Тёмное свечение", "description": "Глубокий тёмный ореол вокруг рамки.", "rarity": "rare", "category": "base", "css_class": "effect-shadow-bloom", "emoji": "🌑", "sort_order": 101},
    {"id": "arcane_dust", "name": "Арканная пыль", "description": "Мелкие магические точки вокруг профиля.", "rarity": "rare", "category": "base", "css_class": "effect-arcane-dust", "emoji": "🔮", "sort_order": 102},
    {"id": "soft_orbit", "name": "Тихая орбита", "description": "Очень мягкий внешний круг, который не закрывает рамку.", "rarity": "common", "category": "base", "css_class": "effect-soft-orbit", "emoji": "○", "sort_order": 103},
    {"id": "dust_trail", "name": "Пыльный след", "description": "Ненавязчивые частицы по краям.", "rarity": "common", "category": "base", "css_class": "effect-dust-trail", "emoji": "·", "sort_order": 104},
    {"id": "tiny_glitch", "name": "Малый глитч", "description": "Небольшие цифровые сбои снаружи рамки.", "rarity": "rare", "category": "base", "css_class": "effect-tiny-glitch", "emoji": "▣", "sort_order": 105},
    {"id": "rune_flicker", "name": "Мерцание рун", "description": "Магические вспышки вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-rune-flicker", "emoji": "ᚱ", "sort_order": 230},
    {"id": "ember_rain", "name": "Искры костра", "description": "Тёплые внешние вспышки, как от костра.", "rarity": "epic", "category": "unique", "css_class": "effect-ember-rain", "emoji": "🔥", "sort_order": 240},
    {"id": "frost_stars", "name": "Морозные звёзды", "description": "Холодные кристаллические искры.", "rarity": "epic", "category": "unique", "css_class": "effect-frost-stars", "emoji": "❄️", "sort_order": 250},
    {"id": "micro_lightning", "name": "Микро-молнии", "description": "Короткие вспышки по внешнему контуру.", "rarity": "legendary", "category": "unique", "css_class": "effect-micro-lightning", "emoji": "⚡", "sort_order": 260},
    {"id": "violet_smoke", "name": "Фиолетовый дым", "description": "Плавный мистический дым вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-violet-smoke", "emoji": "☁️", "sort_order": 270},
    {"id": "golden_halo", "name": "Золотой нимб", "description": "Внешний золотой ореол и редкие блики.", "rarity": "legendary", "category": "unique", "css_class": "effect-golden-halo", "emoji": "✨", "sort_order": 280},
    {"id": "digital_rain", "name": "Цифровой дождь", "description": "Тонкие цифровые линии вне рамки.", "rarity": "legendary", "category": "unique", "css_class": "effect-digital-rain", "emoji": "▥", "sort_order": 290},
    {"id": "blood_sparks", "name": "Кровавые искры", "description": "Резкие красные вспышки вокруг профиля.", "rarity": "legendary", "category": "unique", "css_class": "effect-blood-sparks", "emoji": "🩸", "sort_order": 300},
    {"id": "neon_haze", "name": "Неоновая дымка", "description": "Клубная дымка фиолетово-голубых оттенков.", "rarity": "epic", "category": "unique", "css_class": "effect-neon-haze", "emoji": "🌫️", "sort_order": 310},
    {"id": "cosmic_noise", "name": "Космический шум", "description": "Мелкие звёздные помехи и холодный свет.", "rarity": "legendary", "category": "unique", "css_class": "effect-cosmic-noise", "emoji": "🌌", "sort_order": 320},

    {"id": "rune_ascent", "name": "Восходящие руны", "description": "Светящиеся руны медленно поднимаются вокруг рамки, оставляя магический след.", "rarity": "legendary", "category": "unique", "css_class": "effect-rune-ascent", "emoji": "ᚱ", "sort_order": 330},
    {"id": "neon_rain", "name": "Неоновый дождь", "description": "Многоуровневый неоновый ливень по внешнему кольцу в стиле киберпанка.", "rarity": "legendary", "category": "unique", "css_class": "effect-neon-rain", "emoji": "🌧️", "sort_order": 340},
    {"id": "sand_vortex", "name": "Песчаный вихрь", "description": "Песочные потоки и искры вращаются вокруг рамки, как мини-буря.", "rarity": "legendary", "category": "unique", "css_class": "effect-sand-vortex", "emoji": "🏜️", "sort_order": 350},
    {"id": "aurora_shards", "name": "Аврора-осколки", "description": "Полярные осколки света дрейфуют вокруг профиля.", "rarity": "epic", "category": "unique", "css_class": "effect-aurora-shards", "emoji": "🌌", "sort_order": 360},
    {"id": "void_whispers", "name": "Шёпот пустоты", "description": "Тёмные волны и звёздная пыль из глубокой пустоты окружают рамку.", "rarity": "legendary", "category": "unique", "css_class": "effect-void-whispers", "emoji": "🕳️", "sort_order": 370},
    {"id": "crystal_bloom", "name": "Кристальный венец", "description": "Холодные кристальные блики распускаются вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-crystal-bloom", "emoji": "💎", "sort_order": 380},

])

COSMETIC_EFFECT_LIBRARY.extend([
    {"id": "lightning_chain", "name": "Цепная молния", "description": "Настоящие ломаные разряды вокруг рамки, без кругового вращения.", "rarity": "legendary", "category": "unique", "css_class": "effect-lightning-chain", "emoji": "⚡", "sort_order": 390},
    {"id": "arcane_sigils", "name": "Арканные печати", "description": "Крупные магические символы вспыхивают вокруг профиля.", "rarity": "legendary", "category": "unique", "css_class": "effect-arcane-sigils", "emoji": "✦", "sort_order": 400},
    {"id": "clockwork_gears", "name": "Часовой механизм", "description": "Механические зубцы и тонкие шестерни вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-clockwork-gears", "emoji": "⚙️", "sort_order": 410},
    {"id": "thorn_vines", "name": "Шипованные лозы", "description": "Живые зелёные лозы и шипы по краям аватарки.", "rarity": "epic", "category": "unique", "css_class": "effect-thorn-vines", "emoji": "🌿", "sort_order": 420},
    {"id": "radiant_wings", "name": "Световые крылья", "description": "Две светлые дуги за рамкой, похожие на крылья.", "rarity": "legendary", "category": "unique", "css_class": "effect-radiant-wings", "emoji": "🪽", "sort_order": 430},
    {"id": "constellation_map", "name": "Созвездие", "description": "Звёзды соединяются тонкими линиями вокруг рамки.", "rarity": "epic", "category": "unique", "css_class": "effect-constellation-map", "emoji": "🌠", "sort_order": 440},
    {"id": "blood_drips", "name": "Кровавые капли", "description": "Тяжёлые красные капли стекают по внешнему контуру.", "rarity": "epic", "category": "unique", "css_class": "effect-blood-drips", "emoji": "🩸", "sort_order": 450},
    {"id": "dragon_breath", "name": "Дыхание дракона", "description": "Огненный полукруг и горячие вспышки за рамкой.", "rarity": "legendary", "category": "unique", "css_class": "effect-dragon-breath", "emoji": "🐉", "sort_order": 460},
])



# v49: effects imported from the final preview library. Frames are intentionally unchanged.
COSMETIC_EFFECT_LIBRARY.extend([
    {"id": "silver_motes", "name": "Серебряные пылинки", "description": "Чистые серебряные частицы медленно дрейфуют вокруг аватарки.", "rarity": "common", "category": "base", "css_class": "effect-silver-motes", "emoji": "✨", "sort_order": 510},
    {"id": "soft_mist", "name": "Мягкий туман", "description": "Лёгкая дымка создаёт глубину и не перегружает аватарку.", "rarity": "common", "category": "base", "css_class": "effect-soft-mist", "emoji": "✨", "sort_order": 520},
    {"id": "dew_drift", "name": "Роса и дрейф", "description": "Холодные капли и влажный блеск дают спокойный водный оттенок.", "rarity": "common", "category": "base", "css_class": "effect-dew-drift", "emoji": "✨", "sort_order": 530},
    {"id": "shadow_dust", "name": "Теневая пыль", "description": "Мелкая тёмная пыль и приглушённые фиолетовые искры для мрачного образа.", "rarity": "common", "category": "base", "css_class": "effect-shadow-dust", "emoji": "✨", "sort_order": 540},
    {"id": "heavy_rain", "name": "Ливень", "description": "Простой читаемый эффект: много капель падают сверху вниз с разной скоростью.", "rarity": "rare", "category": "base", "css_class": "effect-heavy-rain", "emoji": "✨", "sort_order": 550},
    {"id": "snow_squall", "name": "Снежный шквал", "description": "Снег летит сверху вниз по диагонали, будто персонажа накрыла метель.", "rarity": "rare", "category": "base", "css_class": "effect-snow-squall", "emoji": "✨", "sort_order": 560},
    {"id": "black_rain", "name": "Чёрный дождь", "description": "Тёмные холодные капли падают сверху вниз и оставляют мрачное ощущение.", "rarity": "rare", "category": "base", "css_class": "effect-black-rain", "emoji": "✨", "sort_order": 570},
    {"id": "midnight_snow", "name": "Полуночный снег", "description": "Тёмные снежинки и фиолетовая пыль падают сверху как снег в проклятой ночи.", "rarity": "rare", "category": "base", "css_class": "effect-midnight-snow", "emoji": "✨", "sort_order": 580},
    {"id": "soot_rain", "name": "Сажевый дождь", "description": "Чёрная сажа медленно осыпается вниз, как после пожара или проклятого костра.", "rarity": "rare", "category": "base", "css_class": "effect-soot-rain", "emoji": "✨", "sort_order": 590},
    {"id": "moon_sigils", "name": "Лунные сигилы", "description": "Полумесяцы и мягкие символы всплывают в холодном свете.", "rarity": "rare", "category": "base", "css_class": "effect-moon-sigils", "emoji": "✨", "sort_order": 600},
    {"id": "toxic_drizzle", "name": "Ядовитая морось", "description": "Тонкие зелёные капли и лёгкие брызги добавляют токсичный тон.", "rarity": "rare", "category": "base", "css_class": "effect-toxic-drizzle", "emoji": "✨", "sort_order": 610},
    {"id": "star_chorus", "name": "Хор звёзд", "description": "Несколько типов звёздных частиц движутся разной скоростью.", "rarity": "rare", "category": "base", "css_class": "effect-star-chorus", "emoji": "✨", "sort_order": 620},
    {"id": "coin_whirl", "name": "Вихрь монет", "description": "Золотые монеты и блики вращаются вокруг аватарки.", "rarity": "rare", "category": "base", "css_class": "effect-coin-whirl", "emoji": "✨", "sort_order": 630},
    {"id": "grave_whispers", "name": "Шёпот могил", "description": "Бледные знаки, черепа и холодные духи медленно всплывают вокруг портрета.", "rarity": "rare", "category": "base", "css_class": "effect-grave-whispers", "emoji": "✨", "sort_order": 640},
    {"id": "storm_lash", "name": "Бич бури", "description": "Длинные молнии и искры создают сильный грозовой характер.", "rarity": "epic", "category": "unique", "css_class": "effect-storm-lash", "emoji": "✨", "sort_order": 650},
    {"id": "oracle_glyphs", "name": "Оракульные глифы", "description": "Сложные символы в случайных местах спокойно всплывают вверх.", "rarity": "epic", "category": "unique", "css_class": "effect-oracle-glyphs", "emoji": "✨", "sort_order": 660},
    {"id": "grave_candles", "name": "Могильные свечи", "description": "Свечи появляются плавно, мерцают и медленно гаснут.", "rarity": "epic", "category": "unique", "css_class": "effect-grave-candles", "emoji": "✨", "sort_order": 670},
    {"id": "necrotic_ash", "name": "Некротический прах", "description": "Зелёно-серый прах, черепа и тусклые знаки для некромантского образа.", "rarity": "epic", "category": "unique", "css_class": "effect-necrotic-ash", "emoji": "✨", "sort_order": 680},
    {"id": "night_script", "name": "Ночные письмена", "description": "Тёмные руны и холодные символы появляются редко, зато выглядят выразительно.", "rarity": "epic", "category": "unique", "css_class": "effect-night-script", "emoji": "✨", "sort_order": 690},
    {"id": "holo_glitch", "name": "Голографический сбой", "description": "Короткие глитч-полосы и цифровые смещения вокруг аватарки.", "rarity": "rare", "category": "base", "css_class": "effect-holo-glitch", "emoji": "✨", "sort_order": 700},
    {"id": "quantum_pixels", "name": "Квантовые пиксели", "description": "Квадратные пиксели распадаются, дрожат и собираются обратно.", "rarity": "epic", "category": "unique", "css_class": "effect-quantum-pixels", "emoji": "✨", "sort_order": 710},
    {"id": "meridian_orbit", "name": "Меридиональный облёт", "description": "Энергетический объект облетает аватарку по вертикальной орбите, визуально уходя за неё и возвращаясь на передний план.", "rarity": "epic", "category": "unique", "css_class": "effect-meridian-orbit", "emoji": "✨", "sort_order": 720},
    {"id": "thunder_throne", "name": "Трон грома", "description": "Сильные разветвлённые молнии и сияющие точки. Пока оставлен как усиленный любимый вариант бури.", "rarity": "legendary", "category": "unique", "css_class": "effect-thunder-throne", "emoji": "✨", "sort_order": 730},
    {"id": "nightfall", "name": "Падение ночи", "description": "Чёрный дождь, редкие холодные звёзды и дым создают стильный эффект наступающей тьмы.", "rarity": "legendary", "category": "unique", "css_class": "effect-nightfall", "emoji": "✨", "sort_order": 740},
    {"id": "oblivion_script", "name": "Письмена забвения", "description": "Крупные тёмные символы появляются из дыма и растворяются, не перегружая портрет.", "rarity": "legendary", "category": "unique", "css_class": "effect-oblivion-script", "emoji": "✨", "sort_order": 750},
    {"id": "golden_glint", "name": "Золотой отблеск", "description": "Редкие маленькие золотые отблески мягко появляются в случайных точках и плавно затухают.", "rarity": "epic", "category": "unique", "css_class": "effect-golden-glint", "emoji": "✨", "sort_order": 760},
    {"id": "amethyst_dust", "name": "Аметистовая пыль", "description": "Мелкая фиолетовая пыль мерцает и плавно дрейфует вокруг аватарки.", "rarity": "rare", "category": "base", "css_class": "effect-amethyst-dust", "emoji": "✨", "sort_order": 770},
    {"id": "halo_of_dawn", "name": "Нимб рассвета", "description": "Над аватаркой мерцает небольшой светящийся нимб и редкие частицы света.", "rarity": "epic", "category": "unique", "css_class": "effect-halo-of-dawn", "emoji": "✨", "sort_order": 780},
    {"id": "umbra_crown", "name": "Венец мрака", "description": "Над аватаркой висит тёмный венец из мрака и фиолетовой дымки.", "rarity": "epic", "category": "unique", "css_class": "effect-umbra-crown", "emoji": "✨", "sort_order": 790},
    {"id": "brutalist_hud", "name": "Брутальный HUD", "description": "Грубые прямоугольные индикаторы, предупреждающие полосы и техно-бруталистичный интерфейс.", "rarity": "epic", "category": "unique", "css_class": "effect-brutalist-hud", "emoji": "✨", "sort_order": 800},
    {"id": "corporate_veil", "name": "Корпоративная вуаль", "description": "Сдержанный корпоративный интерфейс с холодными метками, акцентами и техно-брендингом.", "rarity": "epic", "category": "unique", "css_class": "effect-corporate-veil", "emoji": "✨", "sort_order": 810},
    {"id": "gear_orbit", "name": "Шестерни изобретателя", "description": "Малые шестерни и латунные символы вращаются у аватарки, подчёркивая образ изобретателя и стимпанк-эстетику.", "rarity": "epic", "category": "unique", "css_class": "effect-gear-orbit", "emoji": "✨", "sort_order": 820},
    {"id": "silver_glint", "name": "Серебряный отблеск", "description": "Редкие маленькие серебряные блики мягко вспыхивают в случайных точках, как отражения на полированном металле.", "rarity": "rare", "category": "base", "css_class": "effect-silver-glint", "emoji": "✨", "sort_order": 830},
    {"id": "gem_grotto", "name": "Пещера самоцветов", "description": "Редкие самоцветные блики появляются в случайных местах по всей аватарке и мягко затухают, как мерцание кристаллов в пещере.", "rarity": "epic", "category": "unique", "css_class": "effect-gem-grotto", "emoji": "✨", "sort_order": 840},
    {"id": "low_equator_orbit", "name": "Нижний экваториальный облёт", "description": "Похожий на экваториальный облёт, но линия орбиты и световой объект проходят чуть ниже центра аватарки.", "rarity": "epic", "category": "unique", "css_class": "effect-low-equator-orbit", "emoji": "✨", "sort_order": 850},
    {"id": "red_equator_scan", "name": "Экваториальное сканирование", "description": "Горизонтальная и вертикальная красные линии двигаются по аватарке, замирают на мгновение, а точка их пересечения ярко помечает цель.", "rarity": "legendary", "category": "unique", "css_class": "effect-red-equator-scan", "emoji": "✨", "sort_order": 860},
    {"id": "matrix_rain", "name": "Матричный дождь", "description": "Сверху вниз падают зелёные цифровые символы, которые меняются на каждом шаге и создают эффект матричного дождя.", "rarity": "epic", "category": "unique", "css_class": "effect-matrix-rain", "emoji": "✨", "sort_order": 870},
    {"id": "diamond_shimmer", "name": "Алмазная россыпь", "description": "Редкие алмазные блики вспыхивают по всей аватарке, как холодное мерцание кристаллических граней.", "rarity": "epic", "category": "unique", "css_class": "effect-diamond-shimmer", "emoji": "✨", "sort_order": 880},
    {"id": "matrix_rain_cyan", "name": "Лазурный код", "description": "Внутри аватарки струятся вниз лазурные цифровые символы, меняющиеся прямо на ходу.", "rarity": "epic", "category": "unique", "css_class": "effect-matrix-rain-cyan", "emoji": "✨", "sort_order": 890},
    {"id": "matrix_rain_violet", "name": "Фиолетовый код", "description": "Фиолетовый цифровой дождь с меняющимися символами льётся внутри аватарки.", "rarity": "epic", "category": "unique", "css_class": "effect-matrix-rain-violet", "emoji": "✨", "sort_order": 900},
    {"id": "matrix_rain_gold", "name": "Янтарный код", "description": "Тёплый золотистый цифровой поток создаёт более корпоративно-технологичное ощущение.", "rarity": "epic", "category": "unique", "css_class": "effect-matrix-rain-gold", "emoji": "✨", "sort_order": 910},
    {"id": "matrix_orbit", "name": "Орбитальный код", "description": "Зелёные цифровые символы и фрагменты кода летают вокруг аватарки по мягким орбитам.", "rarity": "epic", "category": "unique", "css_class": "effect-matrix-orbit", "emoji": "✨", "sort_order": 920},
    {"id": "quantum_hex", "name": "Квантовые соты", "description": "Полупрозрачные световые шестиугольники вспыхивают вокруг аватарки, формируя техномагическую сетку.", "rarity": "legendary", "category": "unique", "css_class": "effect-quantum-hex", "emoji": "✨", "sort_order": 930},
    {"id": "hex_beacon", "name": "Гекс-маяк", "description": "Одиночные световые соты вспыхивают вокруг аватарки и быстро гаснут, создавая лёгкий техно-акцент.", "rarity": "rare", "category": "base", "css_class": "effect-hex-beacon", "emoji": "✨", "sort_order": 940},
    {"id": "ring_glints", "name": "Венец отблесков", "description": "Редкие маленькие отблески вспыхивают по радиусу аватарки, как свет на кромке металла или самоцвета.", "rarity": "rare", "category": "base", "css_class": "effect-ring-glints", "emoji": "✨", "sort_order": 950},
    {"id": "holo_iris", "name": "Голографическая диафрагма", "description": "Полупрозрачные световые секторы раскрываются вокруг аватарки, как футуристическая ирис-диафрагма или сканирующая апертура.", "rarity": "legendary", "category": "unique", "css_class": "effect-holo-iris", "emoji": "✨", "sort_order": 960},
    {"id": "aether_loom", "name": "Эфирное ткачество", "description": "Совершенно новый узор из световых волн переплетается внутри аватарки, как магический тканый резонанс или муаровая сетка.", "rarity": "legendary", "category": "unique", "css_class": "effect-aether-loom", "emoji": "✨", "sort_order": 970},
])


TAG_LIBRARY = [
    # Тэг теперь состоит из двух независимых частей:
    # 1) форма/стиль плашки (category='tag_shape'), 2) текст плашки (category='tag_text').
    # В characters храним: custom_tag_style = выбранная форма, custom_tag = id текста, custom_tag_text = сам текст.
    {"id":"tag_none","name":"Без тэга","description":"Не показывать тэг рядом с именем.","rarity":"common","category":"base","css_class":"tag-none","emoji":"","sort_order":0},
    {"id":"tag_shape_classic","name":"Классическая форма","description":"Базовая спокойная форма тэга. Доступна сразу.","rarity":"common","category":"base","css_class":"tag-shape-classic","emoji":"🏷️","sort_order":5},

    # Формы тэга из старого конструктора достижений — теперь это отдельные товары магазина.
    {"id":"tag-custom-gold","name":"Золотая форма","description":"Тёплая золотая плашка для героических и удачных титулов.","rarity":"rare","category":"tag_shape","css_class":"tag-custom-gold","emoji":"✨","sort_order":110},
    {"id":"tag-custom-cyber","name":"Кибер-форма","description":"Угловатая техно-плашка с моноширинным текстом.","rarity":"rare","category":"tag_shape","css_class":"tag-custom-cyber","emoji":"💻","sort_order":120},
    {"id":"tag-custom-shadow","name":"Теневая форма","description":"Мрачная форма для скрытных, проклятых или опасных персонажей.","rarity":"rare","category":"tag_shape","css_class":"tag-custom-shadow","emoji":"🌑","sort_order":130},
    {"id":"tag-custom-emerald","name":"Изумрудная форма","description":"Живая зелёная форма для следопытов, друидов и целителей.","rarity":"rare","category":"tag_shape","css_class":"tag-custom-emerald","emoji":"🍃","sort_order":140},
    {"id":"tag-custom-frost","name":"Ледяная форма","description":"Холодная голубая плашка с морозным блеском.","rarity":"rare","category":"tag_shape","css_class":"tag-custom-frost","emoji":"❄️","sort_order":150},
    {"id":"tag-custom-blood","name":"Кровавая форма","description":"Резкая красная плашка для жестоких побед и опасных репутаций.","rarity":"epic","category":"tag_shape","css_class":"tag-custom-blood","emoji":"🩸","sort_order":210},
    {"id":"tag-custom-arcane","name":"Арканная форма","description":"Мистическая плашка для магов, ритуалов и древних сил.","rarity":"epic","category":"tag_shape","css_class":"tag-custom-arcane","emoji":"🔮","sort_order":220},
    {"id":"tag-custom-neon","name":"Неоновая форма","description":"Яркая клубная форма для сценичных и дерзких персонажей.","rarity":"epic","category":"tag_shape","css_class":"tag-custom-neon","emoji":"🎤","sort_order":230},
    {"id":"tag-custom-sunset","name":"Закатная форма","description":"Оранжево-розовая форма с мягким градиентом.","rarity":"epic","category":"tag_shape","css_class":"tag-custom-sunset","emoji":"🌅","sort_order":240},
    {"id":"tag-custom-steel","name":"Стальная форма","description":"Сухая металлическая форма для бойцов, солдат и техников.","rarity":"epic","category":"tag_shape","css_class":"tag-custom-steel","emoji":"⚙️","sort_order":250},
    {"id":"tag-custom-royal","name":"Королевская форма","description":"Премиальная форма с золотым акцентом.","rarity":"legendary","category":"tag_shape","css_class":"tag-custom-royal","emoji":"👑","sort_order":310},
    {"id":"tag-custom-glitch","name":"Глитч-форма","description":"Ломаная цифровая форма с эффектом ошибки.","rarity":"legendary","category":"tag_shape","css_class":"tag-custom-glitch","emoji":"▣","sort_order":320},

    # Тексты тэга — игрок комбинирует любой открытый текст с любой открытой формой.
    {"id":"tag_text_barbarian","name":"Варвар","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1010},
    {"id":"tag_text_bard","name":"Бард","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1020},
    {"id":"tag_text_cleric","name":"Жрец","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1030},
    {"id":"tag_text_druid","name":"Друид","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1040},
    {"id":"tag_text_fighter","name":"Воин","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1050},
    {"id":"tag_text_monk","name":"Монах","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1060},
    {"id":"tag_text_paladin","name":"Паладин","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1070},
    {"id":"tag_text_ranger","name":"Следопыт","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1080},
    {"id":"tag_text_rogue","name":"Плут","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1090},
    {"id":"tag_text_sorcerer","name":"Чародей","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1100},
    {"id":"tag_text_warlock","name":"Колдун","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1110},
    {"id":"tag_text_wizard","name":"Волшебник","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1120},
    {"id":"tag_text_artificer","name":"Изобретатель","description":"Базовый текст тэга класса D&D.","rarity":"common","category":"tag_text","css_class":"","emoji":"","sort_order":1130},

    # Старые готовые тэги теперь тоже являются текстами, а не формами.
    {"id":"tag_hero","name":"Герой","description":"Готовый текст для героического персонажа.","rarity":"rare","category":"tag_text","css_class":"","emoji":"","sort_order":1210},
    {"id":"tag_survivor","name":"Выживший","description":"Готовый текст для тех, кто держится на последнем HP.","rarity":"rare","category":"tag_text","css_class":"","emoji":"","sort_order":1220},
    {"id":"tag_scout","name":"Следопыт","description":"Готовый текст для разведчика и проводника.","rarity":"rare","category":"tag_text","css_class":"","emoji":"","sort_order":1230},
    {"id":"tag_netrunner","name":"Нетраннер","description":"Готовый текст в киберпанк-стиле.","rarity":"rare","category":"tag_text","css_class":"","emoji":"","sort_order":1240},
    {"id":"tag_solo","name":"Соло","description":"Готовый текст для одиночки, решающего проблемы силой.","rarity":"rare","category":"tag_text","css_class":"","emoji":"","sort_order":1250},
    {"id":"tag_lucky","name":"Любимец судьбы","description":"Текст для персонажа, которому подозрительно везёт.","rarity":"epic","category":"tag_text","css_class":"","emoji":"","sort_order":1310},
    {"id":"tag_stage_legend","name":"Легенда сцены","description":"Текст для яркого публичного персонажа.","rarity":"epic","category":"tag_text","css_class":"","emoji":"","sort_order":1320},
    {"id":"tag_liquidator","name":"Ликвидатор","description":"Текст для персонажа, после которого цель исчезает.","rarity":"legendary","category":"tag_text","css_class":"","emoji":"","sort_order":1410},
]



# v48: новая база кастомизации из preview v13 — рамки, эффекты, формы и тексты тэгов.
COSMETIC_LIBRARY.extend([
    {'id': 'gilded-vine', 'name': 'Позолоченная лоза', 'description': 'Тёплая классическая рамка с мягким золотым свечением.', 'rarity': 'common', 'category': 'unique', 'css_class': 'frame-gilded-vine', 'emoji': '▫️', 'sort_order': 610},
    {'id': 'ashen-bone', 'name': 'Пепельная кость', 'description': 'Костяная рамка для мрачных и боевых образов.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-ashen-bone', 'emoji': '▫️', 'sort_order': 620},
    {'id': 'storm-iron', 'name': 'Грозовое железо', 'description': 'Металлическая рамка с холодным стальным оттенком.', 'rarity': 'common', 'category': 'unique', 'css_class': 'frame-storm-iron', 'emoji': '▫️', 'sort_order': 630},
    {'id': 'sunforge', 'name': 'Солнечная кузня', 'description': 'Яркая оранжево-золотая рамка с кузнечным настроением.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'frame-sunforge', 'emoji': '🔹', 'sort_order': 640},
    {'id': 'moon-silk', 'name': 'Лунный шёлк', 'description': 'Мягкая лилово-серебряная рамка для мистических персонажей.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'frame-moon-silk', 'emoji': '🔹', 'sort_order': 650},
    {'id': 'deepwood', 'name': 'Глубокий лес', 'description': 'Насыщенная зелёная рамка для друидов и следопытов.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'frame-deepwood', 'emoji': '🔹', 'sort_order': 660},
    {'id': 'red-bastion', 'name': 'Алый бастион', 'description': 'Агрессивная кроваво-красная рамка.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'frame-red-bastion', 'emoji': '🔹', 'sort_order': 670},
    {'id': 'copper-gear', 'name': 'Медный механизм', 'description': 'Тёплая механическая рамка с индустриальным видом.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'frame-copper-gear', 'emoji': '🔹', 'sort_order': 680},
    {'id': 'sea-glass', 'name': 'Морское стекло', 'description': 'Бирюзовый морской оттенок и лёгкий блеск.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'frame-sea-glass', 'emoji': '🔹', 'sort_order': 690},
    {'id': 'night-obsidian', 'name': 'Ночной обсидиан', 'description': 'Тёмная и холодная рамка с магической глубиной.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-night-obsidian', 'emoji': '💜', 'sort_order': 700},
    {'id': 'ember-crown', 'name': 'Корона углей', 'description': 'Огненный акцент и раскалённый силуэт.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-ember-crown', 'emoji': '💜', 'sort_order': 710},
    {'id': 'blessed-silver', 'name': 'Благословенное серебро', 'description': 'Светлая рамка для священных и благородных образов.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-blessed-silver', 'emoji': '💜', 'sort_order': 720},
    {'id': 'glacial-rim', 'name': 'Ледяной обод', 'description': 'Холодная голубая рамка с ледяным свечением.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-glacial-rim', 'emoji': '💜', 'sort_order': 730},
    {'id': 'thorn-circle', 'name': 'Терновый круг', 'description': 'Живая природная рамка с шипастым настроением.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-thorn-circle', 'emoji': '💜', 'sort_order': 740},
    {'id': 'royal-amethyst', 'name': 'Королевский аметист', 'description': 'Насыщенный фиолетовый для магов и аристократии.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-royal-amethyst', 'emoji': '💜', 'sort_order': 750},
    {'id': 'ghost-veil', 'name': 'Призрачная вуаль', 'description': 'Светлая призрачная рамка с почти эфирным свечением.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-ghost-veil', 'emoji': '💜', 'sort_order': 760},
    {'id': 'drake-scale', 'name': 'Драконья чешуя', 'description': 'Плотная тёплая рамка с характером древнего дракона.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-drake-scale', 'emoji': '🌟', 'sort_order': 770},
    {'id': 'crystal-lattice', 'name': 'Кристальная решётка', 'description': 'Яркая кристаллическая рамка с магическим оттенком.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'frame-crystal-lattice', 'emoji': '🌟', 'sort_order': 780},
    {'id': 'eclipse-halo', 'name': 'Венец затмения', 'description': 'Тёмно-фиолетовый ореол с легендарной подачей.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-eclipse-halo', 'emoji': '🌟', 'sort_order': 790},
    {'id': 'worldroot', 'name': 'Корень мира', 'description': 'Природно-древняя рамка с ощущением силы живого мира.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-worldroot', 'emoji': '🌟', 'sort_order': 800},
    {'id': 'lunar_oracle', 'name': 'Лунный оракул', 'description': 'Тёмно-серебряная рамка в эстетике затмения: спокойное дыхание, холодный блеск и мягкая лунная глубина.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-lunar-oracle', 'emoji': '🌙', 'sort_order': 810},
    {'id': 'void_singularity', 'name': 'Сингулярность Бездны', 'description': 'Тёмная гравитационная рамка с синим и фиолетовым разломом в кольце.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-void-singularity', 'emoji': '🕳️', 'sort_order': 820},
    {'id': 'eldritch_knot', 'name': 'Узел Древних', 'description': 'Бирюзово-лиловый ритуальный узор, переплетённый прямо в кольце.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-eldritch-knot', 'emoji': '🔮', 'sort_order': 830},
    {'id': 'orbital_array', 'name': 'Орбитальный массив', 'description': 'Sci-fi кольцо с орбитальными узлами и холодным технологичным свечением.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-orbital-array', 'emoji': '🛰️', 'sort_order': 840},
    {'id': 'nanoforge_luminous', 'name': 'Нанокузница', 'description': 'Светящаяся технологичная нанокузница: яркое кольцо, мягкая пульсация и встроенные сияющие зажимы.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'frame-nanoforge-brackets', 'emoji': '⚡', 'sort_order': 850},
])

COSMETIC_EFFECT_LIBRARY.extend([
    {'id': 'campfire-embers', 'name': 'Костровые угли', 'description': 'Угли вспыхивают, летят вверх по дуге и постепенно темнеют, превращаясь в холодный пепел.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-campfire-embers', 'emoji': '🔥', 'sort_order': 1010},
    {'id': 'silver-motes', 'name': 'Серебряные пылинки', 'description': 'Чистые серебряные частицы медленно дрейфуют вокруг аватарки.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-silver-motes', 'emoji': '✨', 'sort_order': 1020},
    {'id': 'soft-mist', 'name': 'Мягкий туман', 'description': 'Лёгкая дымка создаёт глубину и не перегружает аватарку.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-soft-mist', 'emoji': '🌫️', 'sort_order': 1030},
    {'id': 'fireflies', 'name': 'Светлячки', 'description': 'Зелёно-золотые огоньки мерцают как ночные светлячки.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-fireflies', 'emoji': '🍃', 'sort_order': 1040},
    {'id': 'dew-drift', 'name': 'Роса и дрейф', 'description': 'Холодные капли и влажный блеск дают спокойный водный оттенок.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-dew-drift', 'emoji': '💧', 'sort_order': 1050},
    {'id': 'snow-dust', 'name': 'Снежная пыль', 'description': 'Маленькие снежинки и кристаллы кружат вокруг портрета.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-snow-dust', 'emoji': '❄️', 'sort_order': 1060},
    {'id': 'amber-dust', 'name': 'Янтарная пыль', 'description': 'Тёплые золотистые крупинки плавают как лёгкая пыль реликвии.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-amber-dust', 'emoji': '🟤', 'sort_order': 1070},
    {'id': 'shadow-dust', 'name': 'Теневая пыль', 'description': 'Мелкая тёмная пыль и приглушённые фиолетовые искры для мрачного образа.', 'rarity': 'common', 'category': 'unique', 'css_class': 'effect-shadow-dust', 'emoji': '🌑', 'sort_order': 1080},
    {'id': 'heavy-rain', 'name': 'Ливень', 'description': 'Простой читаемый эффект: много капель падают сверху вниз с разной скоростью.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-heavy-rain', 'emoji': '🌧️', 'sort_order': 1090},
    {'id': 'snow-squall', 'name': 'Снежный шквал', 'description': 'Снег летит сверху вниз по диагонали, будто персонажа накрыла метель.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-snow-squall', 'emoji': '❄️', 'sort_order': 1100},
    {'id': 'black-rain', 'name': 'Чёрный дождь', 'description': 'Тёмные холодные капли падают сверху вниз и оставляют мрачное ощущение.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-black-rain', 'emoji': '🖤', 'sort_order': 1110},
    {'id': 'midnight-snow', 'name': 'Полуночный снег', 'description': 'Тёмные снежинки и фиолетовая пыль падают сверху как снег в проклятой ночи.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-midnight-snow', 'emoji': '🖤', 'sort_order': 1120},
    {'id': 'soot-rain', 'name': 'Сажевый дождь', 'description': 'Чёрная сажа медленно осыпается вниз, как после пожара или проклятого костра.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-soot-rain', 'emoji': '🖤', 'sort_order': 1130},
    {'id': 'obsidian-splinters', 'name': 'Обсидиановые осколки', 'description': 'Чёрные стеклянные осколки падают и мерцают фиолетовым краем.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-obsidian-splinters', 'emoji': '🖤', 'sort_order': 1140},
    {'id': 'arc-sparks', 'name': 'Дуговые искры', 'description': 'Короткие электрические искры вспыхивают по периферии.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-arc-sparks', 'emoji': '⚡', 'sort_order': 1150},
    {'id': 'thorn-bloom', 'name': 'Терновый расцвет', 'description': 'Листья и острые зелёные осколки движутся без дополнительной окантовки.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-thorn-bloom', 'emoji': '🍃', 'sort_order': 1160},
    {'id': 'moon-sigils', 'name': 'Лунные сигилы', 'description': 'Полумесяцы и мягкие символы всплывают в холодном свете.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-moon-sigils', 'emoji': '🌙', 'sort_order': 1170},
    {'id': 'toxic-drizzle', 'name': 'Ядовитая морось', 'description': 'Тонкие зелёные капли и лёгкие брызги добавляют токсичный тон.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-toxic-drizzle', 'emoji': '☣️', 'sort_order': 1180},
    {'id': 'star-chorus', 'name': 'Хор звёзд', 'description': 'Несколько типов звёздных частиц движутся разной скоростью.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-star-chorus', 'emoji': '🌟', 'sort_order': 1190},
    {'id': 'frost-orbit', 'name': 'Ледяная орбита', 'description': 'Кристаллы бегут по орбите и вылетают наружу.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-frost-orbit', 'emoji': '❄️', 'sort_order': 1200},
    {'id': 'spirit-lanterns', 'name': 'Духовные фонари', 'description': 'Небольшие духи-светильники покачиваются на невидимом ветру.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-spirit-lanterns', 'emoji': '👻', 'sort_order': 1210},
    {'id': 'sun-shards', 'name': 'Солнечные осколки', 'description': 'Золотые лучики и мелкие осколки света создают тёплый ореол.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-sun-shards', 'emoji': '🤍', 'sort_order': 1220},
    {'id': 'coin-whirl', 'name': 'Вихрь монет', 'description': 'Золотые монеты и блики вращаются вокруг аватарки.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-coin-whirl', 'emoji': '🪙', 'sort_order': 1230},
    {'id': 'grave-whispers', 'name': 'Шёпот могил', 'description': 'Бледные знаки, черепа и холодные духи медленно всплывают вокруг портрета.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-grave-whispers', 'emoji': '🖤', 'sort_order': 1240},
    {'id': 'storm-lash', 'name': 'Бич бури', 'description': 'Длинные молнии и искры создают сильный грозовой характер.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-storm-lash', 'emoji': '⚡', 'sort_order': 1250},
    {'id': 'blood-rite', 'name': 'Кровавый ритуал', 'description': 'Капли крови появляются плавнее, стекают тяжелее и выглядят как кровь, а не круглые леденцы.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-blood-rite', 'emoji': '🩸', 'sort_order': 1260},
    {'id': 'rift-glass', 'name': 'Разлом стекла', 'description': 'Осколки и магические линии ведут себя как нестабильный разлом.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-rift-glass', 'emoji': '🔮', 'sort_order': 1270},
    {'id': 'dragon-cinders', 'name': 'Драконьи угли', 'description': 'Плотные искры и короткие огненные дуги как дыхание дракона.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-dragon-cinders', 'emoji': '🔥', 'sort_order': 1280},
    {'id': 'oracle-glyphs', 'name': 'Оракульные глифы', 'description': 'Сложные символы в случайных местах спокойно всплывают вверх.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-oracle-glyphs', 'emoji': 'ᚱ', 'sort_order': 1290},
    {'id': 'clock-halo', 'name': 'Механический венец', 'description': 'Шестерни, винты и тонкие механические знаки образуют орбиту.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-clock-halo', 'emoji': '⚙️', 'sort_order': 1300},
    {'id': 'grave-candles', 'name': 'Могильные свечи', 'description': 'Свечи появляются плавно, мерцают и медленно гаснут.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-grave-candles', 'emoji': '👻', 'sort_order': 1310},
    {'id': 'crystal-pulse', 'name': 'Кристальный импульс', 'description': 'Кристаллические вспышки без окантовки: только осколки и короткие всплески света.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-crystal-pulse', 'emoji': '💎', 'sort_order': 1320},
    {'id': 'shadow-chains', 'name': 'Теневые цепи', 'description': 'Звенья цепей, тёмные искры и дым создают ощущение проклятой клетки.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-shadow-chains', 'emoji': '🖤', 'sort_order': 1330},
    {'id': 'necrotic-ash', 'name': 'Некротический прах', 'description': 'Зелёно-серый прах, черепа и тусклые знаки для некромантского образа.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-necrotic-ash', 'emoji': '🖤', 'sort_order': 1340},
    {'id': 'void-shards', 'name': 'Осколки Бездны', 'description': 'Фиолетовые тёмные осколки вылетают из пустоты и растворяются в дыме.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-void-shards', 'emoji': '🕳️', 'sort_order': 1350},
    {'id': 'shadow-needles', 'name': 'Теневые иглы', 'description': 'Чёрные тонкие иглы падают сверху и рассыпаются в фиолетовую пыль.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-shadow-needles', 'emoji': '🖤', 'sort_order': 1360},
    {'id': 'ink-comets', 'name': 'Чернильные кометы', 'description': 'Чёрные кометы с дымным хвостом проскальзывают по диагонали.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-ink-comets', 'emoji': '🖤', 'sort_order': 1370},
    {'id': 'night-script', 'name': 'Ночные письмена', 'description': 'Тёмные руны и холодные символы появляются редко, зато выглядят выразительно.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-night-script', 'emoji': '🖤', 'sort_order': 1380},
    {'id': 'neon-rain', 'name': 'Неоновый дождь', 'description': 'Киберпанковый дождь из коротких розово-голубых световых штрихов сверху вниз.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-neon-rain', 'emoji': '▣', 'sort_order': 1390},
    {'id': 'holo-glitch', 'name': 'Голографический сбой', 'description': 'Короткие глитч-полосы и цифровые смещения вокруг аватарки.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-holo-glitch', 'emoji': '🚀', 'sort_order': 1400},
    {'id': 'data-sparks', 'name': 'Искры данных', 'description': 'Мелкие цифровые символы и пиксели вспыхивают как сбой интерфейса.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-data-sparks', 'emoji': '▣', 'sort_order': 1410},
    {'id': 'laser-sights', 'name': 'Лазерные прицелы', 'description': 'Тонкие красные лазерные линии быстро пересекают портрет и исчезают.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-laser-sights', 'emoji': '🚀', 'sort_order': 1420},
    {'id': 'plasma-circuit', 'name': 'Плазменная цепь', 'description': 'Синие плазменные дуги и короткие импульсы напоминают перегруженную схему.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-plasma-circuit', 'emoji': '🚀', 'sort_order': 1430},
    {'id': 'quantum-pixels', 'name': 'Квантовые пиксели', 'description': 'Квадратные пиксели распадаются, дрожат и собираются обратно.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-quantum-pixels', 'emoji': '🚀', 'sort_order': 1440},
    {'id': 'orbital-scan', 'name': 'Орбитальное сканирование', 'description': 'Тонкие сканирующие лучи проходят по портрету, как сенсор боевого корабля.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-orbital-scan', 'emoji': '🚀', 'sort_order': 1450},
    {'id': 'cyber-ghost', 'name': 'Кибер-призрак', 'description': 'Цифровой призрачный шум, короткие силуэты и холодные пиксели.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-cyber-ghost', 'emoji': '▣', 'sort_order': 1460},
    {'id': 'ion-trails', 'name': 'Ионные следы', 'description': 'Голубые ионные следы пролетают по диагонали, как следы двигателей.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-ion-trails', 'emoji': '🚀', 'sort_order': 1470},
    {'id': 'glitch-frame', 'name': 'Глитч-контур', 'description': 'Глитч-полосы и неоновые сбои бегут по периметру аватарки, создавая ощущение сломанной рамки.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-glitch-frame', 'emoji': '▣', 'sort_order': 1480},
    {'id': 'phase-orbit', 'name': 'Фазовый облёт', 'description': 'Энергетический дрон облетает аватарку по кругу, временами визуально уходя за неё и возвращаясь на передний план.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-phase-orbit', 'emoji': '🚀', 'sort_order': 1490},
    {'id': 'meridian-orbit', 'name': 'Меридиональный облёт', 'description': 'Энергетический объект облетает аватарку по вертикальной орбите, визуально уходя за неё и возвращаясь на передний план.', 'rarity': 'epic', 'category': 'unique', 'css_class': 'effect-meridian-orbit', 'emoji': '🚀', 'sort_order': 1500},
    {'id': 'tracer-tail', 'name': 'Трассирующий след', 'description': 'Быстрый светящийся сгусток пролетает по дуге и тянет за собой длинный яркий трейл.', 'rarity': 'rare', 'category': 'unique', 'css_class': 'effect-tracer-tail', 'emoji': '🚀', 'sort_order': 1510},
    {'id': 'inferno-crown', 'name': 'Инфернальное пламя', 'description': 'Реалистичные языки пламени, клубы дыма и яркие искры поднимаются вдоль нижней части аватарки.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-inferno-crown', 'emoji': '🔥', 'sort_order': 1520},
    {'id': 'hyperspace-jump', 'name': 'Прыжок в сверхсвет', 'description': 'Быстрые световые streak-линии несутся по периметру аватарки, создавая ощущение перехода на сверхсвет.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-hyperspace-jump', 'emoji': '🚀', 'sort_order': 1530},
    {'id': 'black-ice', 'name': 'Чёрный лёд', 'description': 'Опасный киберпанк-эффект: чёрные цифровые осколки, красные предупреждения и холодный сбой.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-black-ice', 'emoji': '▣', 'sort_order': 1540},
    {'id': 'eclipse-crown', 'name': 'Корона затмения', 'description': 'Тёмная аура, светлые орбиты и магический венец затмения.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-eclipse-crown', 'emoji': '🌌', 'sort_order': 1550},
    {'id': 'prism-monarch', 'name': 'Призматический монарх', 'description': 'Хроматические дуги, призматические искры и переливы в богатой композиции.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-prism-monarch', 'emoji': '💠', 'sort_order': 1560},
    {'id': 'thunder-throne', 'name': 'Трон грома', 'description': 'Сильные разветвлённые молнии и сияющие точки. Пока оставлен как усиленный любимый вариант бури.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-thunder-throne', 'emoji': '⚡', 'sort_order': 1570},
    {'id': 'nightfall', 'name': 'Падение ночи', 'description': 'Чёрный дождь, редкие холодные звёзды и дым создают стильный эффект наступающей тьмы.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-nightfall', 'emoji': '🖤', 'sort_order': 1580},
    {'id': 'oblivion-script', 'name': 'Письмена забвения', 'description': 'Крупные тёмные символы появляются из дыма и растворяются, не перегружая портрет.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-oblivion-script', 'emoji': '🖤', 'sort_order': 1590},
    {'id': 'black-aurora', 'name': 'Чёрное сияние', 'description': 'Тёмные волны, фиолетовые искры и мягкие всплески света без кольцевой окантовки.', 'rarity': 'legendary', 'category': 'unique', 'css_class': 'effect-black-aurora', 'emoji': '🖤', 'sort_order': 1600},
])

TAG_LIBRARY.extend([
    {'id': 'tag_shape_scroll', 'name': 'Свиток', 'description': 'Классический бумажный вид.', 'rarity': 'common', 'category': 'tag_shape', 'css_class': 'form-scroll', 'emoji': '📜', 'sort_order': 510},
    {'id': 'tag_shape_banner', 'name': 'Знамя', 'description': 'Прямой и читаемый боевой стиль.', 'rarity': 'common', 'category': 'tag_shape', 'css_class': 'form-banner', 'emoji': '🚩', 'sort_order': 520},
    {'id': 'tag_shape_hex', 'name': 'Шестиугольник', 'description': 'Строгая геометрия и нейтральность.', 'rarity': 'common', 'category': 'tag_shape', 'css_class': 'form-hex', 'emoji': '⬡', 'sort_order': 530},
    {'id': 'tag_shape_plate', 'name': 'Пластина', 'description': 'Металлическая табличка.', 'rarity': 'common', 'category': 'tag_shape', 'css_class': 'form-plate', 'emoji': '▰', 'sort_order': 540},
    {'id': 'tag_shape_shield', 'name': 'Щит', 'description': 'Геральдический защитный силуэт.', 'rarity': 'rare', 'category': 'tag_shape', 'css_class': 'form-shield', 'emoji': '🛡️', 'sort_order': 550},
    {'id': 'tag_shape_ribbon', 'name': 'Лента', 'description': 'Лёгкая декоративная форма.', 'rarity': 'rare', 'category': 'tag_shape', 'css_class': 'form-ribbon', 'emoji': '🎗️', 'sort_order': 560},
    {'id': 'tag_shape_leaf', 'name': 'Лист', 'description': 'Мягкая природная форма.', 'rarity': 'rare', 'category': 'tag_shape', 'css_class': 'form-leaf', 'emoji': '🍃', 'sort_order': 570},
    {'id': 'tag_shape_crystal', 'name': 'Кристалл', 'description': 'Огранённый магический силуэт.', 'rarity': 'rare', 'category': 'tag_shape', 'css_class': 'form-crystal', 'emoji': '💎', 'sort_order': 580},
    {'id': 'tag_shape_seal', 'name': 'Печать', 'description': 'Круглая печать для редких надписей.', 'rarity': 'epic', 'category': 'tag_shape', 'css_class': 'form-seal', 'emoji': '🔘', 'sort_order': 590},
    {'id': 'tag_shape_thorn', 'name': 'Шипы', 'description': 'Агрессивная рваная форма.', 'rarity': 'epic', 'category': 'tag_shape', 'css_class': 'form-thorn', 'emoji': '🌿', 'sort_order': 600},
    {'id': 'tag_shape_arcane', 'name': 'Арканная дуга', 'description': 'Светящийся магический овал.', 'rarity': 'epic', 'category': 'tag_shape', 'css_class': 'form-arcane', 'emoji': '🔮', 'sort_order': 610},
    {'id': 'tag_shape_claw', 'name': 'Коготь', 'description': 'Резкий хищный силуэт.', 'rarity': 'legendary', 'category': 'tag_shape', 'css_class': 'form-claw', 'emoji': '🦴', 'sort_order': 620},
    {'id': 'tag_shape_crown', 'name': 'Корона', 'description': 'Торжественная форма для выдающихся тэгов.', 'rarity': 'legendary', 'category': 'tag_shape', 'css_class': 'form-crown', 'emoji': '👑', 'sort_order': 630},
    {'id': 'tag_text_extra_alchemist', 'name': 'Алхимик', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'rare', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1620},
    {'id': 'tag_text_extra_merciless', 'name': 'Безжалостный', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'rare', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1630},
    {'id': 'tag_text_extra_vanguard', 'name': 'Авангард', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'rare', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1640},
    {'id': 'tag_text_extra_nightborn', 'name': 'Ночной', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'epic', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1650},
    {'id': 'tag_text_extra_bloodthirsty', 'name': 'Кровожадный', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'epic', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1660},
    {'id': 'tag_text_extra_dragonslayer', 'name': 'Драконоборец', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'epic', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1670},
    {'id': 'tag_text_extra_fatebreaker', 'name': 'Сломавший судьбу', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'legendary', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1680},
    {'id': 'tag_text_extra_voidmarked', 'name': 'Отмеченный Бездной', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'legendary', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1690},
    {'id': 'tag_text_extra_chosen', 'name': 'Избранный', 'description': 'Дополнительный текст тэга для магазина кастомизации.', 'rarity': 'legendary', 'category': 'tag_text', 'css_class': '', 'emoji': '', 'sort_order': 1700},
])

SPARK_CREDIT_DEFAULT = 2000

RARITY_PRICE_RANGES = {
    "common": (40, 90),
    "rare": (120, 260),
    "epic": (350, 750),
    "legendary": (1000, 2000),
    "unique": None,
}

RARITY_PRICES = {
    "common": 60,
    "rare": 180,
    "epic": 500,
    "legendary": 1300,
    "unique": None,
}


def default_price_for_rarity(rarity: str | None) -> int | None:
    return RARITY_PRICES.get(str(rarity or "common"), 60)


def default_price_for_item(item: dict[str, Any] | None) -> int | None:
    item = item or {}
    rarity = str(item.get("rarity") or "common")
    bounds = RARITY_PRICE_RANGES.get(rarity)
    if bounds is None:
        return None
    lo, hi = bounds
    step = 10 if rarity in {"common", "rare"} else 50
    key = str(item.get("id") or item.get("name") or rarity)
    span = max(0, (hi - lo) // step)
    seed = sum((i + 1) * ord(ch) for i, ch in enumerate(key))
    return lo + (seed % (span + 1)) * step


LOCATION_RU = {
    "head": "Голова",
    "torso": "Туловище",
    "arm_r": "Правая рука",
    "arm_l": "Левая рука",
    "leg_r": "Правая нога",
    "leg_l": "Левая нога",
    "right_arm": "Правая рука",
    "left_arm": "Левая рука",
    "right_leg": "Правая нога",
    "left_leg": "Левая нога",
}

SEVERITY_RU = {
    "light": "Лёгкая",
    "medium": "Средняя",
    "heavy": "Тяжёлая",
}


SUPPORTED_MODERN_EFFECT_IDS = {'effect_none', 'silver_motes', 'soft_mist', 'dew_drift', 'shadow_dust', 'heavy_rain', 'snow_squall', 'black_rain', 'midnight_snow', 'soot_rain', 'moon_sigils', 'toxic_drizzle', 'star_chorus', 'coin_whirl', 'grave_whispers', 'storm_lash', 'oracle_glyphs', 'grave_candles', 'necrotic_ash', 'night_script', 'neon_rain', 'holo_glitch', 'quantum_pixels', 'meridian_orbit', 'thunder_throne', 'nightfall', 'oblivion_script', 'golden_glint', 'amethyst_dust', 'halo_of_dawn', 'umbra_crown', 'rune_ascent', 'brutalist_hud', 'corporate_veil', 'gear_orbit', 'silver_glint', 'gem_grotto', 'low_equator_orbit', 'red_equator_scan', 'matrix_rain', 'diamond_shimmer', 'matrix_rain_cyan', 'matrix_rain_violet', 'matrix_rain_gold', 'matrix_orbit', 'quantum_hex', 'hex_beacon', 'ring_glints', 'holo_iris', 'aether_loom'}

# v65: requested shop balance for modern canvas effects.
# Legendary effects are curated; all remaining modern effects are split between epic and rare.
LEGENDARY_MODERN_EFFECT_IDS = {
    'aether_loom', 'thunder_throne', 'red_equator_scan',
    'halo_of_dawn', 'umbra_crown', 'low_equator_orbit',
}
EPIC_MODERN_EFFECT_IDS = {
    # explicitly requested epic effects
    'quantum_hex', 'coin_whirl',
    # deterministic half of the remaining pool, including part of the rain/code recolors
    'soft_mist', 'snow_squall', 'black_rain', 'toxic_drizzle', 'star_chorus',
    'storm_lash', 'oracle_glyphs', 'grave_candles', 'quantum_pixels', 'nightfall',
    'golden_glint', 'brutalist_hud', 'gear_orbit', 'gem_grotto', 'matrix_rain',
    'diamond_shimmer', 'matrix_rain_violet', 'matrix_orbit', 'ring_glints', 'holo_iris',
}

def _rebalance_modern_effects_for_shop() -> None:
    for item in COSMETIC_EFFECT_LIBRARY:
        effect_id = str(item.get('id') or '')
        if effect_id == 'effect_none' or effect_id not in SUPPORTED_MODERN_EFFECT_IDS:
            continue
        if effect_id in LEGENDARY_MODERN_EFFECT_IDS:
            rarity = 'legendary'
        elif effect_id in EPIC_MODERN_EFFECT_IDS:
            rarity = 'epic'
        else:
            rarity = 'rare'
        item['rarity'] = rarity
        item['category'] = 'unique'

_rebalance_modern_effects_for_shop()

def is_supported_modern_effect(effect_id: str | None) -> bool:
    return str(effect_id or '') in SUPPORTED_MODERN_EFFECT_IDS


class Database:
    def __init__(self, path: str) -> None:
        self.path = path
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")

    def init_schema(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                master_tg_id INTEGER NOT NULL,
                rule_type TEXT NOT NULL DEFAULT 'fantasy',
                injuries_enabled INTEGER NOT NULL DEFAULT 1,
                armor_enabled INTEGER NOT NULL DEFAULT 0,
                weapons_enabled INTEGER NOT NULL DEFAULT 0,
                invite_code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                telegram_user_id INTEGER,
                ac INTEGER NOT NULL DEFAULT 10,
                max_hp_base INTEGER NOT NULL DEFAULT 1,
                max_hp_penalty INTEGER NOT NULL DEFAULT 0,
                current_hp INTEGER NOT NULL DEFAULT 1,
                pain INTEGER NOT NULL DEFAULT 0,
                armor_max_base INTEGER NOT NULL DEFAULT 0,
                armor_max_penalty INTEGER NOT NULL DEFAULT 0,
                armor_current INTEGER NOT NULL DEFAULT 0,
                color TEXT NOT NULL DEFAULT '#72a7ff',
                avatar_path TEXT NOT NULL DEFAULT '',
                avatar_thumb_path TEXT NOT NULL DEFAULT '',
                custom_frame TEXT NOT NULL DEFAULT '',
                custom_effect TEXT NOT NULL DEFAULT '',
                statuses_json TEXT NOT NULL DEFAULT '[]',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                UNIQUE(campaign_id, name)
            );

            CREATE TABLE IF NOT EXISTS injuries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                location TEXT NOT NULL,
                severity TEXT NOT NULL,
                stabilized INTEGER NOT NULL DEFAULT 0,
                healed INTEGER NOT NULL DEFAULT 0,
                max_hp_loss INTEGER NOT NULL DEFAULT 0,
                max_hp_restored INTEGER NOT NULL DEFAULT 0,
                pain_added INTEGER NOT NULL DEFAULT 0,
                combat TEXT NOT NULL DEFAULT '',
                exploration TEXT NOT NULL DEFAULT '',
                social TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                heal_rule TEXT NOT NULL DEFAULT '',
                psych_effect TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                player_tg_id INTEGER NOT NULL,
                request_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS log_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
                character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
                kind TEXT NOT NULL,
                title TEXT NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );


            CREATE TABLE IF NOT EXISTS cosmetics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                rarity TEXT NOT NULL DEFAULT 'common',
                category TEXT NOT NULL DEFAULT 'base',
                css_class TEXT NOT NULL DEFAULT '',
                asset_path TEXT NOT NULL DEFAULT '',
                thumb_path TEXT NOT NULL DEFAULT '',
                frame_scale REAL NOT NULL DEFAULT 1.55,
                frame_offset_x REAL NOT NULL DEFAULT 0,
                frame_offset_y REAL NOT NULL DEFAULT 0,
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS user_cosmetic_unlocks (
                telegram_user_id INTEGER NOT NULL,
                cosmetic_id TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (telegram_user_id, cosmetic_id)
            );

            CREATE TABLE IF NOT EXISTS cosmetic_effects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                rarity TEXT NOT NULL DEFAULT 'common',
                category TEXT NOT NULL DEFAULT 'base',
                css_class TEXT NOT NULL DEFAULT '',
                asset_path TEXT NOT NULL DEFAULT '',
                thumb_path TEXT NOT NULL DEFAULT '',
                frame_scale REAL NOT NULL DEFAULT 1.55,
                frame_offset_x REAL NOT NULL DEFAULT 0,
                frame_offset_y REAL NOT NULL DEFAULT 0,
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS user_effect_unlocks (
                telegram_user_id INTEGER NOT NULL,
                effect_id TEXT NOT NULL REFERENCES cosmetic_effects(id) ON DELETE CASCADE,
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (telegram_user_id, effect_id)
            );

            CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                created_by_master_id INTEGER NOT NULL,
                icon TEXT NOT NULL DEFAULT '🏆',
                icon_thumb TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                tag TEXT NOT NULL DEFAULT '',
                cosmetic_reward_id TEXT REFERENCES cosmetics(id) ON DELETE SET NULL,
                cosmetic_effect_reward_id TEXT REFERENCES cosmetic_effects(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS achievement_grants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
                telegram_user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
                given_by_master_id INTEGER NOT NULL,
                master_comment TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                opened_at TEXT NOT NULL DEFAULT '',
                UNIQUE(achievement_id, telegram_user_id)
            );

            CREATE TABLE IF NOT EXISTS user_customizations (
                telegram_user_id INTEGER PRIMARY KEY,
                unique_unlocked INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS combats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'setup',
                round INTEGER NOT NULL DEFAULT 1,
                current_combatant_id INTEGER,
                created_at TEXT NOT NULL,
                started_at TEXT,
                ended_at TEXT
            );

            CREATE TABLE IF NOT EXISTS combatants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                combat_id INTEGER NOT NULL REFERENCES combats(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#72a7ff',
                avatar_path TEXT NOT NULL DEFAULT '',
                ac INTEGER NOT NULL DEFAULT 10,
                max_hp INTEGER NOT NULL DEFAULT 1,
                current_hp INTEGER NOT NULL DEFAULT 1,
                initiative INTEGER,
                hidden_hp INTEGER NOT NULL DEFAULT 0,
                public_note TEXT NOT NULL DEFAULT '',
                alive INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            """
        )
        self._migrate()
        self.seed_cosmetics()
        self.seed_cosmetic_effects()
        self.seed_tags()
        self.conn.commit()

    def _migrate(self) -> None:
        """Безопасно добавляет новые поля в старую SQLite-базу."""
        def cols(table: str) -> set[str]:
            return {str(r[1]) for r in self.conn.execute(f"PRAGMA table_info({table})").fetchall()}

        campaign_cols = cols("campaigns")
        if "injuries_enabled" not in campaign_cols:
            self.conn.execute("ALTER TABLE campaigns ADD COLUMN injuries_enabled INTEGER NOT NULL DEFAULT 1")
        if "armor_enabled" not in campaign_cols:
            self.conn.execute("ALTER TABLE campaigns ADD COLUMN armor_enabled INTEGER NOT NULL DEFAULT 0")
        if "weapons_enabled" not in campaign_cols:
            self.conn.execute("ALTER TABLE campaigns ADD COLUMN weapons_enabled INTEGER NOT NULL DEFAULT 0")

        char_cols = cols("characters")
        if "armor_max_base" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN armor_max_base INTEGER NOT NULL DEFAULT 0")
        if "armor_max_penalty" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN armor_max_penalty INTEGER NOT NULL DEFAULT 0")
        if "armor_current" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN armor_current INTEGER NOT NULL DEFAULT 0")
        if "color" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN color TEXT NOT NULL DEFAULT '#72a7ff'")
        if "avatar_path" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN avatar_path TEXT NOT NULL DEFAULT ''")
        if "avatar_thumb_path" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN avatar_thumb_path TEXT NOT NULL DEFAULT ''")
        if "custom_frame" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN custom_frame TEXT NOT NULL DEFAULT ''")
        if "custom_effect" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN custom_effect TEXT NOT NULL DEFAULT ''")
        if "custom_tag" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN custom_tag TEXT NOT NULL DEFAULT ''")
        if "custom_tag_text" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN custom_tag_text TEXT NOT NULL DEFAULT ''")
        if "custom_tag_style" not in char_cols:
            self.conn.execute("ALTER TABLE characters ADD COLUMN custom_tag_style TEXT NOT NULL DEFAULT 'tag_none'")

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS user_customizations (
                telegram_user_id INTEGER PRIMARY KEY,
                unique_unlocked INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            )
        """)

        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS cosmetics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                rarity TEXT NOT NULL DEFAULT 'common',
                category TEXT NOT NULL DEFAULT 'base',
                css_class TEXT NOT NULL DEFAULT '',
                asset_path TEXT NOT NULL DEFAULT '',
                thumb_path TEXT NOT NULL DEFAULT '',
                frame_scale REAL NOT NULL DEFAULT 1.55,
                frame_offset_x REAL NOT NULL DEFAULT 0,
                frame_offset_y REAL NOT NULL DEFAULT 0,
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS user_cosmetic_unlocks (
                telegram_user_id INTEGER NOT NULL,
                cosmetic_id TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (telegram_user_id, cosmetic_id)
            );
            CREATE TABLE IF NOT EXISTS cosmetic_effects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                rarity TEXT NOT NULL DEFAULT 'common',
                category TEXT NOT NULL DEFAULT 'base',
                css_class TEXT NOT NULL DEFAULT '',
                asset_path TEXT NOT NULL DEFAULT '',
                thumb_path TEXT NOT NULL DEFAULT '',
                frame_scale REAL NOT NULL DEFAULT 1.55,
                frame_offset_x REAL NOT NULL DEFAULT 0,
                frame_offset_y REAL NOT NULL DEFAULT 0,
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS user_effect_unlocks (
                telegram_user_id INTEGER NOT NULL,
                effect_id TEXT NOT NULL REFERENCES cosmetic_effects(id) ON DELETE CASCADE,
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (telegram_user_id, effect_id)
            );
            CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                created_by_master_id INTEGER NOT NULL,
                icon TEXT NOT NULL DEFAULT '🏆',
                icon_thumb TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                tag TEXT NOT NULL DEFAULT '',
                cosmetic_reward_id TEXT REFERENCES cosmetics(id) ON DELETE SET NULL,
                cosmetic_effect_reward_id TEXT REFERENCES cosmetic_effects(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS achievement_grants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
                telegram_user_id INTEGER NOT NULL,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
                given_by_master_id INTEGER NOT NULL,
                master_comment TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                opened_at TEXT NOT NULL DEFAULT '',
                UNIQUE(achievement_id, telegram_user_id)
            );
        """)

        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS cosmetic_tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                rarity TEXT NOT NULL DEFAULT 'common',
                category TEXT NOT NULL DEFAULT 'base',
                css_class TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '',
                price INTEGER,
                purchasable INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS user_tag_unlocks (
                telegram_user_id INTEGER NOT NULL,
                tag_id TEXT NOT NULL REFERENCES cosmetic_tags(id) ON DELETE CASCADE,
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY (telegram_user_id, tag_id)
            );
            CREATE TABLE IF NOT EXISTS user_wallets (
                telegram_user_id INTEGER PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS currency_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS master_spark_wallets (
                master_tg_id INTEGER PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 2000,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS master_spark_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                master_tg_id INTEGER NOT NULL,
                target_tg_id INTEGER,
                target_character_id INTEGER,
                campaign_id INTEGER,
                amount INTEGER NOT NULL,
                reserve_delta INTEGER NOT NULL,
                reserve_after INTEGER NOT NULL,
                kind TEXT NOT NULL DEFAULT 'grant',
                comment TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT '',
                source_id INTEGER,
                created_by_tg_id INTEGER,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS campaign_maps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                image_path TEXT NOT NULL DEFAULT '',
                thumb_path TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS map_pings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                map_id INTEGER NOT NULL REFERENCES campaign_maps(id) ON DELETE CASCADE,
                telegram_user_id INTEGER NOT NULL,
                character_id INTEGER,
                x REAL NOT NULL,
                y REAL NOT NULL,
                color TEXT NOT NULL DEFAULT '#72a7ff',
                label TEXT NOT NULL DEFAULT '',
                is_master INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS inventory_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                item_type TEXT NOT NULL DEFAULT 'normal',
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '',
                quantity INTEGER NOT NULL DEFAULT 1,
                weapon_type TEXT NOT NULL DEFAULT '',
                reload_type TEXT NOT NULL DEFAULT 'magazine',
                mag_capacity INTEGER NOT NULL DEFAULT 0,
                ammo_per_attack INTEGER NOT NULL DEFAULT 0,
                active_magazine_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS weapon_magazines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                name TEXT NOT NULL DEFAULT '',
                ammo_current INTEGER NOT NULL DEFAULT 0,
                ammo_max INTEGER NOT NULL DEFAULT 0,
                ammo_type TEXT NOT NULL DEFAULT 'обычные',
                description TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS weapon_fire_modes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                ammo_cost INTEGER NOT NULL DEFAULT 1,
                description TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS weapon_shell_stocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                ammo_type TEXT NOT NULL DEFAULT 'стандартная дробь',
                quantity INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS weapon_loaded_shells (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                ammo_type TEXT NOT NULL DEFAULT 'стандартная дробь',
                description TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS inventory_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                player_tg_id INTEGER NOT NULL,
                request_type TEXT NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL
            );
        """)

        inv_cols = cols("inventory_items")
        if "reload_type" not in inv_cols:
            self.conn.execute("ALTER TABLE inventory_items ADD COLUMN reload_type TEXT NOT NULL DEFAULT 'magazine'")
        mag_cols = cols("weapon_magazines")
        if "name" not in mag_cols:
            self.conn.execute("ALTER TABLE weapon_magazines ADD COLUMN name TEXT NOT NULL DEFAULT ''")
        if "ammo_type" not in mag_cols:
            self.conn.execute("ALTER TABLE weapon_magazines ADD COLUMN ammo_type TEXT NOT NULL DEFAULT 'обычные'")
        if "description" not in mag_cols:
            self.conn.execute("ALTER TABLE weapon_magazines ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        fire_cols = cols("weapon_fire_modes")
        if "description" not in fire_cols:
            self.conn.execute("ALTER TABLE weapon_fire_modes ADD COLUMN description TEXT NOT NULL DEFAULT ''")
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS weapon_fire_modes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                ammo_cost INTEGER NOT NULL DEFAULT 1,
                description TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS weapon_shell_stocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                ammo_type TEXT NOT NULL DEFAULT 'стандартная дробь',
                quantity INTEGER NOT NULL DEFAULT 0,
                description TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS weapon_loaded_shells (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
                ammo_type TEXT NOT NULL DEFAULT 'стандартная дробь',
                description TEXT NOT NULL DEFAULT '',
                emoji TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );
        """)

        for table in ("cosmetics", "cosmetic_effects"):
            tcols = cols(table)
            if "price" not in tcols:
                self.conn.execute(f"ALTER TABLE {table} ADD COLUMN price INTEGER")
            if "purchasable" not in tcols:
                self.conn.execute(f"ALTER TABLE {table} ADD COLUMN purchasable INTEGER NOT NULL DEFAULT 1")

        cosmetic_cols = cols("cosmetics")
        if "asset_path" not in cosmetic_cols:
            self.conn.execute("ALTER TABLE cosmetics ADD COLUMN asset_path TEXT NOT NULL DEFAULT ''")
        if "thumb_path" not in cosmetic_cols:
            self.conn.execute("ALTER TABLE cosmetics ADD COLUMN thumb_path TEXT NOT NULL DEFAULT ''")
        if "frame_scale" not in cosmetic_cols:
            self.conn.execute("ALTER TABLE cosmetics ADD COLUMN frame_scale REAL NOT NULL DEFAULT 1.55")
        if "frame_offset_x" not in cosmetic_cols:
            self.conn.execute("ALTER TABLE cosmetics ADD COLUMN frame_offset_x REAL NOT NULL DEFAULT 0")
        if "frame_offset_y" not in cosmetic_cols:
            self.conn.execute("ALTER TABLE cosmetics ADD COLUMN frame_offset_y REAL NOT NULL DEFAULT 0")
        effect_cols = cols("cosmetic_effects")
        if "asset_path" not in effect_cols:
            self.conn.execute("ALTER TABLE cosmetic_effects ADD COLUMN asset_path TEXT NOT NULL DEFAULT ''")
        if "thumb_path" not in effect_cols:
            self.conn.execute("ALTER TABLE cosmetic_effects ADD COLUMN thumb_path TEXT NOT NULL DEFAULT ''")

        achievement_cols = cols("achievements")
        if "icon_thumb" not in achievement_cols:
            self.conn.execute("ALTER TABLE achievements ADD COLUMN icon_thumb TEXT NOT NULL DEFAULT ''")
        if "cosmetic_effect_reward_id" not in achievement_cols:
            self.conn.execute("ALTER TABLE achievements ADD COLUMN cosmetic_effect_reward_id TEXT REFERENCES cosmetic_effects(id) ON DELETE SET NULL")
        if "tag_reward_id" not in achievement_cols:
            self.conn.execute("ALTER TABLE achievements ADD COLUMN tag_reward_id TEXT REFERENCES cosmetic_tags(id) ON DELETE SET NULL")
        if "currency_reward" not in achievement_cols:
            self.conn.execute("ALTER TABLE achievements ADD COLUMN currency_reward INTEGER NOT NULL DEFAULT 0")

        grant_cols = cols("achievement_grants")
        if "opened_at" not in grant_cols:
            self.conn.execute("ALTER TABLE achievement_grants ADD COLUMN opened_at TEXT NOT NULL DEFAULT ''")

        request_cols = cols("requests")
        if "payload_json" not in request_cols:
            self.conn.execute("ALTER TABLE requests ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}'")

    # ---------- generic ----------
    def _one(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        row = self.conn.execute(sql, params).fetchone()
        return dict(row) if row else None

    def _many(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        return rows_to_dicts(self.conn.execute(sql, params).fetchall())

    def log(self, campaign_id: int | None, character_id: int | None, kind: str, title: str, payload: dict[str, Any] | None = None) -> int:
        cur = self.conn.execute(
            "INSERT INTO log_events(campaign_id, character_id, kind, title, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (campaign_id, character_id, kind, title, json.dumps(payload or {}, ensure_ascii=False), utc_now()),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def get_event(self, event_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM log_events WHERE id=?", (event_id,))
        if row:
            row["payload"] = json.loads(row.pop("payload_json") or "{}")
        return row

    def get_recent_events(self, campaign_id: int, limit: int = 10) -> list[dict[str, Any]]:
        rows = self._many(
            "SELECT * FROM log_events WHERE campaign_id=? ORDER BY id DESC LIMIT ?",
            (campaign_id, limit),
        )
        for row in rows:
            row["payload"] = json.loads(row.pop("payload_json") or "{}")
            row["created_at_msk"] = msk_time(row.get("created_at", ""))
        return rows

    # ---------- campaigns ----------
    def _new_invite_code(self) -> str:
        alphabet = string.ascii_uppercase + string.digits
        while True:
            code = "".join(random.choice(alphabet) for _ in range(6))
            if not self._one("SELECT id FROM campaigns WHERE invite_code=?", (code,)):
                return code

    def create_campaign(self, name: str, master_tg_id: int, *, injuries_enabled: bool = True, armor_enabled: bool = False, weapons_enabled: bool = False) -> dict[str, Any]:
        code = self._new_invite_code()
        cur = self.conn.execute(
            """
            INSERT INTO campaigns(name, master_tg_id, rule_type, injuries_enabled, armor_enabled, weapons_enabled, invite_code, created_at)
            VALUES (?, ?, 'fantasy', ?, ?, ?, ?, ?)
            """,
            (name.strip(), master_tg_id, int(injuries_enabled), int(armor_enabled), int(weapons_enabled), code, utc_now()),
        )
        self.conn.commit()
        return self.get_campaign(int(cur.lastrowid))  # type: ignore[return-value]

    def get_campaign(self, campaign_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM campaigns WHERE id=?", (campaign_id,))
        return self._hydrate_campaign(row) if row else None

    def get_campaign_by_invite(self, code: str) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM campaigns WHERE invite_code=?", (code.strip().upper(),))
        return self._hydrate_campaign(row) if row else None

    def list_master_campaigns(self, master_tg_id: int) -> list[dict[str, Any]]:
        return [self._hydrate_campaign(r) for r in self._many("SELECT * FROM campaigns WHERE master_tg_id=? ORDER BY id DESC", (master_tg_id,))]

    def campaigns_for_player(self, tg_id: int) -> list[dict[str, Any]]:
        rows = self._many(
            """
            SELECT DISTINCT c.* FROM campaigns c
            JOIN characters ch ON ch.campaign_id=c.id
            WHERE ch.telegram_user_id=?
            ORDER BY c.id DESC
            """,
            (tg_id,),
        )
        return [self._hydrate_campaign(r) for r in rows]

    def _hydrate_campaign(self, row: dict[str, Any]) -> dict[str, Any]:
        row = dict(row)
        row["injuries_enabled"] = bool(row.get("injuries_enabled", 1))
        row["armor_enabled"] = bool(row.get("armor_enabled", 0))
        row["weapons_enabled"] = bool(row.get("weapons_enabled", 0))
        return row

    # ---------- characters ----------
    def create_character(self, campaign_id: int, name: str, hp: int, ac: int, armor: int = 0, color: str = '#72a7ff') -> dict[str, Any]:
        hp = max(1, int(hp))
        ac = max(1, int(ac))
        armor = max(0, int(armor))
        color = normalize_color(color)
        cur = self.conn.execute(
            """
            INSERT INTO characters(campaign_id, name, ac, max_hp_base, max_hp_penalty, current_hp, pain,
                                   armor_max_base, armor_max_penalty, armor_current, color, avatar_path, custom_frame, custom_effect, custom_tag, custom_tag_text, custom_tag_style, created_at)
            VALUES (?, ?, ?, ?, 0, ?, 0, ?, 0, ?, ?, '', '', '', '', '', 'tag_none', ?)
            """,
            (campaign_id, name.strip(), ac, hp, hp, armor, armor, color, utc_now()),
        )
        self.conn.commit()
        return self.get_character(int(cur.lastrowid))  # type: ignore[return-value]

    def get_character(self, character_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM characters WHERE id=?", (character_id,))
        return self._hydrate_character(row) if row else None

    def get_character_by_player(self, campaign_id: int, tg_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM characters WHERE campaign_id=? AND telegram_user_id=?", (campaign_id, tg_id))
        return self._hydrate_character(row) if row else None

    def list_characters(self, campaign_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM characters WHERE campaign_id=? ORDER BY name COLLATE NOCASE", (campaign_id,))
        return [self._hydrate_character(r) for r in rows]

    def unlinked_characters(self, campaign_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM characters WHERE campaign_id=? AND telegram_user_id IS NULL ORDER BY name", (campaign_id,))
        return [self._hydrate_character(r) for r in rows]

    def link_character(self, character_id: int, telegram_user_id: int) -> None:
        self.conn.execute("UPDATE characters SET telegram_user_id=? WHERE id=?", (telegram_user_id, character_id))
        self.conn.commit()

    def update_character_fields(self, character_id: int, **fields: Any) -> dict[str, Any]:
        allowed = {
            "name", "telegram_user_id", "ac", "max_hp_base", "max_hp_penalty", "current_hp", "pain",
            "armor_max_base", "armor_max_penalty", "armor_current", "color", "avatar_path", "custom_frame", "custom_effect", "custom_tag", "custom_tag_text", "custom_tag_style", "statuses_json", "notes"
        }
        data = {k: v for k, v in fields.items() if k in allowed}
        if "color" in data:
            data["color"] = normalize_color(data["color"])
        if not data:
            char = self.get_character(character_id)
            if not char:
                raise ValueError("Персонаж не найден")
            return char
        cols = ", ".join(f"{k}=?" for k in data)
        values = tuple(data.values()) + (character_id,)
        self.conn.execute(f"UPDATE characters SET {cols} WHERE id=?", values)
        self.conn.commit()
        char = self.get_character(character_id)
        if not char:
            raise ValueError("Персонаж не найден")
        return char

    def add_status(self, character_id: int, text: str) -> dict[str, Any]:
        char = self.get_character(character_id)
        if not char:
            raise ValueError("Персонаж не найден")
        statuses = char["statuses"]
        statuses.append(text.strip())
        return self.update_character_fields(character_id, statuses_json=json.dumps(statuses, ensure_ascii=False))

    def remove_status(self, character_id: int, idx: int) -> dict[str, Any]:
        char = self.get_character(character_id)
        if not char:
            raise ValueError("Персонаж не найден")
        statuses = char["statuses"]
        if 0 <= idx < len(statuses):
            statuses.pop(idx)
        return self.update_character_fields(character_id, statuses_json=json.dumps(statuses, ensure_ascii=False))

    def _hydrate_character(self, row: dict[str, Any]) -> dict[str, Any]:
        row = dict(row)
        row["statuses"] = json.loads(row.pop("statuses_json") or "[]")
        row["injuries"] = self.list_injuries(int(row["id"]))
        row["current_max_hp"] = max(0, int(row["max_hp_base"]) - int(row["max_hp_penalty"]))
        row["current_max_armor"] = max(0, int(row.get("armor_max_base", 0) or 0) - int(row.get("armor_max_penalty", 0) or 0))
        row["color"] = normalize_color(row.get("color", "#72a7ff"))
        row["avatar_path"] = str(row.get("avatar_path", "") or "")
        row["custom_frame"] = str(row.get("custom_frame", "") or "")
        row["custom_effect"] = str(row.get("custom_effect", "") or "")
        row["custom_tag"] = str(row.get("custom_tag", "") or "")
        row["custom_tag_text"] = str(row.get("custom_tag_text", "") or "")
        row["custom_tag_style"] = str(row.get("custom_tag_style", "tag_none") or "tag_none")
        tg_id = row.get("telegram_user_id")
        row["unique_custom_unlocked"] = bool(tg_id and self.list_unlocked_cosmetic_ids(int(tg_id)))
        row["unlocked_cosmetic_ids"] = self.list_unlocked_cosmetic_ids(int(tg_id)) if tg_id else []
        if row["armor_current"] > row["current_max_armor"]:
            row["armor_current"] = row["current_max_armor"]
        campaign = self.get_campaign(int(row["campaign_id"]))
        row["injuries_enabled"] = bool(campaign.get("injuries_enabled", True)) if campaign else True
        row["armor_enabled"] = bool(campaign.get("armor_enabled", False)) if campaign else False
        return row

    # ---------- injuries ----------
    def list_injuries(self, character_id: int, include_healed: bool = True) -> list[dict[str, Any]]:
        where = "character_id=?" if include_healed else "character_id=? AND healed=0"
        rows = self._many(f"SELECT * FROM injuries WHERE {where} ORDER BY id DESC", (character_id,))
        for r in rows:
            r["stabilized"] = bool(r["stabilized"])
            r["healed"] = bool(r["healed"])
            r["location_ru"] = LOCATION_RU.get(str(r.get("location", "")), str(r.get("location", "")))
            r["severity_ru"] = SEVERITY_RU.get(str(r.get("severity", "")), str(r.get("severity", "")))
            r["max_hp_effective_loss"] = max(0, int(r.get("max_hp_loss", 0) or 0) - int(r.get("max_hp_restored", 0) or 0))
            r["title_ru"] = f"{r['location_ru']}. {r['severity_ru']}"
        return rows

    def add_injury(self, character_id: int, injury: dict[str, Any]) -> int:
        cur = self.conn.execute(
            """
            INSERT INTO injuries(character_id, location, severity, stabilized, healed, max_hp_loss, max_hp_restored,
                                 pain_added, combat, exploration, social, notes, heal_rule, psych_effect, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                character_id,
                injury.get("location", "torso"),
                injury.get("severity", "light"),
                int(bool(injury.get("stabilized", False))),
                int(bool(injury.get("healed", False))),
                int(injury.get("max_hp_loss", 0) or 0),
                int(injury.get("max_hp_restored", 0) or 0),
                int(injury.get("pain_added", 0) or 0),
                injury.get("combat", ""),
                injury.get("exploration", ""),
                injury.get("social", ""),
                injury.get("notes", ""),
                injury.get("heal_rule", ""),
                injury.get("psych_effect"),
                utc_now(),
            ),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def update_injury(self, injury_id: int, **fields: Any) -> None:
        allowed = {"stabilized", "healed", "max_hp_restored"}
        data = {k: int(v) if k in {"stabilized", "healed"} else v for k, v in fields.items() if k in allowed}
        if not data:
            return
        cols = ", ".join(f"{k}=?" for k in data)
        self.conn.execute(f"UPDATE injuries SET {cols} WHERE id=?", tuple(data.values()) + (injury_id,))
        self.conn.commit()

    def heal_all_injuries(self, character_id: int) -> None:
        self.conn.execute("UPDATE injuries SET healed=1, stabilized=1 WHERE character_id=?", (character_id,))
        self.conn.commit()

    def delete_character(self, character_id: int) -> None:
        self.conn.execute("DELETE FROM characters WHERE id=?", (character_id,))
        self.conn.commit()

    def restore_character_snapshot(self, snapshot: dict[str, Any]) -> dict[str, Any] | None:
        """Восстанавливает персонажа из снимка для отмены последнего действия."""
        character_id = int(snapshot["id"])
        statuses_json = snapshot.get("statuses_json")
        if statuses_json is None:
            statuses_json = json.dumps(snapshot.get("statuses", []), ensure_ascii=False)
        fields = {
            "name": snapshot.get("name"),
            "telegram_user_id": snapshot.get("telegram_user_id"),
            "ac": snapshot.get("ac"),
            "max_hp_base": snapshot.get("max_hp_base"),
            "max_hp_penalty": snapshot.get("max_hp_penalty"),
            "current_hp": snapshot.get("current_hp"),
            "pain": snapshot.get("pain"),
            "armor_max_base": snapshot.get("armor_max_base"),
            "armor_max_penalty": snapshot.get("armor_max_penalty"),
            "armor_current": snapshot.get("armor_current"),
            "color": snapshot.get("color", "#72a7ff"),
            "avatar_path": snapshot.get("avatar_path", ""),
            "custom_frame": snapshot.get("custom_frame", ""),
            "custom_effect": snapshot.get("custom_effect", ""),
            "custom_tag": snapshot.get("custom_tag", ""),
            "statuses_json": statuses_json,
            "notes": snapshot.get("notes", ""),
        }
        fields = {k: v for k, v in fields.items() if v is not None}
        if self.get_character(character_id) is None:
            self.conn.execute(
                """
                INSERT INTO characters(id, campaign_id, name, telegram_user_id, ac, max_hp_base, max_hp_penalty, current_hp, pain,
                                       armor_max_base, armor_max_penalty, armor_current, color, avatar_path, custom_frame, custom_effect, custom_tag, statuses_json, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    character_id, snapshot.get("campaign_id"), snapshot.get("name", "Персонаж"), snapshot.get("telegram_user_id"),
                    snapshot.get("ac", 10), snapshot.get("max_hp_base", 1), snapshot.get("max_hp_penalty", 0),
                    snapshot.get("current_hp", 1), snapshot.get("pain", 0), snapshot.get("armor_max_base", 0),
                    snapshot.get("armor_max_penalty", 0), snapshot.get("armor_current", 0), snapshot.get("color", "#72a7ff"), snapshot.get("avatar_path", ""), snapshot.get("custom_frame", ""), snapshot.get("custom_effect", ""), snapshot.get("custom_tag", ""), statuses_json, snapshot.get("notes", ""),
                    snapshot.get("created_at", utc_now()),
                ),
            )
        else:
            cols = ", ".join(f"{k}=?" for k in fields)
            self.conn.execute(f"UPDATE characters SET {cols} WHERE id=?", tuple(fields.values()) + (character_id,))

        before_injuries = snapshot.get("injuries", []) or []
        before_ids = {int(i["id"]) for i in before_injuries if i.get("id") is not None}
        current_ids = {int(i["id"]) for i in self.list_injuries(character_id, include_healed=True)}
        for iid in current_ids - before_ids:
            self.conn.execute("DELETE FROM injuries WHERE id=?", (iid,))
        for inj in before_injuries:
            iid = int(inj["id"])
            payload = (
                character_id, inj.get("location", "torso"), inj.get("severity", "light"), int(bool(inj.get("stabilized", False))),
                int(bool(inj.get("healed", False))), int(inj.get("max_hp_loss", 0) or 0), int(inj.get("max_hp_restored", 0) or 0),
                int(inj.get("pain_added", 0) or 0), inj.get("combat", ""), inj.get("exploration", ""), inj.get("social", ""),
                inj.get("notes", ""), inj.get("heal_rule", ""), inj.get("psych_effect"), inj.get("created_at", utc_now()), iid,
            )
            if iid in current_ids:
                self.conn.execute(
                    """
                    UPDATE injuries SET character_id=?, location=?, severity=?, stabilized=?, healed=?, max_hp_loss=?, max_hp_restored=?,
                        pain_added=?, combat=?, exploration=?, social=?, notes=?, heal_rule=?, psych_effect=?, created_at=?
                    WHERE id=?
                    """, payload,
                )
            else:
                self.conn.execute(
                    """
                    INSERT INTO injuries(character_id, location, severity, stabilized, healed, max_hp_loss, max_hp_restored,
                                         pain_added, combat, exploration, social, notes, heal_rule, psych_effect, created_at, id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, payload,
                )
        self.conn.commit()
        return self.get_character(character_id)


    # ---------- combat tracker ----------
    def get_active_combat(self, campaign_id: int) -> dict[str, Any] | None:
        row = self._one(
            "SELECT * FROM combats WHERE campaign_id=? AND status IN ('setup','active') ORDER BY id DESC LIMIT 1",
            (campaign_id,),
        )
        return self._hydrate_combat(row) if row else None

    def create_combat(self, campaign_id: int) -> dict[str, Any]:
        existing = self.get_active_combat(campaign_id)
        if existing:
            return existing
        cur = self.conn.execute(
            "INSERT INTO combats(campaign_id, status, round, created_at) VALUES (?, 'setup', 1, ?)",
            (campaign_id, utc_now()),
        )
        combat_id = int(cur.lastrowid)
        for idx, ch in enumerate(self.list_characters(campaign_id)):
            self.conn.execute(
                """
                INSERT INTO combatants(combat_id, kind, character_id, name, color, avatar_path, ac, max_hp, current_hp, initiative, hidden_hp, public_note, alive, sort_order, created_at)
                VALUES (?, 'character', ?, ?, ?, ?, ?, ?, ?, NULL, 0, '', 1, ?, ?)
                """,
                (combat_id, int(ch["id"]), ch["name"], ch.get("color", "#72a7ff"), ch.get("avatar_path", ""), int(ch.get("ac", 10)), int(ch.get("current_max_hp", 1)), int(ch.get("current_hp", 1)), idx, utc_now()),
            )
        self.conn.commit()
        return self.get_combat(combat_id)  # type: ignore[return-value]

    def get_combat(self, combat_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM combats WHERE id=?", (combat_id,))
        return self._hydrate_combat(row) if row else None

    def _hydrate_combat(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        c = dict(row)
        combatants = self.list_combatants(int(c["id"]))
        c["combatants"] = combatants
        c["current"] = next((x for x in combatants if int(x["id"]) == int(c.get("current_combatant_id") or 0)), None)
        c["players_ready"] = all(x.get("initiative") is not None for x in combatants if x.get("kind") == "character" and x.get("alive"))
        return c

    def list_combatants(self, combat_id: int, include_dead: bool = False) -> list[dict[str, Any]]:
        where = "combat_id=?" if include_dead else "combat_id=? AND alive=1"
        rows = self._many(f"SELECT * FROM combatants WHERE {where} ORDER BY sort_order ASC, id ASC", (combat_id,))
        out: list[dict[str, Any]] = []
        for r in rows:
            item = dict(r)
            item["hidden_hp"] = bool(item.get("hidden_hp"))
            item["alive"] = bool(item.get("alive"))
            item["color"] = normalize_color(item.get("color", "#72a7ff"))
            if item.get("kind") == "character" and item.get("character_id"):
                ch = self.get_character(int(item["character_id"]))
                if ch:
                    item["character"] = ch
                    item["name"] = ch.get("name", item["name"])
                    item["color"] = ch.get("color", item["color"])
                    item["avatar_path"] = ch.get("avatar_path", item.get("avatar_path", ""))
                    item["custom_frame"] = ch.get("custom_frame", "")
                    item["custom_effect"] = ch.get("custom_effect", "")
                    item["unique_custom_unlocked"] = ch.get("unique_custom_unlocked", False)
                    item["ac"] = int(ch.get("ac", item.get("ac", 10)))
                    item["max_hp"] = int(ch.get("current_max_hp", item.get("max_hp", 1)))
                    item["current_hp"] = int(ch.get("current_hp", item.get("current_hp", 1)))
            item["public_condition"] = self.enemy_condition(item) if item.get("kind") == "enemy" else ""
            out.append(item)
        return out

    def public_combat(self, combat: dict[str, Any] | None) -> dict[str, Any] | None:
        if not combat:
            return None
        out = dict(combat)
        public_items = []
        for x in combat.get("combatants", []):
            item = {
                "id": x.get("id"),
                "kind": x.get("kind"),
                "character_id": x.get("character_id"),
                "name": x.get("name"),
                "color": x.get("color"),
                "avatar_path": x.get("avatar_path", ""),
                "custom_frame": x.get("custom_frame", ""),
                "custom_effect": x.get("custom_effect", ""),
                "initiative": x.get("initiative"),
                "sort_order": x.get("sort_order"),
                "alive": x.get("alive"),
                "is_current": int(x.get("id")) == int(combat.get("current_combatant_id") or 0),
            }
            if x.get("kind") == "character":
                item.update({"current_hp": x.get("current_hp"), "max_hp": x.get("max_hp")})
            else:
                item.update({
                    "hidden_hp": bool(x.get("hidden_hp")),
                    "public_note": x.get("public_note", ""),
                    "public_condition": self.enemy_condition(x),
                })
            public_items.append(item)
        out["combatants"] = public_items
        out["current"] = next((x for x in public_items if x.get("is_current")), None)
        return out

    def enemy_condition(self, item: dict[str, Any]) -> str:
        if bool(item.get("hidden_hp")):
            return "Состояние здоровья скрыто мастером."
        max_hp = max(1, int(item.get("max_hp") or 1))
        hp = max(0, int(item.get("current_hp") or 0))
        ratio = hp / max_hp
        if hp <= 0:
            return "Повержен."
        if ratio >= 0.85:
            return "Выглядит почти невредимым."
        if ratio >= 0.6:
            return "Заметно ранен, но держится уверенно."
        if ratio >= 0.35:
            return "Сильно ранен, движения стали тяжелее."
        if ratio >= 0.15:
            return "Едва держится на ногах."
        return "На грани падения."

    def _next_sort_order(self, combat_id: int) -> int:
        row = self._one("SELECT COALESCE(MAX(sort_order), -1) AS m FROM combatants WHERE combat_id=?", (combat_id,))
        return int(row.get("m", -1) if row else -1) + 1

    def add_enemy_combatant(self, combat_id: int, name: str, hp: int, ac: int, initiative: int | None, color: str, hidden_hp: bool = False, public_note: str = "") -> dict[str, Any]:
        hp = max(1, int(hp))
        ac = max(1, int(ac))
        cur = self.conn.execute(
            """
            INSERT INTO combatants(combat_id, kind, character_id, name, color, avatar_path, ac, max_hp, current_hp, initiative, hidden_hp, public_note, alive, sort_order, created_at)
            VALUES (?, 'enemy', NULL, ?, ?, '', ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (combat_id, name.strip() or "Враг", normalize_color(color), ac, hp, hp, initiative, int(bool(hidden_hp)), public_note.strip(), self._next_sort_order(combat_id), utc_now()),
        )
        self.conn.commit()
        # Враги всегда встраиваются в порядок по инициативе.
        self.sort_combat_by_initiative(combat_id)
        return self.get_combatant(int(cur.lastrowid))  # type: ignore[return-value]

    def get_combatant(self, combatant_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM combatants WHERE id=?", (combatant_id,))
        if not row:
            return None
        # hydrate through list for character live values
        combat_id = int(row["combat_id"])
        return next((x for x in self.list_combatants(combat_id, include_dead=True) if int(x["id"]) == int(combatant_id)), None)

    def set_combatant_initiative(self, combatant_id: int, initiative: int) -> None:
        self.conn.execute("UPDATE combatants SET initiative=? WHERE id=?", (int(initiative), combatant_id))
        self.conn.commit()

    def update_combatant(self, combatant_id: int, **fields: Any) -> dict[str, Any]:
        allowed = {"name", "color", "ac", "max_hp", "current_hp", "initiative", "hidden_hp", "public_note", "alive"}
        data = {k: v for k, v in fields.items() if k in allowed}
        if "color" in data:
            data["color"] = normalize_color(data["color"])
        if "hidden_hp" in data:
            data["hidden_hp"] = int(bool(data["hidden_hp"]))
        if "alive" in data:
            data["alive"] = int(bool(data["alive"]))
        if data:
            cols = ", ".join(f"{k}=?" for k in data)
            self.conn.execute(f"UPDATE combatants SET {cols} WHERE id=?", tuple(data.values()) + (combatant_id,))
            self.conn.commit()
        item = self.get_combatant(combatant_id)
        if not item:
            raise ValueError("Участник боя не найден")
        return item

    def damage_enemy_combatant(self, combatant_id: int, damage: int) -> dict[str, Any]:
        item = self.get_combatant(combatant_id)
        if not item or item.get("kind") != "enemy":
            raise ValueError("Враг не найден")
        new_hp = max(0, int(item.get("current_hp") or 0) - max(0, int(damage)))
        alive = new_hp > 0
        self.conn.execute("UPDATE combatants SET current_hp=?, alive=? WHERE id=?", (new_hp, int(alive), combatant_id))
        self.conn.commit()
        combat = self.get_combat(int(item["combat_id"]))
        if combat and int(combat.get("current_combatant_id") or 0) == int(combatant_id) and not alive:
            self.advance_turn(int(item["combat_id"]))
        return self.get_combatant(combatant_id) or {**item, "current_hp": new_hp, "alive": alive}

    def delete_combatant(self, combatant_id: int) -> None:
        item = self.get_combatant(combatant_id)
        self.conn.execute("DELETE FROM combatants WHERE id=?", (combatant_id,))
        self.conn.commit()
        if item:
            combat = self.get_combat(int(item["combat_id"]))
            if combat and int(combat.get("current_combatant_id") or 0) == int(combatant_id):
                self.advance_turn(int(item["combat_id"]))

    def sort_combat_by_initiative(self, combat_id: int) -> None:
        rows = self._many("SELECT id, initiative FROM combatants WHERE combat_id=? AND alive=1", (combat_id,))
        rows.sort(key=lambda r: (r.get("initiative") is None, -(int(r.get("initiative") or -9999)), int(r["id"])))
        for idx, r in enumerate(rows):
            self.conn.execute("UPDATE combatants SET sort_order=? WHERE id=?", (idx, int(r["id"])))
        self.conn.commit()

    def begin_combat(self, combat_id: int) -> dict[str, Any]:
        self.sort_combat_by_initiative(combat_id)
        first = self._one("SELECT id FROM combatants WHERE combat_id=? AND alive=1 ORDER BY sort_order ASC, id ASC LIMIT 1", (combat_id,))
        self.conn.execute(
            "UPDATE combats SET status='active', round=1, current_combatant_id=?, started_at=COALESCE(started_at, ?) WHERE id=?",
            (int(first["id"]) if first else None, utc_now(), combat_id),
        )
        self.conn.commit()
        return self.get_combat(combat_id)  # type: ignore[return-value]

    def advance_turn(self, combat_id: int) -> dict[str, Any]:
        combat = self.get_combat(combat_id)
        if not combat:
            raise ValueError("Бой не найден")
        items = self.list_combatants(combat_id)
        if not items:
            self.conn.execute("UPDATE combats SET current_combatant_id=NULL WHERE id=?", (combat_id,))
            self.conn.commit()
            return self.get_combat(combat_id)  # type: ignore[return-value]
        current_id = int(combat.get("current_combatant_id") or 0)
        idx = next((i for i, x in enumerate(items) if int(x["id"]) == current_id), -1)
        next_idx = (idx + 1) % len(items)
        round_no = int(combat.get("round") or 1) + (1 if idx >= 0 and next_idx == 0 else 0)
        self.conn.execute("UPDATE combats SET current_combatant_id=?, round=? WHERE id=?", (int(items[next_idx]["id"]), round_no, combat_id))
        self.conn.commit()
        return self.get_combat(combat_id)  # type: ignore[return-value]

    def reorder_combatants(self, combat_id: int, ids: list[int]) -> dict[str, Any]:
        for idx, cid in enumerate(ids):
            self.conn.execute("UPDATE combatants SET sort_order=? WHERE combat_id=? AND id=?", (idx, combat_id, int(cid)))
        self.conn.commit()
        return self.get_combat(combat_id)  # type: ignore[return-value]

    def finish_combat(self, combat_id: int) -> dict[str, Any]:
        self.conn.execute("UPDATE combats SET status='finished', ended_at=? WHERE id=?", (utc_now(), combat_id))
        self.conn.commit()
        return self.get_combat(combat_id)  # type: ignore[return-value]

    # ---------- cosmetics and achievements ----------
    def seed_cosmetics(self) -> None:
        for item in COSMETIC_LIBRARY:
            self.conn.execute(
                """
                INSERT INTO cosmetics(id, name, description, rarity, category, css_class, asset_path, thumb_path, frame_scale, emoji, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    rarity=excluded.rarity,
                    category=excluded.category,
                    css_class=excluded.css_class,
                    asset_path=excluded.asset_path,
                    thumb_path=excluded.thumb_path,
                    frame_scale=excluded.frame_scale,
                    emoji=excluded.emoji,
                    sort_order=excluded.sort_order
                """,
                (
                    item["id"], item["name"], item.get("description", ""), item.get("rarity", "common"),
                    item.get("category", "base"), item.get("css_class", ""), item.get("asset_path", ""), item.get("thumb_path", ""), float(item.get("frame_scale", 1.55)), item.get("emoji", ""), int(item.get("sort_order", 0)),
                ),
            )
        # цены нужны для магазина; уникальную редкость покупать нельзя
        for row in self._many("SELECT id, name, rarity FROM cosmetics"):
            price = default_price_for_item(row)
            purchasable = 0 if price is None else 1
            self.conn.execute("UPDATE cosmetics SET price=?, purchasable=? WHERE id=?", (price, purchasable, row["id"]))
        self.conn.commit()

    def list_cosmetics(self) -> list[dict[str, Any]]:
        return self._many("SELECT * FROM cosmetics ORDER BY sort_order, name")

    def update_cosmetic_thumb(self, cosmetic_id: str, *, asset_path: str | None = None, thumb_path: str | None = None) -> None:
        parts = []
        vals: list[Any] = []
        if asset_path is not None:
            parts.append("asset_path=?")
            vals.append(asset_path)
        if thumb_path is not None:
            parts.append("thumb_path=?")
            vals.append(thumb_path)
        if not parts:
            return
        vals.append(str(cosmetic_id))
        self.conn.execute(f"UPDATE cosmetics SET {', '.join(parts)} WHERE id=?", tuple(vals))
        self.conn.commit()

    def update_achievement_icon_paths(self, achievement_id: int, *, icon: str | None = None, icon_thumb: str | None = None) -> None:
        parts = []
        vals: list[Any] = []
        if icon is not None:
            parts.append("icon=?")
            vals.append(icon)
        if icon_thumb is not None:
            parts.append("icon_thumb=?")
            vals.append(icon_thumb)
        if not parts:
            return
        vals.append(int(achievement_id))
        self.conn.execute(f"UPDATE achievements SET {', '.join(parts)} WHERE id=?", tuple(vals))
        self.conn.commit()

    def seed_cosmetic_effects(self) -> None:
        for item in COSMETIC_EFFECT_LIBRARY:
            self.conn.execute(
                """
                INSERT INTO cosmetic_effects(id, name, description, rarity, category, css_class, asset_path, thumb_path, emoji, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    rarity=excluded.rarity,
                    category=excluded.category,
                    css_class=excluded.css_class,
                    asset_path=excluded.asset_path,
                    thumb_path=excluded.thumb_path,
                    emoji=excluded.emoji,
                    sort_order=excluded.sort_order
                """,
                (
                    item["id"], item["name"], item.get("description", ""), item.get("rarity", "common"),
                    item.get("category", "base"), item.get("css_class", ""), item.get("asset_path", ""), item.get("thumb_path", ""), item.get("emoji", ""), int(item.get("sort_order", 0)),
                ),
            )
        for row in self._many("SELECT id, name, rarity FROM cosmetic_effects"):
            price = default_price_for_item(row)
            purchasable = 0 if price is None else 1
            self.conn.execute("UPDATE cosmetic_effects SET price=?, purchasable=? WHERE id=?", (price, purchasable, row["id"]))
        self.conn.commit()

    def list_cosmetic_effects(self) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM cosmetic_effects ORDER BY sort_order, name")
        return [row for row in rows if is_supported_modern_effect(row.get('id'))]

    def get_cosmetic_effect(self, effect_id: str) -> dict[str, Any] | None:
        if not effect_id or str(effect_id) == "effect_none":
            return None
        return self._one("SELECT * FROM cosmetic_effects WHERE id=?", (str(effect_id),))

    def list_unlocked_effect_ids(self, telegram_user_id: int) -> list[str]:
        rows = self._many("SELECT effect_id FROM user_effect_unlocks WHERE telegram_user_id=?", (int(telegram_user_id),))
        return [str(r["effect_id"]) for r in rows]

    def has_effect_unlocked(self, telegram_user_id: int, effect_id: str) -> bool:
        if not effect_id or str(effect_id) == "effect_none":
            return True
        effect = self.get_cosmetic_effect(effect_id)
        if not effect:
            return False
        if str(effect.get("rarity") or "common") == "common":
            return True
        row = self._one(
            "SELECT 1 AS ok FROM user_effect_unlocks WHERE telegram_user_id=? AND effect_id=?",
            (int(telegram_user_id), str(effect_id)),
        )
        return bool(row)

    def unlock_cosmetic_effect(self, telegram_user_id: int, effect_id: str, *, source: str = '', source_id: int | None = None) -> None:
        if not effect_id or str(effect_id) == "effect_none" or not self.get_cosmetic_effect(effect_id):
            return
        self.conn.execute(
            """
            INSERT INTO user_effect_unlocks(telegram_user_id, effect_id, source, source_id, unlocked_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(telegram_user_id, effect_id) DO NOTHING
            """,
            (int(telegram_user_id), str(effect_id), source, source_id, utc_now()),
        )
        self.conn.commit()

    def get_cosmetic(self, cosmetic_id: str) -> dict[str, Any] | None:
        if not cosmetic_id:
            return None
        return self._one("SELECT * FROM cosmetics WHERE id=?", (str(cosmetic_id),))

    def list_unlocked_cosmetic_ids(self, telegram_user_id: int) -> list[str]:
        rows = self._many("SELECT cosmetic_id FROM user_cosmetic_unlocks WHERE telegram_user_id=?", (int(telegram_user_id),))
        return [str(r["cosmetic_id"]) for r in rows]

    def has_cosmetic_unlocked(self, telegram_user_id: int, cosmetic_id: str) -> bool:
        cosmetic = self.get_cosmetic(cosmetic_id)
        if not cosmetic:
            return False
        if str(cosmetic.get("rarity") or "common") == "common":
            return True
        row = self._one(
            "SELECT 1 AS ok FROM user_cosmetic_unlocks WHERE telegram_user_id=? AND cosmetic_id=?",
            (int(telegram_user_id), str(cosmetic_id)),
        )
        return bool(row)

    def unlock_cosmetic(self, telegram_user_id: int, cosmetic_id: str, *, source: str = '', source_id: int | None = None) -> None:
        if not cosmetic_id or not self.get_cosmetic(cosmetic_id):
            return
        self.conn.execute(
            """
            INSERT INTO user_cosmetic_unlocks(telegram_user_id, cosmetic_id, source, source_id, unlocked_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(telegram_user_id, cosmetic_id) DO NOTHING
            """,
            (int(telegram_user_id), str(cosmetic_id), source, source_id, utc_now()),
        )
        self.conn.commit()

    def create_custom_cosmetic_frame(self, *, frame_id: str, name: str, description: str = '', rarity: str = 'unique', asset_path: str = '', thumb_path: str = '', frame_scale: float = 1.55, frame_offset_x: float = 0, frame_offset_y: float = 0, css_class: str = '', emoji: str = '🖼️') -> dict[str, Any]:
        frame_id = str(frame_id).strip()
        if not frame_id:
            raise ValueError("Пустой ID рамки")
        self.conn.execute(
            """
            INSERT INTO cosmetics(id, name, description, rarity, category, css_class, asset_path, thumb_path, frame_scale, frame_offset_x, frame_offset_y, emoji, sort_order)
            VALUES (?, ?, ?, ?, 'unique', ?, ?, ?, ?, ?, ?, ?, 900)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                rarity=excluded.rarity,
                category='unique',
                css_class=excluded.css_class,
                asset_path=excluded.asset_path,
                thumb_path=excluded.thumb_path,
                frame_scale=excluded.frame_scale,
                frame_offset_x=excluded.frame_offset_x,
                frame_offset_y=excluded.frame_offset_y,
                emoji=excluded.emoji,
                sort_order=excluded.sort_order
            """,
            (frame_id, name.strip() or "Кастомная рамка", description.strip(), rarity.strip() or "legendary", css_class.strip(), asset_path.strip(), thumb_path.strip(), max(0.50, min(3.50, float(frame_scale or 1.55))), max(-80, min(80, float(frame_offset_x or 0))), max(-80, min(80, float(frame_offset_y or 0))), emoji.strip() or "🖼️"),
        )
        self.conn.commit()
        row = self.get_cosmetic(frame_id)
        if not row:
            raise ValueError("Не удалось создать рамку")
        return row

    def create_achievement(self, campaign_id: int, master_tg_id: int, *, icon: str, icon_thumb: str = '', title: str, description: str, tag: str, cosmetic_reward_id: str | None = None, cosmetic_effect_reward_id: str | None = None, tag_reward_id: str | None = None, currency_reward: int = 0) -> dict[str, Any]:
        reward = str(cosmetic_reward_id or '').strip() or None
        effect_reward = str(cosmetic_effect_reward_id or '').strip() or None
        if reward and not self.get_cosmetic(reward):
            raise ValueError("Неизвестная рамка-награда")
        if effect_reward and not self.get_cosmetic_effect(effect_reward):
            raise ValueError("Неизвестный эффект-награда")
        tag_reward = str(tag_reward_id or '').strip() or None
        if tag_reward and not self.get_tag(tag_reward):
            raise ValueError("Неизвестный тэг-награда")
        cur = self.conn.execute(
            """
            INSERT INTO achievements(campaign_id, created_by_master_id, icon, icon_thumb, title, description, tag, cosmetic_reward_id, cosmetic_effect_reward_id, tag_reward_id, currency_reward, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (int(campaign_id), int(master_tg_id), (icon or '🏆').strip()[:300], (icon_thumb or '').strip()[:300], title.strip(), description.strip(), tag.strip() or 'Без тэга', reward, effect_reward, tag_reward, max(0, int(currency_reward or 0)), utc_now()),
        )
        self.conn.commit()
        return self.get_achievement(int(cur.lastrowid))  # type: ignore[return-value]

    def _hydrate_achievement(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        row = dict(row)
        reward_id = row.get("cosmetic_reward_id")
        row["cosmetic_reward"] = self.get_cosmetic(str(reward_id)) if reward_id else None
        effect_reward_id = row.get("cosmetic_effect_reward_id")
        row["cosmetic_effect_reward"] = self.get_cosmetic_effect(str(effect_reward_id)) if effect_reward_id else None
        tag_reward_id = row.get("tag_reward_id")
        row["tag_reward"] = self.get_tag(str(tag_reward_id)) if tag_reward_id else None
        row["currency_reward"] = int(row.get("currency_reward") or 0)
        return row

    def get_achievement(self, achievement_id: int) -> dict[str, Any] | None:
        return self._hydrate_achievement(self._one("SELECT * FROM achievements WHERE id=?", (int(achievement_id),)))

    def list_achievements(self, campaign_id: int | None = None) -> list[dict[str, Any]]:
        # Achievement library is global for this bot: all campaigns share templates.
        rows = self._many("SELECT * FROM achievements ORDER BY id DESC")
        return [a for a in (self._hydrate_achievement(r) for r in rows) if a]

    def delete_achievement(self, achievement_id: int, campaign_id: int | None = None) -> bool:
        ach = self.get_achievement(achievement_id)
        if not ach:
            return False
        if campaign_id is not None and int(ach.get("campaign_id") or 0) != int(campaign_id):
            return False
        grants = self._many("SELECT id FROM achievement_grants WHERE achievement_id=?", (int(achievement_id),))
        grant_ids = [int(g["id"]) for g in grants]
        if grant_ids:
            placeholders = ",".join("?" for _ in grant_ids)
            self.conn.execute(f"DELETE FROM user_cosmetic_unlocks WHERE source='achievement' AND source_id IN ({placeholders})", tuple(grant_ids))
            self.conn.execute(f"DELETE FROM user_effect_unlocks WHERE source='achievement' AND source_id IN ({placeholders})", tuple(grant_ids))
            self.conn.execute(f"DELETE FROM user_tag_unlocks WHERE source='achievement' AND source_id IN ({placeholders})", tuple(grant_ids))
        self.conn.execute("DELETE FROM achievement_grants WHERE achievement_id=?", (int(achievement_id),))
        self.conn.execute("DELETE FROM achievements WHERE id=?", (int(achievement_id),))
        self.conn.commit()
        return True

    def grant_achievement(self, achievement_id: int, character_id: int, master_tg_id: int, master_comment: str = '') -> dict[str, Any]:
        ach = self.get_achievement(achievement_id)
        ch = self.get_character(character_id)
        if not ach or not ch:
            raise ValueError("Достижение или персонаж не найдены")
        tg_id = ch.get("telegram_user_id")
        if not tg_id:
            raise ValueError("Персонаж не привязан к игроку")
        if int(ch["campaign_id"]) != int(ach["campaign_id"]):
            raise ValueError("Персонаж из другой кампании")
        cur = self.conn.execute(
            """
            INSERT INTO achievement_grants(achievement_id, telegram_user_id, campaign_id, character_id, given_by_master_id, master_comment, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(achievement_id, telegram_user_id) DO UPDATE SET
                character_id=excluded.character_id,
                given_by_master_id=excluded.given_by_master_id,
                master_comment=excluded.master_comment,
                created_at=excluded.created_at
            """,
            (int(achievement_id), int(tg_id), int(ach["campaign_id"]), int(character_id), int(master_tg_id), master_comment.strip(), utc_now()),
        )
        grant_id = int(cur.lastrowid or 0)
        self.conn.commit()
        grant = self.get_grant_by_achievement_user(int(achievement_id), int(tg_id))
        return grant or {"id": grant_id, "achievement": ach, "telegram_user_id": int(tg_id)}

    def open_achievement_grant(self, grant_id: int, telegram_user_id: int) -> dict[str, Any]:
        grant = self._one("SELECT * FROM achievement_grants WHERE id=? AND telegram_user_id=?", (int(grant_id), int(telegram_user_id)))
        if not grant:
            raise ValueError("Достижение не найдено")
        opened_at = ""
        if not str(grant.get("opened_at") or ""):
            opened_at = utc_now()
            self.conn.execute("UPDATE achievement_grants SET opened_at=? WHERE id=?", (opened_at, int(grant_id)))
            self.conn.commit()
            grant = self._one("SELECT * FROM achievement_grants WHERE id=?", (int(grant_id),)) or grant
        ach = self.get_achievement(int(grant["achievement_id"]))
        if ach:
            reward = ach.get("cosmetic_reward_id")
            if reward:
                self.unlock_cosmetic(int(telegram_user_id), str(reward), source='achievement', source_id=int(grant["id"]))
            effect_reward = ach.get("cosmetic_effect_reward_id")
            if effect_reward:
                self.unlock_cosmetic_effect(int(telegram_user_id), str(effect_reward), source='achievement', source_id=int(grant["id"]))
            tag_reward = ach.get("tag_reward_id")
            if tag_reward:
                self.unlock_tag(int(telegram_user_id), str(tag_reward), source='achievement', source_id=int(grant["id"]))
            currency_reward = int(ach.get("currency_reward") or 0)
            if currency_reward > 0:
                # Чтобы повторное открытие не дублировало валюту: начисляем только когда opened_at был пустым.
                if opened_at:
                    self.grant_currency_from_master(int(grant.get("given_by_master_id") or 0), int(telegram_user_id), currency_reward, campaign_id=int(grant.get("campaign_id") or 0), target_character_id=int(grant.get("character_id") or 0) if grant.get("character_id") else None, comment=f"Достижение: {ach.get('title')}", source='achievement', source_id=int(grant["id"]), created_by_tg_id=int(grant.get("given_by_master_id") or 0))
        return self._hydrate_grant(grant) or grant

    def get_grant_by_achievement_user(self, achievement_id: int, telegram_user_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM achievement_grants WHERE achievement_id=? AND telegram_user_id=?", (int(achievement_id), int(telegram_user_id)))
        return self._hydrate_grant(row)

    def _hydrate_grant(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        row = dict(row)
        row["achievement"] = self.get_achievement(int(row["achievement_id"]))
        row["character"] = self.get_character(int(row["character_id"])) if row.get("character_id") else None
        row["created_at_msk"] = msk_time(row.get("created_at", ""))
        return row

    def list_player_achievement_grants(self, telegram_user_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM achievement_grants WHERE telegram_user_id=? ORDER BY id DESC", (int(telegram_user_id),))
        return [g for g in (self._hydrate_grant(r) for r in rows) if g]

    def list_user_characters(self, telegram_user_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT id FROM characters WHERE telegram_user_id=? ORDER BY id DESC", (int(telegram_user_id),))
        return [ch for ch in (self.get_character(int(r["id"])) for r in rows) if ch]

    def list_user_campaigns(self, telegram_user_id: int) -> list[dict[str, Any]]:
        rows = self._many("""
            SELECT DISTINCT c.* FROM campaigns c
            JOIN characters ch ON ch.campaign_id = c.id
            WHERE ch.telegram_user_id=?
            ORDER BY c.id DESC
        """, (int(telegram_user_id),))
        return rows

    def get_user_profile(self, telegram_user_id: int) -> dict[str, Any]:
        characters = self.list_user_characters(int(telegram_user_id))
        grants = self.list_player_achievement_grants(int(telegram_user_id))
        campaigns = self.list_user_campaigns(int(telegram_user_id))
        main_char = characters[0] if characters else None
        return {
            "telegram_user_id": int(telegram_user_id),
            "main_character": main_char,
            "characters": characters,
            "campaigns": campaigns,
            "achievement_grants": grants,
            "currency_balance": self.get_currency_balance(int(telegram_user_id)),
            "currency_transactions": self.list_currency_transactions(int(telegram_user_id), 20),
            "unlocked_tag_ids": self.list_unlocked_tag_ids(int(telegram_user_id)),
        }

    # ---------- unique customization ----------
    def has_unique_customization(self, telegram_user_id: int) -> bool:
        row = self._one("SELECT unique_unlocked FROM user_customizations WHERE telegram_user_id=?", (int(telegram_user_id),))
        return bool(row and int(row.get("unique_unlocked") or 0))

    def unlock_unique_customization(self, telegram_user_id: int) -> None:
        self.conn.execute(
            """
            INSERT INTO user_customizations(telegram_user_id, unique_unlocked, updated_at)
            VALUES (?, 1, ?)
            ON CONFLICT(telegram_user_id) DO UPDATE SET unique_unlocked=1, updated_at=excluded.updated_at
            """,
            (int(telegram_user_id), utc_now()),
        )
        self.conn.commit()

    # ---------- requests ----------
    def _hydrate_request(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        row = dict(row)
        payload_raw = row.pop("payload_json", "{}") or "{}"
        try:
            row["payload"] = json.loads(payload_raw)
        except Exception:
            row["payload"] = {}
        row["character"] = self.get_character(int(row["character_id"]))
        return row

    def create_request(self, campaign_id: int, character_id: int, player_tg_id: int, request_type: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if self.get_any_open_request_by_player(campaign_id, player_tg_id):
            raise ValueError("У тебя уже есть активная заявка. Дождись решения мастера, прежде чем отправлять новую.")
        cur = self.conn.execute(
            "INSERT INTO requests(campaign_id, character_id, player_tg_id, request_type, status, payload_json, created_at) VALUES (?, ?, ?, ?, 'open', ?, ?)",
            (campaign_id, character_id, player_tg_id, request_type, json.dumps(payload or {}, ensure_ascii=False), utc_now()),
        )
        self.conn.commit()
        return self.get_request(int(cur.lastrowid))  # type: ignore[return-value]

    def get_request(self, request_id: int) -> dict[str, Any] | None:
        return self._hydrate_request(self._one("SELECT * FROM requests WHERE id=?", (request_id,)))

    def list_open_requests(self, campaign_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM requests WHERE campaign_id=? AND status='open' ORDER BY id DESC", (campaign_id,))
        return [r for r in (self._hydrate_request(row) for row in rows) if r]

    def get_open_request_by_player(self, campaign_id: int, player_tg_id: int) -> dict[str, Any] | None:
        row = self._one(
            "SELECT * FROM requests WHERE campaign_id=? AND player_tg_id=? AND status='open' ORDER BY id DESC LIMIT 1",
            (campaign_id, player_tg_id),
        )
        return self._hydrate_request(row)

    def get_open_inventory_request_by_player(self, campaign_id: int, player_tg_id: int) -> dict[str, Any] | None:
        row = self._one(
            "SELECT * FROM inventory_requests WHERE campaign_id=? AND player_tg_id=? AND status='open' ORDER BY id DESC LIMIT 1",
            (int(campaign_id), int(player_tg_id)),
        )
        if not row:
            return None
        row = dict(row)
        try:
            row["payload"] = json.loads(row.pop("payload_json") or "{}")
        except Exception:
            row["payload"] = {}
        row["source"] = "inventory"
        row["character"] = self.get_character(int(row["character_id"]))
        row["item"] = self.get_inventory_item(int(row["item_id"]))
        return row

    def get_any_open_request_by_player(self, campaign_id: int, player_tg_id: int) -> dict[str, Any] | None:
        regular = self.get_open_request_by_player(campaign_id, player_tg_id)
        if regular:
            regular["source"] = "character"
            return regular
        return self.get_open_inventory_request_by_player(campaign_id, player_tg_id)

    def close_request(self, request_id: int, status: str) -> None:
        self.conn.execute("UPDATE requests SET status=? WHERE id=?", (status, request_id))
        self.conn.commit()



    # ---------- tags, wallet and shop ----------
    def seed_tags(self) -> None:
        for item in TAG_LIBRARY:
            rarity = item.get("rarity", "common")
            price = default_price_for_item(item)
            purchasable = 1 if price is not None and item.get("category") != "unique" else 0
            self.conn.execute(
                """
                INSERT INTO cosmetic_tags(id, name, description, rarity, category, css_class, emoji, price, purchasable, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    rarity=excluded.rarity,
                    category=excluded.category,
                    css_class=excluded.css_class,
                    emoji=excluded.emoji,
                    price=excluded.price,
                    purchasable=excluded.purchasable,
                    sort_order=excluded.sort_order
                """,
                (item["id"], item["name"], item.get("description", ""), rarity, item.get("category", "base"), item.get("css_class", ""), item.get("emoji", ""), price, purchasable, int(item.get("sort_order", 0))),
            )
        self.conn.commit()

    def list_tags(self) -> list[dict[str, Any]]:
        return self._many("SELECT * FROM cosmetic_tags ORDER BY sort_order, name")

    def get_tag(self, tag_id: str) -> dict[str, Any] | None:
        if not tag_id or str(tag_id) == "tag_none":
            return None
        return self._one("SELECT * FROM cosmetic_tags WHERE id=?", (str(tag_id),))

    def create_custom_tag(self, *, tag_id: str, name: str, emoji: str = '', css_class: str = 'tag-custom-gold', description: str = '') -> dict[str, Any]:
        tag_id = str(tag_id).strip()
        if not tag_id:
            raise ValueError("Некорректный ID тэга")
        self.conn.execute(
            """
            INSERT INTO cosmetic_tags(id, name, description, rarity, category, css_class, emoji, price, purchasable, sort_order)
            VALUES (?, ?, ?, 'unique', 'tag_text', ?, ?, NULL, 0, 900)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                rarity='unique',
                category='tag_text',
                css_class=excluded.css_class,
                emoji=excluded.emoji,
                price=NULL,
                purchasable=0,
                sort_order=excluded.sort_order
            """,
            (tag_id, name.strip() or "Уникальный текст тэга", description.strip(), '', emoji.strip()[:8]),
        )
        self.conn.commit()
        row = self.get_tag(tag_id)
        if not row:
            raise ValueError("Не удалось создать тэг")
        return row

    def list_unlocked_tag_ids(self, telegram_user_id: int) -> list[str]:
        rows = self._many("SELECT tag_id FROM user_tag_unlocks WHERE telegram_user_id=?", (int(telegram_user_id),))
        return [str(r["tag_id"]) for r in rows]

    def has_tag_unlocked(self, telegram_user_id: int, tag_id: str) -> bool:
        if not tag_id or str(tag_id) == "tag_none":
            return True
        tag = self.get_tag(tag_id)
        if not tag:
            return False
        # Автоматически доступны только базовые системные варианты.
        # Магазинные common-тексты и common-формы всё равно покупаются/открываются через user_tag_unlocks.
        if str(tag.get("category") or "") == "base":
            return True
        row = self._one("SELECT 1 FROM user_tag_unlocks WHERE telegram_user_id=? AND tag_id=?", (int(telegram_user_id), str(tag_id)))
        return bool(row)

    def unlock_tag(self, telegram_user_id: int, tag_id: str, *, source: str = '', source_id: int | None = None) -> None:
        if not tag_id or str(tag_id) == "tag_none" or not self.get_tag(tag_id):
            return
        self.conn.execute(
            """
            INSERT INTO user_tag_unlocks(telegram_user_id, tag_id, source, source_id, unlocked_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(telegram_user_id, tag_id) DO NOTHING
            """,
            (int(telegram_user_id), str(tag_id), source, source_id, utc_now()),
        )
        self.conn.commit()

    def ensure_wallet(self, telegram_user_id: int) -> None:
        self.conn.execute(
            "INSERT INTO user_wallets(telegram_user_id, balance, updated_at) VALUES (?, 0, ?) ON CONFLICT(telegram_user_id) DO NOTHING",
            (int(telegram_user_id), utc_now()),
        )

    def get_currency_balance(self, telegram_user_id: int) -> int:
        self.ensure_wallet(int(telegram_user_id))
        row = self._one("SELECT balance FROM user_wallets WHERE telegram_user_id=?", (int(telegram_user_id),))
        return int(row["balance"] if row else 0)

    def add_currency(self, telegram_user_id: int, amount: int, *, reason: str = '', source: str = '', source_id: int | None = None) -> int:
        amount = int(amount)
        self.ensure_wallet(int(telegram_user_id))
        self.conn.execute("UPDATE user_wallets SET balance=MAX(0, balance + ?), updated_at=? WHERE telegram_user_id=?", (amount, utc_now(), int(telegram_user_id)))
        self.conn.execute("INSERT INTO currency_transactions(telegram_user_id, amount, reason, source, source_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", (int(telegram_user_id), amount, reason[:500], source, source_id, utc_now()))
        self.conn.commit()
        return self.get_currency_balance(int(telegram_user_id))

    def list_currency_transactions(self, telegram_user_id: int, limit: int = 20) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM currency_transactions WHERE telegram_user_id=? ORDER BY id DESC LIMIT ?", (int(telegram_user_id), int(limit)))
        for r in rows:
            r["created_at_msk"] = msk_time(r.get("created_at", ""))
        return rows

    def purchasable_info(self, item: dict[str, Any]) -> dict[str, Any]:
        item = dict(item)
        if item.get("price") is None:
            price = default_price_for_item(item)
            item["price"] = price
        if "purchasable" not in item or item.get("purchasable") is None:
            item["purchasable"] = 0 if str(item.get("rarity") or "") == "unique" else 1
        return item

    def purchase_cosmetic_item(self, telegram_user_id: int, item_type: str, item_id: str) -> dict[str, Any]:
        item_type = str(item_type)
        item_id = str(item_id)
        if item_type == "frame":
            item = self.get_cosmetic(item_id)
            if not item:
                raise ValueError("Рамка не найдена")
            if self.has_cosmetic_unlocked(int(telegram_user_id), item_id):
                return {"message": "Уже куплено", "balance": self.get_currency_balance(int(telegram_user_id))}
            unlock = lambda: self.unlock_cosmetic(int(telegram_user_id), item_id, source='shop', source_id=None)
        elif item_type == "effect":
            item = self.get_cosmetic_effect(item_id)
            if not item:
                raise ValueError("Эффект не найден")
            if self.has_effect_unlocked(int(telegram_user_id), item_id):
                return {"message": "Уже куплено", "balance": self.get_currency_balance(int(telegram_user_id))}
            unlock = lambda: self.unlock_cosmetic_effect(int(telegram_user_id), item_id, source='shop', source_id=None)
        elif item_type == "tag":
            item = self.get_tag(item_id)
            if not item:
                raise ValueError("Тэг не найден")
            if self.has_tag_unlocked(int(telegram_user_id), item_id):
                return {"message": "Уже куплено", "balance": self.get_currency_balance(int(telegram_user_id))}
            unlock = lambda: self.unlock_tag(int(telegram_user_id), item_id, source='shop', source_id=None)
        else:
            raise ValueError("Неизвестный тип товара")
        item = self.purchasable_info(item)
        rarity = str(item.get("rarity") or "common")
        if rarity == "unique" or not int(item.get("purchasable") or 0):
            raise ValueError("Уникальную косметику нельзя купить")
        price = int(item.get("price") or default_price_for_item(item) or 0)
        balance = self.get_currency_balance(int(telegram_user_id))
        if balance < price:
            raise ValueError(f"Недостаточно искр: не хватает {price - balance} ✦")
        self.add_currency(int(telegram_user_id), -price, reason=f"Покупка: {item.get('name')}", source='shop', source_id=None)
        unlock()
        return {"message": "Покупка выполнена", "balance": self.get_currency_balance(int(telegram_user_id))}



    # ---------- spark credit / master reserve ----------
    def ensure_master_spark_wallet(self, master_tg_id: int) -> None:
        self.conn.execute(
            "INSERT INTO master_spark_wallets(master_tg_id, balance, updated_at) VALUES (?, ?, ?) ON CONFLICT(master_tg_id) DO NOTHING",
            (int(master_tg_id), SPARK_CREDIT_DEFAULT, utc_now()),
        )

    def get_master_spark_balance(self, master_tg_id: int) -> int:
        self.ensure_master_spark_wallet(int(master_tg_id))
        row = self._one("SELECT balance FROM master_spark_wallets WHERE master_tg_id=?", (int(master_tg_id),))
        return int(row.get("balance") if row else SPARK_CREDIT_DEFAULT)

    def first_campaign_master_id(self) -> int | None:
        row = self._one("SELECT master_tg_id FROM campaigns ORDER BY id ASC LIMIT 1")
        return int(row["master_tg_id"]) if row else None

    def is_spark_admin(self, telegram_user_id: int, configured_admin_id: int = 0) -> bool:
        telegram_user_id = int(telegram_user_id)
        configured_admin_id = int(configured_admin_id or 0)
        if configured_admin_id:
            return telegram_user_id == configured_admin_id
        first_master = self.first_campaign_master_id()
        return bool(first_master and telegram_user_id == int(first_master))

    def list_master_spark_transactions(self, master_tg_id: int, limit: int = 50) -> list[dict[str, Any]]:
        rows = self._many(
            """
            SELECT t.*, ch.name AS target_character_name, c.name AS campaign_name
            FROM master_spark_transactions t
            LEFT JOIN characters ch ON ch.id=t.target_character_id
            LEFT JOIN campaigns c ON c.id=t.campaign_id
            WHERE t.master_tg_id=?
            ORDER BY t.id DESC
            LIMIT ?
            """,
            (int(master_tg_id), int(limit)),
        )
        for r in rows:
            r["created_at_msk"] = msk_time(r.get("created_at", ""))
        return rows

    def list_spark_masters(self, limit_history: int = 12) -> list[dict[str, Any]]:
        rows = self._many(
            """
            SELECT master_tg_id, COUNT(*) AS campaign_count, GROUP_CONCAT(name, ' · ') AS campaign_names, MIN(id) AS first_campaign_id
            FROM campaigns
            GROUP BY master_tg_id
            ORDER BY first_campaign_id ASC
            """
        )
        out: list[dict[str, Any]] = []
        for r in rows:
            master_id = int(r["master_tg_id"])
            self.ensure_master_spark_wallet(master_id)
            display_name = self.master_display_name(master_id)
            out.append({
                "master_tg_id": master_id,
                "display_name": display_name,
                "campaign_count": int(r.get("campaign_count") or 0),
                "campaign_names": str(r.get("campaign_names") or ""),
                "balance": self.get_master_spark_balance(master_id),
                "history": self.list_master_spark_transactions(master_id, limit_history),
            })
        return out

    def master_display_name(self, master_tg_id: int) -> str:
        row = self._one(
            """
            SELECT ch.name AS character_name, c.name AS campaign_name
            FROM characters ch
            LEFT JOIN campaigns c ON c.id=ch.campaign_id
            WHERE ch.telegram_user_id=?
            ORDER BY ch.id DESC LIMIT 1
            """,
            (int(master_tg_id),),
        )
        if row and row.get("character_name"):
            return f"{row['character_name']} · TG {int(master_tg_id)}"
        return f"Мастер TG {int(master_tg_id)}"

    def spark_management_state(self, master_tg_id: int, *, is_admin: bool = False) -> dict[str, Any]:
        master_tg_id = int(master_tg_id)
        return {
            "balance": self.get_master_spark_balance(master_tg_id),
            "history": self.list_master_spark_transactions(master_tg_id, 30),
            "is_admin": bool(is_admin),
            "masters": self.list_spark_masters(12) if is_admin else [],
        }

    def grant_currency_from_master(self, master_tg_id: int, target_tg_id: int, amount: int, *, campaign_id: int | None = None, target_character_id: int | None = None, comment: str = '', source: str = 'master', source_id: int | None = None, created_by_tg_id: int | None = None) -> int:
        master_tg_id = int(master_tg_id)
        target_tg_id = int(target_tg_id)
        amount = int(amount)
        if amount == 0:
            raise ValueError("Количество искр не может быть нулевым")
        self.ensure_master_spark_wallet(master_tg_id)
        current = self.get_master_spark_balance(master_tg_id)
        if amount > 0:
            reserve_delta = -amount
            if current < amount:
                raise ValueError(f"Недостаточно искр в запасе мастера: не хватает {amount - current} ✦")
            kind = "grant"
        else:
            reserve_delta = abs(amount)
            kind = "revoke"
        new_reserve = max(0, current + reserve_delta)
        self.conn.execute("UPDATE master_spark_wallets SET balance=?, updated_at=? WHERE master_tg_id=?", (new_reserve, utc_now(), master_tg_id))
        player_balance = self.add_currency(target_tg_id, amount, reason=comment or ("Выдано мастером" if amount > 0 else "Корректировка мастером"), source=source, source_id=source_id)
        self.conn.execute(
            """
            INSERT INTO master_spark_transactions(master_tg_id, target_tg_id, target_character_id, campaign_id, amount, reserve_delta, reserve_after, kind, comment, source, source_id, created_by_tg_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (master_tg_id, target_tg_id, target_character_id, campaign_id, amount, reserve_delta, new_reserve, kind, (comment or '')[:500], source, source_id, int(created_by_tg_id or master_tg_id), utc_now()),
        )
        self.conn.commit()
        return player_balance

    def top_up_master_sparks(self, master_tg_id: int, amount: int, *, comment: str = '', created_by_tg_id: int | None = None) -> int:
        master_tg_id = int(master_tg_id)
        amount = int(amount)
        if amount <= 0:
            raise ValueError("Пополнение должно быть положительным")
        self.ensure_master_spark_wallet(master_tg_id)
        current = self.get_master_spark_balance(master_tg_id)
        new_balance = current + amount
        self.conn.execute("UPDATE master_spark_wallets SET balance=?, updated_at=? WHERE master_tg_id=?", (new_balance, utc_now(), master_tg_id))
        self.conn.execute(
            """
            INSERT INTO master_spark_transactions(master_tg_id, amount, reserve_delta, reserve_after, kind, comment, source, created_by_tg_id, created_at)
            VALUES (?, ?, ?, ?, 'topup', ?, 'admin_topup', ?, ?)
            """,
            (master_tg_id, amount, amount, new_balance, (comment or '')[:500], int(created_by_tg_id or master_tg_id), utc_now()),
        )
        self.conn.commit()
        return new_balance

    # ---------- maps ----------
    def create_map(self, campaign_id: int, name: str, image_path: str, thumb_path: str = '') -> dict[str, Any]:
        cur = self.conn.execute(
            "INSERT INTO campaign_maps(campaign_id, name, image_path, thumb_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (int(campaign_id), name.strip() or 'Карта', image_path, thumb_path, int(datetime.now(timezone.utc).timestamp()), utc_now()),
        )
        self.conn.commit()
        return self.get_map(int(cur.lastrowid))

    def get_map(self, map_id: int) -> dict[str, Any] | None:
        return self._one("SELECT * FROM campaign_maps WHERE id=?", (int(map_id),))

    def list_maps(self, campaign_id: int) -> list[dict[str, Any]]:
        return self._many("SELECT * FROM campaign_maps WHERE campaign_id=? ORDER BY sort_order DESC, id DESC", (int(campaign_id),))

    def delete_map(self, map_id: int, campaign_id: int) -> None:
        self.conn.execute("DELETE FROM campaign_maps WHERE id=? AND campaign_id=?", (int(map_id), int(campaign_id)))
        self.conn.commit()

    def add_map_ping(self, campaign_id: int, map_id: int, telegram_user_id: int, *, character_id: int | None, x: float, y: float, color: str, label: str = '', is_master: bool = False, ttl_seconds: int = 8) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        expires = now + timedelta(seconds=max(3, min(30, int(ttl_seconds))))
        cur = self.conn.execute(
            """
            INSERT INTO map_pings(campaign_id, map_id, telegram_user_id, character_id, x, y, color, label, is_master, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (int(campaign_id), int(map_id), int(telegram_user_id), character_id, max(0, min(100, float(x))), max(0, min(100, float(y))), normalize_color(color), label[:80], int(is_master), now.isoformat(timespec='seconds'), expires.isoformat(timespec='seconds')),
        )
        self.conn.commit()
        return self._one("SELECT * FROM map_pings WHERE id=?", (int(cur.lastrowid),))

    def list_active_pings(self, campaign_id: int, map_id: int | None = None) -> list[dict[str, Any]]:
        now = utc_now()
        if map_id:
            rows = self._many("SELECT * FROM map_pings WHERE campaign_id=? AND map_id=? AND expires_at>? ORDER BY id DESC LIMIT 50", (int(campaign_id), int(map_id), now))
        else:
            rows = self._many("SELECT * FROM map_pings WHERE campaign_id=? AND expires_at>? ORDER BY id DESC LIMIT 50", (int(campaign_id), now))
        for r in rows:
            r['is_master'] = bool(r.get('is_master'))
        return rows

    # ---------- inventory ----------
    def _hydrate_inventory_item(self, row: dict[str, Any]) -> dict[str, Any]:
        row = dict(row)
        row['quantity'] = int(row.get('quantity') or 1)
        row['reload_type'] = str(row.get('reload_type') or 'magazine')
        row['fire_modes'] = self._many("SELECT * FROM weapon_fire_modes WHERE item_id=? ORDER BY sort_order, id", (int(row['id']),)) if row.get('item_type') == 'weapon' else []
        row['magazines'] = self._many("SELECT * FROM weapon_magazines WHERE item_id=? ORDER BY sort_order, id", (int(row['id']),)) if row.get('item_type') == 'weapon' else []
        row['active_magazine'] = None
        if row.get('active_magazine_id'):
            row['active_magazine'] = self._one("SELECT * FROM weapon_magazines WHERE id=?", (int(row['active_magazine_id']),))
        row['shell_stocks'] = self._many("SELECT * FROM weapon_shell_stocks WHERE item_id=? ORDER BY sort_order, id", (int(row['id']),)) if row.get('item_type') == 'weapon' else []
        row['loaded_shells'] = self._many("SELECT * FROM weapon_loaded_shells WHERE item_id=? ORDER BY sort_order, id", (int(row['id']),)) if row.get('item_type') == 'weapon' else []
        return row

    def list_inventory(self, character_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM inventory_items WHERE character_id=? ORDER BY id DESC", (int(character_id),))
        return [self._hydrate_inventory_item(r) for r in rows]

    def get_inventory_item(self, item_id: int) -> dict[str, Any] | None:
        row = self._one("SELECT * FROM inventory_items WHERE id=?", (int(item_id),))
        return self._hydrate_inventory_item(row) if row else None

    def _default_fire_modes(self, weapon_type: str, reload_type: str, ammo_per_attack: int) -> list[dict[str, Any]]:
        wt = str(weapon_type or '').lower()
        cost = max(1, int(ammo_per_attack or 1))
        if reload_type == 'shell':
            return [{"name": "Один выстрел", "ammo_cost": 1}, {"name": "Двойной выстрел", "ammo_cost": 2}]
        if 'автомат' in wt:
            return [{"name": "Одиночный", "ammo_cost": 1}, {"name": "Очередь", "ammo_cost": cost or 6}]
        if 'пп' in wt:
            return [{"name": "Короткая очередь", "ammo_cost": min(cost, 6) or 6}, {"name": "Длинная очередь", "ammo_cost": max(cost, 12)}]
        return [{"name": "Выстрел", "ammo_cost": cost}]

    def create_inventory_item(self, character_id: int, *, name: str, description: str = '', emoji: str = '', quantity: int = 1, item_type: str = 'normal', weapon_type: str = '', reload_type: str = 'magazine', mag_capacity: int = 0, ammo_per_attack: int = 0, magazine_count: int = 0, fire_modes: list[dict[str, Any]] | None = None, magazines: list[dict[str, Any]] | None = None, shell_stocks: list[dict[str, Any]] | None = None, loaded_count: int = 0) -> dict[str, Any]:
        now = utc_now()
        reload_type = 'shell' if str(reload_type).lower() in ('shell', 'shotgun', 'internal', 'поштучная') else 'magazine'
        cur = self.conn.execute(
            """
            INSERT INTO inventory_items(character_id, item_type, name, description, emoji, quantity, weapon_type, reload_type, mag_capacity, ammo_per_attack, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (int(character_id), item_type, name.strip()[:100], description.strip()[:1000], emoji.strip()[:8], max(1, int(quantity or 1)), weapon_type[:40], reload_type, max(0, int(mag_capacity or 0)), max(0, int(ammo_per_attack or 0)), now, now),
        )
        item_id = int(cur.lastrowid)
        if item_type == 'weapon':
            modes = fire_modes or self._default_fire_modes(weapon_type, reload_type, ammo_per_attack)
            for i, fm in enumerate(modes[:8]):
                fname = str(fm.get('name') or f'Режим {i+1}').strip()[:80]
                fcost = max(1, int(fm.get('ammo_cost') or 1))
                fdesc = str(fm.get('description') or '').strip()[:300]
                self.conn.execute("INSERT INTO weapon_fire_modes(item_id, name, ammo_cost, description, sort_order) VALUES (?, ?, ?, ?, ?)", (item_id, fname, fcost, fdesc, i))
            if reload_type == 'magazine':
                # v43: оружие создаётся без магазинов, если фронтенд передал пустой список.
                # Магазины игрок добавляет потом прямо из карточки оружия.
                mags = magazines if magazines is not None else []
                active_id = None
                for i, m in enumerate(mags[:16]):
                    max_ammo = max(1, int(m.get('ammo_max') or m.get('capacity') or mag_capacity or 1))
                    cur_ammo = max(0, min(max_ammo, int(m.get('ammo_current', max_ammo) if m.get('ammo_current') is not None else max_ammo)))
                    mcur = self.conn.execute("""
                        INSERT INTO weapon_magazines(item_id, name, ammo_current, ammo_max, ammo_type, description, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (item_id, str(m.get('name') or f"Магазин {i+1}")[:80], cur_ammo, max_ammo, str(m.get('ammo_type') or 'обычные')[:80], str(m.get('description') or '')[:300], i))
                    if active_id is None:
                        active_id = int(mcur.lastrowid)
                if active_id is not None:
                    self.conn.execute("UPDATE inventory_items SET active_magazine_id=? WHERE id=?", (active_id, item_id))
            else:
                max_loaded = max(1, int(mag_capacity or 2))
                # v43: поштучное оружие тоже создаётся пустым; стопки патронов добавляются отдельно.
                stocks = shell_stocks if shell_stocks is not None else []
                for i, st in enumerate(stocks[:16]):
                    self.conn.execute("""
                        INSERT INTO weapon_shell_stocks(item_id, ammo_type, quantity, description, emoji, sort_order)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (item_id, str(st.get('ammo_type') or 'стандартная дробь')[:80], max(0, int(st.get('quantity') or 0)), str(st.get('description') or '')[:300], str(st.get('emoji') or '')[:8], i))
                first = stocks[0] if stocks else {"ammo_type":"стандартная дробь", "description":"", "emoji":"⚪"}
                count = max(0, min(max_loaded, int(loaded_count or 0)))
                for i in range(count):
                    self.conn.execute("""
                        INSERT INTO weapon_loaded_shells(item_id, ammo_type, description, emoji, sort_order)
                        VALUES (?, ?, ?, ?, ?)
                    """, (item_id, str(first.get('ammo_type') or 'стандартная дробь')[:80], str(first.get('description') or '')[:300], str(first.get('emoji') or '')[:8], i))
        self.conn.commit()
        return self.get_inventory_item(item_id)

    def update_inventory_item(self, item_id: int, **fields: Any) -> dict[str, Any]:
        allowed = {'name','description','emoji','quantity','weapon_type','mag_capacity','ammo_per_attack','active_magazine_id','reload_type'}
        data = {k:v for k,v in fields.items() if k in allowed}
        if not data:
            return self.get_inventory_item(item_id)
        data['updated_at'] = utc_now()
        cols_sql = ', '.join(f"{k}=?" for k in data)
        self.conn.execute(f"UPDATE inventory_items SET {cols_sql} WHERE id=?", tuple(data.values()) + (int(item_id),))
        self.conn.commit()
        return self.get_inventory_item(item_id)

    def delete_inventory_item(self, item_id: int) -> None:
        self.conn.execute("DELETE FROM inventory_items WHERE id=?", (int(item_id),))
        self.conn.commit()

    def add_weapon_magazine(self, item_id: int, *, name: str = '', ammo_current: int = 0, ammo_max: int = 1, ammo_type: str = 'обычные', description: str = '') -> dict[str, Any]:
        max_ammo = max(1, int(ammo_max or 1))
        cur_ammo = max(0, min(max_ammo, int(ammo_current if ammo_current is not None else max_ammo)))
        order = int((self._one("SELECT COALESCE(MAX(sort_order), -1)+1 AS n FROM weapon_magazines WHERE item_id=?", (int(item_id),)) or {}).get('n') or 0)
        cur = self.conn.execute("""
            INSERT INTO weapon_magazines(item_id, name, ammo_current, ammo_max, ammo_type, description, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (int(item_id), name.strip()[:80] or f"Магазин {order+1}", cur_ammo, max_ammo, ammo_type.strip()[:80] or 'обычные', description.strip()[:300], order))
        mag_id = int(cur.lastrowid)
        item = self._one("SELECT active_magazine_id FROM inventory_items WHERE id=?", (int(item_id),)) or {}
        if not item.get('active_magazine_id'):
            self.conn.execute("UPDATE inventory_items SET active_magazine_id=?, updated_at=? WHERE id=?", (mag_id, utc_now(), int(item_id)))
        self.conn.commit()
        return self._one("SELECT * FROM weapon_magazines WHERE id=?", (mag_id,))

    def add_weapon_shell_stock(self, item_id: int, *, ammo_type: str = 'стандартные', quantity: int = 0, emoji: str = '', description: str = '') -> dict[str, Any]:
        qty = max(0, int(quantity or 0))
        order = int((self._one("SELECT COALESCE(MAX(sort_order), -1)+1 AS n FROM weapon_shell_stocks WHERE item_id=?", (int(item_id),)) or {}).get('n') or 0)
        cur = self.conn.execute("""
            INSERT INTO weapon_shell_stocks(item_id, ammo_type, quantity, description, emoji, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (int(item_id), str(ammo_type or 'стандартные').strip()[:80], qty, str(description or '').strip()[:300], str(emoji or '').strip()[:8], order))
        self.conn.commit()
        return self._one("SELECT * FROM weapon_shell_stocks WHERE id=?", (int(cur.lastrowid),))

    def weapon_fire(self, item_id: int, fire_mode_id: int | None = None) -> dict[str, Any]:
        item = self.get_inventory_item(item_id)
        if not item or item.get('item_type') != 'weapon':
            raise ValueError('Оружие не найдено')
        mode = None
        modes = item.get('fire_modes') or []
        if fire_mode_id:
            mode = next((m for m in modes if int(m['id']) == int(fire_mode_id)), None)
        if not mode:
            mode = modes[0] if modes else {'name':'Выстрел', 'ammo_cost': max(1, int(item.get('ammo_per_attack') or 1))}
        cost = max(1, int(mode.get('ammo_cost') or 1))
        fired = []
        before = {}
        after = {}
        if item.get('reload_type') == 'shell':
            loaded = item.get('loaded_shells') or []
            if not loaded:
                raise ValueError('Оружие не заряжено')
            used = loaded[:min(cost, len(loaded))]
            for sh in used:
                fired.append(str(sh.get('ammo_type') or 'заряд'))
                self.conn.execute("DELETE FROM weapon_loaded_shells WHERE id=?", (int(sh['id']),))
            before = {'loaded': len(loaded)}
            after = {'loaded': max(0, len(loaded) - len(used))}
        else:
            mag = item.get('active_magazine')
            if not mag:
                raise ValueError('Нет активного магазина')
            cur_ammo = int(mag.get('ammo_current') or 0)
            if cur_ammo <= 0:
                raise ValueError('Магазин пуст')
            used = min(cost, cur_ammo)
            self.conn.execute("UPDATE weapon_magazines SET ammo_current=? WHERE id=?", (cur_ammo - used, int(mag['id'])))
            fired = [str(mag.get('ammo_type') or 'обычные')] * used
            before = {'magazine_id': int(mag['id']), 'ammo': cur_ammo, 'ammo_max': int(mag.get('ammo_max') or 0), 'ammo_type': mag.get('ammo_type')}
            after = {'magazine_id': int(mag['id']), 'ammo': cur_ammo - used, 'ammo_max': int(mag.get('ammo_max') or 0), 'ammo_type': mag.get('ammo_type')}
        self.conn.commit()
        return {'item': self.get_inventory_item(item_id), 'fire_log': {'weapon': item.get('name'), 'mode': mode.get('name'), 'requested': cost, 'spent': len(fired), 'ammo_types': fired, 'before': before, 'after': after}}

    def create_inventory_request(self, campaign_id: int, character_id: int, item_id: int, player_tg_id: int, request_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        if self.get_any_open_request_by_player(campaign_id, player_tg_id):
            raise ValueError("У тебя уже есть активная заявка. Дождись решения мастера, прежде чем отправлять новую.")
        cur = self.conn.execute(
            "INSERT INTO inventory_requests(campaign_id, character_id, item_id, player_tg_id, request_type, payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)",
            (int(campaign_id), int(character_id), int(item_id), int(player_tg_id), request_type, json.dumps(payload, ensure_ascii=False), utc_now()),
        )
        self.conn.commit()
        return self.get_inventory_request(int(cur.lastrowid))

    def get_inventory_request(self, request_id: int) -> dict[str, Any] | None:
        r = self._one("SELECT * FROM inventory_requests WHERE id=?", (int(request_id),))
        if r:
            r['payload'] = json.loads(r.pop('payload_json') or '{}')
        return r

    def list_inventory_requests(self, campaign_id: int) -> list[dict[str, Any]]:
        rows = self._many("SELECT * FROM inventory_requests WHERE campaign_id=? AND status='open' ORDER BY id DESC", (int(campaign_id),))
        out=[]
        for r in rows:
            r['payload'] = json.loads(r.pop('payload_json') or '{}')
            r['character'] = self.get_character(int(r['character_id']))
            r['item'] = self.get_inventory_item(int(r['item_id']))
            out.append(r)
        return out

    def decide_inventory_request(self, request_id: int, approve: bool) -> dict[str, Any]:
        req = self.get_inventory_request(request_id)
        if not req or req.get('status') != 'open':
            raise ValueError('Заявка не найдена')
        if approve:
            payload = req.get('payload') or {}
            item = self.get_inventory_item(int(req['item_id']))
            if req['request_type'] == 'reload_weapon' and item:
                new_mag_id = int(payload.get('magazine_id') or 0)
                if new_mag_id:
                    self.update_inventory_item(int(item['id']), active_magazine_id=new_mag_id)
            elif req['request_type'] == 'refill_magazine':
                mag_id = int(payload.get('magazine_id') or 0)
                amount = payload.get('amount')
                mag = self._one("SELECT * FROM weapon_magazines WHERE id=?", (mag_id,))
                if mag:
                    target = int(mag['ammo_max']) if amount is None else min(int(mag['ammo_max']), int(mag['ammo_current']) + max(0, int(amount)))
                    self.conn.execute("UPDATE weapon_magazines SET ammo_current=? WHERE id=?", (target, mag_id))
            elif req['request_type'] == 'load_shells' and item:
                stock_id = int(payload.get('stock_id') or 0)
                count = max(1, int(payload.get('count') or 1))
                stock = self._one("SELECT * FROM weapon_shell_stocks WHERE id=? AND item_id=?", (stock_id, int(item['id'])))
                max_loaded = max(1, int(item.get('mag_capacity') or 1))
                loaded_count = len(item.get('loaded_shells') or [])
                can_load = max(0, min(count, max_loaded - loaded_count, int(stock.get('quantity') or 0) if stock else 0))
                if stock and can_load:
                    order_start = int((self._one("SELECT COALESCE(MAX(sort_order), -1)+1 AS n FROM weapon_loaded_shells WHERE item_id=?", (int(item['id']),)) or {}).get('n') or 0)
                    for i in range(can_load):
                        self.conn.execute("INSERT INTO weapon_loaded_shells(item_id, ammo_type, description, emoji, sort_order) VALUES (?, ?, ?, ?, ?)", (int(item['id']), stock.get('ammo_type') or 'заряд', stock.get('description') or '', stock.get('emoji') or '', order_start+i))
                    self.conn.execute("UPDATE weapon_shell_stocks SET quantity=quantity-? WHERE id=?", (can_load, stock_id))
            elif req['request_type'] == 'refill_shell_stock' and item:
                stock_id = int(payload.get('stock_id') or 0)
                amount = max(1, int(payload.get('amount') or 1))
                self.conn.execute("UPDATE weapon_shell_stocks SET quantity=quantity+? WHERE id=? AND item_id=?", (amount, stock_id, int(item['id'])))
        if approve:
            item_after = self.get_inventory_item(int(req['item_id']))
            if item_after:
                self.conn.execute("UPDATE inventory_items SET updated_at=? WHERE id=?", (utc_now(), int(req['item_id'])))
        self.conn.execute("UPDATE inventory_requests SET status=? WHERE id=?", ('approved' if approve else 'declined', int(request_id)))
        self.conn.commit()
        return self.get_inventory_request(request_id) or req

    def delete_campaign(self, campaign_id: int) -> None:
        self.conn.execute("DELETE FROM campaigns WHERE id=?", (campaign_id,))
        self.conn.commit()
