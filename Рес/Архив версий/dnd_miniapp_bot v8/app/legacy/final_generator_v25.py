#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mood Cocktail Engine v0.2 (mood durations v1) (Dark Fantasy, D&D 5e-ish)
----------------------------------------------------
- Чем выше мораль, тем чаще GOOD/EXCELLENT; чем ниже — тем чаще BAD/AWFUL.
- n (накопление проверок) ухудшает расклад и чаще даёт больше эффектов.
- Можно смешивать категории: бой/социалка/исследование (в любом сочетании).
- Социальные эффекты часто имеют "последствие после данжа" + два пути: "поддаться" или "сопротивляться".
- Цветной вывод (ANSI).

Запуск:
  python mood_cocktail_engine.py
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional, Sequence
import random
import math
import re

TIERS = ("EXCELLENT", "GOOD", "NEUTRAL", "BAD", "AWFUL")
CATEGORIES = ("combat", "social", "exploration")

# ----------------------------- ANSI colors -----------------------------
ANSI = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "excellent": "\033[92m",   # bright green
    "good": "\033[32m",        # green
    "neutral": "\033[33m",     # yellow
    "bad": "\033[31m",         # red
    "awful": "\033[35m",       # magenta
    "combat": "\033[36m",      # cyan
    "social": "\033[34m",      # blue
    "exploration": "\033[90m", # gray
}

def color(text: str, key: str) -> str:
    return f"{ANSI.get(key,'')}{text}{ANSI['reset']}"

TIER_COLOR = {
    "EXCELLENT": "excellent",
    "GOOD": "good",
    "NEUTRAL": "neutral",
    "BAD": "bad",
    "AWFUL": "awful",
}

CAT_COLOR = {
    "combat": "combat",
    "social": "social",
    "exploration": "exploration",
}

# ----------------------------- Dice utils -----------------------------
_DICE_RE = re.compile(r'^\s*(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$', re.IGNORECASE)

def roll_dice(rng: random.Random, expr: str) -> int:
    """Supports: X, AdB, AdB+X, AdB-X"""
    expr = expr.strip().lower().replace(" ", "")
    if expr.isdigit() or (expr.startswith("-") and expr[1:].isdigit()):
        return int(expr)
    m = _DICE_RE.match(expr)
    if not m:
        raise ValueError(f"Bad dice expression: {expr!r}")
    a = int(m.group(1))
    b = int(m.group(2))
    mod = m.group(3)
    mod_v = int(mod.replace(" ", "")) if mod else 0
    return sum(rng.randint(1, b) for _ in range(a)) + mod_v

def clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x

def weighted_choice(rng: random.Random, items: Sequence[Tuple[str, float]]) -> str:
    total = sum(w for _, w in items)
    if total <= 0:
        raise ValueError("Total weight <= 0")
    r = rng.random() * total
    acc = 0.0
    for item, w in items:
        acc += w
        if r <= acc:
            return item
    return items[-1][0]

# ----------------------------- Phase (pacing) -----------------------------
PHASES: List[Tuple[str, int, int]] = [
    ("100–85 Воодушевление", 85, 100),
    ("84–70 Уверенность", 70, 84),
    ("69–55 Равновесие", 55, 69),
    ("54–40 Напряжение", 40, 54),
    ("39–25 Тревога", 25, 39),
    ("24–10 Упадок", 10, 24),
    ("9–0  Критическая фаза", 0, 9),
]

def get_phase(morale: int) -> Tuple[str, int, int]:
    for name, lo, hi in PHASES:
        if lo <= morale <= hi:
            return (name, lo, hi)
    return ("69–55 Равновесие", 55, 69)

# ----------------------------- Tier logic (monotonic) -----------------------------
def tier_weights(morale: int, n: int, phase_name: str) -> Dict[str, float]:
    morale = int(clamp(morale, 0, 100))
    n = max(0, int(n))

    m = (morale - 50) / 50.0          # [-1..1]
    fatigue = clamp(n / 10.0, 0.0, 2.0)
    eff = clamp(m - 0.25 * fatigue, -1.2, 1.2)

    pos = max(0.0, eff)
    neg = max(0.0, -eff)

    p_ex = clamp(0.03 + 0.14 * pos, 0.02, 0.22)
    p_gd = clamp(0.18 + 0.52 * pos + 0.06 * (1 - abs(eff)), 0.10, 0.70)
    p_aw = clamp(0.03 + 0.14 * neg + 0.02 * fatigue, 0.02, 0.40)
    p_bd = clamp(0.18 + 0.52 * neg + 0.06 * (1 - abs(eff)) + 0.03 * fatigue, 0.10, 0.75)

    p_nt = 1.0 - (p_ex + p_gd + p_bd + p_aw)
    p_nt = clamp(p_nt, 0.06, 0.40)

    s = p_ex + p_gd + p_nt + p_bd + p_aw
    w = {"EXCELLENT": p_ex/s, "GOOD": p_gd/s, "NEUTRAL": p_nt/s, "BAD": p_bd/s, "AWFUL": p_aw/s}

    if phase_name.startswith("9–0"):
        w["AWFUL"] *= 1.20
        w["BAD"] *= 1.10
    elif phase_name.startswith("100–85") or phase_name.startswith("84–70"):
        w["AWFUL"] *= 0.85
        w["BAD"] *= 0.92

    for k in w:
        w[k] = max(0.001, w[k])
    s2 = sum(w.values())
    for k in w:
        w[k] /= s2
    return w

def count_distribution(morale: int, n: int, phase_name: str) -> Dict[int, float]:
    morale = int(clamp(morale, 0, 100))
    n = max(0, int(n))
    fatigue = clamp(n / 10.0, 0.0, 2.0)
    m = (morale - 50) / 50.0
    stress = clamp(0.5 + 0.5 * (-m) + 0.35 * fatigue, 0.0, 1.5)

    if phase_name.startswith("100–85"):
        base = {0: 0.14, 1: 0.46, 2: 0.30, 3: 0.10}
    elif phase_name.startswith("84–70"):
        base = {0: 0.12, 1: 0.42, 2: 0.32, 3: 0.12, 4: 0.02}
    elif phase_name.startswith("69–55"):
        base = {0: 0.10, 1: 0.38, 2: 0.34, 3: 0.15, 4: 0.03}
    elif phase_name.startswith("54–40"):
        base = {0: 0.08, 1: 0.32, 2: 0.36, 3: 0.18, 4: 0.06}
    elif phase_name.startswith("39–25"):
        base = {0: 0.06, 1: 0.26, 2: 0.36, 3: 0.22, 4: 0.10}
    elif phase_name.startswith("24–10"):
        base = {0: 0.05, 1: 0.20, 2: 0.34, 3: 0.26, 4: 0.15}
    else:
        base = {0: 0.04, 1: 0.14, 2: 0.30, 3: 0.28, 4: 0.24}

    shift = clamp(0.12 * stress, 0.0, 0.20)
    d = dict(base)
    take0 = min(d.get(0, 0.0), shift * 0.55)
    take1 = min(d.get(1, 0.0), shift * 0.45)
    d[0] -= take0
    d[1] -= take1
    gained = take0 + take1
    if 4 in d:
        d[2] += gained * 0.45
        d[3] += gained * 0.35
        d[4] += gained * 0.20
    else:
        d[2] += gained * 0.55
        d[3] += gained * 0.45
    s = sum(d.values())
    for k in d:
        d[k] = max(0.0, d[k]) / s
    return d


# ----------------------------- Duration adjustment (fatigue accumulation n) -----------------------------
POS_TIERS = {"GOOD", "EXCELLENT"}
NEG_TIERS = {"BAD", "AWFUL"}

def adjust_duration_by_n(base: int, tier: str, category: str, n: int) -> int:
    """
    Make durations respond to fatigue accumulation (n):
      - As n grows: bad/awful last longer; good/excellent last shorter.
      - Social bad/awful can linger a bit more than combat.
    Also pushes extremes:
      - EXCELLENT slightly better (longer baseline).
      - BAD/AWFUL noticeably worse (longer baseline).
    """
    base = int(base)
    if base <= 0:
        return 0

    tier = (tier or "NEUTRAL").upper()
    category = (category or "").lower()
    n = max(0, int(n))

    # Baseline multipliers (extremes)
    baseline = 1.0
    if tier == "EXCELLENT":
        baseline = 1.40
    elif tier == "GOOD":
        baseline = 1.00
    elif tier == "BAD":
        baseline = 1.40
    elif tier == "AWFUL":
        baseline = 2.00

    # Accumulation effect
    if tier in POS_TIERS:
        # Good things fade faster the deeper you go
        k = 0.05  # per check
        # Social/exploration buffs are even more fleeting
        if category in ("social", "exploration"):
            k = 0.06
        factor = max(0.35, 1.0 - k * n)
    elif tier in NEG_TIERS:
        # Bad things cling longer under stress
        k = 0.08
        if category == "social":
            k = 0.10
        elif category == "exploration":
            k = 0.09
        factor = min(3.0, 1.0 + k * n)
    else:
        factor = 1.0

    val = int(math.ceil(base * baseline * factor))
    return max(1, val)


# ----------------------------- Tier rebalance (make extremes feel extreme) -----------------------------
DIE_UP_1 = {"d4":"d6","d6":"d8","d8":"d10","d10":"d12","d12":"d12"}
DIE_UP_2 = {"d4":"d8","d6":"d10","d8":"d12","d10":"d12","d12":"d12"}

def _bump_signed_numbers(text: str, delta_pos: int, delta_neg: int, cap_pos: int = 6, cap_neg: int = 6) -> str:
    """
    Adjust occurrences like '+1' or '-2' in rules text.
    delta_pos increases bonuses; delta_neg increases penalties magnitude.
    """
    def repl(m):
        sign = m.group(1)
        num = int(m.group(2))
        if sign == "+":
            num2 = min(cap_pos, num + delta_pos)
            return f"+{num2}"
        else:
            num2 = min(cap_neg, num + delta_neg)
            return f"-{num2}"
    return re.sub(r'([+-])(\d+)', repl, text)

def _bump_dc(text: str, delta: int, cap: int = 20) -> str:
    def repl(m):
        n = int(m.group(1))
        return f"КС {min(cap, n + delta)}"
    return re.sub(r"\bКС\s*(\d+)\b", repl, text)

def _upgrade_dice_in_text(text: str, upmap: dict) -> str:
    # Replace die sizes (d4/d6/...) but keep counts
    def repl(m):
        die = m.group(2)
        return m.group(1) + upmap.get(die, die)
    return re.sub(r"(\d+d)(4|6|8|10|12)\b", repl, text)

def rebalance_effect_text(text: str, tier: str) -> str:
    """
    Make tiers match intended feel:
      EXCELLENT: truly strong.
      GOOD: pleasant.
      NEUTRAL: meh.
      BAD: harsh.
      AWFUL: devastating.
    We do this with conservative, systematic tweaks (numbers/КС/dice), without rewriting every effect by hand.
    """
    t = (tier or "NEUTRAL").upper()
    if t == "EXCELLENT":
        text = _bump_signed_numbers(text, delta_pos=1, delta_neg=0, cap_pos=7, cap_neg=7)
        text = _upgrade_dice_in_text(text, DIE_UP_1)
        # If it mentions temp HP/heal, a bit stronger feel
        if "врем" in text.lower() or "исцел" in text.lower() or "леч" in text.lower():
            text = text.replace("1d6", "1d8").replace("1d4", "1d6")
        return text
    if t == "GOOD":
        # small polish: keep as is
        return text
    if t == "NEUTRAL":
        return text
    if t == "BAD":
        text = _bump_signed_numbers(text, delta_pos=0, delta_neg=1, cap_pos=7, cap_neg=8)
        text = _bump_dc(text, delta=1)
        text = _upgrade_dice_in_text(text, DIE_UP_1)
        return text
    if t == "AWFUL":
        text = _bump_signed_numbers(text, delta_pos=0, delta_neg=2, cap_pos=7, cap_neg=10)
        text = _bump_dc(text, delta=2)
        text = _upgrade_dice_in_text(text, DIE_UP_2)
        # Make awful feel awful: add a small persistent sting if not already present
        if "помех" in text.lower() and "скорость" not in text.lower():
            text += " Также твоя скорость -5 фт, пока эффект активен."
        return text
    return text

def rebalance_effect(e: Effect) -> Effect:
    return Effect(
        id=e.id,
        name=e.name,
        tier=e.tier,
        category=e.category,
        tags=e.tags,
        combat_text=rebalance_effect_text(e.combat_text, e.tier),
        duration_expr=e.duration_expr,
        duration_unit=e.duration_unit,
        aftermath=e.aftermath,
        coping=e.coping,
    )

# ----------------------------- Effects -----------------------------
@dataclass(frozen=True)
class Effect:
    id: str
    name: str
    tier: str
    category: str
    tags: Tuple[str, ...]
    combat_text: str
    duration_expr: str
    duration_unit: str
    aftermath: Optional[str] = None
    coping: Optional[str] = None

def E(id: str, name: str, tier: str, category: str, tags: Sequence[str],
      combat_text: str, duration_expr: str, unit: str,
      aftermath: Optional[str] = None, coping: Optional[str] = None) -> Effect:
    return Effect(id=id, name=name, tier=tier, category=category, tags=tuple(tags),
                  combat_text=combat_text, duration_expr=duration_expr, duration_unit=unit,
                  aftermath=aftermath, coping=coping)

EFFECTS: List[Effect] = [
    # COMBAT EXCELLENT
    E("C_EX_01", "Свет в бездне", "EXCELLENT", "combat", ("support",),
      "В начале своего хода получаешь врем. ХП 1d6 (не складывается; берёшь большее).",
      "1d4+1", "rounds"),
    E("C_EX_02", "Перелом судьбы", "EXCELLENT", "combat", ("attack",),
      "1 раз: после броска d20 на атаку/спасбросок объяви «это 20».",
      "1", "encounter"),
    E("C_EX_03", "Отменить попадание", "EXCELLENT", "combat", ("defense",),
      "Реакция: преврати попавшую по тебе атаку в промах (после результата).",
      "1", "encounter"),
    E("C_EX_04", "Кровавый раж", "EXCELLENT", "combat", ("damage",),
      "1 раз в ход при попадании добавь +1d8 урона. Если в этот ход ты опустил цель до 0 ХП, получи +5 фт скорости до конца хода.",
      "1d4", "rounds"),
    E("C_EX_05", "Стальной нерв", "EXCELLENT", "combat", ("control",),
      "Иммунитет к «испуган» и «очарован». 1 раз можешь повторить проваленный спасбросок Мудрости.",
      "1d4+1", "rounds"),
    E("C_EX_06", "Темп охотника", "EXCELLENT", "combat", ("action",),
      "1 раз: получи дополнительное действие (только Атака/Рывок/Отход/Помочь/Использовать предмет).",
      "1", "encounter"),
    E("C_EX_07", "Непробиваемый миг", "EXCELLENT", "combat", ("defense",),
      "Сопротивление всем видам урона до начала твоего следующего хода.",
      "1", "rounds"),
    E("C_EX_08", "Чистый каст", "EXCELLENT", "combat", ("magic",),
      "+2 к проверкам концентрации; 1 раз автоматически проходишь проверку концентрации.",
      "1d4", "rounds"),
    E("C_EX_09", "Идеальная позиция", "EXCELLENT", "combat", ("mobility",),
      "Скорость +15 фт; игнорируешь сложную местность; 1 раз можешь пройти через клетку врага (как через союзника).",
      "1d4+1", "rounds"),
    E("C_EX_10", "Последний рубеж", "EXCELLENT", "combat", ("survive",),
      "1 раз: когда должен упасть до 0 ХП, остаёшься на 1 ХП и получаешь врем. ХП 1d10.",
      "1", "encounter"),

    # COMBAT GOOD
    E("C_GD_01", "Меткость", "GOOD", "combat", ("attack",), "+1 к броскам атаки.", "1d4+1", "rounds"),
    E("C_GD_02", "Сила удара", "GOOD", "combat", ("damage",), "1 раз в ход при попадании добавь +1d6 урона.", "1d4", "rounds"),
    E("C_GD_03", "Щит уверенности", "GOOD", "combat", ("defense",), "+2 к КД до первого попадания по тебе.", "1", "encounter"),
    E("C_GD_04", "Боевой старт", "GOOD", "combat", ("initiative",), "+4 к инициативе; в первом раунде не застигнуть врасплох.", "1", "encounter"),
    E("C_GD_05", "Стремительность", "GOOD", "combat", ("mobility",), "Скорость +10 фт; 1 раз Отход бонусным действием.", "1d4+1", "rounds"),
    E("C_GD_06", "Живучесть", "GOOD", "combat", ("survive",), "Временные ХП 1d10 + бонус мастерства.", "1", "encounter"),
    E("C_GD_07", "Холодная оценка", "GOOD", "combat", ("support",), "Реакция: союзник получает +3 к КД против одной атаки.", "1", "encounter"),
    E("C_GD_08", "Упрямство", "GOOD", "combat", ("survive",), "Преимущество на спасброски Телосложения.", "1d4+1", "rounds"),
    E("C_GD_09", "Защита духа", "GOOD", "combat", ("control",), "Преимущество на спасброски Мудрости.", "1d4+1", "rounds"),
    E("C_GD_10", "Окно атаки", "GOOD", "combat", ("attack",), "1 раз: после промаха перебрось бросок атаки.", "1", "encounter"),
    E("C_GD_11", "Жёсткий блок", "GOOD", "combat", ("defense",), "Сопротивление B/P/S от немагического оружия.", "1d4", "rounds"),
    E("C_GD_12", "Рефлекс", "GOOD", "combat", ("reaction",), "1 раз: атака возможности с преимуществом.", "1", "encounter"),

    # COMBAT NEUTRAL
    E("C_NT_01", "Искра удачи", "NEUTRAL", "combat", ("flex",), "1 раз добавь +1d4 к любому d20 (после броска).", "1", "encounter"),
    E("C_NT_02", "Осторожность", "NEUTRAL", "combat", ("defense",), "+1 к КД.", "1d4+1", "rounds"),
    E("C_NT_03", "Фокус на цель", "NEUTRAL", "combat", ("mixed",), "По выбранной цели +1 к атакам, по другим -1.", "1d4+1", "rounds"),
    E("C_NT_04", "Натянутые нервы", "NEUTRAL", "combat", ("mixed",), "+1 к инициативе, но помеха на Скрытность.", "1", "encounter"),
    E("C_NT_05", "Сбитый ритм", "NEUTRAL", "combat", ("mixed",), "-1 к атакам, но +1 к КД.", "1d4+1", "rounds"),
    E("C_NT_06", "Кровь стучит", "NEUTRAL", "combat", ("survive",), "При первом уроне за бой получи врем. ХП 1d4.", "1", "encounter"),
    E("C_NT_07", "План в голове", "NEUTRAL", "combat", ("mixed",), "Если не меняешь план — +2 к первому d20; если меняешь — -2.", "1d4", "rounds"),
    E("C_NT_08", "Микро-импульс", "NEUTRAL", "combat", ("mobility",), "1 раз: переместись на 5 фт без провоцирования атаки возможности.", "1", "encounter"),

    # COMBAT BAD
    E("C_BD_01", "Тряска рук", "BAD", "combat", ("attack",), "-3 к броскам атаки.", "1d4", "rounds"),
    E("C_BD_02", "Открытая стойка", "BAD", "combat", ("defense",), "-2 к КД и ты не получаешь выгоды от укрытия.", "1d4", "rounds"),
    E("C_BD_03", "Слабый удар", "BAD", "combat", ("damage",), "1 раз в ход при попадании вычти 1d6 из урона.", "1d4", "rounds"),
    E("C_BD_04", "Тяжёлые ноги", "BAD", "combat", ("mobility",), "Скорость -15 фт; ты не можешь Рывок.", "1d4", "rounds"),
    E("C_BD_05", "Срыв концентрации", "BAD", "combat", ("magic",), "Помеха на концентрацию; если уже концентрируешься — ТЕЛ КС 12, провал — потеря.", "1d4", "rounds"),
    E("C_BD_06", "Панический откат", "BAD", "combat", ("control",), "Когда получаешь урон: МДР КС 12, провал — состояние «испуган» до конца след. хода.", "1d4", "rounds"),
    E("C_BD_07", "Потеря реакции", "BAD", "combat", ("reaction",), "Ты не можешь совершать реакции.", "1d4", "rounds"),
    E("C_BD_08", "Туннельное зрение", "BAD", "combat", ("control",), "Ты зациклен на ближайшей цели: не можешь добровольно атаковать других существ, помеха на Внимательность, а против внезапных атак и обходов с фланга ты уязвимее обычного.", "1d4", "rounds"),
    E("C_BD_09", "Шум в ушах", "BAD", "combat", ("control",), "Помеха на Внимательность и на спасброски Мудрости против ужаса/иллюзий.", "1d4", "rounds"),
    E("C_BD_10", "Кровавый звон", "BAD", "combat", ("mixed",), "При каждом промахе атакой получаешь 1 псих. урон (макс 3 за бой).", "1", "encounter"),

    # COMBAT AWFUL
    E("C_AW_01", "Истощение", "AWFUL", "combat", ("awful",), "Получаешь 1 уровень истощения.", "1", "encounter"),
    E("C_AW_02", "Ступор", "AWFUL", "combat", ("control",), "Ты состояние «ошеломлён» до конца своего следующего хода.", "1", "rounds"),
    E("C_AW_03", "Срыв: испуг", "AWFUL", "combat", ("control",), "Ты состояние «испуган» ближайшего врага. В конце хода МДР КС 14 — снять.", "1d4", "rounds"),
    E("C_AW_04", "Confusion-lite", "AWFUL", "combat", ("control",), "В начале хода d6: 1 — ничего; 2–3 — движение случайно; 4–6 — нормально, но помеха на атаки.", "1d4", "rounds"),
    E("C_AW_05", "Чёрный холод", "AWFUL", "combat", ("survive",), "Любое лечение по тебе вдвое меньше; ты не можешь получать врем. ХП.", "1", "encounter"),
    E("C_AW_06", "Немые губы", "AWFUL", "combat", ("magic",), "Ты не можешь произносить вербальные компоненты.", "1d4", "rounds"),
    E("C_AW_07", "Бегство", "AWFUL", "combat", ("control",), "В свой ход обязан тратить действие на Dash прочь. В конце хода МДР КС 14 — снять.", "1d4", "rounds"),
    E("C_AW_08", "Мегаломания (за ширмой)", "AWFUL", "combat", ("screen","control"), "Игроку: «Ты непобедим». За ширмой: все d20 с помехой; нельзя Отход/Уклонение. В конце хода МДР КС 15 — снять.", "1d4", "rounds"),
    E("C_AW_09", "Дереализация (за ширмой)", "AWFUL", "combat", ("screen","control"), "За ширмой: если есть помеха — 3d20 худший. В конце хода МДР КС 15 — снять.", "1d4", "rounds"),
    E("C_AW_10", "Сломанная воля", "AWFUL", "combat", ("control",), "Ты не можешь приближаться к тому, кто ранил тебя последним. В конце хода МДР КС 14 — снять.", "1d4", "rounds"),

    
    # EXPLORATION (dark fantasy; mostly generalized)

    # EXPLORATION EXCELLENT
    E("X_EX_01", "Глаза ночи", "EXCELLENT", "exploration", ("perception",),
      "В ближайшем бою: ты игнорируешь эффект «плохо видно» (тусклый свет) и получаешь преимущество на первый бросок Внимательности или Расследования, связанный с засадой или ловушкой.",
      "1", "encounter",
      aftermath="После выхода: ты видишь угрозы в мелочах. +2 к Внимательности в тёмных местах до конца дня.",
      coping=None),
    E("X_EX_02", "Хладнокровный следопыт", "EXCELLENT", "exploration", ("navigation",),
      "В бою: 1 раз можешь переместиться на 15 фт без провоцирования атак возможности.",
      "1", "encounter",
      aftermath="После выхода: ты лучше ориентируешься. Преимущество на Выживание для навигации на 1 день.",
      coping=None),
    E("X_EX_03", "Память катакомб", "EXCELLENT", "exploration", ("navigation",),
      "В исследовании: ты почти идеально удерживаешь маршрут в памяти. 1 раз за сцену можешь отменить путаницу в направлении или ошибку развилки.",
      "2", "hours",
      aftermath="После выхода: до конца дня ты легко восстанавливаешь путь по памяти, даже если проходил его в спешке.",
      coping=None),
    E("X_EX_04", "Тонкий слух", "EXCELLENT", "exploration", ("perception",),
      "В исследовании: преимущество на Внимательность по звуку; ты улавливаешь скрип механизмов, дыхание за дверью и шорох шагов раньше остальных.",
      "2", "hours",
      aftermath="После выхода: первый бросок Внимательности в новой локации совершается с преимуществом.",
      coping=None),
    E("X_EX_05", "Рука мастера", "EXCELLENT", "exploration", ("tools",),
      "В исследовании: преимущество на проверки инструментов и Ловкости рук; 1 раз за сцену можешь перебросить проваленную проверку с инструментами.",
      "2", "hours",
      aftermath="После выхода: даже усталые пальцы слушаются тебя лучше обычного.",
      coping=None),

    # EXPLORATION GOOD
    E("X_GD_01", "Пальцы взломщика", "GOOD", "exploration", ("tools",),
      "В бою: 1 раз можешь бонусным действием достать или применить предмет (верёвка, крюк, шипы, мазь) без траты действия.",
      "1", "encounter",
      aftermath="После выхода: преимущество на проверку инструментов (взлом, набор лекаря, ремесло) в следующей сцене.",
      coping=None),
    E("X_GD_02", "Чутьё на ловушки", "GOOD", "exploration", ("perception",),
      "В бою: в первом раунде ты получаешь +2 к КД против атак из засады или скрытых врагов.",
      "1", "encounter",
      aftermath="После выхода: +2 к Внимательности при поиске ловушек на 1 день.",
      coping=None),
    E("X_GD_03", "Глаз мелочей", "GOOD", "exploration", ("perception",),
      "В исследовании: +2 к Внимательности и Расследованию при осмотре помещений, механизмов и следов.",
      "2", "hours",
      aftermath="После выхода: мелкие детали бросаются в глаза — потерянные вещи, странные пятна, сбитые петли.",
      coping=None),
    E("X_GD_04", "Уверенный темп", "GOOD", "exploration", ("mobility",),
      "В исследовании: игнорируешь первый штраф от грязи, скользкой почвы или усталой дороги; +1 к проверкам Выживания в пути.",
      "3", "hours",
      aftermath="После выхода: ты двигаешься размеренно и не сбиваешь шаг группы.",
      coping=None),
    E("X_GD_05", "Спокойная рука", "GOOD", "exploration", ("tools",),
      "В исследовании: +2 к Ловкости рук; первая проверка тонкой работы в сцене получает преимущество.",
      "2", "hours",
      aftermath="После выхода: тебе проще шить, чинить, перевязывать и работать с мелкими предметами.",
      coping=None),
    E("X_GD_06", "Здравый маршрут", "GOOD", "exploration", ("navigation",),
      "В исследовании: +2 к Выживанию и Истории при попытке понять, куда ведут тоннели, тропы и старые метки.",
      "2", "hours",
      aftermath="После выхода: шанс перепутать путь заметно ниже до конца дня.",
      coping=None),

    # EXPLORATION NEUTRAL
    E("X_NT_01", "Нервная собранность", "NEUTRAL", "exploration", ("mixed",),
      "В бою: +1 к инициативе, но помеха на Скрытность до конца первого раунда.",
      "1", "encounter",
      aftermath="После выхода: ты не расслабляешься. Помеха на Выступление, преимущество на Внимательность (на 1 сцену).",
      coping=None),
    E("X_NT_02", "Запах крови", "NEUTRAL", "exploration", ("mixed",),
      "В бою: первый раз, когда ты попадаешь по цели, добавь +1d4 урона, но после этого -1 к КД до начала следующего хода.",
      "1", "encounter",
      aftermath="После выхода: ты раздражён резкими запахами. Помеха на Скрытность в городах и тавернах (на 1 сцену).",
      coping=None),
    E("X_NT_03", "Мелкая подозрительность", "NEUTRAL", "exploration", ("mixed",),
      "+2 к Внимательности против засад, но -2 к Скрытности.",
      "2", "hours",
      aftermath="После выхода: ты чаще оглядываешься и мешаешь тихому продвижению группы.",
      coping=None),
    E("X_NT_04", "Упрямый ритм", "NEUTRAL", "exploration", ("mixed",),
      "+1 к Атлетике, но -1 к Ловкости рук и проверкам инструментов.",
      "2", "hours",
      aftermath="После выхода: проще тащить груз и перелезать препятствия, сложнее ковыряться в замках и механизмах.",
      coping=None),
    E("X_NT_05", "Скупой свет", "NEUTRAL", "exploration", ("mixed",),
      "+2 к Внимательности в полумраке, но помеха на Внимательность при ярком освещении или резкой смене света.",
      "2", "hours",
      aftermath="После выхода: глаза привыкают к сумраку, но яркий свет раздражает.",
      coping=None),

    # EXPLORATION BAD
    E("X_BD_01", "Туман в голове", "BAD", "exploration", ("perception",),
      "В бою: помеха на первую проверку Внимательности или Расследования, связанную с окружением; если такой нет — помеха на первую атаку дальнего боя.",
      "1", "encounter",
      aftermath="После выхода: помеха на Внимательность в течение 4 часов.",
      coping="Сопротивление: короткий отдых + Интеллект КС 13. Успех — снимает. Провал — эффект возвращается при первом стрессе."),
    E("X_BD_02", "Скользкие руки", "BAD", "exploration", ("tools",),
      "В бою: если ты используешь предмет (зелье, мазь, бинт, шипы) — брось Ловкость КС 12; провал — тратишь действие впустую.",
      "1d4", "rounds",
      aftermath="После выхода: помеха на проверки инструментов (на 1 сцену).",
      coping="Поддаться: курить, пить или успокоиться — снимает на 1 сцену, но повышает КС сопротивления на +1."),
    E("X_BD_03", "Застывшие пальцы", "BAD", "exploration", ("tools",),
      "-2 к проверкам инструментов, Ловкости рук и действиям, требующим тонкой моторики.",
      "2", "hours",
      aftermath="После выхода: ты роняешь мелочи, плохо завязываешь узлы и дольше работаешь с замками и ремнями.",
      coping="Сопротивление: согреть руки, передохнуть, растереть пальцы; Ловкость КС 12, чтобы снять раньше."),
    E("X_BD_04", "Ложные тени", "BAD", "exploration", ("perception",),
      "Помеха на Внимательность при поиске ловушек и скрытых проходов; ты чаще видишь угрозу там, где её нет.",
      "2", "hours",
      aftermath="После выхода: тебе всё мерещатся силуэты и движения в углах зрения.",
      coping="Сопротивление: 10 минут отдыха и спокойная проверка Мудрости КС 12."),
    E("X_BD_05", "Сбитый шаг", "BAD", "exploration", ("mobility",),
      "Скорость -10 фт вне боя, и при спешке брось Ловкость КС 12 или споткнись/урони снаряжение.",
      "2", "hours",
      aftermath="После выхода: долгий путь выматывает сильнее обычного.",
      coping="Поддаться: идти медленнее всей группе; сопротивление: ТЕЛ КС 12 каждый час пути."),
    E("X_BD_06", "Затёртая память", "BAD", "exploration", ("navigation",),
      "Помеха на Выживание и Историю, если нужно восстановить путь, метки или порядок комнат.",
      "2", "hours",
      aftermath="После выхода: ты хуже вспоминаешь маршруты и расположение предметов.",
      coping="Сопротивление: зарисовать путь или проговорить его вслух вместе с союзником — срок эффекта сокращается."),

    # EXPLORATION AWFUL
    E("X_AW_01", "Дезориентация", "AWFUL", "exploration", ("control",),
      "В бою: в начале своего хода брось d6. 1–2: ты теряешь действие; 3–4: скорость 0; 5–6: ход нормальный. В конце хода МДР КС 14 — снять.",
      "1d4", "rounds",
      aftermath="После выхода: ты путаешь направления и детали. Помеха на навигацию и память местности (Выживание/История) на 1 день.",
      coping="Сопротивление: 10 минут спокойного отдыха + МДР КС 14. Успех — срок -1 день. Провал — срок +1 день."),
    E("X_AW_02", "Слепая уверенность (за ширмой)", "AWFUL", "exploration", ("screen",),
      "За ширмой: первая проверка поиска ловушек или скрытых угроз получает -5 к результату, а игроку говоришь «всё чисто».",
      "1", "encounter",
      aftermath="После выхода: тебя тянет рисковать. Если ты первый входишь в неизвестную комнату — помеха на Внимательность (на 1 сцену).",
      coping="Поддаться: бросаться вперёд — снимает тревогу, но увеличивает шанс следующего «ужасного» эффекта."),
    E("X_AW_03", "Память тропы расползается", "AWFUL", "exploration", ("navigation",),
      "Помеха на Выживание и Расследование; после каждой новой комнаты или развилки сделай спасбросок МДР КС 14, иначе путаешь детали маршрута.",
      "3", "hours",
      aftermath="После выхода: в памяти остаются дыры, ложные повороты и несуществующие знаки.",
      coping="Сопротивление: вести карту, заметки или идти за чужим ориентиром — иначе эффект держится дольше."),
    E("X_AW_04", "Лес давит тишиной", "AWFUL", "exploration", ("control",),
      "Помеха на Внимательность, Скрытность и любые проверки, связанные с ориентированием; ты постоянно замираешь, вслушиваясь в воображаемые звуки.",
      "1d4+2", "hours",
      aftermath="После выхода: тишина становится невыносимой, а шорохи — подозрительными.",
      coping="Поддаться: двигаться только в чьём-то сопровождении; сопротивление: МДР КС 14 после короткого отдыха."),
    E("X_AW_05", "Сломанный маршрут", "AWFUL", "exploration", ("navigation",),
      "Ты не можешь уверенно вести группу: все проверки навигации с помехой, а при провале группа тратит лишнее время или ресурсы.",
      "1d4+2", "hours",
      aftermath="После выхода: ты избегаешь принимать решения о пути и сомневаешься в каждом ориентире.",
      coping="Сопротивление: передать лидерство другому и отдохнуть в безопасном месте не меньше часа."),

# SOCIAL (dark fantasy psychological, generalized)

    # SOCIAL EXCELLENT
    E("S_EX_01", "Сдержанная харизма", "EXCELLENT", "social", ("social",),
      "В бою: 1 раз можешь действием дать союзнику Вдохновение.",
      "1", "encounter",
      aftermath="После выхода: следующая социальная сцена начинается мягче (НИП на 1 шаг дружелюбнее, если уместно).",
      coping="Если ты используешь Помощь в разговоре, эффект может закончиться сразу."),
    E("S_EX_02", "Нить доверия", "EXCELLENT", "social", ("social",),
      "+2 ко всем проверкам Харизмы и Проницательности; 1 раз в сцене можешь перебросить проваленную проверку Убеждения, Обмана или Проницательности.",
      "3", "hours",
      aftermath="После выхода: люди охотнее дают тебе шанс договорить и выслушать.",
      coping=None),
    E("S_EX_03", "Холодное достоинство", "EXCELLENT", "social", ("social",),
      "Ты почти не выдаёшь страх. Преимущество на Убеждение, Запугивание и спасброски против провокации.",
      "3", "hours",
      aftermath="После выхода: тебя труднее выбить из равновесия и сложнее поймать на слабом месте.",
      coping=None),
    E("S_EX_04", "Верный тон", "EXCELLENT", "social", ("social",),
      "1 раз за сцену можешь превратить проваленный бросок Харизмы в обычный успех без критического эффекта.",
      "1", "scene",
      aftermath="После выхода: у тебя реже срывается голос и ты лучше держишь беседу.",
      coping=None),

    # SOCIAL GOOD
    E("S_GD_01", "Надёжный голос", "GOOD", "social", ("social",),
      "+1 ко всем проверкам Харизмы; один раз в сцене можешь перебросить проваленный бросок Убеждения.",
      "2", "hours",
      aftermath="После выхода: тебя легче воспринимать всерьёз, даже если ты выглядишь уставшим.",
      coping=None),
    E("S_GD_02", "Прямой взгляд", "GOOD", "social", ("social",),
      "+2 к Проницательности и Запугиванию; тебя труднее смутить или сбить с мысли.",
      "2", "hours",
      aftermath="После выхода: ты быстрее замечаешь фальшь в интонации и напряжение в жестах.",
      coping=None),
    E("S_GD_03", "Тёплый тон", "GOOD", "social", ("social",),
      "+2 к Убеждению.",
      "2", "hours",
      aftermath="После выхода: с тобой проще начать разговор без настороженности.",
      coping=None),
    E("S_GD_04", "Язык без костей", "GOOD", "social", ("social",),
      "1 раз: получаешь преимущество на Обман.",
      "1", "scene",
      aftermath="После выхода: ложь и полуправда ложатся на язык легче обычного.",
      coping=None),
    E("S_GD_05", "Внятные границы", "GOOD", "social", ("social",),
      "Преимущество на Проницательность (видишь манипуляции и угрозы).",
      "2", "hours",
      aftermath="После выхода: тебя труднее втянуть в невыгодную сделку или унизительный разговор.",
      coping=None),
    E("S_GD_06", "Мягкая властность", "GOOD", "social", ("social",),
      "+1 ко всем проверкам Харизмы и преимущество на первую социальную проверку в новой сцене.",
      "2", "hours",
      aftermath="После выхода: незнакомцы чаще воспринимают тебя как человека, к словам которого стоит прислушаться.",
      coping=None),

    # SOCIAL NEUTRAL
    E("S_NT_01", "Мрачный юмор", "NEUTRAL", "social", ("social",),
      "В бою: при крите цель делает МДР КС 12 или получает помеху на следующую атаку.",
      "1", "encounter",
      aftermath="После выхода: ты шутишь не к месту; возможна помеха на Убеждение и Выступление с приличными людьми.",
      coping="Сопротивление: МДР КС 12 в конце соц. сцены. Успех — эффект сходит на нет."),
    E("S_NT_02", "Осторожные слова", "NEUTRAL", "social", ("mixed",),
      "+1 к Убеждению, но -1 к Обману и Запугиванию.",
      "2", "hours",
      aftermath="После выхода: ты говоришь аккуратнее, но звучишь менее опасно и менее убедительно во лжи.",
      coping=None),
    E("S_NT_03", "Глухая вежливость", "NEUTRAL", "social", ("mixed",),
      "+2 к спасброскам против провокации и манипуляции, но -2 к дружелюбным разговорам.",
      "2", "hours",
      aftermath="После выхода: тебя трудно вывести из себя, но ты звучишь холодно и отстранённо.",
      coping=None),
    E("S_NT_04", "Сухая честность", "NEUTRAL", "social", ("mixed",),
      "+2 к Проницательности, но помеха на Обман.",
      "2", "hours",
      aftermath="После выхода: проще распознавать ложь, но сложнее красиво врать самому.",
      coping=None),
    E("S_NT_05", "Тихое превосходство", "NEUTRAL", "social", ("mixed",),
      "+1 к Запугиванию, но -1 к Убеждению и Выступлению.",
      "2", "hours",
      aftermath="После выхода: люди чувствуют напряжение и уступают, но не располагаются к тебе.",
      coping=None),

    # SOCIAL BAD
    E("S_BD_01", "Тяга к алкоголю", "BAD", "social", ("addiction",),
      "В бою: в начале хода МДР КС 12. Провал — помеха на первый d20 в этот ход.",
      "1d4", "rounds",
      aftermath="После выхода: пока ты не выпьешь, у тебя помеха на Убеждение и Проницательность.",
      coping="Поддаться: выпить — снимает помеху на 4 часа, но продлевает зависимость на +1 день.\nСопротивление: в конце дня МДР КС 13. Успех — срок -1 день. Провал — КС +1 (макс 15) и срок +1 день."),
    E("S_BD_02", "Компульсивная ложь", "BAD", "social", ("compulsion",),
      "В бою: 1 раз за бой, когда объявляешь действие, ИНТ КС 12. Провал — выбираешь менее оптимальное действие.",
      "1", "encounter",
      aftermath="После выхода: ты врёшь без причины. Помеха на Убеждение; преимущество на Обман, но провалы портят отношение НИП.",
      coping="Поддаться: соври в диалоге — снимает помеху на 1 сцену, но КС сопротивления +1.\nСопротивление: МДР КС 13 в конце сцены. Успех — срок -1 день. Провал — срок +1 день."),
    E("S_BD_03", "Истерический смех", "BAD", "social", ("control",),
      "В бою: когда получаешь урон, d6. На 1–2 ты теряешь реакции до начала следующего хода.",
      "1", "encounter",
      aftermath="После выхода: в напряжённых разговорах смех выдаёт тебя. Помеха на Скрытность и Обман.",
      coping="Поддаться: «отпустить» смех в безопасном месте — снимает эффект на 1 день, но портит репутацию.\nСопротивление: ТЕЛ КС 13 после стресса. Успех — эффект ослабевает."),
    E("S_BD_04", "Нервный тик", "BAD", "social", ("social",),
      "-2 к Обману и Убеждению; внимательные НИП легко замечают твоё напряжение.",
      "2", "hours",
      aftermath="После выхода: лишние движения, дёрганье губ, взглядов и пальцев мешают держать лицо.",
      coping="Сопротивление: короткий отдых и МДР КС 12."),
    E("S_BD_05", "Грязная резкость", "BAD", "social", ("social",),
      "-1 ко всем проверкам Харизмы; при провале социальной проверки отношение собеседника ухудшается сильнее обычного.",
      "2", "hours",
      aftermath="После выхода: даже нейтральные слова звучат грубо или устало.",
      coping="Поддаться: запугивать и давить; сопротивление: долгое спокойное общение с союзником."),
    E("S_BD_06", "Стыдливый взгляд", "BAD", "social", ("social",),
      "Помеха на Убеждение и Выступление; ты избегаешь зрительного контакта и звучишь неуверенно.",
      "2", "hours",
      aftermath="После выхода: сложнее договариваться, просить о помощи и удерживать внимание собеседника.",
      coping="Сопротивление: ХАР КС 12 после безопасной сцены, где тебя поддержали."),

    # SOCIAL AWFUL
    E("S_AW_01", "Паранойя", "AWFUL", "social", ("paranoia","screen"),
      "В бою (за ширмой): ты не получаешь бонусы от Помощи и аур союзников. В конце хода МДР КС 15 — снять на бой.",
      "1d4", "rounds",
      aftermath="После выхода: ты всем не доверяешь. Помеха на Убеждение и Проницательность; избегание толпы.",
      coping="Поддаться: подозревать — даёт преимущество на Внимательность 1 сцену, но продлевает паранойю на +2 дня.\nСопротивление: разговор с союзником 10 минут + МДР КС 15. Успех — срок -2 дня. Провал — срок +1 день."),
    E("S_AW_02", "Ночные кошмары", "AWFUL", "social", ("stress",),
      "В бою: в начале 1 раунда твоя инициатива уменьшается на 1d6, и ты не можешь реакции в 1 раунде.",
      "1", "encounter",
      aftermath="После выхода: длинный отдых восстанавливает на 1 кость хитов меньше обычного (мин. 0).",
      coping="Поддаться: не спать — избегаешь кошмаров, но -1 к спасброскам Телосложения до следующего отдыха.\nСопротивление: в конце длительного отдыха МДР КС 14. Успех — ещё 1 ночь, затем исчезает. Провал — ещё 1d4 ночи."),
    E("S_AW_03", "Мания унижения", "AWFUL", "social", ("social",),
      "-2 ко всем проверкам Харизмы; ты сам подставляешь себя неловкими словами или жестами.",
      "1d4+2", "hours",
      aftermath="После выхода: в памяти снова и снова всплывают собственные унижения, а язык будто ищет новые поводы опозориться.",
      coping="Сопротивление: долгий отдых в безопасности + МДР КС 14 или поддержка союзника."),
    E("S_AW_04", "Рваная личность", "AWFUL", "social", ("social",),
      "В каждой новой социальной сцене первый бросок Харизмы автоматически с помехой; после провала ты или замыкаешься, или срываешься в агрессию.",
      "1d6", "hours",
      aftermath="После выхода: окружающим кажется, будто в тебе спорят два разных человека.",
      coping="Поддаться: уйти от людей и молчать; сопротивление: МДР КС 15 после откровенного разговора."),
    E("S_AW_05", "Липкий стыд", "AWFUL", "social", ("social",),
      "Помеха на все проверки Харизмы и Проницательности; ты ждёшь осуждения в каждом слове собеседника.",
      "1d4+2", "hours",
      aftermath="После выхода: хочется исчезнуть, спрятаться или сорваться на саморазрушительное поведение.",
      coping="Сопротивление: безопасная поддерживающая сцена, без свидетелей, и МДР КС 14."),
    E("S_AW_06", "Срыв речи", "AWFUL", "social", ("social",),
      "В начале каждой социальной сцены сделай спасбросок МДР КС 14. При провале: до конца сцены все проверки Харизмы с помехой, голос дрожит или ломается.",
      "1d4+2", "hours",
      aftermath="После выхода: даже простые разговоры кажутся допросом или угрозой.",
      coping="Сопротивление: молчать, писать, говорить через посредника или восстановиться после отдыха."),
]


PERSONAL_DEBUFFS = [
    {
        "name": "Персональный дебафф: Ничтожество",
        "category": "social",
        "text": "Ты убеждён, что всем только мешаешь. Помеха на все проверки Харизмы; ты не можешь добровольно использовать Помощь в разговоре.",
        "aftermath": "После выхода: ты избегаешь инициативы, не смотришь людям в глаза и стараешься не принимать решений.",
        "coping": "Сопротивление: откровенный разговор с союзником + спасбросок МДР КС 15. Провал — эффект держится до следующего долгого отдыха."
    },
    {
        "name": "Персональный дебафф: Кровь на руках",
        "category": "combat",
        "text": "Кажется, что любое насилие делает тебя чудовищем. Помеха на первый бросок атаки в каждом бою; после добивания цели ты получаешь 1 психический урон.",
        "aftermath": "После выхода: ты дольше молчишь после боя и не выносишь разговоров о насилии.",
        "coping": "Сопротивление: ритуал очищения, исповедь или 1 день покоя. Иначе эффект возвращается при следующем спуске."
    },
    {
        "name": "Персональный дебафф: Шёпот бездны",
        "category": "exploration",
        "text": "Тьма как будто зовёт тебя по имени. Помеха на Внимательность и навигацию; при входе в новую зону сделай спасбросок МДР КС 14, иначе на миг замираешь и теряешь темп.",
        "aftermath": "После выхода: в тишине тебе слышатся далёкие шаги и шёпот.",
        "coping": "Сопротивление: яркий свет, безопасный сон и МДР КС 15. Провал — шёпот возвращается в следующем подземелье."
    },
]

def maybe_personal_debuff(morale: int, n: int, categories, rng):
    """
    При морали 0-10 есть шанс вместо обычного коктейля получить только один
    персональный дебафф. Он по редкости сопоставим с ужасным тиром.
    """
    if not (0 <= morale <= 10):
        return None

    # Базовый шанс примерно на уровне awful тира, но чуть растёт с n
    p = 0.12 + min(0.18, n * 0.01)   # 12%..30%
    if rng.random() >= p:
        return None

    cats = set(categories or [])
    pool = [d for d in PERSONAL_DEBUFFS if d["category"] in cats] or PERSONAL_DEBUFFS
    d = rng.choice(pool)
    unit = "раундов" if d["category"] == "combat" else "часов"
    duration = 1 if d["category"] == "combat" else 6
    if d["category"] != "combat":
        duration += min(12, n)

    return {
        "morale": morale,
        "n": n,
        "phase": {"name": get_phase(morale)[0], "range": [get_phase(morale)[1], get_phase(morale)[2]]},
        "capricious_d100": None,
        "forced_extreme": None,
        "count": 1,
        "extreme_pair": False,
        "personal_debuff": True,
        "effects": [{
            "id": "PERSONAL_DEBUFF",
            "name": d["name"],
            "tier": "AWFUL",
            "category": d["category"],
            "tags": ["personal"],
            "combat_text": d["text"],
            "duration": {"value": duration, "expr": str(duration), "unit": unit},
            "aftermath": d["aftermath"],
            "coping": d["coping"],
            "tier_chance": round(p * 100.0, 1),
        }]
    }

# Apply tier rebalance
EFFECTS = [rebalance_effect(e) for e in EFFECTS]

def filter_effects(categories: Sequence[str], tier: Optional[str] = None) -> List[Effect]:
    cats = set(categories)
    out = [e for e in EFFECTS if e.category in cats]
    if tier is not None:
        out = [e for e in out if e.tier == tier]
    return out

def pick_effect(rng: random.Random, pool: List[Effect], used_ids: set) -> Effect:
    candidates = [e for e in pool if e.id not in used_ids]
    if not candidates:
        candidates = pool[:]
    return rng.choice(candidates)


# ----------------------------- Strong Accumulation System -----------------------------

def accumulation_multiplier(n: int) -> float:
    # Нелинейный рост давления
    return 1.0 + (n * n * 0.15)

def apply_accumulation_modifier(weights: dict, n: int) -> dict:
    n = max(0, int(n))
    mult = accumulation_multiplier(n)
    new_weights = weights.copy()

    if n >= 3:
        # начиная с n=3 система скатывается
        new_weights["BAD"] *= mult * 1.5
        new_weights["AWFUL"] *= mult * 2.0
        new_weights["GOOD"] *= max(0.2, 1.0 - 0.25 * n)
        new_weights["EXCELLENT"] *= max(0.1, 1.0 - 0.35 * n)
    else:
        new_weights["BAD"] *= mult
        new_weights["AWFUL"] *= mult * 1.2

    # при n >= 5 хорошие почти исчезают
    if n >= 5:
        new_weights["GOOD"] *= 0.1
        new_weights["EXCELLENT"] *= 0.05

    return new_weights

def generate_cocktail(morale: int, n: int, categories: Sequence[str], rng: random.Random) -> Dict:
    morale = int(clamp(morale, 0, 100))
    n = max(0, int(n))
    phase_name, lo, hi = get_phase(morale)

    personal = maybe_personal_debuff(morale, n, categories, rng)
    if personal is not None:
        return personal

    capricious = rng.randint(1, 100)
    forced: Optional[str] = None
    if capricious == 1:
        forced = "AWFUL"
    elif capricious == 100:
        forced = "EXCELLENT"

    w = tier_weights(morale, n, phase_name)
    if forced == "EXCELLENT":
        w = {"EXCELLENT": 0.72, "GOOD": 0.20, "NEUTRAL": 0.06, "BAD": 0.015, "AWFUL": 0.005}
    elif forced == "AWFUL":
        w = {"EXCELLENT": 0.005, "GOOD": 0.015, "NEUTRAL": 0.06, "BAD": 0.20, "AWFUL": 0.72}

    dist = count_distribution(morale, n, phase_name)
    count = int(weighted_choice(rng, [(str(k), v) for k, v in dist.items()]))

    fatigue = clamp(n / 10.0, 0.0, 2.0)
    p_extreme_pair = clamp(0.012 + 0.010 * fatigue, 0.012, 0.032)
    do_extreme_pair = (count >= 2) and (rng.random() < p_extreme_pair)

    used_ids: set = set()
    chosen: List[Dict] = []

    def add_one(tier: str):
        pool = filter_effects(categories, tier=tier)
        if not pool:
            pool = filter_effects(categories, tier=None)
        if not pool:
            # No effects exist for chosen categories (e.g., exploration-only). Fallback to all effects.
            pool = EFFECTS
        eff = pick_effect(rng, pool, used_ids)
        used_ids.add(eff.id)
        dur_val_raw = roll_dice(rng, eff.duration_expr)
        dur_val = adjust_duration_by_n(dur_val_raw, eff.tier, eff.category, n)
        # Unit rules: combat is always rounds; social/exploration should read as time
        unit = eff.duration_unit
        if eff.category == "combat":
            unit = "раундов"
        else:
            if unit == "encounter":
                unit = "часов"

        # Шанс именно качества (тира) на текущих морали и n
        tier_chance = round(float(w.get(eff.tier, 0.0)) * 100.0, 1)

        chosen.append({
            "id": eff.id,
            "name": eff.name,
            "tier": eff.tier,
            "category": eff.category,
            "tags": list(eff.tags),
            "combat_text": eff.combat_text,
            "duration": {"value": dur_val, "expr": eff.duration_expr, "unit": unit},
            "aftermath": eff.aftermath,
            "coping": eff.coping,
            "tier_chance": tier_chance,
        })

    if count > 0:
        remaining = count
        if do_extreme_pair:
            add_one("EXCELLENT")
            add_one("AWFUL")
            remaining -= 2

        for _ in range(remaining):
            tier = weighted_choice(rng, [(t, w[t]) for t in TIERS])
            add_one(tier)

    return {
        "morale": morale,
        "n": n,
        "phase": {"name": phase_name, "range": [lo, hi]},
        "capricious_d100": capricious,
        "forced_extreme": forced,
        "count": count,
        "extreme_pair": do_extreme_pair,
        "effects": chosen,
    }

def pretty_print(result: Dict) -> None:
    print(f"Мораль: {ANSI['bold']}{result['morale']}{ANSI['reset']} | n: {result['n']}")
    print(f"Фаза: {result['phase']['name']} (диапазон {result['phase']['range'][0]}..{result['phase']['range'][1]})")

    cap = result["capricious_d100"]
    cap_str = f"d100 каприз судьбы: {cap}"
    if result["forced_extreme"]:
        cap_str += f" -> форс: {result['forced_extreme']}"
    print(cap_str)

    line = f"Эффектов: {result['count']}"
    if result["extreme_pair"]:
        line += " | экстремальная пара (ОТЛИЧНЫЙ+УЖАСНЫЙ)"
    print(line)

    if not result["effects"]:
        print(color("Ничего не произошло. (Коктейль пуст)", "dim"))
        return

    unit_ru = {"rounds": "раунд(а/ов)", "minutes": "мин", "scene": "сцена", "encounter": "бой"}
    tier_ru = {"EXCELLENT": "ОТЛИЧНЫЙ", "GOOD": "ХОРОШИЙ", "NEUTRAL": "СРЕДНИЙ", "BAD": "ПЛОХОЙ", "AWFUL": "УЖАСНЫЙ"}
    cat_ru = {"combat": "БОЙ", "social": "СОЦ.", "exploration": "ИССЛЕД."}

    if result.get("personal_debuff"):
        print("\nПерсональный дебафф:")
    else:
        print("\nКоктейль:")
    for i, e in enumerate(result["effects"], start=1):
        dur = e["duration"]
        dur_str = f"{dur['value']} {unit_ru.get(dur['unit'], dur['unit'])}"

        tier_label = tier_ru.get(e["tier"], e["tier"])
        cat_label = cat_ru.get(e["category"], e["category"])
        tier_col = TIER_COLOR.get(e["tier"], "neutral")
        cat_col = CAT_COLOR.get(e["category"], "neutral")

        chance_txt = ""
        if e.get("tier_chance") is not None:
            chance_txt = f" ({e['tier_chance']}%)"
        if result.get("personal_debuff"):
            header = f"{i}) [ПЕРСОНАЛЬНЫЙ ДЕБАФФ] [{cat_label}] {e['name']} — {dur_str}{chance_txt}"
        else:
            header = f"{i}) [{cat_label}] [{tier_label}] {e['name']} — {dur_str}{chance_txt}"
        print(color(header, cat_col))
        print(color("   " + e["combat_text"], tier_col))

        if "screen" in e["tags"]:
            print(color("   (!) За ширмой / искажённое восприятие", "awful"))
        if e.get("aftermath"):
            print(color("   После данжа: " + e["aftermath"], "dim"))
        if e.get("coping"):
            print(color("   Как с этим жить: " + e["coping"], "dim"))

def choose_categories_menu() -> List[str]:
    print("\nВыберите что смешиваем:")
    print("1 - БОЙ")
    print("2 - СОЦИАЛКА")
    print("3 - ИССЛЕДОВАНИЕ")
    print("Можно вводить комбинации цифр: 12 / 13 / 23 / 123")

    while True:
        choice = input("Ваш выбор: ").strip()
        if not choice.isdigit():
            print("Введите цифры 1, 2, 3 в любой комбинации.")
            continue
        cats = set()
        if "1" in choice: cats.add("combat")
        if "2" in choice: cats.add("social")
        if "3" in choice: cats.add("exploration")
        if not cats:
            print("Нужно выбрать хотя бы одну категорию.")
            continue
        return list(cats)


# ----------------------------- Weather generator (spring/autumn; mixed forest & fields) -----------------------------
WEATHER_PALETTES = {
    "clear": "excellent",
    "partly": "good",
    "cloudy": "neutral",
    "drizzle": "good",
    "rain": "social",          # blue
    "heavy_rain": "bad",       # red
    "storm": "awful",          # magenta
    "fog": "exploration",      # gray
    "dense_fog": "bad",
    "wind": "combat",          # cyan
    "gale": "bad",
    "astral": "awful",
}

def generate_weather(rng: random.Random) -> Dict[str, str]:
    """
    Biome: mixed forest + fields.
    Season: spring or autumn (no snow, no heatwaves).
    Includes rare astral anomalies (very low chance).
    Returns fields ready for printing.
    """
    season = rng.choice(["весна", "осень"])

    # ---- Base temperature (no heatwaves, no freezing) ----
    if season == "весна":
        temp = weighted_choice(rng, [
            ("+3…+7°C, зябко", 0.25),
            ("+6…+11°C, мягко", 0.45),
            ("+8…+13°C, сыровато", 0.25),
            ("+10…+14°C, приятно", 0.05),
        ])
    else:
        temp = weighted_choice(rng, [
            ("+2…+6°C, зябко", 0.40),
            ("+5…+9°C, прохладно", 0.40),
            ("+7…+11°C, мягко", 0.15),
            ("+9…+12°C, странно тепло", 0.05),
        ])

    # ---- Astral anomaly (rare) ----
    # About 2% by default; can tune later.
    anomaly_roll = rng.random()
    if anomaly_roll < 0.02:
        anomaly = weighted_choice(rng, [
            ("астральный шторм: фиолетовые разряды в облаках, воздух звенит", 0.35),
            ("фиолетовое небо и «двойные» тени, будто свет идёт не оттуда", 0.25),
            ("тонкая астральная морось: капли не мокрые, а холодные и стеклянные", 0.20),
            ("шёпот в ветре: слова неразборчивы, но от них хочется оглядываться", 0.20),
        ])
        # Effects are narrative; keep mechanical hints optional.
        sky = anomaly
        wind = weighted_choice(rng, [("порывистый ветер", 0.45), ("резкие шквалы", 0.35), ("ветер с сыростью", 0.20)])
        ground = weighted_choice(rng, [
            ("трава пригибается, будто от невидимой волны", 0.35),
            ("почва сухая, но следы выглядят «чужими»", 0.25),
            ("лужи отражают небо не тем цветом", 0.20),
            ("в лесу хрустит листва, хотя ветра меньше, чем кажется", 0.20),
        ])
        special = weighted_choice(rng, [
            ("Птицы молчат. Даже вороны.", 0.28),
            ("На мгновение кажется, что ты уже проживал этот шаг.", 0.24),
            ("Компас/ориентиры ведут себя капризно.", 0.24),
            ("Запах озона и пепла стоит в горле.", 0.24),
        ])
        return {
            "season": season,
            "temp": temp,
            "sky": sky,
            "wind": wind,
            "ground": ground,
            "special": special,
            "type": "astral",
        }

    # ---- Normal weather ----
    sky_type = weighted_choice(rng, [
        ("ясное небо", 0.10),
        ("ясные окна среди облаков", 0.18),
        ("переменная облачность", 0.24),
        ("низкие серые тучи", 0.22),
        ("мелкая морось", 0.10),
        ("ровный дождь", 0.10),
        ("сильный дождь", 0.04),
        ("гроза на горизонте", 0.02),
    ])

    wind = weighted_choice(rng, [
        ("штиль", 0.14),
        ("лёгкий ветер", 0.34),
        ("порывистый ветер", 0.28),
        ("резкие шквалы", 0.12),
        ("ветер с сыростью", 0.12),
    ])

    # Fog layer (can stack with sky_type)
    fog = weighted_choice(rng, [
        ("", 0.62),
        ("лёгкий туман в низинах", 0.20),
        ("туманная пелена", 0.12),
        ("сильный туман, видимость как в молоке", 0.06),
    ])

    ground = weighted_choice(rng, [
        ("сухая тропа и мягкая земля", 0.18),
        ("влажная трава, следы читаются легко", 0.16),
        ("раскисшая колея и липкая глина", 0.20),
        ("лужи в низинах, сапоги чавкают", 0.22),
        ("опавшая листва скользит под ногой", 0.16 if season == "осень" else 0.06),
        ("молодая зелень скрывает ямы и корни", 0.16 if season == "весна" else 0.06),
        ("в поле грязь подсыхает коркой, но под ней жижа", 0.10),
    ])

    special = weighted_choice(rng, [
        ("", 0.42),
        ("В кронах шумят вороны — будто предупреждают.", 0.10),
        ("Запах дыма — далеко жгут костёр или горит хутор.", 0.10),
        ("Тишина давит: даже насекомые будто прячутся.", 0.08),
        ("Сырость пробирает до костей — одежда тяжелеет.", 0.10),
        ("Лес «дышит» туманом, и шаги звучат глухо.", 0.08),
        ("Ветер приносит шёпот — возможно, просто листья.", 0.08),
        ("В поле видно чёрные силуэты пугал, хотя пугал тут быть не должно.", 0.04),
    ])

    # Determine type for coloring
    wtype = "cloudy"
    low = sky_type.lower()
    if "гроза" in low:
        wtype = "storm"
    elif "сильный дождь" in low:
        wtype = "heavy_rain"
    elif "дожд" in low:
        wtype = "rain"
    elif "морось" in low:
        wtype = "drizzle"
    elif "ясное небо" in low:
        wtype = "clear"
    elif "окна" in low or "переменная" in low:
        wtype = "partly"

    if fog:
        if "сильный туман" in fog:
            wtype = "dense_fog" if wtype in ("clear", "partly", "cloudy") else wtype
        else:
            wtype = "fog" if wtype in ("clear", "partly", "cloudy") else wtype

    if ("шквал" in wind) or ("порыв" in wind):
        if wtype in ("clear", "partly", "cloudy"):
            wtype = "wind"
        elif wtype == "fog":
            # fog + strong wind feels harsh
            wtype = "gale"

    return {
        "season": season,
        "temp": temp,
        "sky": (sky_type + (", " + fog if fog else "")),
        "wind": wind,
        "ground": ground,
        "special": special,
        "type": wtype,
    }

def pretty_print_weather(w: Dict[str, str]) -> None:
    """
    Output format requested:
    - No header like "Погода (весна | ...)" because it's implied.
    - Just lines: Температура/Небо/Ветер/Почва + optional detail.
    """
    palette = WEATHER_PALETTES.get(w.get("type", "cloudy"), "neutral")
    print(color(f"Температура: {w['temp']}", palette))
    print(color(f"Небо: {w['sky']}", palette))
    print(color(f"Ветер: {w['wind']}", palette))
    print(color(f"Почва: {w['ground']}", palette))
    if w.get("special"):
        print(color(f"Деталь: {w['special']}", "dim"))



def effective_max_hp_loss(inj: dict) -> int:
    loss = int(inj.get("max_hp_loss", 0) or 0)
    restored = int(inj.get("max_hp_restored", 0) or 0)
    return max(0, loss - restored)

def adjust_injury_text_for_stabilized(text_in: str, inj: dict, kind: str) -> str:
    """
    If an injury is stabilized, show changed parameters (visible), not just a note.
    Simple rules:
      - Speed penalties: -5 ft softer (e.g. -15 -> -10).
      - 'нет реакций' -> 'реакция доступна 1 раз за бой'.
      - Pain-on-move: +10 боли -> +6 боли; +15 боли -> +10 боли.
    """
    if not inj.get("stabilized", False):
        return text_in

    t = text_in

    def _soften_speed(m):
        val = int(m.group(1))
        newv = max(0, val - 5)
        return f"Скорость -{newv} фт" if newv > 0 else "Скорость без штрафа"

    t = re.sub(r"Скорость -(\d+)\s*фт", _soften_speed, t)
    t = t.replace("нет реакций", "реакция доступна 1 раз за бой")
    t = t.replace("+10 боли", "+6 боли").replace("+15 боли", "+10 боли")

    if kind in ("combat", "social", "exploration") and t:
        t = t + " (стаб.)"
    return t

# ----------------------------- Injury system (persistent players, pain 0..100) -----------------------------
SAVE_FILE = "mood_campaign_save.json"

INJURY_LOCATIONS = [
    ("torso", "Туловище"),
    ("head", "Голова"),
    ("arm_r", "Правая рука"),
    ("arm_l", "Левая рука"),
    ("leg_r", "Правая нога"),
    ("leg_l", "Левая нога"),
]

INJURY_LOCATION_WEIGHTS = [
    ("torso", 0.30),
    ("head", 0.12),
    ("arm_r", 0.14),
    ("arm_l", 0.14),
    ("leg_r", 0.15),
    ("leg_l", 0.15),
]

SEVERITY_ORDER = {"light": 1, "medium": 2, "heavy": 3}
SEVERITY_RU = {"light": "ЛЁГКАЯ", "medium": "СРЕДНЯЯ", "heavy": "ТЯЖЁЛАЯ"}
SEVERITY_COLOR = {"light": "neutral", "medium": "bad", "heavy": "awful"}

def _loc_ru(loc: str) -> str:
    for k, ru in INJURY_LOCATIONS:
        if k == loc:
            return ru
    return loc

def _best_heal_rule(sev: str) -> str:
    if sev == "light":
        return "Полевое лечение возможно. Снять полностью: короткий отдых + набор лекаря (КС 12) или 1 день спокойного восстановления."
    if sev == "medium":
        return "Полевое лечение только стабилизирует. Снять полностью: 1d4 дней отдыха + уход (мазь/шина/перевязки) ИЛИ магия 2 круга (по миру)."
    return "Обычные средства не снимают полностью. Нужно: время (1d6+7 дней) + дорогие материалы/хирургия ИЛИ магия 3 круга+ (спец-ритуал/Greater Restoration и т.п. — по миру)."

def _injury_templates() -> dict:
    return {
        "head": {
            "light": {"combat": "Пока травма не стабилизирована: помеха на первую атаку/заклинание в бою.", "expl": "Помеха на Внимательность.", "social": "Помеха на Проницательность.", "hp_loss": (0, 1), "pain": (10, 18), "notes": "Лёгкое сотрясение/рассечение."},
            "medium": {"combat": "Помеха на инициативу и концентрацию; при уроне ТЕЛ КС 12 или потеря реакции до конца раунда.", "expl": "Помеха на Внимательность и Инвестигейшн.", "social": "Помеха на Убеждение/Обман.", "hp_loss": (2, 4), "pain": (20, 35), "notes": "Сотрясение, кровотечение, светобоязнь."},
            "heavy": {"combat": "В начале хода d6: 1 — оглушён до конца хода; 2–3 — скорость 0; 4–6 — нормально. Помеха на концентрацию.", "expl": "Помеха на проверки ИНТ и МДР (кроме спасбросков).", "social": "Помеха на Харизму; выглядишь пугающе/неадекватно.", "hp_loss": (5, 10), "pain": (40, 70), "notes": "Тяжёлая ЧМТ, риск потери сознания."},
        },
        "torso": {
            "light": {"combat": "При Рывке/Отходе ТЕЛ КС 10; провал — скорость -10 фт в этот ход.", "expl": "Помеха на Атлетику.", "social": "Ты морщишься от боли; лёгкая нервозность.", "hp_loss": (1, 2), "pain": (12, 22), "notes": "Ушиб рёбер/порез/сбитое дыхание."},
            "medium": {"combat": "Помеха на спасброски Телосложения; если получаешь крит — +1d4 урона.", "expl": "Скорость -5 фт вне боя; помеха на Атлетику.", "social": "Помеха на Убеждение при торге/давлении.", "hp_loss": (3, 6), "pain": (25, 45), "notes": "Трещины рёбер, глубокая рана."},
            "heavy": {"combat": "Скорость -10 фт; помеха на атаки в ближнем бою; лечение по тебе вдвое меньше до стабилизации.", "expl": "Каждые 2 часа пути ТЕЛ КС 13 или +10 боли.", "social": "Помеха на Харизму (раздражён, короткие фразы).", "hp_loss": (7, 12), "pain": (45, 80), "notes": "Внутренние повреждения (по стилю мира)."},
        },
        "arm_r": {
            "light": {"combat": "Если держишь предмет правой рукой — -1 к атакам. Можно игнорировать 1 бой, но +5 боли.", "expl": "Помеха на Ловкость рук/инструменты.", "social": "Помеха на Выступление (жесты).", "hp_loss": (0, 2), "pain": (10, 20), "notes": "Растяжение, неглубокая рана."},
            "medium": {"combat": "Правая рука: -2 к атакам и урону оружием этой рукой.", "expl": "Помеха на инструменты и лазание.", "social": "-2 к первой проверке Харизмы в сцене (нервные движения).", "hp_loss": (2, 5), "pain": (22, 45), "notes": "Вывих/трещина/глубокий порез."},
            "heavy": {"combat": "Правая рука недееспособна: нельзя щит/двуручное; атаки этой рукой с помехой. Силовой удар: ТЕЛ КС 14 или 1d4 урона себе.", "expl": "Инструменты/взлом почти невозможны; помеха на проверки, где нужна правая рука.", "social": "Помеха на Харизму в приличных местах (повязки/кровь).", "hp_loss": (6, 10), "pain": (45, 80), "notes": "Перелом/раздробление, риск потери функции."},
        },
        "arm_l": {},
        "leg_r": {
            "light": {"combat": "Скорость -5 фт. При Рывке ЛВК КС 10 или prone.", "expl": "Помеха на Скрытность (шаг тяжёлый).", "social": "-1 к первой проверке Харизмы в сцене (хромота).", "hp_loss": (1, 3), "pain": (12, 24), "notes": "Ушиб/растяжение."},
            "medium": {"combat": "Скорость -10 фт; нельзя Рывок. Если тебя сбили — падаешь автоматически.", "expl": "Каждый час пути ТЕЛ КС 12 или +8 боли.", "social": "Помеха на Запугивание.", "hp_loss": (3, 6), "pain": (25, 50), "notes": "Перелом/глубокая рана."},
            "heavy": {"combat": "Скорость -15 фт; нет реакций. Двигаешься >15 фт/ход — 1d4 урона и +10 боли.", "expl": "Без помощи/носилок не можешь путешествовать дольше 1 часа (иначе +15 боли/час).", "social": "Помеха на Харизму.", "hp_loss": (7, 12), "pain": (50, 85), "notes": "Сложный перелом/разрыв связок."},
        },
        "leg_l": {},
    }

def _build_injury_templates() -> dict:
    t = _injury_templates()
    t["arm_l"] = {k: dict(v) for k, v in t["arm_r"].items()}
    t["leg_l"] = {k: dict(v) for k, v in t["leg_r"].items()}
    return t

INJURY_TEMPLATES = _build_injury_templates()

def _severity_from_damage(max_hp: int, damage: int) -> str:
    if max_hp <= 0:
        return "light"
    frac = damage / max_hp
    if frac >= 0.45:
        return "heavy"
    if frac >= 0.22:
        return "medium"
    return "light"

def _roll_hp_loss(rng: random.Random, sev: str, loc: str) -> int:
    lo, hi = INJURY_TEMPLATES[loc][sev]["hp_loss"]
    return lo if hi <= lo else rng.randint(lo, hi)

def _roll_pain(rng: random.Random, sev: str, loc: str) -> int:
    lo, hi = INJURY_TEMPLATES[loc][sev]["pain"]
    val = rng.randint(lo, hi)

    # Pain is strong, but we keep it playable: scale down a bit overall,
    # and even more for limbs (hands/legs) so it doesn't spiral too fast.
    scale = 0.75
    if loc in ("arm_r", "arm_l", "leg_r", "leg_l"):
        scale = 0.60
    elif loc == "torso":
        scale = 0.70
    elif loc == "head":
        scale = 0.75

    val = int(math.ceil(val * scale))
    return max(0, val)

def pain_effect_text(pain: int) -> str:
    p = int(clamp(pain, 0, 100))
    if p < 15:
        return "Боль фоновая: без штрафов."
    if p < 35:
        return "Боль мешает: -1 к атакам и проверкам характеристик."
    if p < 55:
        return "Сильная боль: -2 к атакам/проверкам; помеха на концентрацию."
    if p < 75:
        return "Очень сильная боль: скорость -5 фт; помеха на атаки; реакции только при ТЕЛ КС 12 в начале хода."
    if p < 90:
        return "Адская боль: скорость вдвое; помеха на все d20; в начале хода ТЕЛ КС 14 или теряешь действие."
    return "Нестерпимо: в начале хода ТЕЛ КС 15 или оглушён до конца хода. Срочно лечиться."


def current_max_hp(player: dict) -> int:
    base = int(player.get("max_hp_base", 0) or 0)
    pen = int(player.get("max_hp_penalty", 0) or 0)
    return max(0, base - pen)

def _default_player(name: str) -> dict:
    return {"name": name, "max_hp_base": 0, "max_hp_penalty": 0, "current_hp": 0, "pain": 0, "injuries": []}

def load_campaign() -> dict:
    try:
        if os.path.exists(SAVE_FILE):
            with open(SAVE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and "players" in data:
                return data
    except Exception:
        pass
    return {"players": {}}

def save_campaign(data: dict) -> None:
    try:
        with open(SAVE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def list_players(campaign: dict) -> List[str]:
    return sorted(list(campaign.get("players", {}).keys()))

def choose_player(campaign: dict) -> str:
    players = list_players(campaign)
    print("\nВыберите игрока:")
    if players:
        for i, nm in enumerate(players, start=1):
            p = campaign["players"][nm]
            pain = p.get("pain", 0)
            pen = p.get("max_hp_penalty", 0)
            base = p.get("max_hp_base", 0)
            curmax = max(0, base - pen) if base else 0
            pain_col = "bad" if pain >= 35 else "neutral" if pain >= 15 else "good"
            print(f"{i} - {nm}  ({color('боль '+str(pain), pain_col)}, максХП {curmax}/{base})")
    print("N - Новый игрок")
    while True:
        c = input("Ваш выбор: ").strip()
        if c.lower() == "n":
            name = input("Имя нового игрока: ").strip()
            if not name:
                print("Имя не может быть пустым.")
                continue
            if name not in campaign["players"]:
                campaign["players"][name] = _default_player(name)
                save_campaign(campaign)
            return name
        if c.isdigit():
            k = int(c)
            if 1 <= k <= len(players):
                return players[k-1]
        print("Неверный выбор.")

def _find_injury(player: dict, loc: str) -> Optional[dict]:
    for inj in player.get("injuries", []):
        if inj.get("location") == loc and not inj.get("healed", False):
            return inj
    return None

def injury_chance(max_hp: int, damage: int, location: str, rng: random.Random) -> float:
    """
    Chance that a *single hit* produces a notable injury.
    - Very small damage is usually a scratch.
    - Damage >= 50% max ХП strongly increases risk.
    - Head hits are a bit more likely to matter.
    """
    if max_hp <= 0:
        return 0.35
    dmg = max(0, int(damage))
    frac = dmg / max_hp

    if dmg <= 1:
        base = 0.02
    elif frac < 0.05:
        base = 0.05
    elif frac < 0.20:
        base = 0.10 + 0.25 * ((frac - 0.05) / 0.15)  # 0.10..0.35
    elif frac < 0.50:
        base = 0.35 + 0.35 * ((frac - 0.20) / 0.30)  # 0.35..0.70
    else:
        base = 0.70 + 0.20 * min(1.0, (frac - 0.50) / 0.50)  # 0.70..0.90

    if frac >= 0.50:
        base += 0.08  # explicit bump for 50%+ hits

    if location == "head":
        base += 0.06
    if location == "torso":
        base += 0.02

    return float(clamp(base, 0.02, 0.95))

HEAD_PSYCH_EFFECTS = [
    "Вспышки воспоминаний: в тишине слышишь бой снова и снова (помеха на спокойное Убеждение, пока не отдохнёшь).",
    "Шум в ушах и «провалы» внимания (помеха на Внимательность в следующей сцене).",
    "Дереализация: мир кажется ненастоящим (помеха на Проницательность; иногда ты отвечаешь невпопад).",
    "Паранойя-искры: ты ждёшь удара со спины (помеха на доверительные разговоры; +2 к проверкам Внимательности на угрозы).",
    "Раздражительность: любая мелочь бесит (помеха на Убеждение; преимущество на Запугивание, но рискуешь сорваться).",
    "Панические микропаузи: при резком звуке замираешь на мгновение (Мастер может требовать МДР КС 12, чтобы не «потерять» реакцию).",
]

def add_injury_for_player(campaign: dict, player_name: str, rng: random.Random) -> None:
    player = campaign["players"][player_name]

    # --- Max ХП is remembered. Ask only once (when base is 0) ---
    base = int(player.get("max_hp_base", 0) or 0)
    if base <= 0:
        while True:
            try:
                base = int(input("\nЗадай базовые максимальные ХП персонажа (вводится один раз): ").strip())
                if base > 0:
                    break
                print("Введите число > 0.")
            except ValueError:
                print("Введите число.")
        player["max_hp_base"] = base
        # initialize current ХП to current max if not set
        if int(player.get("current_hp", 0) or 0) <= 0:
            player["current_hp"] = current_max_hp(player)
        save_campaign(campaign)

    # Clamp current ХП to current max
    curmax = current_max_hp(player)
    curhp = int(player.get("current_hp", 0) or 0)
    if curhp > curmax:
        player["current_hp"] = curmax
        curhp = curmax
        save_campaign(campaign)

    print(color(f"\n{player_name}: ХП {curhp}/{curmax} (макс {curmax}/{player['max_hp_base']}) | боль {player.get('pain',0)}/100", "dim"))

    # --- Damage input ---
    while True:
        try:
            dmg = int(input("Полученный урон (одно попадание/событие): ").strip())
            if dmg > 0:
                break
            print("Введите число > 0.")
        except ValueError:
            print("Введите число.")

    # Apply damage to current ХП
    before_hp = curhp
    curhp = max(0, curhp - dmg)
    player["current_hp"] = curhp
    save_campaign(campaign)

    # Choose location first (even if no injury happens)
    loc = weighted_choice(rng, INJURY_LOCATION_WEIGHTS)

    # Not every hit causes a notable injury
    chance = injury_chance(player["max_hp_base"], dmg, loc, rng)
    roll = rng.random()

    if roll > chance:
        scratch_pain = rng.randint(0, 2) if dmg <= 1 else rng.randint(1, 4)
        before_p = int(player.get("pain", 0) or 0)
        player["pain"] = int(clamp(before_p + scratch_pain, 0, 100))
        save_campaign(campaign)

        print("\n" + "=" * 30)
        print(color(f"Попадание: {_loc_ru(loc)} — царапина/ушиб (без травмы)", "good"))
        print(color(f"Урон: {dmg} | ХП: {before_hp} -> {curhp} / {current_max_hp(player)}", "dim"))
        print(color(f"Шанс травмы: {int(chance*100)}% | Бросок: {int(roll*100)}%", "dim"))
        if scratch_pain:
            pain_col = "bad" if player["pain"] >= 35 else "neutral" if player["pain"] >= 15 else "good"
            print(color(f"Боль +{scratch_pain} (теперь {player['pain']}/100)", pain_col))
            print(color("Болевой статус: " + pain_effect_text(player["pain"]), "dim"))
        else:
            print(color("Боль не усилилась заметно.", "dim"))
        print("=" * 30)
        return

    # Injury occurs
    sev = _severity_from_damage(player["max_hp_base"], dmg)

    existing = _find_injury(player, loc)
    upgraded = False
    if existing:
        old_sev = existing["severity"]
        sev = "medium" if old_sev == "light" else "heavy"
        upgraded = True

    tpl = INJURY_TEMPLATES[loc][sev]

    # ХП max penalty: felt but not oppressive, and never exceeds the damage.
    if sev == "light":
        hp_loss = rng.randint(0, min(2, dmg))
    elif sev == "medium":
        hp_loss = rng.randint(1, min(5, dmg))
    else:
        hp_loss = rng.randint(2, min(8, dmg))

    pain_add = _roll_pain(rng, sev, loc)

    psych = None
    if loc == "head":
        if sev in ("medium", "heavy") or rng.random() < 0.35:
            psych = rng.choice(HEAD_PSYCH_EFFECTS)

    # Apply max ХП penalty (and clamp so current max >= 1)
    player["max_hp_penalty"] = int(player.get("max_hp_penalty", 0) + hp_loss)
    base_now = int(player.get("max_hp_base", 0) or 0)
    if base_now > 0:
        player["max_hp_penalty"] = min(player["max_hp_penalty"], max(0, base_now - 1))

    # Apply pain
    player["pain"] = int(clamp(player.get("pain", 0) + pain_add, 0, 100))

    # Clamp current ХП to new current max
    new_curmax = current_max_hp(player)
    if player["current_hp"] > new_curmax:
        player["current_hp"] = new_curmax

    inj = {
        "location": loc,
        "severity": sev,
        "stabilized": False if sev in ("medium", "heavy") else True,
        "healed": False,
        "max_hp_loss": hp_loss,
        "pain_added": pain_add,
        "combat": tpl["combat"],
        "exploration": tpl["expl"],
        "social": tpl["social"],
        "notes": tpl["notes"],
        "heal_rule": _best_heal_rule(sev),
        "psych_effect": psych,
        "injury_gate": {"chance": chance, "roll": roll, "damage": dmg},
    }

    if existing:
        existing["healed"] = True
        existing["stabilized"] = True

    player["injuries"].append(inj)
    save_campaign(campaign)

    print("\n" + "=" * 30)
    title = f"Травма: {_loc_ru(loc)} — {SEVERITY_RU[sev]}"
    if upgraded:
        title += " (ухудшение из-за повторного удара)"
    print(color(title, SEVERITY_COLOR[sev]))
    print(color(f"Урон: {dmg} | ХП: {before_hp} -> {player['current_hp']} / {current_max_hp(player)}", "dim"))
    print(color(f"Шанс травмы: {int(chance*100)}% | Бросок: {int(roll*100)}%", "dim"))
    pain_col = "bad" if player["pain"] >= 35 else "neutral" if player["pain"] >= 15 else "good"
    print(color(f"Боль +{pain_add} (теперь {player['pain']}/100)", pain_col))
    curmax2 = current_max_hp(player)
    print(color(f"Макс. ХП -{hp_loss} (теперь {curmax2}/{player['max_hp_base']})", "bad" if hp_loss >= 5 else "neutral"))
    print(color("БОЙ: " + inj["combat"], "combat"))
    print(color("ИССЛЕД.: " + inj["exploration"], "exploration"))
    print(color("СОЦ.: " + inj["social"], "social"))
    if psych:
        print(color("ПСИХ. ЭФФЕКТ: " + psych, "awful"))
    print(color("Заметки: " + inj["notes"], "dim"))
    print(color("Лечение: " + inj["heal_rule"], "dim"))
    print(color("Болевой статус: " + pain_effect_text(player["pain"]), "dim"))
    print("=" * 30)

def stabilization_restore_amount(inj: dict) -> int:
    """
    When an injury is stabilized (field treatment), it should ease symptoms a bit:
    - reduces pain (handled elsewhere)
    - partially restores max ХП penalty for this injury (once)
    Rates:
      light: 100% (usually already stabilized on creation)
      medium: 50%
      heavy: 25%
    """
    sev = inj.get("severity", "light")
    loss = int(inj.get("max_hp_loss", 0) or 0)
    already = int(inj.get("max_hp_restored", 0) or 0)
    remaining = max(0, loss - already)
    if remaining <= 0:
        return 0
    rate = 1.0 if sev == "light" else 0.5 if sev == "medium" else 0.25
    amt = int(math.ceil(remaining * rate))
    return max(0, min(amt, remaining))

def stabilize_or_treat_for_player(campaign: dict, player_name: str) -> None:
    player = campaign["players"][player_name]

    print("\nДействие:")
    print("1 - Стабилизировать травму (полевое лечение)")
    print("2 - Снять боль (обезбол/перевязка/дыхание)")
    print("3 - Отметить травму как полностью вылеченную (после времени/магии)")
    print("0 - Назад")
    c = input("Ваш выбор: ").strip()
    if c == "0":
        return

    if c == "2":
        curmax = current_max_hp(player)
        curhp = int(player.get("current_hp", 0) or 0)
        pain_now = int(player.get("pain", 0) or 0)
        print(color(f"Сейчас: ХП {curhp}/{curmax} (макс {curmax}/{player.get('max_hp_base',0)}) | боль {pain_now}/100", "dim"))
        while True:
            try:
                amt = int(input("Сколько боли снять (рекомендация: 10–25): ").strip())
                break
            except ValueError:
                print("Введите число.")
        before = pain_now
        player["pain"] = int(clamp(before - amt, 0, 100))
        save_campaign(campaign)
        print(color(f"Боль: {before} -> {player['pain']}", "good"))
        print(color("Болевой статус: " + pain_effect_text(player["pain"]), "dim"))
        return

    active = [inj for inj in player.get("injuries", []) if not inj.get("healed", False)]
    if not active:
        print(color("У игрока нет активных травм.", "neutral"))
        return

    print("\nАктивные травмы:")
    for i, inj in enumerate(active, start=1):
        loc_ru = _loc_ru(inj["location"])
        sev_ru = SEVERITY_RU[inj["severity"]]
        mark = "стаб." if inj.get("stabilized") else "НЕ стаб."
        print(f"{i} - {loc_ru} | {sev_ru} | {mark} | -{inj.get('max_hp_loss',0)} максХП")

    while True:
        ch = input("Выберите травму: ").strip()
        if ch.isdigit() and 1 <= int(ch) <= len(active):
            inj = active[int(ch)-1]
            break
        print("Неверный выбор.")

    if c == "1":
        if inj.get("stabilized", False):
            print(color("Эта травма уже стабилизирована.", "neutral"))
            return

        inj["stabilized"] = True

        # Pain relief (a bit stronger than before)
        before_pain = int(player.get("pain", 0) or 0)
        player["pain"] = int(clamp(before_pain - 12, 0, 100))

        # Partial max ХП restoration for this injury (once)
        restore = stabilization_restore_amount(inj)
        if restore > 0:
            inj["max_hp_restored"] = int(inj.get("max_hp_restored", 0) or 0) + restore
            before_pen = int(player.get("max_hp_penalty", 0) or 0)
            player["max_hp_penalty"] = max(0, before_pen - restore)
        else:
            before_pen = int(player.get("max_hp_penalty", 0) or 0)

        save_campaign(campaign)

        print(color("Травма стабилизирована (кровь остановлена/шина наложена).", "good"))
        print(color(f"Боль: {before_pain} -> {player['pain']}", "good"))

        if restore > 0:
            curmax = current_max_hp(player)
            print(color(f"МаксХП частично восстановлены: +{restore} (штраф теперь {player['max_hp_penalty']}; макс {curmax}/{player.get('max_hp_base',0)})", "good"))

        print(color("Стабилизация смягчает эффект: помехи/штрафы действуют только на ПЕРВЫЙ подходящий бросок в бою/сцене, дальше — как обычно.", "dim"))
        return

    if c == "3":
        inj["healed"] = True
        inj["stabilized"] = True
        loss = int(inj.get("max_hp_loss", 0))
        before_pen = player.get("max_hp_penalty", 0)
        player["max_hp_penalty"] = max(0, before_pen - loss)
        before_pain = player.get("pain", 0)
        player["pain"] = int(clamp(before_pain - 15, 0, 100))
        save_campaign(campaign)
        print(color("Травма отмечена как вылеченная.", "good"))
        print(color(f"МаксХП штраф: {before_pen} -> {player['max_hp_penalty']}", "good"))
        print(color(f"Боль: {before_pain} -> {player['pain']}", "good"))
        return

def _injury_sev_rank(sev: str) -> int:
    return {"light": 1, "medium": 2, "heavy": 3}.get(sev, 0)

def aggregate_injury_debuffs(player: dict) -> list[str]:
    """
    Computes a short, combined summary of the biggest active debuffs from injuries,
    so DM doesn't have to read each injury line by line.
    """
    active = [inj for inj in player.get("injuries", []) if not inj.get("healed", False)]
    if not active:
        return []

    by_loc = {}
    for inj in active:
        loc = inj.get("location")
        sev = inj.get("severity", "light")
        if loc not in by_loc or _injury_sev_rank(sev) > _injury_sev_rank(by_loc[loc].get("severity","light")):
            by_loc[loc] = inj

    lines = []

    # Legs -> movement
    leg_pen = {"light": 5, "medium": 10, "heavy": 15}
    legs = [by_loc.get("leg_r"), by_loc.get("leg_l")]
    legs = [x for x in legs if x]
    if legs:
        worst = max(legs, key=lambda x: _injury_sev_rank(x.get("severity","light")))
        base_pen = leg_pen.get(worst.get("severity","light"), 0)
        both = len(legs) == 2
        total_pen = base_pen + (5 if both else 0)
        extra = ""
        if both:
            extra = " (обе ноги травмированы: бег и резкие манёвры почти невозможны)"
        lines.append(f"Передвижение: скорость -{total_pen} фт{extra}.")

    # Arms -> attacks / tools
    arms = [by_loc.get("arm_r"), by_loc.get("arm_l")]
    arms = [x for x in arms if x]
    if arms:
        worst = max(arms, key=lambda x: _injury_sev_rank(x.get("severity","light")))
        both = len(arms) == 2
        if both:
            lines.append("Руки: атаки оружием и проверки инструментов с помехой (обе руки травмированы).")
        else:
            sev = worst.get("severity","light")
            if sev == "light":
                lines.append("Рука: если используешь травмированную руку — -1 к атакам и сложные манипуляции затруднены.")
            elif sev == "medium":
                lines.append("Рука: -2 к атакам/урону оружием этой рукой; инструменты и лазание с помехой.")
            else:
                lines.append("Рука: конечность почти недееспособна; щит/двуручное под вопросом, атаки/манипуляции с помехой.")

    # Head / Torso -> concise note
    if "head" in by_loc:
        sev = by_loc["head"].get("severity","light")
        if sev == "light":
            lines.append("Голова: сбивается концентрация и внимание (лёгкое сотрясение).")
        elif sev == "medium":
            lines.append("Голова: сильные провалы внимания; риск потери реакции при уроне.")
        else:
            lines.append("Голова: тяжёлая ЧМТ; возможны оглушение/ступор в бою.")
    if "torso" in by_loc:
        sev = by_loc["torso"].get("severity","light")
        if sev == "light":
            lines.append("Туловище: боль мешает рывкам и силовым действиям.")
        elif sev == "medium":
            lines.append("Туловище: дыхание сбивается; силовые действия и концентрация заметно хуже.")
        else:
            lines.append("Туловище: серьёзная травма; каждое усилие даёт откат болью и риском обморока.")

    return lines

def show_player_status_for_player(campaign: dict, player_name: str) -> None:
    p = campaign["players"][player_name]
    base = int(p.get("max_hp_base", 0) or 0)
    pen = int(p.get("max_hp_penalty", 0) or 0)
    curmax = current_max_hp(p)
    curhp = int(p.get("current_hp", 0) or 0)
    pain = int(p.get("pain", 0) or 0)

    print("\n" + "=" * 34)
    print(color(f"Игрок: {player_name}", "bold"))
    print(color(f"Текущее ХП: {curhp}/{curmax}", "bold"))
    print(color(f"Макс ХП: {curmax}/{base} (штраф {pen})", "dim"))
    pain_col = "bad" if pain >= 55 else "neutral" if pain >= 15 else "good"
    print(color(f"Боль: {pain}/100", pain_col))
    print(color("Болевой статус: " + pain_effect_text(pain), "dim"))

    active = [inj for inj in p.get("injuries", []) if not inj.get("healed", False)]
    if not active:
        print(color("\nАктивных травм нет.", "good"))
        print("=" * 34)
        return

    # 1) Сначала — какие именно травмы (коротко)
    print(color("\nТравмы:", "neutral"))
    for inj in active:
        loc_ru = _loc_ru(inj["location"])
        sev = inj["severity"]
        sev_ru = SEVERITY_RU[sev]
        sev_col = SEVERITY_COLOR[sev]
        mark = "стаб." if inj.get("stabilized") else "НЕ стаб."
        raw_loss = int(inj.get("max_hp_loss", 0) or 0)
        eff_loss = effective_max_hp_loss(inj)
        restored = int(inj.get("max_hp_restored", 0) or 0)
        extra = ""
        if inj.get("stabilized") and restored:
            extra = f" (было -{raw_loss}, стаб. вернул +{restored} → сейчас -{eff_loss})"
        print(color(f"- {loc_ru}: {sev_ru} ({mark}) | -{eff_loss} максХП{extra}", sev_col))

    # 2) Детали по каждой травме (ИССЛЕД. можно оставлять под травмой, как ты просил)
    print(color("\nДетали по травмам:", "neutral"))
    for inj in active:
        loc_ru = _loc_ru(inj["location"])
        sev_col = SEVERITY_COLOR[inj["severity"]]
        print(color(f"\n{loc_ru}:", sev_col))

        combat = adjust_injury_text_for_stabilized(inj.get("combat", ""), inj, "combat")
        expl = adjust_injury_text_for_stabilized(inj.get("exploration", ""), inj, "exploration")
        soc = adjust_injury_text_for_stabilized(inj.get("social", ""), inj, "social")

        if combat:
            print(color("  БОЙ: " + combat, "combat"))
        if expl:
            print(color("  ИССЛЕД.: " + expl, "exploration"))
        if soc:
            print(color("  СОЦ.: " + soc, "social"))
        if inj.get("psych_effect"):
            print(color("  ПСИХ.: " + str(inj.get("psych_effect")), "awful"))

    # 3) Суммарные дебаффы (без дублей; скорость суммируем особым правилом)
    combat_set, expl_set, soc_set = set(), set(), set()

    # соберём штрафы ног (с учётом стабилизации)
    leg_penalties = {}
    for inj in active:
        loc = inj.get("location")
        if loc in ("leg_r", "leg_l"):
            ctext = adjust_injury_text_for_stabilized(inj.get("combat", ""), inj, "combat")
            msp = re.search(r"Скорость -(\d+)\s*фт", ctext)
            if msp:
                leg_penalties[loc] = int(msp.group(1))

    for inj in active:
        combat_set.add(adjust_injury_text_for_stabilized(inj.get("combat", ""), inj, "combat"))
        expl_set.add(adjust_injury_text_for_stabilized(inj.get("exploration", ""), inj, "exploration"))
        soc_set.add(adjust_injury_text_for_stabilized(inj.get("social", ""), inj, "social"))

    combat_set.discard("")
    expl_set.discard("")
    soc_set.discard("")

    # убрать отдельные строки скорости, заменив на одну суммарную
    def _strip_speed(entries: set) -> set:
        out = set()
        for t in entries:
            if re.search(r"Скорость -\d+\s*фт|Скорость без штрафа", t):
                tt = re.sub(r"(?:Скорость -\d+\s*фт;?\s*)|(?:Скорость без штрафа;?\s*)", "", t).strip()
                if tt:
                    out.add(tt)
            else:
                out.add(t)
        return out

    combat_set = _strip_speed(combat_set)

    if leg_penalties:
        worst = max(leg_penalties.values())
        both = ("leg_r" in leg_penalties) and ("leg_l" in leg_penalties)
        total = worst + (5 if both else 0)
        if both:
            combat_set.add(f"Передвижение: скорость -{total} фт (обе ноги травмированы: бег и резкие манёвры почти невозможны).")
        else:
            combat_set.add(f"Передвижение: скорость -{total} фт.")

    print(color("\nСуммарно по травмам:", "neutral"))
    if combat_set:
        print(color("• БОЙ:", "neutral"))
        for t in sorted(combat_set):
            print(color("  - " + t, "combat"))
    if expl_set:
        print(color("• ИССЛЕД.:", "neutral"))
        for t in sorted(expl_set):
            print(color("  - " + t, "exploration"))
    if soc_set:
        print(color("• СОЦ.:", "neutral"))
        for t in sorted(soc_set):
            print(color("  - " + t, "social"))

    print("=" * 34)



def choose_injury_location_manual(rng: random.Random) -> str:
    print("\nКуда пришёлся удар?")
    options = [
        ("1", "torso", "Туловище"),
        ("2", "head", "Голова"),
        ("3", "arm_r", "Правая рука"),
        ("4", "arm_l", "Левая рука"),
        ("5", "leg_r", "Правая нога"),
        ("6", "leg_l", "Левая нога"),
        ("7", "random", "Рандом"),
    ]
    for key, _, label in options:
        print(f"{key} - {label}")
    while True:
        c = input("Ваш выбор: ").strip()
        for key, loc, _ in options:
            if c == key:
                if loc == "random":
                    return weighted_choice(rng, INJURY_LOCATION_WEIGHTS)
                return loc
        print("Неверный выбор.")

def choose_injury_severity_manual(rng: random.Random) -> str:
    print("\nКакой тип травмы?")
    options = [
        ("1", "light", "ЛЁГКАЯ"),
        ("2", "medium", "СРЕДНЯЯ"),
        ("3", "heavy", "ТЯЖЁЛАЯ"),
        ("4", "random", "РАНДОМ"),
    ]
    for key, _, label in options:
        print(f"{key} - {label}")
    while True:
        c = input("Ваш выбор: ").strip()
        for key, sev, _ in options:
            if c == key:
                if sev == "random":
                    return weighted_choice(rng, [("light", 0.45), ("medium", 0.35), ("heavy", 0.20)])
                return sev
        print("Неверный выбор.")

def debug_injury_generator(rng: random.Random) -> None:
    """
    Быстрый генератор травм:
    - не запоминает игрока
    - не спрашивает макс ХП
    - спрашивает только область удара и тяжесть
    - быстро показывает дебафф, рекомендуемый штраф макс ХП и прирост боли
    """
    loc = choose_injury_location_manual(rng)
    sev = choose_injury_severity_manual(rng)

    tpl = INJURY_TEMPLATES[loc][sev]
    hp_lo, hp_hi = tpl["hp_loss"]
    pain_lo, pain_hi = tpl["pain"]

    # Смягчение боли как в основной более мягкой системе
    if loc in ("arm_r", "arm_l", "leg_r", "leg_l"):
        pain_lo = max(0, int(round(pain_lo * 0.60)))
        pain_hi = max(pain_lo, int(round(pain_hi * 0.60)))
    elif loc == "torso":
        pain_lo = max(0, int(round(pain_lo * 0.70)))
        pain_hi = max(pain_lo, int(round(pain_hi * 0.70)))
    elif loc == "head":
        pain_lo = max(0, int(round(pain_lo * 0.75)))
        pain_hi = max(pain_lo, int(round(pain_hi * 0.75)))

    recommended_hp_loss = rng.randint(hp_lo, hp_hi) if hp_hi > hp_lo else hp_lo
    recommended_pain = rng.randint(pain_lo, pain_hi) if pain_hi > pain_lo else pain_lo

    loc_ru = _loc_ru(loc)
    sev_ru = SEVERITY_RU[sev]
    sev_col = SEVERITY_COLOR[sev]

    print("\n" + "=" * 34)
    print(color("Быстрый генератор травм", "bold"))
    print(color(f"Попадание: {loc_ru}", sev_col))
    print(color(f"Тяжесть: {sev_ru}", sev_col))
    print(color(f"Рекомендуемый штраф макс ХП: -{recommended_hp_loss}", "neutral" if recommended_hp_loss < 5 else "bad"))
    pain_col = "good" if recommended_pain < 10 else "neutral" if recommended_pain < 25 else "bad"
    print(color(f"Рекомендуемое увеличение боли: +{recommended_pain}", pain_col))
    print(color("БОЙ: " + tpl["combat"], "combat"))
    print(color("ИССЛЕД.: " + tpl["expl"], "exploration"))
    print(color("СОЦ.: " + tpl["social"], "social"))
    print(color("Заметки: " + tpl["notes"], "dim"))
    print(color("Лечение: " + _best_heal_rule(sev), "dim"))
    print("=" * 34)

def injury_menu(campaign: dict, rng: random.Random) -> None:
    # Choose player first, then operate on them until back/switch
    current = choose_player(campaign)

    while True:
        print(f"\n=== Травмы: {color(current, 'bold')} ===")
        print("1 - Добавить травму (по урону; травма не гарантирована)")
        print("2 - Лечение / стабилизация / снять боль / отметить излечение")
        print("3 - Показать состояние игрока")
        print("4 - Изменить базовые макс ХП (увеличить/уменьшить)")
        print("5 - Сменить игрока")
        print("6 - Восстановить ХП (бинты/мазь/магия)")
        print("0 - Назад")

        c = input("Ваш выбор: ").strip()
        if c == "0":
            return
        if c == "1":
            add_injury_for_player(campaign, current, rng)
        elif c == "2":
            stabilize_or_treat_for_player(campaign, current)
        elif c == "3":
            show_player_status_for_player(campaign, current)
        elif c == "4":
            adjust_base_hp_for_player(campaign, current)
        elif c == "5":
            current = choose_player(campaign)
        elif c == "6":
            heal_hp_for_player(campaign, current)
        else:
            print("Неверный выбор.")


# ----------------------------- Event generator (weekly location events) -----------------------------
EVENT_CATEGORY_COLOR = {
    "social": "social",
    "holy": "excellent",
    "order": "good",
    "military": "combat",
    "supernatural": "awful",
    "ecology": "exploration",
    "psyche": "bad",
    "rare": "neutral",
    "very_rare": "awful",
}

EVENT_CATEGORY_LABEL = {
    "social": "СОЦИАЛЬНОЕ",
    "holy": "СВЯТОЕ",
    "order": "ПОРЯДОК",
    "military": "ВОЕННОЕ",
    "supernatural": "СВЕРХЪЕСТЕСТВЕННОЕ",
    "ecology": "ПРИРОДНОЕ",
    "psyche": "ПСИХОЛОГИЧЕСКОЕ",
    "rare": "РЕДКОЕ",
    "very_rare": "ОЧЕНЬ РЕДКОЕ",
}

WEEK_DAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]

LOCATION_EVENTS = [
    {
        "name": "Ярмарка",
        "category": "social",
        "details": "В локации проходит большая ярмарка. Толпы людей, торговцы, слухи и шум.",
        "impact": "Социально: люди разговорчивее, проще найти товары и слухи. Враги-преступники действуют осторожнее среди толпы.",
        "psyche": "Психика: получение психики ×2, но сопротивление потере психики повышается — праздник отвлекает, а шум всё равно давит.",
    },
    {
        "name": "Паломники",
        "category": "holy",
        "details": "Через регион проходит группа паломников со святынями и песнопениями.",
        "impact": "Враги: нежить и одержимые ощущают слабость; религиозные НИП дружелюбнее. Легче найти духовную помощь.",
        "psyche": "Психика: первая потеря психики на неделе уменьшается; при виде паломников возможен разовый подъём морали.",
    },
    {
        "name": "Приезжая стража",
        "category": "order",
        "details": "Вооружённый отряд проводит проверки дорог и застав.",
        "impact": "Враги: бандитов и мародёров меньше, часть их лагерей пустует. Но проверок, допросов и запретов больше.",
        "psyche": "Психика: чувство порядка снижает тревожность, но скрытным персонажам тяжелее расслабиться.",
    },
    {
        "name": "Беженцы",
        "category": "social",
        "details": "В локацию прибывает поток измождённых беженцев с плохими историями.",
        "impact": "Социально: больше слухов, просьб о помощи и напряжения. Могут появиться мародёры и отчаявшиеся воришки.",
        "psyche": "Психика: при первой встрече — разовая потеря психики; дальше мрачные рассказы усиливают эффект тревожных событий.",
    },
    {
        "name": "Праздник урожая",
        "category": "social",
        "details": "В деревнях ставят столы, жгут костры и поют до глубокой ночи.",
        "impact": "Социально: легче добиться помощи, скидок и дружелюбия. Меньше открытой враждебности среди простых людей.",
        "psyche": "Психика: получение морали усиливается; первая потеря психики за неделю уменьшается вдвое.",
    },
    {
        "name": "Траурный день",
        "category": "social",
        "details": "Люди скорбят о недавней трагедии; в воздухе тишина, свечи и закрытые ставни.",
        "impact": "Социально: люди менее разговорчивы, развлечений нет, помощь просят шёпотом. Нежить и мрачные культы чувствуют себя свободнее.",
        "psyche": "Психика: потери морали усиливаются; радостные эффекты и слухи работают слабее.",
    },
    {
        "name": "Охота на монстров",
        "category": "military",
        "details": "Охотники, следопыты и наёмники прочёсывают окрестности.",
        "impact": "Враги: обычных зверей и одиночных чудовищ меньше. Можно наткнуться на охотничьи лагеря и уже очищенные тропы.",
        "psyche": "Психика: знание, что охота идёт, немного успокаивает. Но следы крови и трупы могут дать разовый стресс.",
    },
    {
        "name": "Бандитская активность",
        "category": "military",
        "details": "На дорогах и опушках стало больше дозоров, наблюдателей и засад.",
        "impact": "Враги: возрастает шанс столкновения с разбойниками, вымогателями и следопытами банд. Торговцы боятся ехать.",
        "psyche": "Психика: ожидание засады усиливает тревогу; проверки на страх от внезапной опасности проходят тяжелее.",
    },
    {
        "name": "Разборка банд",
        "category": "military",
        "details": "Две шайки делят территорию, оставляя трупы, костры и пустые схроны.",
        "impact": "Враги: часть лагерей пустует, часть — ослаблена. Можно найти следы боя, пленников или брошенные припасы.",
        "psyche": "Психика: разовое мрачное впечатление при обнаружении последствий; дальше чувствуется шанс наживы и ослабления врага.",
    },
    {
        "name": "Военный отряд",
        "category": "order",
        "details": "Небольшой обученный отряд занимает дороги, башни и удобные переправы.",
        "impact": "Враги: часть чудовищ и бандитов уходит глубже в чащу и руины. Но солдаты могут реквизировать припасы и мешать свободному проходу.",
        "psyche": "Психика: чувство защиты для законопослушных, давление и нервозность для скрытных и виноватых.",
    },
    {
        "name": "Ослабление завесы",
        "category": "supernatural",
        "details": "Граница между материальным миром и иными планами тоньше обычного.",
        "impact": "Враги: нежить, духи и аномальные существа активнее; магические эффекты ощущаются ярче и тревожнее.",
        "psyche": "Психика: все мистические события бьют сильнее; первая встреча с аномалией даёт разовую потерю психики.",
    },
    {
        "name": "Астральный разлом",
        "category": "supernatural",
        "details": "Небо временами отливает фиолетовым, а тени ведут себя слишком живо.",
        "impact": "Враги: существа, связанные с иным, становятся смелее; обычные люди паникуют и прячутся по домам.",
        "psyche": "Психика: астральные сцены дают повышенную потерю психики; сопротивляться ей труднее.",
    },
    {
        "name": "Святая реликвия",
        "category": "holy",
        "details": "В регионе временно находится святыня, к которой тянутся молящиеся и больные.",
        "impact": "Враги: нежить слабеет, культы действуют осторожнее. Часть тёмных существ избегает этого места.",
        "psyche": "Психика: страх и отчаяние действуют слабее; надежда помогает быстрее восстановить мораль.",
    },
    {
        "name": "Проклятая земля",
        "category": "supernatural",
        "details": "Почва чёрная, урожай сохнет, звери нервны, а вода кажется горькой.",
        "impact": "Враги: мрачные твари и культисты чувствуют себя увереннее; крестьяне злы, напуганы и склонны к суевериям.",
        "psyche": "Психика: любые тревожные события ощущаются тяжелее; отдых в такой местности восстанавливает хуже.",
    },
    {
        "name": "Шёпот леса",
        "category": "supernatural",
        "details": "Ветер несёт обрывки слов, а чаща отвечает эхом там, где эха быть не должно.",
        "impact": "Враги: звери и лесные чудовища ведут себя странно, а навигация становится опаснее.",
        "psyche": "Психика: первая прогулка по лесу даёт разовую проверку на стресс; дальше тревога висит фоном.",
    },
    {
        "name": "Миграция зверей",
        "category": "ecology",
        "details": "Животные покидают район, тропы полны следов спешного бегства.",
        "impact": "Враги: обычной дичи меньше, зато хищники и чудовища могут смещаться следом за стадами.",
        "psyche": "Психика: пустой лес и тишина тревожат; при наблюдении миграции возможна разовая потеря морали.",
    },
    {
        "name": "Стая хищников",
        "category": "ecology",
        "details": "В округе появилась большая стая. Ночами слышен вой, а днём — подозрительная тишина.",
        "impact": "Враги: чаще встречаются звериные угрозы, дороги по ночам становятся опаснее.",
        "psyche": "Психика: ночные привалы тревожнее; страх перед темнотой и одиночеством усиливается.",
    },
    {
        "name": "Болезнь скота",
        "category": "ecology",
        "details": "Скот чахнет, сараи воняют лекарствами и гнилью, люди боятся голода.",
        "impact": "Социально: крестьяне раздражены и суеверны. Торговля едой дороже, слухов о проклятии больше.",
        "psyche": "Психика: ощущение надвигающейся беды усиливает тяжёлые разговоры и сцены с крестьянской нищетой.",
    },
    {
        "name": "Плохой урожай",
        "category": "ecology",
        "details": "Амбары полупусты, на рынках спорят за каждое зерно.",
        "impact": "Социально: растут цены, помощь получить сложнее, разбой и мелкие кражи учащаются.",
        "psyche": "Психика: безнадёжность и голодная нервозность усиливают потери морали.",
    },
    {
        "name": "Мрачные слухи",
        "category": "psyche",
        "details": "По трактирам и дворам ползут страшные истории о пропажах, культах и чудовищах.",
        "impact": "Социально: люди чаще отказывают в помощи или требуют плату за сведения. Враги могут пользоваться паникой.",
        "psyche": "Психика: потери морали и стресс от неизвестности усиливаются.",
    },
    {
        "name": "Геройская легенда",
        "category": "psyche",
        "details": "Кто-то рассказывает вдохновляющие истории о победе над тьмой и чудовищами.",
        "impact": "Социально: люди охотнее поддерживают смельчаков, а трусы чувствуют стыд.",
        "psyche": "Психика: получение морали усиливается; первая удачная победа на неделе даёт дополнительный подъём духа.",
    },
    {
        "name": "Странные сны",
        "category": "psyche",
        "details": "Разные люди видят похожие сны о дороге, колодце, луне или чужом голосе.",
        "impact": "Социально: обсуждения снов захватывают деревни и лагеря. Суеверные НИП становятся нервнее.",
        "psyche": "Психика: отдых не кажется до конца безопасным; ночные эффекты и тревога цепляются дольше.",
    },
    {
        "name": "Чувство надвигающейся беды",
        "category": "psyche",
        "details": "Даже в ясный день люди ведут себя так, будто ждут колокольного звона и дыма.",
        "impact": "Социально: меньше смеха, меньше доверия, больше настороженности. Враги могут действовать смелее на фоне общей растерянности.",
        "psyche": "Психика: напряжение висит фоном и усиливает все мрачные впечатления.",
    },
    {
        "name": "Караван",
        "category": "rare",
        "details": "В регион вошёл крупный торговый караван с охраной, фургонами и редкими товарами.",
        "impact": "Социально: больше товаров, новостей и возможностей. Бандиты могут следить за караваном из тени.",
        "psyche": "Психика: оживление даёт краткий подъём духа, но большие толпы и разговоры могут перегружать.",
    },
    {
        "name": "Проповедник конца света",
        "category": "rare",
        "details": "Безумный проповедник кричит о гибели, грехах и скором суде.",
        "impact": "Социально: вызывает конфликты, толпы зевак и раскол мнений. Нервные люди ведутся на страх.",
        "psyche": "Психика: разовая потеря психики при первой сцене с ним; дальше страх распространяется как зараза.",
    },
    {
        "name": "Таинственный странник",
        "category": "rare",
        "details": "Незнакомец появляется в самых странных местах и знает больше, чем должен.",
        "impact": "Социально: может дать важный слух, зацепку или странное предупреждение. Люди спорят, человек ли он вообще.",
        "psyche": "Психика: его слова могут как успокоить, так и взбудоражить — по тону сцены.",
    },
    {
        "name": "Чудо",
        "category": "very_rare",
        "details": "Происходит нечто светлое и почти необъяснимое: исцеление, знак, внезапное спасение.",
        "impact": "Социально: люди надеются и ведут себя мягче. Тёмные силы и культисты осторожничают.",
        "psyche": "Психика: заметное восстановление морали; страх и отчаяние на время слабеют.",
    },
    {
        "name": "Знамение",
        "category": "very_rare",
        "details": "Небо, огонь, тени или животные складываются в знак, который все толкуют по-разному.",
        "impact": "Социально: растут споры, пророчества и суеверия. Одни становятся смелее, другие — трусливее.",
        "psyche": "Психика: сильное разовое впечатление; дальше эффект зависит от того, как персонажи поняли знак.",
    },
    {
        "name": "Предвестие катастрофы",
        "category": "very_rare",
        "details": "В воздухе висит ощущение неизбежной беды. Даже собаки воют иначе.",
        "impact": "Враги и люди одинаково напряжены. Кто-то запирается, кто-то бежит, кто-то готовится к худшему.",
        "psyche": "Психика: мощное давление на всех; тревожные события и сцены ужаса становятся гораздо тяжелее.",
    },
]

def generate_location_events(rng: random.Random):
    count = weighted_choice(rng, [("1", 0.45), ("2", 0.35), ("3", 0.20)])
    count = int(count)
    chosen = rng.sample(LOCATION_EVENTS, k=count)

    events = []
    for ev in chosen:
        duration = rng.randint(2, 7)
        start_day = rng.randint(0, 7 - duration)
        end_day = start_day + duration - 1
        events.append({
            "name": ev["name"],
            "category": ev["category"],
            "details": ev["details"],
            "impact": ev["impact"],
            "psyche": ev["psyche"],
            "duration_days": duration,
            "from_day": WEEK_DAYS[start_day],
            "to_day": WEEK_DAYS[end_day],
        })
    return events


def pretty_print_location_events(events):
    print(color("События недели:", "bold"))
    for i, ev in enumerate(events, start=1):
        cat = ev.get("category", "social")
        cat_color = EVENT_CATEGORY_COLOR.get(cat, "neutral")
        cat_label = EVENT_CATEGORY_LABEL.get(cat, cat.upper())

        header = f"{i}) [{cat_label}] {ev['name']} — {ev['duration_days']} дн. ({ev['from_day']} — {ev['to_day']})"
        print(color(header, cat_color))
        print(color("   Что происходит: " + ev["details"], cat_color))
        print(color("   Влияние на локацию: " + ev["impact"], "social"))
        print(color("   Влияние на психику: " + ev["psyche"], "awful"))

def main() -> None:
    rng = random.Random()
    campaign = load_campaign()
    print("=== Mood Cocktail Engine (v1.3) ===")

    while True:
        print("\nГлавное меню:")
        print("1 - Сгенерировать коктейль настроения")
        print("2 - Сгенерировать погоду")
        print("3 - Генератор травм")
        print("4 - События недели")
        print("5 - Быстрый генератор травм")
        print("0 - Выход")

        c = input("Ваш выбор: ").strip()
        if c == "0":
            print("Выход из программы.")
            break
        if c == "2":
            w = generate_weather(rng)
            print("\n" + "=" * 30)
            pretty_print_weather(w)
            print("=" * 30)
            continue
        if c == "3":
            injury_menu(campaign, rng)
            continue
        if c == "4":
            events = generate_location_events(rng)
            print("\n" + "=" * 30)
            pretty_print_location_events(events)
            print("=" * 30)
            continue
        if c == "5":
            debug_injury_generator(rng)
            continue
        if c != "1":
            print("Неверный выбор.")
            continue

        while True:
            try:
                morale = int(input("\nВведите мораль (1–100): ").strip())
                if 1 <= morale <= 100:
                    break
                print("Мораль должна быть от 1 до 100.")
            except ValueError:
                print("Введите число.")

        while True:
            try:
                n = int(input("Введите количество предыдущих проверок (n): ").strip())
                if n >= 0:
                    break
                print("n не может быть отрицательным.")
            except ValueError:
                print("Введите число.")

        categories = choose_categories_menu()
        res = generate_cocktail(morale=morale, n=n, categories=categories, rng=rng)

        print("\n" + "=" * 30)
        pretty_print(res)
        print("=" * 30)

if __name__ == "__main__":
    main()
