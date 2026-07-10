from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from app import formatters
from app.db import Database


MSK = timezone(timedelta(hours=3))
TELEGRAM_TEXT_LIMIT = 3800


@dataclass
class SessionSummaryResult:
    session_date: str
    campaigns: int = 0
    sent_characters: int = 0
    skipped_characters: int = 0
    failed_characters: int = 0
    errors: list[str] = field(default_factory=list)


def moscow_day_bounds(day: date) -> tuple[str, str]:
    start_msk = datetime.combine(day, time.min, tzinfo=MSK)
    end_msk = start_msk + timedelta(days=1)
    return (
        start_msk.astimezone(timezone.utc).isoformat(timespec="seconds"),
        end_msk.astimezone(timezone.utc).isoformat(timespec="seconds"),
    )


def split_telegram_text(text: str, limit: int = TELEGRAM_TEXT_LIMIT) -> list[str]:
    text = str(text or "").strip()
    if not text:
        return []
    chunks: list[str] = []
    current = ""
    for raw_line in text.splitlines():
        line = raw_line
        while len(line) > limit:
            head, line = line[:limit], line[limit:]
            if current:
                chunks.append(current.rstrip())
                current = ""
            chunks.append(head)
        candidate = f"{current}\n{line}" if current else line
        if len(candidate) > limit:
            chunks.append(current.rstrip())
            current = line
        else:
            current = candidate
    if current:
        chunks.append(current.rstrip())
    return chunks


def _weapon_inventory_lines(item: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    weapon_type = str(item.get("weapon_type") or "оружие")
    reload_type = str(item.get("reload_type") or "magazine")
    lines.append(f"   Тип: {weapon_type}")
    modes = item.get("fire_modes") or []
    if modes:
        mode_text = ", ".join(
            f"{mode.get('name') or 'режим'} ({int(mode.get('ammo_cost') or 1)} бп.)"
            for mode in modes
        )
        lines.append(f"   Режимы огня: {mode_text}")
    if reload_type == "magazine":
        magazines = item.get("magazines") or []
        if magazines:
            lines.append("   Магазины:")
            active_id = int(item.get("active_magazine_id") or 0)
            for magazine in magazines:
                mark = "▶" if int(magazine.get("id") or 0) == active_id else "•"
                lines.append(
                    f"   {mark} {magazine.get('name') or 'Магазин'}: "
                    f"{int(magazine.get('ammo_current') or 0)}/{int(magazine.get('ammo_max') or 0)} "
                    f"· {magazine.get('ammo_type') or 'обычные'}"
                )
        else:
            lines.append("   Магазины: нет")
        stocks = item.get("shell_stocks") or []
        if stocks:
            lines.append("   Патроны:")
            for stock in stocks:
                lines.append(
                    f"   • {stock.get('emoji') or '•'} {stock.get('ammo_type') or 'патроны'} "
                    f"×{int(stock.get('quantity') or 0)}"
                )
        else:
            lines.append("   Патроны: нет")
    else:
        loaded = item.get("loaded_shells") or []
        capacity = int(item.get("mag_capacity") or 0)
        loaded_types = Counter(str(shell.get("ammo_type") or "заряд") for shell in loaded)
        loaded_text = ", ".join(f"{name} ×{count}" for name, count in loaded_types.items()) or "пусто"
        lines.append(f"   Заряжено: {len(loaded)}/{capacity} · {loaded_text}")
        stocks = item.get("shell_stocks") or []
        if stocks:
            lines.append("   Запасы боеприпасов:")
            for stock in stocks:
                lines.append(
                    f"   • {stock.get('emoji') or '•'} {stock.get('ammo_type') or 'боеприпасы'} "
                    f"×{int(stock.get('quantity') or 0)}"
                )
        else:
            lines.append("   Запасы боеприпасов: нет")
    return lines


def inventory_text(inventory: list[dict[str, Any]]) -> str:
    lines = ["🎒 Инвентарь"]
    if not inventory:
        lines.append("Пусто.")
        return "\n".join(lines)
    for index, item in enumerate(inventory, 1):
        emoji = str(item.get("emoji") or ("🔫" if item.get("item_type") == "weapon" else "▫️"))
        lines.append("")
        lines.append(
            f"{index}. {emoji} {item.get('name') or 'Предмет'} ×{int(item.get('quantity') or 1)}"
        )
        description = str(item.get("description") or "").strip()
        if description:
            lines.append(f"   {description}")
        if item.get("item_type") == "weapon":
            lines.extend(_weapon_inventory_lines(item))
    return "\n".join(lines)


def session_snapshot_messages(
    campaign: dict[str, Any],
    character: dict[str, Any],
    inventory: list[dict[str, Any]],
    session_day: date,
) -> list[str]:
    heading = (
        f"📋 Итоги сессии за {session_day.strftime('%d.%m.%Y')}\n"
        f"{campaign.get('emoji') or '🎲'} {campaign.get('name') or 'Кампания'}\n\n"
    )
    character_text = formatters.character_card(character, master=False)
    notes = str(character.get("notes") or "").strip()
    if notes:
        character_text += f"\n\n📝 Заметки:\n{notes}"
    messages = split_telegram_text(heading + character_text)
    inventory_chunks = split_telegram_text(inventory_text(inventory))
    if len(inventory_chunks) > 1:
        inventory_chunks = [
            f"{chunk}\n\nЧасть {index}/{len(inventory_chunks)}"
            for index, chunk in enumerate(inventory_chunks, 1)
        ]
    messages.extend(inventory_chunks)
    return messages


async def send_session_summaries(
    db: Database,
    bot: Any,
    *,
    master_tg_id: int | None = None,
    session_day: date | None = None,
    force: bool = False,
) -> SessionSummaryResult:
    day = session_day or datetime.now(MSK).date()
    day_key = day.isoformat()
    start_utc, end_utc = moscow_day_bounds(day)
    campaigns = db.list_session_campaigns(
        start_utc,
        end_utc,
        master_tg_id=master_tg_id,
    )
    result = SessionSummaryResult(session_date=day_key, campaigns=len(campaigns))
    for campaign in campaigns:
        campaign_id = int(campaign["id"])
        for character in db.list_characters(campaign_id):
            player_tg_id = int(character.get("telegram_user_id") or 0)
            if not player_tg_id:
                continue
            character_id = int(character["id"])
            if not force and db.session_summary_was_sent(campaign_id, character_id, day_key):
                result.skipped_characters += 1
                continue
            try:
                inventory = db.list_inventory(character_id)
                for message in session_snapshot_messages(campaign, character, inventory, day):
                    await bot.send_message(chat_id=player_tg_id, text=message)
                db.mark_session_summary_sent(campaign_id, character_id, day_key)
                result.sent_characters += 1
            except Exception as exc:
                result.failed_characters += 1
                result.errors.append(f"{campaign.get('name')} / {character.get('name')}: {exc}")
    return result
