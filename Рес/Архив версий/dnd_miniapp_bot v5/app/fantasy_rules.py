from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Any

from app.legacy import final_generator_v25 as legacy


@dataclass
class DamageResult:
    character: dict[str, Any]
    damage: int
    hp_damage: int
    hp_before: int
    hp_after: int
    max_hp_before: int
    max_hp_after: int
    pain_before: int
    pain_after: int
    armor_enabled: bool = False
    armor_mode: str = "normal"  # normal / piercing / ignore
    armor_before: int = 0
    armor_after: int = 0
    armor_max_before: int = 0
    armor_max_after: int = 0
    armor_damage: int = 0
    injuries_enabled: bool = True
    location: str | None = None
    injury_created: bool = False
    injury: dict[str, Any] | None = None
    injury_chance: float | None = None
    injury_roll: float | None = None
    scratch_pain: int = 0
    injury_mode: str = "default"


@dataclass
class ArmorRepairResult:
    character: dict[str, Any]
    roll: int
    crit20: bool
    max_loss: int
    armor_before: int
    armor_after: int
    armor_max_before: int
    armor_max_after: int


def clamp_int(value: int | float, lo: int, hi: int) -> int:
    return int(max(lo, min(hi, value)))


def current_max_hp(char: dict[str, Any]) -> int:
    return max(0, int(char.get("max_hp_base", 0) or 0) - int(char.get("max_hp_penalty", 0) or 0))


def current_max_armor(char: dict[str, Any]) -> int:
    return max(0, int(char.get("armor_max_base", 0) or 0) - int(char.get("armor_max_penalty", 0) or 0))


def pain_effect_text(pain: int) -> str:
    return legacy.pain_effect_text(int(pain))


def loc_ru(location: str | None) -> str:
    if not location:
        return "—"
    return legacy._loc_ru(location)


def severity_ru(severity: str) -> str:
    return legacy.SEVERITY_RU.get(severity, severity)


def roll_expr(expr: str, rng: random.Random | None = None) -> int:
    return int(legacy.roll_dice(rng or random.Random(), expr.strip()))


def parse_damage(text: str, rng: random.Random | None = None) -> int:
    text = text.strip().lower().replace("х", "x")
    if not text:
        raise ValueError("Пустой урон")
    first = text.split()[0]
    return max(0, roll_expr(first, rng or random.Random()))


def active_injuries(char: dict[str, Any]) -> list[dict[str, Any]]:
    return [i for i in char.get("injuries", []) if not i.get("healed")]


def find_active_injury(char: dict[str, Any], location: str) -> dict[str, Any] | None:
    for inj in active_injuries(char):
        if inj.get("location") == location:
            return inj
    return None


def aggregate_debuffs(char: dict[str, Any]) -> list[str]:
    if not char.get("injuries_enabled", True):
        return []
    pseudo = {
        "injuries": char.get("injuries", []),
        "pain": char.get("pain", 0),
        "max_hp_base": char.get("max_hp_base", 0),
        "max_hp_penalty": char.get("max_hp_penalty", 0),
        "current_hp": char.get("current_hp", 0),
    }
    try:
        return legacy.aggregate_injury_debuffs(pseudo)
    except Exception:
        return []


def dynamic_injury_hp_loss(base_hp: int, damage: int, severity: str, rng: random.Random) -> int:
    """Процентная потеря максимального HP, чтобы травмы ощущались на любом уровне."""
    base_hp = max(1, int(base_hp))
    damage = max(0, int(damage))
    severity = severity or "light"

    if severity == "light":
        lo, hi, min_loss = 0.02, 0.05, 1
    elif severity == "medium":
        lo, hi, min_loss = 0.08, 0.13, 2
    else:
        lo, hi, min_loss = 0.15, 0.24, 4

    pct = rng.uniform(lo, hi)
    # Очень крупный урон слегка усиливает травму, но не разгоняет её бесконечно.
    dmg_ratio = damage / base_hp
    if dmg_ratio >= 0.50:
        pct *= 1.20
    elif dmg_ratio >= 0.35:
        pct *= 1.10

    loss = int(math.ceil(base_hp * pct))
    return max(min_loss, loss)


def compute_damage(
    db: Any,
    character_id: int,
    damage: int,
    *,
    injuries_enabled: bool | None = None,
    armor_enabled: bool | None = None,
    armor_mode: str = "normal",
    rng: random.Random | None = None,
) -> DamageResult:
    """
    Быстрый расчёт урона.

    armor_mode:
      normal   — броня работает как временные HP: сначала урон получает броня, остаток проходит в HP;
      piercing — бронебойный урон: полный урон получает персонаж, и такой же урон получает броня;
      ignore   — броня игнорируется, весь урон идёт в HP.
    """
    rng = rng or random.Random()
    char = db.get_character(character_id)
    if not char:
        raise ValueError("Персонаж не найден")

    damage = max(0, int(damage))
    injuries_enabled = bool(char.get("injuries_enabled", True)) if injuries_enabled is None else bool(injuries_enabled)
    armor_enabled = bool(char.get("armor_enabled", False)) if armor_enabled is None else bool(armor_enabled)
    armor_mode = armor_mode if armor_mode in {"normal", "piercing", "ignore"} else "normal"

    hp_before = int(char["current_hp"])
    max_before = current_max_hp(char)
    pain_before = int(char.get("pain", 0) or 0)
    armor_before = int(char.get("armor_current", 0) or 0)
    armor_max_before = current_max_armor(char)

    hp_damage = damage
    armor_damage = 0
    armor_after = armor_before

    if armor_enabled and armor_mode != "ignore" and damage > 0:
        if armor_mode == "normal":
            armor_damage = min(armor_before, damage)
            hp_damage = max(0, damage - armor_damage)
        elif armor_mode == "piercing":
            armor_damage = min(armor_before, damage)
            hp_damage = damage
        armor_after = max(0, armor_before - armor_damage)
        char = db.update_character_fields(character_id, armor_current=armor_after)
    else:
        armor_enabled = False
        armor_after = armor_before

    hp_after = max(0, hp_before - hp_damage)
    char = db.update_character_fields(character_id, current_hp=hp_after)

    res = DamageResult(
        character=char,
        damage=damage,
        hp_damage=hp_damage,
        hp_before=hp_before,
        hp_after=hp_after,
        max_hp_before=max_before,
        max_hp_after=current_max_hp(char),
        pain_before=pain_before,
        pain_after=int(char.get("pain", 0) or 0),
        armor_enabled=armor_enabled,
        armor_mode=armor_mode,
        armor_before=armor_before,
        armor_after=armor_after,
        armor_max_before=armor_max_before,
        armor_max_after=current_max_armor(char),
        armor_damage=armor_damage,
        injuries_enabled=injuries_enabled,
        injury_mode="default" if injuries_enabled else "no_pain",
    )

    if damage <= 0 or hp_damage <= 0:
        return res

    if not injuries_enabled:
        res.character = char
        return res

    location = legacy.weighted_choice(rng, legacy.INJURY_LOCATION_WEIGHTS)
    res.location = location
    chance = float(legacy.injury_chance(int(char["max_hp_base"]), hp_damage, location, rng))
    roll = rng.random()
    res.injury_chance = chance
    res.injury_roll = roll

    if roll > chance:
        scratch = rng.randint(0, 2) if hp_damage <= 1 else rng.randint(1, 4)
        pain_after = clamp_int(pain_before + scratch, 0, 100)
        char = db.update_character_fields(character_id, pain=pain_after)
        res.character = char
        res.scratch_pain = scratch
        res.pain_after = pain_after
        return res

    severity = legacy._severity_from_damage(int(char["max_hp_base"]), hp_damage)
    existing = find_active_injury(char, location)
    upgraded = False
    if existing:
        old = existing.get("severity", "light")
        severity = "medium" if old == "light" else "heavy"
        upgraded = True

    tpl = legacy.INJURY_TEMPLATES[location][severity]
    hp_loss = dynamic_injury_hp_loss(int(char["max_hp_base"]), hp_damage, severity, rng)

    pain_add = int(legacy._roll_pain(rng, severity, location))
    psych = None
    if location == "head":
        head_effects = getattr(legacy, "HEAD_PSYCH_EFFECTS", [])
        if head_effects and (severity in ("medium", "heavy") or rng.random() < 0.35):
            psych = rng.choice(head_effects)

    base = int(char["max_hp_base"])
    new_penalty = int(char["max_hp_penalty"]) + hp_loss
    if base > 0:
        new_penalty = min(new_penalty, max(0, base - 1))
    pain_after = clamp_int(pain_before + pain_add, 0, 100)

    if existing:
        db.update_injury(int(existing["id"]), healed=1, stabilized=1)

    injury = {
        "location": location,
        "severity": severity,
        "stabilized": False if severity in ("medium", "heavy") else True,
        "healed": False,
        "max_hp_loss": hp_loss,
        "max_hp_restored": 0,
        "pain_added": pain_add,
        "combat": tpl["combat"],
        "exploration": tpl["expl"],
        "social": tpl["social"],
        "notes": tpl["notes"],
        "heal_rule": legacy._best_heal_rule(severity),
        "psych_effect": psych,
        "upgraded": upgraded,
    }
    injury_id = db.add_injury(character_id, injury)
    injury["id"] = injury_id

    new_max = max(0, base - new_penalty)
    new_hp = min(hp_after, new_max) if new_max > 0 else 0
    char = db.update_character_fields(character_id, max_hp_penalty=new_penalty, pain=pain_after, current_hp=new_hp)

    res.character = char
    res.hp_after = int(char["current_hp"])
    res.max_hp_after = current_max_hp(char)
    res.pain_after = pain_after
    res.injury_created = True
    res.injury = injury
    return res


def armor_repair_max_loss(roll: int) -> int:
    """d20: нат.20 не портит броню; больше 20 не считается критом."""
    roll = int(roll)
    if roll == 20:
        return 0
    if roll >= 17:
        return 1
    if roll >= 13:
        return 2
    if roll >= 9:
        return 3
    if roll >= 5:
        return 4
    return 5


def repair_armor(db: Any, character_id: int, roll: int) -> ArmorRepairResult:
    if int(roll) <= 0:
        raise ValueError("Результат проверки должен быть положительным числом")
    char = db.get_character(character_id)
    if not char:
        raise ValueError("Персонаж не найден")
    armor_before = int(char.get("armor_current", 0) or 0)
    max_before = current_max_armor(char)
    loss = armor_repair_max_loss(int(roll))
    new_penalty = int(char.get("armor_max_penalty", 0) or 0) + loss
    base = int(char.get("armor_max_base", 0) or 0)
    new_penalty = min(new_penalty, base)
    max_after = max(0, base - new_penalty)
    char = db.update_character_fields(character_id, armor_max_penalty=new_penalty, armor_current=max_after)
    return ArmorRepairResult(
        character=char,
        roll=int(roll),
        crit20=int(roll) == 20,
        max_loss=loss,
        armor_before=armor_before,
        armor_after=int(char.get("armor_current", 0) or 0),
        armor_max_before=max_before,
        armor_max_after=current_max_armor(char),
    )


def stabilize_injury(db: Any, character_id: int, injury_id: int) -> tuple[dict[str, Any], str]:
    char = db.get_character(character_id)
    if not char:
        raise ValueError("Персонаж не найден")
    injury = next((i for i in char.get("injuries", []) if int(i["id"]) == int(injury_id)), None)
    if not injury:
        raise ValueError("Травма не найдена")
    if injury.get("healed"):
        return char, "Травма уже вылечена."
    if injury.get("stabilized"):
        return char, "Травма уже стабилизирована."

    severity = injury.get("severity", "light")
    loss = int(injury.get("max_hp_loss", 0) or 0)
    already = int(injury.get("max_hp_restored", 0) or 0)
    remaining = max(0, loss - already)
    rate = 1.0 if severity == "light" else 0.5 if severity == "medium" else 0.25
    restore = max(0, min(int(math.ceil(remaining * rate)), remaining))

    db.update_injury(injury_id, stabilized=1, max_hp_restored=already + restore)
    new_penalty = max(0, int(char["max_hp_penalty"]) - restore)
    new_pain = clamp_int(int(char["pain"]) - 12, 0, 100)
    char = db.update_character_fields(character_id, max_hp_penalty=new_penalty, pain=new_pain)
    return char, f"Травма стабилизирована. Боль -12. Максимум HP восстановлен на {restore}."


def heal_injury(db: Any, character_id: int, injury_id: int) -> tuple[dict[str, Any], str]:
    char = db.get_character(character_id)
    if not char:
        raise ValueError("Персонаж не найден")
    injury = next((i for i in char.get("injuries", []) if int(i["id"]) == int(injury_id)), None)
    if not injury:
        raise ValueError("Травма не найдена")
    if injury.get("healed"):
        return char, "Травма уже была вылечена."

    loss = int(injury.get("max_hp_loss", 0) or 0)
    restored = int(injury.get("max_hp_restored", 0) or 0)
    remaining = max(0, loss - restored)
    db.update_injury(injury_id, healed=1, stabilized=1, max_hp_restored=loss)
    new_penalty = max(0, int(char["max_hp_penalty"]) - remaining)
    new_pain = clamp_int(int(char["pain"]) - 15, 0, 100)
    char = db.update_character_fields(character_id, max_hp_penalty=new_penalty, pain=new_pain)
    return char, f"Травма полностью вылечена. Максимум HP восстановлен на {remaining}, боль -15."
