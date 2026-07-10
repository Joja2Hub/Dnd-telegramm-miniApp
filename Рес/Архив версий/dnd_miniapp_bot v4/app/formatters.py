from __future__ import annotations

from typing import Any

from app import fantasy_rules as rules


def hp_line(char: dict[str, Any]) -> str:
    return f"HP {char['current_hp']}/{char['current_max_hp']} (база {char['max_hp_base']}, штраф {char['max_hp_penalty']})"


def armor_line(char: dict[str, Any]) -> str:
    return f"Броня {char.get('armor_current', 0)}/{char.get('current_max_armor', 0)} (база {char.get('armor_max_base', 0)}, износ {char.get('armor_max_penalty', 0)})"


def character_short(char: dict[str, Any]) -> str:
    active = [i for i in char.get("injuries", []) if not i.get("healed")]
    status_count = len(char.get("statuses", []))
    linked = "🔗" if char.get("telegram_user_id") else "не привязан"
    details = []
    if char.get("armor_enabled"):
        details.append(armor_line(char))
    if char.get("injuries_enabled") and active:
        details.append(f"травмы: {len(active)}")
    if status_count:
        details.append(f"статусы: {status_count}")
    if char.get("injuries_enabled") and char.get("pain", 0):
        details.append(f"боль {char['pain']}")
    tail = ", ".join(details) if details else "без эффектов"
    return f"{char['name']} — {hp_line(char)}, КД {char['ac']}, {tail} | {linked}"


def character_card(char: dict[str, Any], *, master: bool = True) -> str:
    lines = [
        f"🧍 {char['name']}",
        f"{hp_line(char)}",
    ]
    if char.get("armor_enabled"):
        lines.append(f"{armor_line(char)}")
    lines.append(f"КД: {char['ac']}")

    if char.get("injuries_enabled"):
        lines.extend([
            f"Боль: {char['pain']}/100",
            f"Болевой эффект: {rules.pain_effect_text(char['pain'])}",
        ])

    statuses = char.get("statuses", [])
    if statuses:
        lines.append("\nСтатусы:")
        for i, s in enumerate(statuses, 1):
            lines.append(f"{i}. {s}")
    else:
        lines.append("\nСтатусы: нет")

    if char.get("injuries_enabled"):
        active = [i for i in char.get("injuries", []) if not i.get("healed")]
        if active:
            lines.append("\nТравмы:")
            for i, inj in enumerate(active, 1):
                mark = "стаб." if inj.get("stabilized") else "НЕ стаб."
                lines.append(
                    f"{i}. {rules.loc_ru(inj.get('location'))} — {rules.severity_ru(inj.get('severity', ''))}, {mark}, -{inj.get('max_hp_loss', 0)} макс. HP"
                )
                lines.append(f"   Бой: {inj.get('combat', '')}")
                if inj.get("psych_effect"):
                    lines.append(f"   Псих. эффект: {inj['psych_effect']}")
        else:
            lines.append("\nТравмы: нет")

    debuffs = rules.aggregate_debuffs(char)
    if debuffs:
        lines.append("\nКоротко по дебаффам:")
        for d in debuffs:
            lines.append(f"• {d}")

    if master:
        lines.append(f"\nID персонажа: {char['id']}")
    return "\n".join(lines)


def damage_result_master(res: rules.DamageResult, title: str = "Урон применён") -> str:
    lines = [
        f"⚔️ {title}: {res.character['name']}",
        f"Входящий урон: {res.damage}",
    ]
    if res.armor_enabled:
        mode = "бронебойный" if res.armor_mode == "piercing" else "обычный"
        lines.append(f"Броня ({mode}): {res.armor_before} → {res.armor_after} / {res.armor_max_after}, урон броне {res.armor_damage}")
        lines.append(f"В HP прошло: {res.hp_damage}")
    lines.extend([
        f"HP: {res.hp_before} → {res.hp_after} / {res.max_hp_after}",
    ])
    if res.injuries_enabled:
        lines.append(f"Боль: {res.pain_before} → {res.pain_after}")
        if res.location:
            lines.append(f"Зона: {rules.loc_ru(res.location)}")
        if res.injury_chance is not None and res.injury_roll is not None:
            lines.append(f"Шанс травмы: {round(res.injury_chance * 100)}%, бросок: {round(res.injury_roll * 100)}%")
        if res.injury_created and res.injury:
            inj = res.injury
            up = " — ухудшение старой травмы" if inj.get("upgraded") else ""
            lines.append(f"\n🩸 Травма: {rules.loc_ru(inj['location'])} — {rules.severity_ru(inj['severity'])}{up}")
            lines.append(f"Макс. HP -{inj.get('max_hp_loss', 0)}")
            lines.append(f"Бой: {inj.get('combat', '')}")
            lines.append(f"Исследование: {inj.get('exploration', '')}")
            lines.append(f"Социалка: {inj.get('social', '')}")
            if inj.get("psych_effect"):
                lines.append(f"Псих. эффект: {inj['psych_effect']}")
            lines.append(f"Лечение: {inj.get('heal_rule', '')}")
        elif res.scratch_pain:
            lines.append(f"Травмы нет. Боль +{res.scratch_pain}.")
        elif res.hp_damage > 0:
            lines.append("Травмы нет.")
        elif res.damage > 0 and res.armor_enabled:
            lines.append("Урон поглощён бронёй.")
        lines.append(f"\nБолевой статус: {rules.pain_effect_text(res.pain_after)}")
    elif res.damage > 0 and res.armor_enabled and res.hp_damage == 0:
        lines.append("Урон поглощён бронёй.")
    return "\n".join(lines)


def damage_result_player(res: rules.DamageResult, title: str = "Ты получил урон") -> str:
    lines = [
        f"⚔️ {title}",
        f"Входящий урон: {res.damage}",
    ]
    if res.armor_enabled:
        mode = "бронебойный" if res.armor_mode == "piercing" else "обычный"
        lines.append(f"Броня ({mode}): {res.armor_before} → {res.armor_after} / {res.armor_max_after}")
        lines.append(f"В HP прошло: {res.hp_damage}")
    lines.append(f"HP: {res.hp_before} → {res.hp_after} / {res.max_hp_after}")
    if res.injuries_enabled:
        lines.append(f"Боль: {res.pain_before} → {res.pain_after}")
        if res.injury_created and res.injury:
            inj = res.injury
            lines.append(f"\n🩸 Получена травма: {rules.loc_ru(inj['location'])} — {rules.severity_ru(inj['severity'])}")
            lines.append(f"Эффект в бою: {inj.get('combat', '')}")
        lines.append(f"\nБолевой статус: {rules.pain_effect_text(res.pain_after)}")
    return "\n".join(lines)


def armor_repair_result_text(res: rules.ArmorRepairResult) -> str:
    crit = "Да" if res.crit20 else "Нет"
    return (
        f"🛠 Ремонт брони: {res.character['name']}\n"
        f"Проверка: {res.roll} | крит. 20: {crit}\n"
        f"Макс. прочность брони: {res.armor_max_before} → {res.armor_max_after} (-{res.max_loss})\n"
        f"Текущая броня: {res.armor_before} → {res.armor_after}"
    )


def generator_mood_text(result: dict[str, Any]) -> str:
    tier_ru = {
        "EXCELLENT": "🌟 Отличный",
        "GOOD": "🟢 Хороший",
        "NEUTRAL": "🟡 Нейтральный",
        "BAD": "🔴 Плохой",
        "AWFUL": "💀 Ужасный",
    }
    cat_ru = {
        "combat": "⚔️ Бой",
        "social": "🎭 Социалка",
        "exploration": "🧭 Исследование",
    }
    lines = [
        "🧠 Генератор настроения",
        f"Мораль: {result.get('morale')} | Накопление: {result.get('n')}",
        f"Фаза: {result.get('phase', {}).get('name', '—')}",
        f"Эффектов: {result.get('count', 0)}",
    ]
    effects = result.get("effects", [])
    if not effects:
        lines.append("Ничего не произошло.")
        return "\n".join(lines)
    lines.append("")
    for i, e in enumerate(effects, 1):
        dur = e.get("duration", {})
        tier = tier_ru.get(e.get("tier"), str(e.get("tier", "")))
        cat = cat_ru.get(e.get("category"), str(e.get("category", "")))
        lines.append(f"{i}. {cat} · {tier}")
        lines.append(f"{e.get('name')} — {dur.get('value')} {dur.get('unit')}")
        lines.append(f"{e.get('combat_text')}")
        if "screen" in (e.get("tags") or []):
            lines.append("🎲 За ширмой / искажённое восприятие")
        if e.get("aftermath"):
            lines.append(f"После данжа: {e['aftermath']}")
        if e.get("coping"):
            lines.append(f"Как жить: {e['coping']}")
        lines.append("")
    return "\n".join(lines).strip()

def weather_text(w: dict[str, Any]) -> str:
    lines = ["🌦 Погода"]
    for key, label in [
        ("season", "Сезон"),
        ("temperature", "Температура"),
        ("temp", "Температура"),
        ("sky", "Небо"),
        ("wind", "Ветер"),
        ("precipitation", "Осадки"),
        ("visibility", "Видимость"),
        ("ground", "Земля"),
        ("effect", "Эффект"),
        ("special", "Особенность"),
        ("type", "Тип"),
        ("flavor", "Атмосфера"),
    ]:
        if key in w and w[key]:
            lines.append(f"{label}: {w[key]}")
    if len(lines) == 1:
        lines.append(str(w))
    return "\n".join(lines)


def location_events_text(events: list[dict[str, Any]]) -> str:
    lines = ["📍 События недели"]
    for i, ev in enumerate(events, 1):
        lines.append(f"\n{i}. {ev.get('name', 'Событие')} — {ev.get('duration_days', '?')} дн. ({ev.get('from_day', '?')} — {ev.get('to_day', '?')})")
        if ev.get("details"):
            lines.append(f"Что происходит: {ev['details']}")
        if ev.get("impact"):
            lines.append(f"Влияние на локацию: {ev['impact']}")
        if ev.get("psyche"):
            lines.append(f"Влияние на психику: {ev['psyche']}")
    return "\n".join(lines)
