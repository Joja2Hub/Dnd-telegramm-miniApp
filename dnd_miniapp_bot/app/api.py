from __future__ import annotations

import asyncio
import hashlib
import json
import os
import random
import time
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import fantasy_rules as rules
from app import formatters, generators
from app.auth import TelegramUser, get_current_user_factory
from app.config import Settings
from app.db import Database
from app.image_utils import optimize_upload

# Карты временно отключены по запросу: UI их не показывает, API возвращает пустые списки/ошибку.
MAPS_FEATURE_ENABLED = False


class CreateCampaignIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    rule_type: Literal["fantasy", "cyberpunk"] = "fantasy"
    injuries_enabled: bool = True
    armor_enabled: bool = False
    weapons_enabled: bool = False


class CampaignSettingsIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    emoji: str | None = Field(default=None, max_length=8)
    rule_type: Literal["fantasy", "cyberpunk"] | None = None


class CyberNetrunnerIn(BaseModel):
    character_id: int | None = Field(default=None, ge=1)


class CyberNetworkIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    depth: int = Field(default=4, ge=1, le=9)
    regen_every: int = Field(default=3, ge=0, le=20)
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=100)


class CyberStartIn(BaseModel):
    network_id: int = Field(ge=1)


class CyberMoveIn(BaseModel):
    node_id: str = Field(min_length=1, max_length=80)


class CyberDamageIn(BaseModel):
    target: Literal["runner", "guardian"]
    damage: int = Field(ge=0, le=100000)


class CyberDebugIn(BaseModel):
    runner_hp: int | None = Field(default=None, ge=0, le=100000)
    runner_max_hp: int | None = Field(default=None, ge=1, le=100000)
    runner_net_hp: int | None = Field(default=None, ge=0, le=100000)
    runner_max_net_hp: int | None = Field(default=None, ge=0, le=100000)
    runner_ac: int | None = Field(default=None, ge=1, le=1000)
    guardian_hp: int | None = Field(default=None, ge=0, le=100000)
    guardian_max_hp: int | None = Field(default=None, ge=1, le=100000)
    guardian_ac: int | None = Field(default=None, ge=1, le=1000)


class CyberHackDecisionIn(BaseModel):
    approve: bool


class JoinIn(BaseModel):
    code: str
    character_id: int | None = None


class CreateCharacterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    hp: int = Field(ge=1, le=10000)
    ac: int = Field(ge=1, le=100)
    armor: int = Field(default=0, ge=0, le=10000)
    color: str = Field(default="#72a7ff", max_length=20)


class AttackDamageIn(BaseModel):
    attack_roll: int = Field(ge=-100, le=1000)
    damage: int = Field(ge=0, le=100000)


class DamageIn(BaseModel):
    damage: int = Field(ge=0, le=100000)


class DebugDamageIn(BaseModel):
    damage: int = Field(default=0, ge=0, le=100000)
    armor_mode: Literal["normal", "piercing", "ignore"] = "normal"
    location: Literal["torso", "head", "arm_r", "arm_l", "leg_r", "leg_l"]
    severity: Literal["light", "medium", "heavy"]
    force_injury: bool = True


class MassDamageIn(BaseModel):
    target_ids: list[int]
    damage: int = Field(ge=0, le=100000)
    piercing: bool = False


class MassEnemyDamageIn(BaseModel):
    target_ids: list[int]
    damage: int = Field(ge=0, le=100000)


class ManualEditIn(BaseModel):
    current_hp: int | None = Field(default=None, ge=0, le=100000)
    temp_hp: int | None = Field(default=None, ge=0, le=100000)
    max_hp_base: int | None = Field(default=None, ge=1, le=100000)
    max_hp_penalty: int | None = Field(default=None, ge=0, le=100000)
    ac: int | None = Field(default=None, ge=1, le=1000)
    pain: int | None = Field(default=None, ge=0, le=100)
    armor_current: int | None = Field(default=None, ge=0, le=100000)
    armor_max_base: int | None = Field(default=None, ge=0, le=100000)
    armor_max_penalty: int | None = Field(default=None, ge=0, le=100000)
    color: str | None = Field(default=None, max_length=20)


class PlayerSettingsIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)
    custom_frame: str | None = Field(default=None, max_length=80)
    custom_effect: str | None = Field(default=None, max_length=80)
    custom_tag: str | None = Field(default=None, max_length=80)
    custom_tag_text: str | None = Field(default=None, max_length=80)
    custom_tag_style: str | None = Field(default=None, max_length=80)


class AchievementCreateIn(BaseModel):
    icon: str = Field(default="🏆", min_length=1, max_length=300)
    icon_thumb: str = Field(default="", max_length=300)
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    tag: str = Field(default="", max_length=80)
    cosmetic_reward_id: str | None = Field(default=None, max_length=80)
    cosmetic_effect_reward_id: str | None = Field(default=None, max_length=80)
    tag_reward_id: str | None = Field(default=None, max_length=80)
    custom_tag_name: str = Field(default="", max_length=40)
    custom_tag_emoji: str = Field(default="", max_length=8)
    custom_tag_style: str = Field(default="tag_shape_classic", max_length=80)
    currency_reward: int = Field(default=0, ge=0, le=1000000)


class AchievementGrantIn(BaseModel):
    character_id: int = Field(ge=1)
    master_comment: str = Field(default="", max_length=1000)


class AchievementGrantManyIn(BaseModel):
    character_ids: list[int] = Field(default_factory=list)
    master_comment: str = Field(default="", max_length=1000)


class ShopPurchaseIn(BaseModel):
    item_type: Literal["frame", "effect", "tag"]
    item_id: str = Field(min_length=1, max_length=80)


class CurrencyGrantIn(BaseModel):
    character_id: int = Field(ge=1)
    amount: int = Field(ge=-1000000, le=1000000)
    comment: str = Field(default="", max_length=500)


class SparkTopUpIn(BaseModel):
    master_tg_id: int = Field(ge=1)
    amount: int = Field(ge=1, le=1000000)
    comment: str = Field(default="", max_length=500)


class AdminPlayerCurrencyIn(BaseModel):
    amount: int = Field(ge=-1000000, le=1000000)
    comment: str = Field(default="", max_length=500)


class AdminPlayerAchievementGrantIn(BaseModel):
    achievement_id: int = Field(ge=1)
    character_id: int | None = Field(default=None, ge=1)
    master_comment: str = Field(default="", max_length=1000)


class StatusIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class RepairIn(BaseModel):
    roll: int = Field(ge=1, le=1000)


class PlayerRequestIn(BaseModel):
    request_type: Literal["heal", "stabilize", "injury_heal", "repair", "customization_unlock"]
    roll: int | None = Field(default=None, ge=1, le=1000)
    hp_amount: int | None = Field(default=None, ge=1, le=100000)
    injury_id: int | None = Field(default=None, ge=1)


class MoodIn(BaseModel):
    morale: int = Field(ge=0, le=100)
    n: int = Field(ge=0, le=100)
    categories: str = Field(default="123")


class RequestDecisionIn(BaseModel):
    approve: bool = True


class InitiativeIn(BaseModel):
    initiative: int = Field(ge=-100, le=1000)


class EnemyIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    hp: int = Field(ge=1, le=100000)
    ac: int = Field(ge=1, le=1000)
    initiative: int | None = Field(default=None, ge=-100, le=1000)
    color: str = Field(default="#ef4444", max_length=20)
    hidden_hp: bool = False
    public_note: str = Field(default="", max_length=1000)


class CombatantPatchIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    hp: int | None = Field(default=None, ge=0, le=100000)
    max_hp: int | None = Field(default=None, ge=1, le=100000)
    ac: int | None = Field(default=None, ge=1, le=1000)
    initiative: int | None = Field(default=None, ge=-100, le=1000)
    color: str | None = Field(default=None, max_length=20)
    hidden_hp: bool | None = None
    public_note: str | None = Field(default=None, max_length=1000)


class CombatantDamageIn(BaseModel):
    damage: int = Field(ge=0, le=100000)


class ReorderCombatIn(BaseModel):
    combatant_ids: list[int]


class MapCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)

class MapPingIn(BaseModel):
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)

class InventoryItemIn(BaseModel):
    item_type: Literal["normal", "weapon"] = "normal"
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=1000)
    emoji: str = Field(default="", max_length=8)
    quantity: int = Field(default=1, ge=1, le=9999)
    weapon_type: str = Field(default="", max_length=40)
    reload_type: Literal["magazine", "shell"] = "magazine"
    mag_capacity: int = Field(default=0, ge=0, le=10000)
    ammo_per_attack: int = Field(default=0, ge=0, le=10000)
    magazine_count: int = Field(default=0, ge=0, le=12)
    fire_modes: list[dict[str, Any]] = Field(default_factory=list)
    magazines: list[dict[str, Any]] = Field(default_factory=list)
    shell_stocks: list[dict[str, Any]] = Field(default_factory=list)
    loaded_count: int = Field(default=0, ge=0, le=10000)

class InventoryPatchIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    emoji: str | None = Field(default=None, max_length=8)
    quantity: int | None = Field(default=None, ge=1, le=9999)

class InventoryMoveIn(BaseModel):
    direction: Literal["up", "down"]

class CyberInventorySlotIn(BaseModel):
    mode: Literal["implants", "gear"] = "implants"
    slot_id: str = Field(min_length=1, max_length=80)
    item_id: int | None = Field(default=None, ge=1)

class ReloadRequestIn(BaseModel):
    magazine_id: int = Field(ge=1)

class RefillRequestIn(BaseModel):
    magazine_id: int = Field(ge=1)
    stock_id: int | None = Field(default=None, ge=1)
    amount: int | None = Field(default=None, ge=1, le=10000)

class MagazineCreateIn(BaseModel):
    name: str = Field(default="", max_length=80)
    ammo_max: int = Field(default=1, ge=1, le=10000)
    ammo_current: int | None = Field(default=None, ge=0, le=10000)
    ammo_type: str = Field(default="обычные", max_length=80)
    description: str = Field(default="", max_length=300)

class ShellStockCreateIn(BaseModel):
    ammo_type: str = Field(default="стандартные", max_length=80)
    quantity: int = Field(default=0, ge=0, le=10000)
    emoji: str = Field(default="", max_length=8)
    description: str = Field(default="", max_length=300)

class FireWeaponIn(BaseModel):
    fire_mode_id: int | None = None

class ShellLoadRequestIn(BaseModel):
    stock_id: int = Field(ge=1)
    count: int = Field(default=1, ge=1, le=10000)

class ShellRefillRequestIn(BaseModel):
    stock_id: int = Field(ge=1)
    amount: int = Field(default=1, ge=1, le=10000)


async def _notify(request: Request, tg_id: int | None, text: str) -> None:
    if not tg_id:
        return
    bot = getattr(request.app.state, "bot", None)
    if not bot:
        return
    try:
        await bot.send_message(chat_id=int(tg_id), text=text[:3900])
    except Exception:
        pass


def _campaign_or_404(db: Database, campaign_id: int) -> dict[str, Any]:
    c = db.get_campaign(campaign_id)
    if not c:
        raise HTTPException(404, "Кампания не найдена")
    return c


def _character_or_404(db: Database, character_id: int) -> dict[str, Any]:
    ch = db.get_character(character_id)
    if not ch:
        raise HTTPException(404, "Персонаж не найден")
    return ch


def _role(db: Database, campaign_id: int, tg_id: int) -> str | None:
    c = db.get_campaign(campaign_id)
    if not c:
        return None
    if int(c["master_tg_id"]) == int(tg_id):
        return "master"
    if db.get_character_by_player(campaign_id, tg_id):
        return "player"
    return None

def _dev_impersonated_character(db: Database, settings: Settings, campaign_id: int, user: TelegramUser, character_id: str | int | None) -> dict[str, Any] | None:
    if not settings.dev_mode or not character_id:
        return None
    try:
        cid = int(character_id)
    except Exception:
        return None
    c = db.get_campaign(campaign_id)
    if not c or int(c.get("master_tg_id") or 0) != int(user.id):
        return None
    ch = db.get_character(cid)
    if not ch or int(ch.get("campaign_id") or 0) != int(campaign_id):
        return None
    return ch


def _effective_player_id_for_dev(user: TelegramUser, ch: dict[str, Any]) -> int:
    return int(ch.get("telegram_user_id") or user.id)


def _require_cyberpunk(campaign: dict[str, Any]) -> None:
    if campaign.get("rule_type") != "cyberpunk":
        raise HTTPException(404, "Модуль нетраннера доступен только в кампании Киберпанка")


def _cyber_runner_character(db: Database, campaign: dict[str, Any]) -> dict[str, Any] | None:
    runner_id = campaign.get("netrunner_character_id")
    if not runner_id:
        return None
    char = db.get_character(int(runner_id))
    return char if char and int(char.get("campaign_id") or 0) == int(campaign["id"]) else None


def _require_cyber_netrunner(db: Database, campaign: dict[str, Any], user: TelegramUser) -> dict[str, Any]:
    runner = _cyber_runner_character(db, campaign)
    if not runner or int(runner.get("telegram_user_id") or 0) != int(user.id):
        raise HTTPException(403, "Этот раздел доступен только назначенному нетраннеру")
    return runner


def _cyber_node(state: dict[str, Any], node_id: str) -> dict[str, Any] | None:
    if node_id == "root":
        return {"id": "root", "children": [str(n.get("id")) for n in state.get("nodes", []) if n.get("parentId") == "root"], "level": 0}
    return next((n for n in state.get("nodes", []) if str(n.get("id")) == str(node_id)), None)


def _cyber_adjacent_ids(state: dict[str, Any], node_id: str) -> list[str]:
    node = _cyber_node(state, node_id)
    if not node:
        return []
    ids: list[str] = []
    parent = node.get("parentId")
    if parent:
        ids.append(str(parent))
    ids.extend(str(v) for v in (node.get("children") or []))
    if node_id == "root":
        ids = [str(n.get("id")) for n in state.get("nodes", []) if n.get("parentId") == "root"]
    return ids


def _cyber_log(state: dict[str, Any], text: str) -> None:
    log = list(state.get("log") or [])[-79:]
    log.append(text[:300])
    state["log"] = log


def _ensure_no_open_player_request(db: Database, campaign_id: int, player_tg_id: int) -> None:
    existing_request = db.get_any_open_request_by_player(int(campaign_id), int(player_tg_id))
    if existing_request:
        raise HTTPException(400, "У тебя уже есть активная заявка. Дождись решения мастера, прежде чем отправлять новую.")


def _require_master(db: Database, campaign_id: int, user: TelegramUser) -> dict[str, Any]:
    c = _campaign_or_404(db, campaign_id)
    if int(c["master_tg_id"]) != int(user.id):
        raise HTTPException(403, "Это действие доступно только мастеру")
    return c


def _require_access(db: Database, campaign_id: int, user: TelegramUser) -> str:
    role = _role(db, campaign_id, user.id)
    if not role:
        raise HTTPException(403, "Нет доступа к кампании")
    return role


def _is_spark_admin(db: Database, settings: Settings, user: TelegramUser) -> bool:
    return db.is_spark_admin(user.id, settings.main_master_tg_id)


def _safe_char_for_player(char: dict[str, Any]) -> dict[str, Any]:
    return char


def _undo_for(*chars: dict[str, Any]) -> dict[str, Any]:
    return {"undo": {"restore_characters": [c for c in chars if c]}}


def _find_injury_or_404(db: Database, injury_id: int) -> tuple[dict[str, Any], dict[str, Any]]:
    row = db._one("SELECT * FROM injuries WHERE id=?", (injury_id,))
    if not row:
        raise HTTPException(404, "Травма не найдена")
    ch = _character_or_404(db, int(row["character_id"]))
    injury = next((i for i in ch.get("injuries", []) if int(i["id"]) == int(injury_id)), None)
    if not injury:
        raise HTTPException(404, "Травма не найдена")
    return ch, injury


def _combatant_or_404(db: Database, combatant_id: int) -> dict[str, Any]:
    item = db.get_combatant(combatant_id)
    if not item:
        raise HTTPException(404, "Участник боя не найден")
    return item


def _active_combat_or_404(db: Database, campaign_id: int) -> dict[str, Any]:
    combat = db.get_active_combat(campaign_id)
    if not combat:
        raise HTTPException(404, "Активный бой не найден")
    return combat


def _human_request(req: dict[str, Any]) -> str:
    t = req.get("request_type")
    payload = req.get("payload", {}) or {}
    if t == "heal":
        return f"лечение на {payload.get('hp_amount', '?')} HP"
    if t == "stabilize":
        return f"стабилизация травмы #{payload.get('injury_id', '?')}"
    if t == "injury_heal":
        return f"полное лечение травмы #{payload.get('injury_id', '?')}"
    if t == "repair":
        return f"ремонт брони, бросок {payload.get('roll', '?')}"
    if t == "customization_unlock":
        return "разблокировка уникальной кастомизации"
    return str(t)


def _campaign_summary(db: Database, c: dict[str, Any], tg_id: int) -> dict[str, Any]:
    role = "master" if int(c["master_tg_id"]) == int(tg_id) else "player"
    return {
        "id": c["id"],
        "name": c["name"],
        "invite_code": c["invite_code"] if role == "master" else None,
        "injuries_enabled": c["injuries_enabled"],
        "armor_enabled": c["armor_enabled"],
        "weapons_enabled": c.get("weapons_enabled", False),
        "rule_type": c.get("rule_type", "fantasy"),
        "role": role,
    }


def _public_character(ch: dict[str, Any]) -> dict[str, Any]:
    injuries = [i for i in (ch.get("injuries") or []) if not i.get("healed")]
    return {
        "id": ch.get("id"),
        "telegram_user_id": ch.get("telegram_user_id"),
        "name": ch.get("name"),
        "color": ch.get("color", "#72a7ff"),
        "avatar_path": ch.get("avatar_path", ""),
        "custom_frame": ch.get("custom_frame", ""),
        "custom_effect": ch.get("custom_effect", ""),
        "custom_tag": ch.get("custom_tag", ""),
        "custom_tag_text": ch.get("custom_tag_text", ""),
        "custom_tag_style": ch.get("custom_tag_style", "tag_shape_classic"),
        "unique_custom_unlocked": ch.get("unique_custom_unlocked", False),
        "current_hp": ch.get("current_hp", 0),
        "current_max_hp": ch.get("current_max_hp", 0),
        "armor_enabled": ch.get("armor_enabled", False),
        "armor_current": ch.get("armor_current", 0),
        "current_max_armor": ch.get("current_max_armor", 0),
        "injury_count": len(injuries),
    }


def _sanitize_combatant_for_player(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    hidden = {"current_hp", "max_hp", "hp", "ac", "initiative"}
    return {k: v for k, v in value.items() if k not in hidden}


def _sanitize_event_for_player(event: dict[str, Any]) -> dict[str, Any]:
    # Игрокам нельзя отдавать точные HP/КД врагов через журнал, даже если они скрыты в интерфейсе боя.
    out = dict(event)
    payload = dict(out.get("payload") or {})
    if out.get("kind") == "combat_damage":
        payload.pop("before", None)
        payload.pop("after", None)
        payload["enemy_hp_hidden"] = True
    if out.get("kind") == "combat":
        for key in ("enemy", "current", "before", "after", "combatant"):
            if key in payload:
                payload[key] = _sanitize_combatant_for_player(payload.get(key))
    out["payload"] = payload
    return out


def _upload_root(settings: Settings) -> Path:
    base = Path(settings.db_path).parent if settings.db_path else Path("data")
    root = base / "uploads"
    (root / "avatars").mkdir(parents=True, exist_ok=True)
    (root / "avatars" / "thumbs").mkdir(parents=True, exist_ok=True)
    (root / "achievements").mkdir(parents=True, exist_ok=True)
    (root / "achievements" / "thumbs").mkdir(parents=True, exist_ok=True)
    (root / "frames").mkdir(parents=True, exist_ok=True)
    (root / "frames" / "thumbs").mkdir(parents=True, exist_ok=True)
    return root


def _optimize_existing_uploads(db: Database, upload_root: Path) -> None:
    """Создаёт WebP/миниатюры для старых загруженных картинок, если их ещё нет."""
    def raw_for(public_path: str) -> bytes | None:
        text = str(public_path or "")
        if not text.startswith("/uploads/"):
            return None
        rel = text.replace("/uploads/", "", 1).lstrip("/")
        path = upload_root / rel
        if not path.exists() or not path.is_file():
            return None
        try:
            return path.read_bytes()
        except OSError:
            return None

    try:
        for ch in db._many("SELECT id, avatar_path, avatar_thumb_path FROM characters WHERE avatar_path!='' AND (avatar_thumb_path IS NULL OR avatar_thumb_path='')"):
            raw = raw_for(ch.get("avatar_path", ""))
            if not raw:
                continue
            try:
                out = optimize_upload(raw, upload_root=upload_root, kind="avatar", stem=f"character_{ch['id']}_optimized")
                db.update_character_fields(int(ch["id"]), avatar_path=out.asset_path, avatar_thumb_path=out.thumb_path)
            except Exception:
                continue
        # v31: re-center uploaded frames by the transparent inner hole. Older optimized
        # versions could be centered by their visible bbox, which shifts the avatar hole.
        for c in db._many("SELECT id, asset_path, thumb_path FROM cosmetics WHERE asset_path!=''"):
            asset = str(c.get("asset_path", ""))
            thumb = str(c.get("thumb_path", ""))
            if "_hole32" in asset and thumb:
                continue
            raw = raw_for(asset)
            if not raw:
                continue
            try:
                out = optimize_upload(raw, upload_root=upload_root, kind="frame", stem=f"frame_{c['id']}_hole32")
                db.update_cosmetic_thumb(str(c["id"]), asset_path=out.asset_path, thumb_path=out.thumb_path)
            except Exception:
                continue
        for a in db._many("SELECT id, icon, icon_thumb FROM achievements WHERE icon LIKE '/uploads/%' AND (icon_thumb IS NULL OR icon_thumb='')"):
            raw = raw_for(a.get("icon", ""))
            if not raw:
                continue
            try:
                out = optimize_upload(raw, upload_root=upload_root, kind="achievement", stem=f"achievement_{a['id']}_optimized")
                db.update_achievement_icon_paths(int(a["id"]), icon=out.asset_path, icon_thumb=out.thumb_path)
            except Exception:
                continue
    except Exception:
        # Оптимизация не должна мешать запуску бота.
        return


def create_app(db: Database, settings: Settings, bot: Any | None = None) -> FastAPI:
    app = FastAPI(title="D&D Telegram Mini App")
    app.state.db = db
    app.state.settings = settings
    app.state.bot = bot
    upload_root = _upload_root(settings)
    app.state.upload_root = upload_root
    app.state.upload_locks = {}
    _optimize_existing_uploads(db, upload_root)

    async def run_idempotent_upload(
        scope: str,
        user_id: int,
        raw: bytes,
        upload_id: str | None,
        extra: str,
        operation: Any,
    ) -> dict[str, Any]:
        client_key = str(upload_id or "").strip()[:120]
        fingerprint = hashlib.sha256(raw).hexdigest()
        key_material = f"{scope}|{int(user_id)}|{client_key}|{fingerprint}|{extra}"
        dedup_key = hashlib.sha256(key_material.encode("utf-8")).hexdigest()
        locks: dict[str, asyncio.Lock] = app.state.upload_locks
        lock = locks.setdefault(dedup_key, asyncio.Lock())
        try:
            async with lock:
                cached = db.get_recent_upload_result(dedup_key)
                if cached is not None:
                    return cached
                result = await operation()
                db.save_upload_result(dedup_key, result)
                return result
        finally:
            if not lock.locked():
                locks.pop(dedup_key, None)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    get_current_user = get_current_user_factory(settings)

    @app.get("/api/health")
    async def health() -> dict[str, Any]:
        return {"ok": True}

    @app.get("/api/me")
    async def me(user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        masters = db.list_master_campaigns(user.id)
        players = db.campaigns_for_player(user.id)
        by_id: dict[int, dict[str, Any]] = {}
        for c in masters + players:
            by_id[int(c["id"])] = c
        return {
            "user": {"id": user.id, "first_name": user.first_name, "username": user.username},
            "campaigns": [_campaign_summary(db, c, user.id) for c in by_id.values()],
            "dev_mode": settings.dev_mode,
            "spark_admin": _is_spark_admin(db, settings, user),
        }

    @app.post("/api/campaigns")
    async def create_campaign(data: CreateCampaignIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        c = db.create_campaign(data.name, user.id, rule_type=data.rule_type, injuries_enabled=data.injuries_enabled, armor_enabled=data.armor_enabled, weapons_enabled=data.weapons_enabled)
        db.log(c["id"], None, "campaign", f"Создана кампания {c['name']}")
        return {"campaign": _campaign_summary(db, c, user.id)}

    @app.patch("/api/campaigns/{campaign_id}")
    async def update_campaign_settings(campaign_id: int, data: CampaignSettingsIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        try:
            c = db.update_campaign_settings(campaign_id, name=data.name, emoji=data.emoji, rule_type=data.rule_type)
        except ValueError as e:
            raise HTTPException(404, str(e))
        db.log(campaign_id, None, "campaign", "Настройки кампании обновлены", {"name": c.get("name"), "emoji": c.get("emoji", ""), "rule_type": c.get("rule_type")})
        return {"campaign": _campaign_summary(db, c, user.id)}

    @app.post("/api/campaigns/{campaign_id}/cyber/netrunner")
    async def set_cyber_netrunner(campaign_id: int, data: CyberNetrunnerIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _require_master(db, campaign_id, user)
        _require_cyberpunk(campaign)
        if data.character_id is not None:
            char = _character_or_404(db, data.character_id)
            if int(char["campaign_id"]) != int(campaign_id) or not char.get("telegram_user_id"):
                raise HTTPException(400, "Нетраннером можно назначить только привязанного игрока этой кампании")
        updated = db.update_campaign_settings(campaign_id, netrunner_character_id=data.character_id)
        db.log(campaign_id, data.character_id, "cyber", "Назначен нетраннер" if data.character_id else "Нетраннер снят")
        return {"campaign": _campaign_summary(db, updated, user.id), "netrunner_character": _cyber_runner_character(db, updated)}

    @app.post("/api/campaigns/{campaign_id}/cyber/networks")
    async def create_cyber_network(campaign_id: int, data: CyberNetworkIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _require_master(db, campaign_id, user)
        _require_cyberpunk(campaign)
        network = db.create_cyber_network(campaign_id, data.name, data.depth, data.regen_every, data.nodes)
        db.log(campaign_id, None, "cyber", f"Создана сеть: {network['name']}")
        return {"network": network, "networks": db.list_cyber_networks(campaign_id)}

    @app.post("/api/campaigns/{campaign_id}/cyber/session/start")
    async def start_cyber_session(campaign_id: int, data: CyberStartIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _require_master(db, campaign_id, user)
        _require_cyberpunk(campaign)
        runner = _cyber_runner_character(db, campaign)
        if not runner:
            raise HTTPException(400, "Сначала назначь нетраннера в настройках кампании")
        session = db.start_cyber_session(campaign_id, data.network_id, int(runner["id"]))
        db.log(campaign_id, int(runner["id"]), "cyber", f"Запущена сеть: {session['network']['name']}")
        return {"session": session}

    @app.post("/api/campaigns/{campaign_id}/cyber/move")
    async def move_cyber_netrunner(campaign_id: int, data: CyberMoveIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _campaign_or_404(db, campaign_id)
        _require_cyberpunk(campaign)
        _require_cyber_netrunner(db, campaign, user)
        session = db.get_cyber_session(campaign_id)
        if not session:
            raise HTTPException(400, "Мастер ещё не запустил сеть")
        state = session["state"]
        current = str(state.get("current_node_id") or "root")
        if str(data.node_id) not in _cyber_adjacent_ids(state, current):
            raise HTTPException(400, "Переход в этот узел сейчас недоступен")
        state["current_node_id"] = data.node_id
        revealed = list(state.get("revealed_details") or ["root"])
        if data.node_id not in revealed:
            revealed.append(data.node_id)
        state["revealed_details"] = revealed
        state["actions_left"] = max(0, int(state.get("actions_left") or 0) - 1)
        node = _cyber_node(state, data.node_id) or {}
        _cyber_log(state, f"Переход в узел: {node.get('label') or 'неизвестный'}.")
        return {"session": db.save_cyber_session_state(campaign_id, state)}

    @app.post("/api/campaigns/{campaign_id}/cyber/hack")
    async def request_cyber_hack(campaign_id: int, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _campaign_or_404(db, campaign_id)
        _require_cyberpunk(campaign)
        runner = _require_cyber_netrunner(db, campaign, user)
        session = db.get_cyber_session(campaign_id)
        if not session:
            raise HTTPException(400, "Мастер ещё не запустил сеть")
        state = session["state"]
        if state.get("hack_request"):
            raise HTTPException(400, "Запрос на взлом уже ожидает решения мастера")
        node = _cyber_node(state, str(state.get("current_node_id") or "root"))
        if not node or node.get("id") == "root" or not node.get("protected"):
            raise HTTPException(400, "В текущем узле нет защищённого взлома")
        state["hack_request"] = {"node_id": node["id"], "label": node.get("label") or "Узел", "dc": int(node.get("dc") or 10), "runner_character_id": runner["id"], "status": "pending"}
        state["actions_left"] = max(0, int(state.get("actions_left") or 0) - 1)
        _cyber_log(state, f"Запрос на взлом «{node.get('label') or 'Узел'}» отправлен мастеру.")
        saved = db.save_cyber_session_state(campaign_id, state)
        await _notify(request, campaign.get("master_tg_id"), f"Нетраннер {runner['name']} ждёт решения по взлому: {node.get('label') or 'узел'}.")
        return {"session": saved}

    @app.post("/api/campaigns/{campaign_id}/cyber/hack-decision")
    async def decide_cyber_hack(campaign_id: int, data: CyberHackDecisionIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _require_master(db, campaign_id, user)
        _require_cyberpunk(campaign)
        session = db.get_cyber_session(campaign_id)
        if not session or not session["state"].get("hack_request"):
            raise HTTPException(400, "Нет активного запроса на взлом")
        state = session["state"]
        req = state["hack_request"]
        node = _cyber_node(state, str(req.get("node_id")))
        if data.approve and node:
            node["protected"] = False
            cleared = list(state.get("cleared") or [])
            if node["id"] not in cleared:
                cleared.append(node["id"])
            state["cleared"] = cleared
            _cyber_log(state, f"SUCCESS: доступ к «{req.get('label')}» подтверждён мастером.")
        else:
            _cyber_log(state, f"ERROR: мастер отклонил взлом «{req.get('label')}».")
        state["hack_request"] = None
        return {"session": db.save_cyber_session_state(campaign_id, state)}

    @app.post("/api/campaigns/{campaign_id}/cyber/damage")
    async def cyber_damage(campaign_id: int, data: CyberDamageIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _require_master(db, campaign_id, user)
        _require_cyberpunk(campaign)
        session = db.get_cyber_session(campaign_id)
        if not session:
            raise HTTPException(400, "Нет активной сети")
        state = session["state"]
        if data.target == "runner":
            runner = state.get("runner") or {}
            damage = int(data.damage)
            net = min(int(runner.get("net_hp") or 0), damage)
            runner["net_hp"] = int(runner.get("net_hp") or 0) - net
            runner["hp"] = max(0, int(runner.get("hp") or 0) - (damage - net))
            state["runner"] = runner
            _cyber_log(state, f"Мастер нанёс нетраннеру {damage} урона.")
        else:
            node = _cyber_node(state, str(state.get("current_node_id") or "root"))
            guardian = node.get("guardian") if node else None
            if not isinstance(guardian, dict):
                raise HTTPException(400, "В текущем узле нет скрипта")
            guardian["hp"] = max(0, int(guardian.get("hp") or 0) - int(data.damage))
            _cyber_log(state, f"Мастер нанёс скрипту {data.damage} урона.")
        return {"session": db.save_cyber_session_state(campaign_id, state)}

    @app.post("/api/campaigns/{campaign_id}/cyber/debug")
    async def cyber_debug(campaign_id: int, data: CyberDebugIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        campaign = _require_master(db, campaign_id, user)
        _require_cyberpunk(campaign)
        session = db.get_cyber_session(campaign_id)
        if not session:
            raise HTTPException(400, "Нет активной сети")
        state = session["state"]
        runner = state.get("runner") or {}
        for key, value in {"hp": data.runner_hp, "max_hp": data.runner_max_hp, "net_hp": data.runner_net_hp, "max_net_hp": data.runner_max_net_hp, "ac": data.runner_ac}.items():
            if value is not None:
                runner[key] = int(value)
        state["runner"] = runner
        node = _cyber_node(state, str(state.get("current_node_id") or "root"))
        guardian = node.get("guardian") if node else None
        if isinstance(guardian, dict):
            for key, value in {"hp": data.guardian_hp, "maxHp": data.guardian_max_hp, "ac": data.guardian_ac}.items():
                if value is not None:
                    guardian[key] = int(value)
        _cyber_log(state, "Мастер применил DEBUG-параметры сети.")
        return {"session": db.save_cyber_session_state(campaign_id, state)}


    @app.post("/api/join")
    async def join(data: JoinIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        c = db.get_campaign_by_invite(data.code)
        if not c:
            raise HTTPException(404, "Код кампании не найден")
        if int(c["master_tg_id"]) == int(user.id):
            return {"campaign": _campaign_summary(db, c, user.id), "message": "Ты мастер этой кампании."}
        existing = db.get_character_by_player(int(c["id"]), user.id)
        if existing:
            return {"campaign": _campaign_summary(db, c, user.id), "character": existing, "message": "Ты уже подключён."}
        free = db.unlinked_characters(int(c["id"]))
        if data.character_id is None:
            return {"need_character": True, "campaign": {"id": c["id"], "name": c["name"]}, "characters": free}
        if not any(int(ch["id"]) == int(data.character_id) for ch in free):
            raise HTTPException(400, "Персонаж недоступен для привязки")
        db.link_character(int(data.character_id), user.id)
        ch = db.get_character(int(data.character_id))
        db.log(int(c["id"]), int(data.character_id), "join", f"Игрок подключился к {ch['name'] if ch else data.character_id}")
        return {"campaign": _campaign_summary(db, c, user.id), "character": ch, "message": "Персонаж привязан."}

    @app.get("/api/campaigns/{campaign_id}/state")
    async def campaign_state(
        campaign_id: int,
        user: TelegramUser = Depends(get_current_user),
        x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id"),
    ) -> dict[str, Any]:
        actual_role = _require_access(db, campaign_id, user)
        c = _campaign_or_404(db, campaign_id)
        dev_character = _dev_impersonated_character(db, settings, campaign_id, user, x_dev_view_character_id)
        role = "player" if dev_character else actual_role
        viewer_tg_id = _effective_player_id_for_dev(user, dev_character) if dev_character else user.id
        player_character = None
        team_characters = []
        if role == "master":
            chars = db.list_characters(campaign_id)
            requests = db.list_open_requests(campaign_id)
        else:
            player_character = dev_character or db.get_character_by_player(campaign_id, viewer_tg_id)
            chars = [player_character] if player_character else []
            requests = []
            team_characters = [_public_character(ch) for ch in db.list_characters(campaign_id)]
        active_combat = db.get_active_combat(campaign_id)
        if role != "master":
            active_combat = db.public_combat(active_combat)
        events = db.get_recent_events(campaign_id, 20)
        if role != "master":
            events = [_sanitize_event_for_player(e) for e in events]
        cyber: dict[str, Any] | None = None
        if c.get("rule_type") == "cyberpunk":
            runner = _cyber_runner_character(db, c)
            is_netrunner = bool(runner and int(runner.get("telegram_user_id") or 0) == int(viewer_tg_id))
            cyber = {
                "is_netrunner": is_netrunner,
                "netrunner_character_id": c.get("netrunner_character_id"),
                "netrunner_character": runner if actual_role == "master" or is_netrunner else None,
                "session": db.get_cyber_session(campaign_id) if actual_role == "master" or is_netrunner else None,
                "networks": db.list_cyber_networks(campaign_id) if actual_role == "master" else [],
            }
        inventory_characters = db.list_characters(campaign_id) if role == "master" else ([player_character] if player_character else [])
        return {
            "campaign": _campaign_summary(db, c, user.id),
            "role": role,
            "actual_role": actual_role,
            "dev_view": bool(dev_character),
            "characters": chars,
            "player_character": player_character,
            "team_characters": team_characters,
            "requests": requests,
            "active_combat": active_combat,
            "events": events,
            "cosmetics": db.list_cosmetics(),
            "cosmetic_effects": db.list_cosmetic_effects(),
            "cosmetic_tags": db.list_tags(),
            "unlocked_cosmetic_ids": db.list_unlocked_cosmetic_ids(viewer_tg_id),
            "unlocked_effect_ids": db.list_unlocked_effect_ids(viewer_tg_id),
            "unlocked_tag_ids": db.list_unlocked_tag_ids(viewer_tg_id),
            "currency_balance": db.get_currency_balance(viewer_tg_id),
            "currency_transactions": db.list_currency_transactions(viewer_tg_id, 20),
            "spark_management": db.spark_management_state(user.id, is_admin=_is_spark_admin(db, settings, user)) if actual_role == "master" else None,
            "achievement_templates": db.list_achievements(),
            "achievement_grants": db.list_player_achievement_grants(viewer_tg_id),
            "maps": [] if not MAPS_FEATURE_ENABLED else db.list_maps(campaign_id),
            "map_pings": [] if not MAPS_FEATURE_ENABLED else db.list_active_pings(campaign_id),
            "inventory_requests": db.list_inventory_requests(campaign_id) if role == "master" else [],
            "inventories": {str(ch["id"]): db.list_inventory(int(ch["id"])) for ch in inventory_characters},
            "cyber_inventory_slots": {str(ch["id"]): db.list_cyber_inventory_slots(int(ch["id"])) for ch in inventory_characters} if c.get("rule_type") == "cyberpunk" else {},
            "cyber": cyber,
        }

    @app.post("/api/campaigns/{campaign_id}/characters")
    async def create_character(campaign_id: int, data: CreateCharacterIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        c = _require_master(db, campaign_id, user)
        armor = data.armor if c["armor_enabled"] else 0
        try:
            ch = db.create_character(campaign_id, data.name, data.hp, data.ac, armor=armor, color=data.color)
        except Exception as e:
            raise HTTPException(400, f"Не удалось создать персонажа: {e}")
        db.log(campaign_id, int(ch["id"]), "character", f"Создан персонаж {ch['name']}", {"character_after": ch, "undo": {"delete_characters": [int(ch["id"])]}})
        return {"character": ch}

    async def _apply_damage_and_notify(
        request: Request,
        ch: dict[str, Any],
        damage: int,
        *,
        armor_mode: str,
        title: str,
        forced_location: str | None = None,
        forced_severity: str | None = None,
        force_injury: bool = False,
    ) -> dict[str, Any]:
        c = db.get_campaign(int(ch["campaign_id"]))
        before = db.get_character(int(ch["id"]))
        res = rules.compute_damage(
            db,
            int(ch["id"]),
            damage,
            injuries_enabled=bool(c.get("injuries_enabled", True)) if c else True,
            armor_enabled=bool(c.get("armor_enabled", False)) if c else False,
            armor_mode=armor_mode,
            rng=random.Random(),
            forced_location=forced_location,
            forced_severity=forced_severity,
            force_injury=force_injury,
        )
        payload = {"damage": damage, "armor_mode": armor_mode, "forced_location": forced_location, "forced_severity": forced_severity, "force_injury": force_injury, "character_before": before, "character_after": res.character}
        payload.update(_undo_for(before))
        db.log(int(ch["campaign_id"]), int(ch["id"]), "damage", f"{res.character['name']}: {title}", payload)
        await _notify(request, res.character.get("telegram_user_id"), formatters.damage_result_player(res, title="По тебе применили урон"))
        return {"character": res.character, "result_text": formatters.damage_result_master(res, title=title), "result": res.__dict__}

    @app.post("/api/characters/{character_id}/damage/attack")
    async def attack_damage(character_id: int, data: AttackDamageIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        _require_master(db, int(ch["campaign_id"]), user)
        if int(data.attack_roll) < int(ch["ac"]):
            text = f"🛡 {ch['name']}: атака не попала. Бросок {data.attack_roll} против КД {ch['ac']}."
            db.log(int(ch["campaign_id"]), character_id, "miss", text)
            await _notify(request, ch.get("telegram_user_id"), f"По тебе атаковали, но промахнулись. Бросок {data.attack_roll} против твоей КД {ch['ac']}.")
            return {"hit": False, "character": ch, "result_text": text}
        out = await _apply_damage_and_notify(request, ch, data.damage, armor_mode="normal", title=f"Обычная атака: попадание {data.attack_roll} против КД {ch['ac']}")
        out["hit"] = True
        return out

    @app.post("/api/characters/{character_id}/damage/direct")
    async def direct_damage(character_id: int, data: DamageIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        _require_master(db, int(ch["campaign_id"]), user)
        return await _apply_damage_and_notify(request, ch, data.damage, armor_mode="normal", title="Обычная атака")

    @app.post("/api/characters/{character_id}/damage/piercing")
    async def piercing_damage(character_id: int, data: DamageIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        c = _require_master(db, int(ch["campaign_id"]), user)
        if not c.get("armor_enabled"):
            raise HTTPException(400, "В этой кампании не включена система брони")
        return await _apply_damage_and_notify(request, ch, data.damage, armor_mode="piercing", title="Бронебойный урон")

    @app.post("/api/characters/{character_id}/damage/debug")
    async def debug_damage(character_id: int, data: DebugDamageIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        c = _require_master(db, int(ch["campaign_id"]), user)
        if data.armor_mode == "piercing" and not c.get("armor_enabled"):
            raise HTTPException(400, "В этой кампании не включена система брони")
        title = f"Дебаг-урон: {rules.loc_ru(data.location)} — {rules.severity_ru(data.severity)}"
        return await _apply_damage_and_notify(
            request,
            ch,
            data.damage,
            armor_mode=data.armor_mode,
            title=title,
            forced_location=data.location,
            forced_severity=data.severity,
            force_injury=data.force_injury,
        )

    @app.post("/api/campaigns/{campaign_id}/damage/mass")
    async def mass_damage(campaign_id: int, data: MassDamageIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        c = _require_master(db, campaign_id, user)
        if not data.target_ids:
            raise HTTPException(400, "Нужно выбрать хотя бы одну цель")
        mode = "piercing" if data.piercing else "normal"
        if data.piercing and not c.get("armor_enabled"):
            raise HTTPException(400, "В этой кампании не включена система брони")
        outputs = []
        for cid in data.target_ids:
            ch = _character_or_404(db, int(cid))
            if int(ch["campaign_id"]) != int(campaign_id):
                raise HTTPException(400, "Цель из другой кампании")
            outputs.append(await _apply_damage_and_notify(request, ch, data.damage, armor_mode=mode, title="Массовый урон"))
        return {"items": outputs, "result_text": "\n\n".join(o["result_text"] for o in outputs)}

    @app.post("/api/campaigns/{campaign_id}/combatants/enemies/damage/mass")
    async def mass_enemy_damage(campaign_id: int, data: MassEnemyDamageIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        ids = [int(x) for x in data.target_ids if int(x) > 0]
        if not ids:
            raise HTTPException(400, "Нужно выбрать хотя бы одного врага")
        outputs = []
        for combatant_id in dict.fromkeys(ids):
            item = db.get_combatant(combatant_id)
            if not item or item.get("kind") != "enemy":
                raise HTTPException(404, "Враг не найден")
            combat = db.get_combat(int(item["combat_id"]))
            if not combat or int(combat.get("campaign_id") or 0) != int(campaign_id):
                raise HTTPException(400, "Враг из другой кампании")
            updated = db.damage_enemy_combatant(combatant_id, data.damage)
            title = f"{item['name']}: получил {data.damage} урона"
            db.log(int(campaign_id), None, "combat_damage", title, {"combat_id": item["combat_id"], "damage": data.damage, "before": item, "after": updated, "mass_enemy_damage": True})
            outputs.append({"combatant": updated, "message": f"{updated['name']}: HP {item.get('current_hp')} → {updated.get('current_hp')} / {updated.get('max_hp')}"})
        return {"items": outputs, "result_text": "\n".join(o["message"] for o in outputs)}


    @app.post("/api/campaigns/{campaign_id}/combat/start")
    async def start_combat(campaign_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        combat = db.create_combat(campaign_id)
        db.log(campaign_id, None, "combat", "Начат сбор инициативы", {"combat_id": combat["id"]})
        return {"combat": combat}

    @app.post("/api/combats/{combat_id}/enemies")
    async def add_enemy(combat_id: int, data: EnemyIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        combat = db.get_combat(combat_id)
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        enemy = db.add_enemy_combatant(combat_id, data.name, data.hp, data.ac, data.initiative, data.color, data.hidden_hp, data.public_note)
        db.log(int(combat["campaign_id"]), None, "combat", f"Добавлен враг {enemy['name']}", {"combat_id": combat_id, "enemy": enemy})
        return {"enemy": enemy, "combat": db.get_combat(combat_id)}

    @app.post("/api/combats/{combat_id}/begin")
    async def begin_combat(combat_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        combat = db.get_combat(combat_id)
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        combat = db.begin_combat(combat_id)
        current = combat.get("current") if combat else None
        title = f"Бой начался. Первый ход: {current.get('name') if current else '—'}"
        db.log(int(combat["campaign_id"]), None, "combat", title, {"combat_id": combat_id, "current": current})
        return {"combat": combat, "message": title}

    @app.post("/api/combats/{combat_id}/next")
    async def next_turn(combat_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        combat = db.get_combat(combat_id)
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        combat = db.advance_turn(combat_id)
        current = combat.get("current") if combat else None
        title = f"Ход передан: {current.get('name') if current else '—'}"
        db.log(int(combat["campaign_id"]), None, "combat", title, {"combat_id": combat_id, "round": combat.get("round"), "current": current})
        return {"combat": combat, "message": title}

    @app.post("/api/combats/{combat_id}/finish")
    async def finish_combat(combat_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        combat = db.get_combat(combat_id)
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        combat = db.finish_combat(combat_id)
        db.log(int(combat["campaign_id"]), None, "combat", "Бой завершён", {"combat_id": combat_id})
        return {"combat": combat, "message": "Бой завершён"}

    @app.post("/api/combats/{combat_id}/reorder")
    async def reorder_combat(combat_id: int, data: ReorderCombatIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        combat = db.get_combat(combat_id)
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        combat = db.reorder_combatants(combat_id, data.combatant_ids)
        db.log(int(combat["campaign_id"]), None, "combat", "Порядок инициативы изменён", {"combat_id": combat_id, "order": data.combatant_ids})
        return {"combat": combat}

    @app.post("/api/characters/{character_id}/initiative")
    async def set_player_initiative(
        character_id: int,
        data: InitiativeIn,
        user: TelegramUser = Depends(get_current_user),
        x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id"),
    ) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        dev_ok = bool(_dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id) and str(x_dev_view_character_id) == str(character_id))
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not dev_ok:
            raise HTTPException(403, "Это не твой персонаж")
        combat = _active_combat_or_404(db, int(ch["campaign_id"]))
        item = next((x for x in combat.get("combatants", []) if x.get("kind") == "character" and int(x.get("character_id") or 0) == int(character_id)), None)
        if not item:
            raise HTTPException(404, "Персонаж не найден в инициативе")
        db.set_combatant_initiative(int(item["id"]), data.initiative)
        db.sort_combat_by_initiative(int(combat["id"]))
        db.log(int(ch["campaign_id"]), character_id, "combat", f"{ch['name']}: инициатива {data.initiative}", {"combat_id": combat["id"], "initiative": data.initiative})
        return {"combat": db.public_combat(db.get_combat(int(combat["id"]))), "message": "Инициатива записана"}

    @app.patch("/api/combatants/{combatant_id}")
    async def patch_combatant(combatant_id: int, data: CombatantPatchIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = _combatant_or_404(db, combatant_id)
        combat = db.get_combat(int(item["combat_id"]))
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        updates: dict[str, Any] = {}
        if data.name is not None: updates["name"] = data.name
        if data.hp is not None: updates["current_hp"] = data.hp
        if data.max_hp is not None: updates["max_hp"] = data.max_hp
        if data.ac is not None: updates["ac"] = data.ac
        if data.initiative is not None: updates["initiative"] = data.initiative
        if data.color is not None: updates["color"] = data.color
        if data.hidden_hp is not None: updates["hidden_hp"] = data.hidden_hp
        if data.public_note is not None: updates["public_note"] = data.public_note
        if item.get("kind") != "enemy":
            # Для персонажей в инициативе меняем только инициативу; остальные значения берутся из карточки персонажа.
            updates = {k: v for k, v in updates.items() if k == "initiative"}
        if not updates:
            return {"combatant": item, "combat": combat}
        new_item = db.update_combatant(combatant_id, **updates)
        if "initiative" in updates:
            db.sort_combat_by_initiative(int(item["combat_id"]))
        db.log(int(combat["campaign_id"]), None, "combat", f"Изменён участник инициативы: {new_item['name']}", {"combat_id": item["combat_id"], "before": item, "after": new_item})
        return {"combatant": new_item, "combat": db.get_combat(int(item["combat_id"]))}

    @app.post("/api/combatants/{combatant_id}/damage")
    async def damage_combatant(combatant_id: int, data: CombatantDamageIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = _combatant_or_404(db, combatant_id)
        combat = db.get_combat(int(item["combat_id"]))
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        if item.get("kind") != "enemy":
            raise HTTPException(400, "Урон через этот контроллер применяется только к врагам")
        updated = db.damage_enemy_combatant(combatant_id, data.damage)
        title = f"{item['name']}: получил {data.damage} урона"
        if not updated.get("alive"):
            title += " и удалён из инициативы"
        db.log(int(combat["campaign_id"]), None, "combat_damage", title, {"combat_id": item["combat_id"], "damage": data.damage, "before": item, "after": updated})
        return {"combatant": updated, "combat": db.get_combat(int(item["combat_id"])), "message": title}

    @app.delete("/api/combatants/{combatant_id}")
    async def delete_combatant(combatant_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = _combatant_or_404(db, combatant_id)
        combat = db.get_combat(int(item["combat_id"]))
        if not combat:
            raise HTTPException(404, "Бой не найден")
        _require_master(db, int(combat["campaign_id"]), user)
        if item.get("kind") == "character":
            # Персонажей не удаляем из базы, только из текущего трекера инициативы.
            pass
        db.delete_combatant(combatant_id)
        db.log(int(combat["campaign_id"]), None, "combat", f"Удалён из инициативы: {item['name']}", {"combat_id": item["combat_id"], "combatant": item})
        return {"combat": db.get_combat(int(item["combat_id"])), "message": "Удалено из инициативы"}

    @app.patch("/api/characters/{character_id}")
    async def manual_edit(character_id: int, data: ManualEditIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        _require_master(db, int(ch["campaign_id"]), user)
        updates = {k: v for k, v in data.dict().items() if v is not None}
        if not updates:
            return {"character": ch}
        # Если меняем максимумы, не даём текущим значениям выходить за новый максимум.
        new_ch = db.update_character_fields(character_id, **updates)
        fix: dict[str, Any] = {}
        if int(new_ch["current_hp"]) > int(new_ch["current_max_hp"]):
            fix["current_hp"] = int(new_ch["current_max_hp"])
        if int(new_ch.get("armor_current", 0)) > int(new_ch.get("current_max_armor", 0)):
            fix["armor_current"] = int(new_ch.get("current_max_armor", 0))
        if fix:
            new_ch = db.update_character_fields(character_id, **fix)
        db.log(int(ch["campaign_id"]), character_id, "manual", f"{ch['name']}: ручная правка", {"updates": updates, "character_before": ch, "character_after": new_ch, **_undo_for(ch)})
        await _notify(request, new_ch.get("telegram_user_id"), "Мастер изменил твоё состояние. Открой карточку персонажа, чтобы увидеть актуальные значения.")
        return {"character": new_ch}

    @app.patch("/api/characters/{character_id}/self")
    async def player_edit_self(
        character_id: int,
        data: PlayerSettingsIn,
        user: TelegramUser = Depends(get_current_user),
        x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id"),
    ) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        dev_ok = bool(_dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id) and str(x_dev_view_character_id) == str(character_id))
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not dev_ok:
            raise HTTPException(403, "Это не твой персонаж")
        effective_player_id = _effective_player_id_for_dev(user, ch) if dev_ok else user.id
        updates = {k: v for k, v in data.dict().items() if v is not None}
        if "custom_frame" in updates:
            frame = str(updates.get("custom_frame") or "")
            if frame:
                cosmetic = db.get_cosmetic(frame)
                if not cosmetic:
                    raise HTTPException(400, "Неизвестная рамка")
                if not db.has_cosmetic_unlocked(effective_player_id, frame):
                    raise HTTPException(403, "Эта рамка ещё не открыта")
        if "custom_effect" in updates:
            effect = str(updates.get("custom_effect") or "")
            if effect:
                cosmetic_effect = db.get_cosmetic_effect(effect)
                if not cosmetic_effect:
                    raise HTTPException(400, "Неизвестный эффект")
                if not db.has_effect_unlocked(effective_player_id, effect):
                    raise HTTPException(403, "Этот эффект ещё не открыт")
        if "custom_tag_style" in updates:
            style = str(updates.get("custom_tag_style") or "tag_shape_classic")
            if style == "tag_none":
                style = "tag_shape_classic"
                updates["custom_tag_style"] = style
            shape = db.get_tag(style)
            if not shape:
                raise HTTPException(400, "Форма тэга не найдена")
            if str(shape.get("category") or "") not in {"base", "tag_shape"}:
                raise HTTPException(400, "Выбранный тэг не является формой")
            if not db.has_tag_unlocked(effective_player_id, style):
                raise HTTPException(403, "Эта форма тэга ещё не открыта")
        if "custom_tag" in updates:
            tag = str(updates.get("custom_tag") or "")
            if not tag or tag == "tag_none":
                updates["custom_tag"] = ""
                updates["custom_tag_text"] = ""
            else:
                cosmetic_tag = db.get_tag(tag)
                if not cosmetic_tag:
                    raise HTTPException(400, "Текст тэга не найден")
                if str(cosmetic_tag.get("category") or "") == "tag_shape":
                    raise HTTPException(400, "Выбранный тэг является формой, а не текстом")
                if not db.has_tag_unlocked(effective_player_id, tag):
                    raise HTTPException(403, "Этот текст тэга ещё не открыт")
                updates["custom_tag_text"] = str(cosmetic_tag.get("name") or tag)[:80]
                if str(updates.get("custom_tag_style") or ch.get("custom_tag_style") or "tag_none") == "tag_none":
                    updates["custom_tag_style"] = "tag_shape_classic"
        if not updates:
            return {"character": ch}
        new_ch = db.update_character_fields(character_id, **updates)
        db.log(int(ch["campaign_id"]), character_id, "manual", f"{ch['name']}: игрок изменил настройки", {"updates": updates, "character_before": ch, "character_after": new_ch})
        return {"character": new_ch}

    @app.post("/api/characters/{character_id}/avatar")
    async def upload_avatar(
        character_id: int,
        file: UploadFile = File(...),
        user: TelegramUser = Depends(get_current_user),
        x_upload_id: str | None = Header(default=None, alias="X-Upload-Id"),
    ) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        role = _role(db, int(ch["campaign_id"]), user.id)
        is_owner = int(ch.get("telegram_user_id") or 0) == int(user.id)
        if role != "master" and not is_owner:
            raise HTTPException(403, "Нет доступа к этому персонажу")
        content_type = (file.content_type or "").lower()
        if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
            raise HTTPException(400, "Загрузи изображение JPG, PNG, WEBP или GIF")
        raw = await file.read()

        async def save_avatar() -> dict[str, Any]:
            try:
                optimized = await asyncio.to_thread(
                    optimize_upload,
                    raw,
                    upload_root=Path(app.state.upload_root),
                    kind="avatar",
                    stem=f"character_{character_id}_{int(time.time())}",
                    max_bytes=5 * 1024 * 1024,
                )
            except ValueError as exc:
                raise HTTPException(400, str(exc))
            avatar_path = optimized.asset_path
            avatar_thumb_path = optimized.thumb_path
            new_ch = db.update_character_fields(character_id, avatar_path=avatar_path, avatar_thumb_path=avatar_thumb_path)
            db.log(int(ch["campaign_id"]), character_id, "manual", f"{ch['name']}: обновлена аватарка", {"updates": {"avatar_path": avatar_path, "avatar_thumb_path": avatar_thumb_path}, "character_before": ch, "character_after": new_ch})
            return {"character": new_ch, "avatar_path": avatar_path, "avatar_thumb_path": avatar_thumb_path}

        return await run_idempotent_upload(
            "avatar",
            user.id,
            raw,
            x_upload_id,
            str(character_id),
            save_avatar,
        )

    @app.post("/api/characters/{character_id}/full-heal")
    async def full_heal(character_id: int, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        _require_master(db, int(ch["campaign_id"]), user)
        db.heal_all_injuries(character_id)
        new_ch = db.update_character_fields(
            character_id,
            max_hp_penalty=0,
            pain=0,
            statuses_json=json.dumps([], ensure_ascii=False),
            current_hp=int(ch["max_hp_base"]),
        )
        db.log(int(ch["campaign_id"]), character_id, "full_heal", f"{ch['name']}: полное излечение", {"character_before": ch, "character_after": new_ch, **_undo_for(ch)})
        await _notify(request, new_ch.get("telegram_user_id"), "Мастер применил полное излечение.")
        return {"character": new_ch}

    @app.post("/api/characters/{character_id}/repair-armor")
    async def repair_armor(character_id: int, data: RepairIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        c = _require_master(db, int(ch["campaign_id"]), user)
        if not c.get("armor_enabled"):
            raise HTTPException(400, "В этой кампании не включена система брони")
        before = db.get_character(character_id)
        res = rules.repair_armor(db, character_id, data.roll)
        db.log(int(ch["campaign_id"]), character_id, "armor_repair", f"{ch['name']}: ремонт брони", {"roll": data.roll, "max_loss": res.max_loss, "character_before": before, "character_after": res.character, **_undo_for(before)})
        await _notify(request, res.character.get("telegram_user_id"), formatters.armor_repair_result_text(res))
        return {"character": res.character, "result_text": formatters.armor_repair_result_text(res)}

    @app.post("/api/characters/{character_id}/statuses")
    async def add_status(character_id: int, data: StatusIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        _require_master(db, int(ch["campaign_id"]), user)
        new_ch = db.add_status(character_id, data.text)
        db.log(int(ch["campaign_id"]), character_id, "status", f"{ch['name']}: добавлен статус", {"text": data.text, "character_before": ch, "character_after": new_ch, **_undo_for(ch)})
        return {"character": new_ch}

    @app.delete("/api/characters/{character_id}/statuses/{idx}")
    async def remove_status(character_id: int, idx: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        _require_master(db, int(ch["campaign_id"]), user)
        new_ch = db.remove_status(character_id, idx)
        db.log(int(ch["campaign_id"]), character_id, "status", f"{ch['name']}: удалён статус", {"idx": idx, "character_before": ch, "character_after": new_ch, **_undo_for(ch)})
        return {"character": new_ch}

    @app.post("/api/characters/{character_id}/request")
    async def player_request(
        character_id: int,
        data: PlayerRequestIn,
        request: Request,
        user: TelegramUser = Depends(get_current_user),
        x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id"),
    ) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        dev_ok = bool(_dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id) and str(x_dev_view_character_id) == str(character_id))
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not dev_ok:
            raise HTTPException(403, "Это не твой персонаж")
        effective_player_id = _effective_player_id_for_dev(user, ch) if dev_ok else user.id
        _ensure_no_open_player_request(db, int(ch["campaign_id"]), effective_player_id)
        payload: dict[str, Any] = {}
        if data.request_type == "heal":
            if data.hp_amount is None:
                raise HTTPException(400, "Укажи, сколько HP нужно восстановить")
            payload["hp_amount"] = int(data.hp_amount)
        elif data.request_type in {"stabilize", "injury_heal"}:
            if data.injury_id is None:
                raise HTTPException(400, "Выбери травму")
            if not any(int(i["id"]) == int(data.injury_id) and not i.get("healed") for i in ch.get("injuries", [])):
                raise HTTPException(400, "Эта травма не найдена или уже вылечена")
            payload["injury_id"] = int(data.injury_id)
        elif data.request_type == "repair":
            if data.roll is None:
                raise HTTPException(400, "Для ремонта брони нужен бросок d20")
            payload["roll"] = int(data.roll)
        elif data.request_type == "customization_unlock":
            if db.has_unique_customization(user.id):
                raise HTTPException(400, "Уникальная кастомизация уже разблокирована")
            payload["telegram_user_id"] = int(user.id)
        try:
            req = db.create_request(int(ch["campaign_id"]), character_id, effective_player_id, data.request_type, payload=payload)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        c = db.get_campaign(int(ch["campaign_id"]))
        db.log(int(ch["campaign_id"]), int(ch["id"]), "request", f"{ch['name']}: новая заявка — {_human_request(req)}", {"request": req, "character_after": db.get_character(int(ch["id"]))})
        await _notify(request, c.get("master_tg_id") if c else None, f"Новая заявка от {ch['name']}: {_human_request(req)}. Открой Mini App → Заявки.")
        return {"request": req, "message": "Заявка отправлена мастеру"}

    @app.post("/api/requests/{request_id}/decision")
    async def request_decision(request_id: int, data: RequestDecisionIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        req = db.get_request(request_id)
        if not req:
            raise HTTPException(404, "Заявка не найдена")
        c = _require_master(db, int(req["campaign_id"]), user)
        ch = _character_or_404(db, int(req["character_id"]))
        if not data.approve:
            db.close_request(request_id, "rejected")
            await _notify(request, ch.get("telegram_user_id"), "Мастер отклонил твою заявку.")
            return {"message": "Заявка отклонена"}

        before = db.get_character(int(ch["id"]))
        result_text = "Заявка подтверждена"
        payload = req.get("payload", {}) or {}
        if req["request_type"] == "heal":
            amount = int(payload.get("hp_amount") or 0)
            if amount <= 0:
                raise HTTPException(400, "В заявке не указано значение лечения")
            new_hp = min(int(ch["current_max_hp"]), int(ch["current_hp"]) + amount)
            ch = db.update_character_fields(int(ch["id"]), current_hp=new_hp)
            result_text = f"Лечение подтверждено. HP +{amount}: {before['current_hp'] if before else '?'} → {new_hp}."
        elif req["request_type"] == "stabilize":
            injury_id = int(payload.get("injury_id") or 0)
            ch, result_text = rules.stabilize_injury(db, int(ch["id"]), injury_id)
        elif req["request_type"] == "injury_heal":
            injury_id = int(payload.get("injury_id") or 0)
            ch, result_text = rules.heal_injury(db, int(ch["id"]), injury_id)
        elif req["request_type"] == "repair":
            if not c.get("armor_enabled"):
                raise HTTPException(400, "В этой кампании не включена броня")
            roll = int(payload.get("roll") or 1)
            res = rules.repair_armor(db, int(ch["id"]), roll)
            ch = res.character
            result_text = formatters.armor_repair_result_text(res)
        elif req["request_type"] == "customization_unlock":
            raise HTTPException(400, "Уникальная кастомизация теперь открывается достижениями")
        db.close_request(request_id, "approved")
        db.log(int(req["campaign_id"]), int(ch["id"]), "request", f"{ch['name']}: заявка подтверждена", {"type": req["request_type"], "request_id": request_id, "request_payload": payload, "character_before": before, "character_after": ch, **_undo_for(before)})
        await _notify(request, ch.get("telegram_user_id"), result_text)
        return {"message": result_text, "character": ch}

    @app.post("/api/injuries/{injury_id}/stabilize")
    async def master_stabilize_injury(injury_id: int, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch, injury = _find_injury_or_404(db, injury_id)
        _require_master(db, int(ch["campaign_id"]), user)
        before = db.get_character(int(ch["id"]))
        ch, text = rules.stabilize_injury(db, int(ch["id"]), injury_id)
        db.log(int(ch["campaign_id"]), int(ch["id"]), "injury", f"{ch['name']}: стабилизация травмы", {"injury_id": injury_id, "character_before": before, "character_after": ch, **_undo_for(before)})
        await _notify(request, ch.get("telegram_user_id"), text)
        return {"message": text, "character": ch}

    @app.post("/api/injuries/{injury_id}/heal")
    async def master_heal_injury(injury_id: int, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch, injury = _find_injury_or_404(db, injury_id)
        _require_master(db, int(ch["campaign_id"]), user)
        before = db.get_character(int(ch["id"]))
        ch, text = rules.heal_injury(db, int(ch["id"]), injury_id)
        db.log(int(ch["campaign_id"]), int(ch["id"]), "injury", f"{ch['name']}: лечение травмы", {"injury_id": injury_id, "character_before": before, "character_after": ch, **_undo_for(before)})
        await _notify(request, ch.get("telegram_user_id"), text)
        return {"message": text, "character": ch}

    @app.post("/api/campaigns/{campaign_id}/achievement-icon")
    async def upload_achievement_icon(
        campaign_id: int,
        file: UploadFile = File(...),
        user: TelegramUser = Depends(get_current_user),
        x_upload_id: str | None = Header(default=None, alias="X-Upload-Id"),
    ) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        content_type = (file.content_type or "").lower()
        if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
            raise HTTPException(400, "Загрузи иконку JPG, PNG, WEBP или GIF")
        raw = await file.read()

        async def save_icon() -> dict[str, Any]:
            try:
                optimized = await asyncio.to_thread(
                    optimize_upload,
                    raw,
                    upload_root=Path(app.state.upload_root),
                    kind="achievement",
                    stem=f"achievement_{campaign_id}_{int(time.time())}_{random.randint(1000,9999)}",
                    max_bytes=3 * 1024 * 1024,
                )
            except ValueError as exc:
                raise HTTPException(400, str(exc))
            return {"icon_path": optimized.asset_path, "icon_thumb_path": optimized.thumb_path}

        return await run_idempotent_upload(
            "achievement-icon",
            user.id,
            raw,
            x_upload_id,
            str(campaign_id),
            save_icon,
        )

    @app.post("/api/campaigns/{campaign_id}/custom-frames")
    async def upload_custom_frame(
        campaign_id: int,
        file: UploadFile = File(...),
        name: str = Form("Кастомная рамка"),
        description: str = Form(""),
        rarity: str = Form("unique"),
        frame_scale: float = Form(1.55),
        frame_offset_x: float = Form(0),
        frame_offset_y: float = Form(0),
        user: TelegramUser = Depends(get_current_user),
        x_upload_id: str | None = Header(default=None, alias="X-Upload-Id"),
    ) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        content_type = (file.content_type or "").lower()
        if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
            raise HTTPException(400, "Загрузи рамку JPG, PNG, WEBP или GIF")
        raw = await file.read()
        safe_name = ''.join(ch.lower() if ch.isalnum() else '_' for ch in name.strip())[:28].strip('_') or 'custom_frame'

        async def save_frame() -> dict[str, Any]:
            suffix = f"{campaign_id}_{int(time.time())}_{random.randint(1000,9999)}"
            try:
                optimized = await asyncio.to_thread(
                    optimize_upload,
                    raw,
                    upload_root=Path(app.state.upload_root),
                    kind="frame",
                    stem=f"frame_{safe_name}_{suffix}_hole32",
                    max_bytes=6 * 1024 * 1024,
                )
            except ValueError as exc:
                raise HTTPException(400, str(exc))
            frame_id = f"custom_frame_{campaign_id}_{suffix}"
            cosmetic = db.create_custom_cosmetic_frame(
                frame_id=frame_id,
                name=name.strip()[:80] or "Кастомная рамка",
                description=description.strip()[:500],
                rarity="unique",
                asset_path=optimized.asset_path,
                thumb_path=optimized.thumb_path,
                frame_scale=max(0.50, min(3.50, float(frame_scale or 1.55))),
                frame_offset_x=max(-80, min(80, float(frame_offset_x or 0))),
                frame_offset_y=max(-80, min(80, float(frame_offset_y or 0))),
                emoji="🖼️",
            )
            db.log(campaign_id, None, "achievement", f"Добавлена кастомная рамка: {cosmetic['name']}", {"cosmetic": cosmetic})
            return {"cosmetic": cosmetic, "cosmetics": db.list_cosmetics()}

        extra = f"{campaign_id}|{name}|{description}|{frame_scale}|{frame_offset_x}|{frame_offset_y}"
        return await run_idempotent_upload(
            "custom-frame",
            user.id,
            raw,
            x_upload_id,
            extra,
            save_frame,
        )

    @app.post("/api/campaigns/{campaign_id}/achievements")
    async def create_achievement(campaign_id: int, data: AchievementCreateIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        c = _require_master(db, campaign_id, user)
        reward = (data.cosmetic_reward_id or '').strip() or None
        effect_reward = (data.cosmetic_effect_reward_id or '').strip() or None
        if reward:
            cosmetic = db.get_cosmetic(reward)
            if not cosmetic:
                raise HTTPException(400, "Рамка-награда не найдена")
            if str(cosmetic.get('rarity') or '').lower() == 'unique':
                # Safe check for older achievement rows where cosmetic_reward may be None.
                # Unique frames should not be attached to more than one achievement.
                used = []
                for a in db.list_achievements(campaign_id):
                    linked_reward = a.get('cosmetic_reward_id')
                    if not linked_reward:
                        cosmetic_reward = a.get('cosmetic_reward') or {}
                        if isinstance(cosmetic_reward, dict):
                            linked_reward = cosmetic_reward.get('id')
                    if str(linked_reward or '') == str(reward):
                        used.append(a)
                if used:
                    raise HTTPException(400, "Эта уникальная рамка уже привязана к другому достижению")
        if effect_reward:
            cosmetic_effect = db.get_cosmetic_effect(effect_reward)
            if not cosmetic_effect or str(effect_reward) == "effect_none":
                raise HTTPException(400, "Эффект-награда не найден")
        tag_reward = (data.tag_reward_id or '').strip() or None
        custom_tag_name = (data.custom_tag_name or '').strip()
        if custom_tag_name:
            # Unique tags are created only through achievements. One achievement creates one account-wide tag reward.
            import re, time
            safe = re.sub(r"[^a-zA-Z0-9а-яА-ЯёЁ_]+", "_", custom_tag_name).strip("_").lower()[:32] or "tag"
            tag_id = f"custom_tag_{campaign_id}_{int(time.time())}_{safe}"
            allowed_styles = {
                "tag_shape_classic",
                "tag-custom-gold", "tag-custom-cyber", "tag-custom-shadow",
                "tag-custom-blood", "tag-custom-arcane", "tag-custom-neon",
                "tag-custom-emerald", "tag-custom-frost", "tag-custom-royal",
                "tag-custom-glitch", "tag-custom-sunset", "tag-custom-steel",
            }
            style = data.custom_tag_style if data.custom_tag_style in allowed_styles else "tag_shape_classic"
            tag = db.create_custom_tag(
                tag_id=tag_id,
                name=custom_tag_name[:40],
                emoji=(data.custom_tag_emoji or '').strip()[:8],
                css_class=style,
                description=data.description[:500],
            )
            tag_reward = tag.get("id")
        if tag_reward:
            cosmetic_tag = db.get_tag(tag_reward)
            if not cosmetic_tag or str(tag_reward) == "tag_none":
                raise HTTPException(400, "Тэг-награда не найден")
        try:
            ach = db.create_achievement(
                campaign_id,
                user.id,
                icon=data.icon,
                icon_thumb=data.icon_thumb,
                title=data.title,
                description=data.description,
                tag=data.tag or c.get("name") or "Кампания",
                cosmetic_reward_id=reward,
                cosmetic_effect_reward_id=effect_reward,
                tag_reward_id=tag_reward,
                currency_reward=data.currency_reward,
            )
        except Exception as e:
            raise HTTPException(400, f"Не удалось создать достижение: {e}")
        db.log(campaign_id, None, "achievement", f"Создано достижение: {ach['title']}", {"achievement_id": ach.get("id"), "title": ach.get("title"), "tag": ach.get("tag")})
        return {"achievement": ach, "achievements": db.list_achievements()}

    @app.delete("/api/campaigns/{campaign_id}/achievements/{achievement_id}")
    async def delete_achievement(campaign_id: int, achievement_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        ach = db.get_achievement(achievement_id)
        if not ach:
            raise HTTPException(404, "Достижение не найдено")
        ok = db.delete_achievement(achievement_id, None)
        if not ok:
            raise HTTPException(400, "Не удалось удалить достижение")
        db.log(campaign_id, None, "achievement", f"Удалено достижение: {ach.get('title')}", {"achievement_id": achievement_id, "deleted_achievement": ach})
        return {"message": "Достижение удалено", "achievements": db.list_achievements()}

    @app.post("/api/campaigns/{campaign_id}/achievements/{achievement_id}/grant")
    async def grant_achievement(campaign_id: int, achievement_id: int, data: AchievementGrantIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        ach = db.get_achievement(achievement_id)
        if not ach:
            raise HTTPException(404, "Достижение не найдено")
        ch = _character_or_404(db, data.character_id)
        if int(ch["campaign_id"]) != int(campaign_id):
            raise HTTPException(400, "Персонаж из другой кампании")
        if not ch.get("telegram_user_id"):
            raise HTTPException(400, "Персонаж ещё не привязан к игроку")
        try:
            grant = db.grant_achievement(achievement_id, data.character_id, user.id, data.master_comment)
        except Exception as e:
            raise HTTPException(400, f"Не удалось выдать достижение: {e}")
        text = f"🏆 Новое достижение!\n\n{ach.get('title')}\n\nОткрой раздел достижений в Mini App, чтобы раскрыть ачивку и получить награду."
        await _notify(request, ch.get("telegram_user_id"), text)
        db.log(campaign_id, int(ch["id"]), "achievement", f"{ch['name']}: получено достижение {ach['title']}", {"achievement": ach, "grant": grant, "character_after": db.get_character(int(ch["id"]))})
        return {"grant": grant, "achievement_grants": db.list_player_achievement_grants(int(ch["telegram_user_id"]))}

    @app.post("/api/campaigns/{campaign_id}/achievements/{achievement_id}/grant-many")
    async def grant_achievement_many(campaign_id: int, achievement_id: int, data: AchievementGrantManyIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        ach = db.get_achievement(achievement_id)
        if not ach:
            raise HTTPException(404, "Достижение не найдено")
        ids = [int(x) for x in data.character_ids if int(x) > 0]
        ids = list(dict.fromkeys(ids))
        if not ids:
            raise HTTPException(400, "Выбери хотя бы одного игрока")
        grants = []
        text = f"🏆 Новое достижение!\n\n{ach.get('title')}\n\nОткрой раздел достижений в Mini App, чтобы раскрыть ачивку и получить награду."
        for character_id in ids:
            ch = _character_or_404(db, character_id)
            if int(ch["campaign_id"]) != int(campaign_id):
                raise HTTPException(400, "В списке есть персонаж из другой кампании")
            if not ch.get("telegram_user_id"):
                raise HTTPException(400, "В списке есть непривязанный персонаж")
            try:
                grant = db.grant_achievement(achievement_id, character_id, user.id, data.master_comment)
            except Exception as e:
                raise HTTPException(400, f"Не удалось выдать достижение: {e}")
            await _notify(request, ch.get("telegram_user_id"), text)
            db.log(campaign_id, int(ch["id"]), "achievement", f"{ch['name']}: получено достижение {ach['title']}", {"achievement": ach, "grant": grant, "character_after": db.get_character(int(ch["id"])), "mass_grant": True})
            grants.append(grant)
        return {"grants": grants, "message": f"Достижение выдано: {len(grants)}"}

    @app.post("/api/achievement-grants/{grant_id}/open")
    async def open_achievement_grant(
        grant_id: int,
        user: TelegramUser = Depends(get_current_user),
        x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id"),
    ) -> dict[str, Any]:
        # В dev-режиме мастер может открыть достижение как выбранный персонаж.
        viewer_tg_id = user.id
        raw_grant = db._one("SELECT * FROM achievement_grants WHERE id=?", (int(grant_id),))
        if raw_grant and x_dev_view_character_id:
            dev_character = _dev_impersonated_character(db, settings, int(raw_grant.get("campaign_id") or 0), user, x_dev_view_character_id)
            if dev_character and dev_character.get("telegram_user_id"):
                viewer_tg_id = int(dev_character["telegram_user_id"])
        try:
            grant = db.open_achievement_grant(grant_id, viewer_tg_id)
        except Exception as e:
            raise HTTPException(404, str(e))
        return {
            "grant": grant,
            "achievement_grants": db.list_player_achievement_grants(viewer_tg_id),
            "unlocked_cosmetic_ids": db.list_unlocked_cosmetic_ids(viewer_tg_id),
            "unlocked_effect_ids": db.list_unlocked_effect_ids(viewer_tg_id),
            "unlocked_tag_ids": db.list_unlocked_tag_ids(viewer_tg_id),
            "currency_balance": db.get_currency_balance(viewer_tg_id),
            "currency_transactions": db.list_currency_transactions(viewer_tg_id, 20),
        }


    @app.post("/api/campaigns/{campaign_id}/maps")
    async def upload_map(campaign_id: int, name: str = Form(...), file: UploadFile = File(...), user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        if not MAPS_FEATURE_ENABLED:
            raise HTTPException(404, "Карты временно отключены")
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(400, "Загрузи изображение карты")
        raw = await file.read()
        safe = ''.join(ch.lower() if ch.isalnum() else '_' for ch in name.strip())[:32].strip('_') or 'map'
        try:
            opt = optimize_upload(raw, upload_root=Path(app.state.upload_root), kind="map", stem=f"map_{campaign_id}_{safe}_{int(time.time())}", max_bytes=18*1024*1024)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        m = db.create_map(campaign_id, name, opt.asset_path, opt.thumb_path)
        db.log(campaign_id, None, "map", f"Добавлена карта: {m['name']}", {"map": m})
        return {"map": m, "maps": db.list_maps(campaign_id)}

    @app.delete("/api/campaigns/{campaign_id}/maps/{map_id}")
    async def delete_map(campaign_id: int, map_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        if not MAPS_FEATURE_ENABLED:
            raise HTTPException(404, "Карты временно отключены")
        db.delete_map(map_id, campaign_id)
        db.log(campaign_id, None, "map", f"Удалена карта #{map_id}")
        return {"maps": db.list_maps(campaign_id)}

    @app.post("/api/campaigns/{campaign_id}/maps/{map_id}/pings")
    async def add_map_ping(campaign_id: int, map_id: int, data: MapPingIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        role = _require_access(db, campaign_id, user)
        if not MAPS_FEATURE_ENABLED:
            raise HTTPException(404, "Карты временно отключены")
        c = _campaign_or_404(db, campaign_id)
        m = db.get_map(map_id)
        if not m or int(m.get("campaign_id") or 0) != int(campaign_id):
            raise HTTPException(404, "Карта не найдена")
        dev_character = _dev_impersonated_character(db, settings, campaign_id, user, x_dev_view_character_id)
        ch = None if role == "master" and not dev_character else (dev_character or db.get_character_by_player(campaign_id, user.id))
        color = "#fbbf24" if role == "master" and not dev_character else (ch.get("color") if ch else "#72a7ff")
        label = "Мастер" if role == "master" and not dev_character else (ch.get("name") if ch else "Игрок")
        ping = db.add_map_ping(campaign_id, map_id, user.id, character_id=int(ch["id"]) if ch else None, x=data.x, y=data.y, color=color, label=label, is_master=(role=="master" and not dev_character))
        return {"ping": ping, "map_pings": db.list_active_pings(campaign_id, map_id)}

    @app.post("/api/characters/{character_id}/inventory")
    async def create_inventory_item(character_id: int, data: InventoryItemIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        role = _role(db, int(ch["campaign_id"]), user.id)
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if role != "master" and not (ch.get("telegram_user_id") and int(ch["telegram_user_id"]) == int(user.id)) and not (dev_character and int(dev_character["id"]) == int(character_id)):
            raise HTTPException(403, "Нет доступа к инвентарю")
        campaign = db.get_campaign(int(ch["campaign_id"])) or {}
        if data.item_type == "weapon" and not campaign.get("weapons_enabled"):
            raise HTTPException(400, "Система оружия не включена в этой кампании")
        item = db.create_inventory_item(
            character_id, name=data.name, description=data.description, emoji=data.emoji, quantity=data.quantity,
            item_type=data.item_type, weapon_type=data.weapon_type, reload_type=data.reload_type,
            mag_capacity=data.mag_capacity, ammo_per_attack=data.ammo_per_attack, magazine_count=data.magazine_count,
            fire_modes=data.fire_modes, magazines=data.magazines, shell_stocks=data.shell_stocks, loaded_count=data.loaded_count,
        )
        db.log(int(ch["campaign_id"]), character_id, "inventory", f"{ch['name']}: добавлен предмет {item['name']}", {"item": item})
        return {"item": item, "inventory": db.list_inventory(character_id)}

    @app.post("/api/inventory/items/{item_id}/magazines")
    async def add_inventory_magazine(item_id: int, data: MagazineCreateIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item or item.get("item_type") != "weapon":
            raise HTTPException(404, "Оружие не найдено")
        if item.get("reload_type") == "shell":
            raise HTTPException(400, "У этого оружия поштучная зарядка. Добавь стопку патронов.")
        ch = _character_or_404(db, int(item["character_id"]))
        role = _role(db, int(ch["campaign_id"]), user.id)
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Нет доступа")
        max_ammo = int(data.ammo_max)
        cur_ammo = max_ammo if data.ammo_current is None else int(data.ammo_current)
        mag = db.add_weapon_magazine(item_id, name=data.name, ammo_current=cur_ammo, ammo_max=max_ammo, ammo_type=data.ammo_type, description=data.description)
        db.log(int(ch["campaign_id"]), int(ch["id"]), "inventory", f"{ch['name']}: добавлен магазин для {item['name']}", {"magazine": mag, "item_id": item_id})
        return {"magazine": mag, "item": db.get_inventory_item(item_id), "inventory": db.list_inventory(int(ch["id"]))}

    @app.post("/api/inventory/items/{item_id}/shell-stocks")
    async def add_inventory_shell_stock(item_id: int, data: ShellStockCreateIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item or item.get("item_type") != "weapon":
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        role = _role(db, int(ch["campaign_id"]), user.id)
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Нет доступа")
        stock = db.add_weapon_shell_stock(item_id, ammo_type=data.ammo_type, quantity=data.quantity, emoji=data.emoji, description=data.description)
        db.log(int(ch["campaign_id"]), int(ch["id"]), "inventory", f"{ch['name']}: добавлены патроны для {item['name']}", {"shell_stock": stock, "item_id": item_id})
        return {"shell_stock": stock, "item": db.get_inventory_item(item_id), "inventory": db.list_inventory(int(ch["id"]))}

    @app.delete("/api/inventory/items/{item_id}/shell-stocks/{stock_id}")
    async def delete_inventory_shell_stock(item_id: int, stock_id: int, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item or item.get("item_type") != "weapon":
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        role = _role(db, int(ch["campaign_id"]), user.id)
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Нет доступа")
        ok = db.delete_weapon_shell_stock(item_id, stock_id)
        if not ok:
            raise HTTPException(404, "Патроны не найдены")
        db.log(int(ch["campaign_id"]), int(ch["id"]), "inventory", f"{ch['name']}: удалены патроны для {item['name']}", {"stock_id": stock_id, "item_id": item_id})
        return {"item": db.get_inventory_item(item_id), "inventory": db.list_inventory(int(ch["id"]))}

    @app.post("/api/inventory/items/{item_id}/move")
    async def move_inventory_item(item_id: int, data: InventoryMoveIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Предмет не найден")
        ch = _character_or_404(db, int(item["character_id"]))
        role = _role(db, int(ch["campaign_id"]), user.id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id):
            raise HTTPException(403, "Нет доступа")
        try:
            inventory = db.move_inventory_item(item_id, data.direction)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        return {"inventory": inventory}

    @app.post("/api/characters/{character_id}/cyber-inventory/slot")
    async def set_cyber_inventory_slot(character_id: int, data: CyberInventorySlotIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        ch = _character_or_404(db, character_id)
        campaign = _campaign_or_404(db, int(ch["campaign_id"]))
        _require_cyberpunk(campaign)
        role = _role(db, int(ch["campaign_id"]), user.id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id):
            raise HTTPException(403, "Нет доступа к кибер-инвентарю")
        try:
            slots = db.set_cyber_inventory_slot(character_id, data.mode, data.slot_id, data.item_id)
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        return {"slots": slots, "inventory": db.list_inventory(character_id)}

    @app.patch("/api/inventory/items/{item_id}")
    async def patch_inventory_item(item_id: int, data: InventoryPatchIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Предмет не найден")
        ch = _character_or_404(db, int(item["character_id"]))
        role = _role(db, int(ch["campaign_id"]), user.id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id):
            raise HTTPException(403, "Нет доступа")
        fields = {k:v for k,v in data.model_dump().items() if v is not None}
        item = db.update_inventory_item(item_id, **fields)
        return {"item": item, "inventory": db.list_inventory(int(ch["id"]))}

    @app.delete("/api/inventory/items/{item_id}")
    async def delete_inventory_item(item_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Предмет не найден")
        ch = _character_or_404(db, int(item["character_id"]))
        role = _role(db, int(ch["campaign_id"]), user.id)
        if role != "master" and int(ch.get("telegram_user_id") or 0) != int(user.id):
            raise HTTPException(403, "Нет доступа")
        db.delete_inventory_item(item_id)
        db.log(int(ch["campaign_id"]), int(ch["id"]), "inventory", f"{ch['name']}: удалён предмет {item['name']}")
        return {"inventory": db.list_inventory(int(ch["id"]))}

    @app.post("/api/inventory/items/{item_id}/fire")
    async def inventory_fire(item_id: int, data: FireWeaponIn | None = None, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and _role(db, int(ch["campaign_id"]), user.id) != "master":
            raise HTTPException(403, "Нет доступа")
        try:
            fire = db.weapon_fire(item_id, data.fire_mode_id if data else None)
            new_item = fire["item"]
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        ammo_text = ", ".join(sorted(set(fire.get("fire_log", {}).get("ammo_types") or []))) or "патроны"
        mode_text = fire.get("fire_log", {}).get("mode", "Выстрел")
        db.log(int(ch["campaign_id"]), int(ch["id"]), "inventory", f"{ch['name']}: {mode_text} из {new_item['name']} — {fire.get('fire_log',{}).get('spent',0)} × {ammo_text}", {"item": new_item, "fire_log": fire.get("fire_log", {})})
        return {"item": new_item, "inventory": db.list_inventory(int(ch["id"])), "fire_log": fire.get("fire_log", {})}

    @app.post("/api/inventory/items/{item_id}/reload-request")
    async def inventory_reload_request(item_id: int, data: ReloadRequestIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Заявку может отправить только игрок персонажа")
        effective_player_id = _effective_player_id_for_dev(user, ch) if dev_character else user.id
        _ensure_no_open_player_request(db, int(ch["campaign_id"]), effective_player_id)
        try:
            req = db.create_inventory_request(int(ch["campaign_id"]), int(ch["id"]), int(item_id), effective_player_id, "reload_weapon", {"magazine_id": data.magazine_id})
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        db.log(int(ch["campaign_id"]), int(ch["id"]), "request", f"{ch['name']}: заявка на перезарядку {item['name']}", {"inventory_request": req})
        return {"request": req}

    @app.post("/api/inventory/items/{item_id}/refill-request")
    async def inventory_refill_request(item_id: int, data: RefillRequestIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Заявку может отправить только игрок персонажа")
        effective_player_id = _effective_player_id_for_dev(user, ch) if dev_character else user.id
        _ensure_no_open_player_request(db, int(ch["campaign_id"]), effective_player_id)
        try:
            req = db.create_inventory_request(int(ch["campaign_id"]), int(ch["id"]), int(item_id), effective_player_id, "refill_magazine", {"magazine_id": data.magazine_id, "stock_id": data.stock_id, "amount": data.amount})
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        db.log(int(ch["campaign_id"]), int(ch["id"]), "request", f"{ch['name']}: заявка на пополнение магазина {item['name']}", {"inventory_request": req})
        return {"request": req}


    @app.post("/api/inventory/items/{item_id}/load-shells-request")
    async def inventory_load_shells_request(item_id: int, data: ShellLoadRequestIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Заявку может отправить только игрок персонажа")
        effective_player_id = _effective_player_id_for_dev(user, ch) if dev_character else user.id
        _ensure_no_open_player_request(db, int(ch["campaign_id"]), effective_player_id)
        try:
            req = db.create_inventory_request(int(ch["campaign_id"]), int(ch["id"]), int(item_id), effective_player_id, "load_shells", {"stock_id": data.stock_id, "count": data.count})
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        db.log(int(ch["campaign_id"]), int(ch["id"]), "request", f"{ch['name']}: заявка на зарядку {item['name']}", {"inventory_request": req})
        return {"request": req}

    @app.post("/api/inventory/items/{item_id}/refill-shell-stock-request")
    async def inventory_refill_shell_stock_request(item_id: int, data: ShellRefillRequestIn, user: TelegramUser = Depends(get_current_user), x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id")) -> dict[str, Any]:
        item = db.get_inventory_item(item_id)
        if not item:
            raise HTTPException(404, "Оружие не найдено")
        ch = _character_or_404(db, int(item["character_id"]))
        dev_character = _dev_impersonated_character(db, settings, int(ch["campaign_id"]), user, x_dev_view_character_id)
        if int(ch.get("telegram_user_id") or 0) != int(user.id) and not (dev_character and int(dev_character["id"]) == int(ch["id"])):
            raise HTTPException(403, "Заявку может отправить только игрок персонажа")
        effective_player_id = _effective_player_id_for_dev(user, ch) if dev_character else user.id
        _ensure_no_open_player_request(db, int(ch["campaign_id"]), effective_player_id)
        try:
            req = db.create_inventory_request(int(ch["campaign_id"]), int(ch["id"]), int(item_id), effective_player_id, "refill_shell_stock", {"stock_id": data.stock_id, "amount": data.amount})
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        db.log(int(ch["campaign_id"]), int(ch["id"]), "request", f"{ch['name']}: заявка на пополнение боеприпасов {item['name']}", {"inventory_request": req})
        return {"request": req}

    @app.post("/api/inventory/requests/{request_id}/decide")
    async def decide_inventory_request(request_id: int, data: RequestDecisionIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        req = db.get_inventory_request(request_id)
        if not req:
            raise HTTPException(404, "Заявка не найдена")
        _require_master(db, int(req["campaign_id"]), user)
        try:
            done = db.decide_inventory_request(request_id, bool(data.approve))
        except ValueError as exc:
            raise HTTPException(400, str(exc))
        ch = db.get_character(int(req["character_id"]))
        item_after = db.get_inventory_item(int(req["item_id"]))
        action_labels = {
            "reload_weapon": "перезарядка оружия",
            "refill_magazine": "пополнение магазина",
            "load_shells": "зарядка оружия",
            "refill_shell_stock": "пополнение стопки патронов",
        }
        decision_text = "подтверждена" if data.approve else "отклонена"
        db.log(
            int(req["campaign_id"]),
            int(req["character_id"]),
            "inventory",
            f"{ch['name'] if ch else 'Персонаж'}: заявка инвентаря {decision_text}",
            {"inventory_request": done, "item": item_after, "action": action_labels.get(req.get("request_type"), req.get("request_type"))},
        )
        await _notify(request, ch.get("telegram_user_id") if ch else None, "✅ Заявка по инвентарю подтверждена" if data.approve else "❌ Заявка по инвентарю отклонена")
        return {"request": done, "inventory_requests": db.list_inventory_requests(int(req["campaign_id"]))}

    @app.get("/api/users/{telegram_user_id}/profile")
    async def user_profile(telegram_user_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        return db.get_user_profile(telegram_user_id)



    @app.post("/api/shop/purchase")
    async def purchase_shop_item(
        data: ShopPurchaseIn,
        user: TelegramUser = Depends(get_current_user),
        x_dev_view_character_id: str | None = Header(default=None, alias="X-Dev-View-Character-Id"),
    ) -> dict[str, Any]:
        if data.item_type == "tag":
            raise HTTPException(400, "Раздел тэгов временно закрыт и добавится позже")
        # In dev/master preview mode the UI state is shown for the selected player
        # character. Purchases must use the same effective player id, otherwise the
        # modal shows one balance but the backend checks the master's own balance.
        buyer_tg_id = int(user.id)
        if x_dev_view_character_id:
            ch = db.get_character(int(x_dev_view_character_id))
            if ch:
                dev_character = _dev_impersonated_character(db, settings, int(ch.get("campaign_id") or 0), user, x_dev_view_character_id)
                if dev_character and dev_character.get("telegram_user_id"):
                    buyer_tg_id = int(dev_character["telegram_user_id"])
        try:
            out = db.purchase_cosmetic_item(buyer_tg_id, data.item_type, data.item_id)
        except Exception as e:
            raise HTTPException(400, str(e))
        return {
            **out,
            "unlocked_cosmetic_ids": db.list_unlocked_cosmetic_ids(buyer_tg_id),
            "unlocked_effect_ids": db.list_unlocked_effect_ids(buyer_tg_id),
            "unlocked_tag_ids": db.list_unlocked_tag_ids(buyer_tg_id),
            "currency_balance": db.get_currency_balance(buyer_tg_id),
            "currency_transactions": db.list_currency_transactions(buyer_tg_id, 20),
        }

    @app.post("/api/campaigns/{campaign_id}/currency/grant")
    async def grant_currency(campaign_id: int, data: CurrencyGrantIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        ch = _character_or_404(db, data.character_id)
        if int(ch.get("campaign_id") or 0) != int(campaign_id):
            raise HTTPException(400, "Персонаж из другой кампании")
        tg_id = ch.get("telegram_user_id")
        if not tg_id:
            raise HTTPException(400, "Персонаж ещё не привязан к игроку")
        try:
            balance = db.grant_currency_from_master(user.id, int(tg_id), int(data.amount), campaign_id=campaign_id, target_character_id=int(ch["id"]), comment=data.comment or "Выдано мастером", source='master', source_id=campaign_id, created_by_tg_id=user.id)
        except Exception as e:
            raise HTTPException(400, str(e))
        sign = "+" if data.amount >= 0 else ""
        await _notify(request, int(tg_id), f"✦ Искры: {sign}{data.amount}. Баланс: {balance}." + (f"\nКомментарий мастера: {data.comment}" if data.comment else ""))
        db.log(campaign_id, int(ch["id"]), "currency", f"{ch['name']}: {sign}{data.amount} искр", {"amount": data.amount, "comment": data.comment, "balance": balance, "master_reserve": db.get_master_spark_balance(user.id)})
        return {"balance": balance, "spark_management": db.spark_management_state(user.id, is_admin=_is_spark_admin(db, settings, user))}


    @app.post("/api/sparks/admin/top-up")
    async def top_up_master_sparks(data: SparkTopUpIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        if not _is_spark_admin(db, settings, user):
            raise HTTPException(403, "Пополнять запас искр может только главный мастер")
        try:
            balance = db.top_up_master_sparks(data.master_tg_id, data.amount, comment=data.comment or "Пополнение главным мастером", created_by_tg_id=user.id)
        except Exception as e:
            raise HTTPException(400, str(e))
        return {"balance": balance, "spark_management": db.spark_management_state(user.id, is_admin=True)}

    @app.get("/api/sparks/admin/players")
    async def admin_players(user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        if not _is_spark_admin(db, settings, user):
            raise HTTPException(403, "Список игроков доступен только главному мастеру")
        return {"players": db.list_spark_players(), "achievements": db.list_achievements()}

    @app.post("/api/sparks/admin/players/{player_tg_id}/currency")
    async def admin_adjust_player_currency(player_tg_id: int, data: AdminPlayerCurrencyIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        if not _is_spark_admin(db, settings, user):
            raise HTTPException(403, "Регулировать искры игроков может только главный мастер")
        if int(data.amount) == 0:
            raise HTTPException(400, "Количество искр не может быть нулевым")
        balance = db.add_currency(int(player_tg_id), int(data.amount), reason=data.comment or "Корректировка главным мастером", source="admin_adjust", source_id=int(user.id))
        return {"balance": balance, "player": db.get_user_profile(int(player_tg_id)), "spark_management": db.spark_management_state(user.id, is_admin=True)}

    @app.post("/api/sparks/admin/players/{player_tg_id}/achievements/grant")
    async def admin_grant_player_achievement(player_tg_id: int, data: AdminPlayerAchievementGrantIn, request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        if not _is_spark_admin(db, settings, user):
            raise HTTPException(403, "Изменять достижения игроков может только главный мастер")
        ach = db.get_achievement(int(data.achievement_id))
        if not ach:
            raise HTTPException(404, "Достижение не найдено")
        characters = db.list_user_characters(int(player_tg_id))
        if not characters:
            raise HTTPException(400, "У игрока нет привязанных персонажей")
        character_id = int(data.character_id or characters[0]["id"])
        ch = db.get_character(character_id)
        if not ch or int(ch.get("telegram_user_id") or 0) != int(player_tg_id):
            raise HTTPException(400, "Выбранный персонаж не принадлежит этому игроку")
        try:
            grant = db.grant_achievement(int(data.achievement_id), character_id, user.id, data.master_comment)
        except Exception as e:
            raise HTTPException(400, f"Не удалось выдать достижение: {e}")
        await _notify(request, int(player_tg_id), f"🏆 Новое достижение!\n\n{ach.get('title')}\n\nОткрой раздел достижений в Mini App, чтобы раскрыть ачивку и получить награду.")
        return {"grant": grant, "player": db.get_user_profile(int(player_tg_id)), "spark_management": db.spark_management_state(user.id, is_admin=True)}

    @app.delete("/api/sparks/admin/players/{player_tg_id}/achievements/{achievement_id}")
    async def admin_revoke_player_achievement(player_tg_id: int, achievement_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        if not _is_spark_admin(db, settings, user):
            raise HTTPException(403, "Изменять достижения игроков может только главный мастер")
        ok = db.revoke_achievement_from_user(int(achievement_id), int(player_tg_id))
        if not ok:
            raise HTTPException(404, "Выданное достижение не найдено")
        return {"message": "Достижение снято", "player": db.get_user_profile(int(player_tg_id)), "spark_management": db.spark_management_state(user.id, is_admin=True)}

    @app.post("/api/campaigns/{campaign_id}/undo-last")
    async def undo_last(campaign_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        events = db.get_recent_events(campaign_id, 100)
        undone = {int(e.get("payload", {}).get("undo_of")) for e in events if e.get("kind") == "undo" and e.get("payload", {}).get("undo_of")}
        target = None
        for e in events:
            payload = e.get("payload", {}) or {}
            if e.get("kind") == "undo" or int(e["id"]) in undone:
                continue
            if payload.get("undo"):
                target = e
                break
        if not target:
            raise HTTPException(400, "Нет действия, которое можно отменить")
        undo = target.get("payload", {}).get("undo", {}) or {}
        for cid in undo.get("delete_characters", []) or []:
            db.delete_character(int(cid))
        restored = []
        for snap in undo.get("restore_characters", []) or []:
            ch = db.restore_character_snapshot(snap)
            if ch:
                restored.append(ch)
        db.log(campaign_id, None, "undo", f"Отменено: {target['title']}", {"undo_of": int(target["id"])})
        return {"message": f"Отменено действие: {target['title']}", "restored": restored}

    @app.post("/api/campaigns/{campaign_id}/generators/weather")
    async def gen_weather(campaign_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        payload, text = generators.generate_weather_text(random.Random())
        db.log(campaign_id, None, "generator", "Погода", payload)
        return {"text": text, "payload": payload}

    @app.post("/api/campaigns/{campaign_id}/generators/events")
    async def gen_events(campaign_id: int, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        payload, text = generators.generate_events_text(random.Random())
        db.log(campaign_id, None, "generator", "События недели", {"events": payload})
        return {"text": text, "payload": payload}

    @app.post("/api/campaigns/{campaign_id}/generators/mood")
    async def gen_mood(campaign_id: int, data: MoodIn, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        payload, text = generators.generate_mood_from_text(f"{data.morale};{data.n};{data.categories}", random.Random())
        db.log(campaign_id, None, "generator", "Настроение", payload)
        return {"text": text, "payload": payload}

    @app.post("/api/campaigns/{campaign_id}/broadcast")
    async def broadcast(campaign_id: int, body: dict[str, str], request: Request, user: TelegramUser = Depends(get_current_user)) -> dict[str, Any]:
        _require_master(db, campaign_id, user)
        text = (body.get("text") or "").strip()
        if not text:
            raise HTTPException(400, "Пустой текст")
        count = 0
        for ch in db.list_characters(campaign_id):
            if ch.get("telegram_user_id"):
                await _notify(request, ch.get("telegram_user_id"), text)
                count += 1
        return {"sent": count}

    app.mount("/uploads", StaticFiles(directory=str(upload_root)), name="uploads")
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
    return app
