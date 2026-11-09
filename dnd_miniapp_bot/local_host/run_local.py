from __future__ import annotations

import ipaddress
import os
import signal
import socket
import sqlite3
import subprocess
import sys
import json
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
LOCAL_ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

from app.api import create_app  # noqa: E402
from app.config import Settings  # noqa: E402
from app.db import Database  # noqa: E402
from app.player_profiles import read_profile, write_profile, profile_stats, STAT_LABELS
from app.image_utils import optimize_upload
from app.api import _upload_root


class ProfileShowcaseIn(BaseModel):
    kind: Literal['achievements', 'stats', 'characters', 'avatars']
    items: list[str] = Field(default_factory=list, max_length=12)


class PlayerProfileIn(BaseModel):
    name: str = Field(default='', max_length=60)
    bio: str = Field(default='', max_length=400)
    avatar_path: str = Field(default='', max_length=300)
    showcases: list[ProfileShowcaseIn] = Field(default_factory=list, max_length=8)


class LocalActiveCampaignIn(BaseModel):
    campaign_id: int = Field(ge=1)


class LocalCreateCampaignIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    master_tg_id: int = Field(ge=1)
    rule_type: Literal["fantasy", "cyberpunk"] = "fantasy"
    injuries_enabled: bool = True
    armor_enabled: bool = False
    weapons_enabled: bool = False


def local_ipv4_addresses() -> list[str]:
    addresses: set[str] = set()
    try:
        host_name = socket.gethostname()
        for item in socket.getaddrinfo(host_name, None, socket.AF_INET):
            ip = item[4][0]
            if ip and not ip.startswith("127."):
                addresses.add(ip)
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))
            ip = probe.getsockname()[0]
            if ip and not ip.startswith("127."):
                addresses.add(ip)
    except OSError:
        pass
    return sorted(addresses)


def windows_physical_ipv4() -> str | None:
    if os.name != "nt":
        return None
    command = (
        "$item = Get-NetIPConfiguration -ErrorAction SilentlyContinue | "
        "Where-Object { $_.NetAdapter.Status -eq 'Up' -and "
        "$_.NetAdapter.HardwareInterface -eq $true -and $_.IPv4DefaultGateway -and $_.IPv4Address } | "
        "Sort-Object { $_.NetIPv4Interface.InterfaceMetric } | Select-Object -First 1; "
        "if ($item) { ($item.IPv4Address | Select-Object -First 1 -ExpandProperty IPAddress) }"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=6,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    ip = result.stdout.strip().splitlines()[0].strip() if result.stdout.strip() else ""
    return ip if ip and not ip.startswith("127.") else None


def windows_routed_lan_ipv4() -> str | None:
    if os.name != "nt":
        return None
    try:
        result = subprocess.run(
            ["route", "print", "-4"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=6,
            check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    candidates: list[tuple[int, str]] = []
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) != 5 or parts[0] != "0.0.0.0" or parts[1] != "0.0.0.0":
            continue
        gateway, interface, metric_text = parts[2], parts[3], parts[4]
        if gateway.lower() == "on-link":
            continue
        try:
            address = ipaddress.ip_address(interface)
            metric = int(metric_text)
        except ValueError:
            continue
        if address.version == 4 and address.is_private and not address.is_loopback:
            candidates.append((metric, interface))
    return min(candidates)[1] if candidates else None


def preferred_local_ipv4() -> str | None:
    physical_ip = windows_physical_ipv4()
    if physical_ip:
        return physical_ip
    routed_lan_ip = windows_routed_lan_ipv4()
    if routed_lan_ip:
        return routed_lan_ip
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))
            ip = probe.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass
    addresses = local_ipv4_addresses()
    return addresses[0] if addresses else None


def port_listener_pids(port: int) -> set[int]:
    if os.name != "nt":
        return set()
    current_pid = os.getpid()
    try:
        out = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        ).stdout
    except OSError:
        return set()
    pids: set[int] = set()
    for line in out.splitlines():
        parts = line.split()
        if len(parts) < 5 or parts[0].upper() != "TCP":
            continue
        local_addr, state, pid_text = parts[1], parts[-2].upper(), parts[-1]
        if state != "LISTENING":
            continue
        if local_addr.rsplit(":", 1)[-1] != str(port):
            continue
        try:
            pid = int(pid_text)
        except ValueError:
            continue
        if pid and pid != current_pid:
            pids.add(pid)
    return pids


def stop_port_listeners(port: int) -> None:
    pids = port_listener_pids(port)
    if not pids:
        return
    print(f"Stopping old local server on port {port}: {', '.join(map(str, sorted(pids)))}")
    for pid in sorted(pids):
        result = subprocess.run(
            ["taskkill", "/PID", str(pid), "/F", "/T"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if result.returncode != 0:
            try:
                os.kill(pid, signal.SIGTERM)
            except OSError:
                pass
    deadline = time.time() + 5
    while time.time() < deadline:
        if not port_listener_pids(port):
            return
        time.sleep(0.25)


def build_local_app(db: Database, settings: Settings, *, player_url: str | None = None, state_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="DND Local Host")
    local_state_path = state_path or LOCAL_ROOT / "local_host_state.json"

    def read_local_state() -> dict:
        try:
            return json.loads(local_state_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def write_local_state(data: dict) -> None:
        local_state_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def list_campaigns() -> list[dict]:
        return [db._hydrate_campaign(row) for row in db._many("SELECT * FROM campaigns ORDER BY id DESC")]

    def list_local_users() -> list[dict]:
        users: dict[int, dict] = {}
        accounts = {int(account["telegram_user_id"]): account for account in db.list_achievement_players()}

        def user_for(tg_id: int) -> dict:
            if tg_id not in users:
                users[tg_id] = {
                    "telegram_user_id": tg_id,
                    "display_name": f"TG {tg_id}",
                    "character_names": [],
                    "master_campaign_names": [],
                    "roles": [],
                }
            return users[tg_id]

        for campaign in list_campaigns():
            tg_id = int(campaign.get("master_tg_id") or 0)
            if not tg_id:
                continue
            item = user_for(tg_id)
            item["master_campaign_names"].append(str(campaign.get("name") or f"Кампания {campaign.get('id')}"))
            if "master" not in item["roles"]:
                item["roles"].append("master")

        rows = db._many(
            """
            SELECT ch.telegram_user_id, ch.name AS character_name, c.name AS campaign_name
            FROM characters ch
            LEFT JOIN campaigns c ON c.id=ch.campaign_id
            WHERE ch.telegram_user_id IS NOT NULL
            ORDER BY ch.id DESC
            """
        )
        for row in rows:
            tg_id = int(row.get("telegram_user_id") or 0)
            if not tg_id:
                continue
            item = user_for(tg_id)
            if row.get("character_name"):
                item["character_names"].append(str(row["character_name"]))
            if "player" not in item["roles"]:
                item["roles"].append("player")

        for item in users.values():
            profile = read_profile(db, item['telegram_user_id'])
            item['avatar_path'] = profile['avatar_path']
            names = item["master_campaign_names"] or item["character_names"]
            account = accounts.get(item["telegram_user_id"], {})
            account_name = str(account.get("first_name") or "")
            username = str(account.get("username") or "")
            if account_name or username:
                item["display_name"] = f"{account_name} (@{username})" if account_name and username else account_name or f"@{username}"
            elif names:
                role = "Мастер" if "master" in item["roles"] else "Игрок"
                item["display_name"] = f"{role}: {names[0]} · TG {item['telegram_user_id']}"
            if profile['name']:
                item['display_name'] = profile['name']
            item["character_names"] = list(dict.fromkeys(item["character_names"]))[:8]
            item["master_campaign_names"] = list(dict.fromkeys(item["master_campaign_names"]))[:8]
        return sorted(users.values(), key=lambda x: (0 if "master" in x["roles"] else 1, str(x["display_name"]).lower()))

    def local_campaign_payload(campaign_id: int | None = None) -> dict:
        campaign = db.get_campaign(int(campaign_id)) if campaign_id else None
        if not campaign:
            return {"campaign": None, "characters": []}
        characters = db.list_characters(int(campaign["id"]))
        return {
            "campaign": {
                "id": campaign["id"],
                "name": campaign["name"],
                "emoji": campaign.get("emoji", ""),
                "rule_type": campaign.get("rule_type", "fantasy"),
                "master_tg_id": campaign.get("master_tg_id"),
                "invite_code": campaign.get("invite_code"),
            },
            "characters": [
                {
                    "id": ch["id"],
                    "name": ch["name"],
                    "color": ch.get("color", "#72a7ff"),
                    "current_hp": ch.get("current_hp"),
                    "current_max_hp": ch.get("current_max_hp"),
                    "ac": ch.get("ac"),
                    "telegram_user_id": ch.get("telegram_user_id"),
                    "avatar_thumb_path": ch.get("avatar_thumb_path"),
                    "avatar_path": ch.get("avatar_path"),
                }
                for ch in characters
            ],
        }

    @app.get("/local-api/campaigns")
    async def local_campaigns() -> dict:
        campaigns = []
        for campaign in list_campaigns():
            characters = db.list_characters(int(campaign["id"]))
            campaigns.append(
                {
                    "id": campaign["id"],
                    "name": campaign["name"],
                    "emoji": campaign.get("emoji", ""),
                    "rule_type": campaign.get("rule_type", "fantasy"),
                    "master_tg_id": campaign.get("master_tg_id"),
                    "invite_code": campaign.get("invite_code"),
                    "characters_count": len(characters),
                }
            )
        active_id = int(read_local_state().get("active_campaign_id") or 0)
        return {"campaigns": campaigns, "active_campaign_id": active_id or None}

    @app.post("/local-api/campaigns")
    async def create_local_campaign(data: LocalCreateCampaignIn) -> dict:
        campaign = db.create_campaign(
            data.name.strip(),
            int(data.master_tg_id),
            rule_type=data.rule_type,
            injuries_enabled=data.injuries_enabled,
            armor_enabled=data.armor_enabled,
            weapons_enabled=data.weapons_enabled,
        )
        db.log(int(campaign["id"]), None, "campaign", f"Создана кампания {campaign['name']} через локальный сервер")
        write_local_state({"active_campaign_id": int(campaign["id"])})
        payload = local_campaign_payload(int(campaign["id"]))
        payload["active_campaign_id"] = int(campaign["id"])
        return payload

    @app.get("/local-api/info")
    async def local_info() -> dict:
        return {"player_url": player_url or f"http://localhost:{settings.port}/local/", "port": settings.port}

    @app.get("/local-api/users")
    async def local_users() -> dict:
        return {"users": list_local_users()}

    @app.get("/local-api/hub/{user_id}")
    async def local_player_hub(user_id: int) -> dict:
        user = next((u for u in list_local_users() if u["telegram_user_id"] == user_id), None)
        if not user:
            raise HTTPException(404, "Пользователь не найден")
        active_id = int(read_local_state().get("active_campaign_id") or 0)
        games, characters = [], []
        for campaign in list_campaigns():
            own = [c for c in db.list_characters(int(campaign["id"])) if c.get("telegram_user_id") == user_id]
            master = campaign.get("master_tg_id") == user_id
            if not own and not master:
                continue
            games.append({"id": campaign["id"], "name": campaign["name"], "rule_type": campaign.get("rule_type", "fantasy"), "active": campaign["id"] == active_id, "master": master})
            for ch in own:
                characters.append({**{key: ch.get(key) for key in ("id", "name", "campaign_id", "avatar_path", "avatar_thumb_path", "current_hp", "current_max_hp", "ac", "selected_inventory_model_id")},'active':campaign['id']==active_id})
        characters.sort(key=lambda ch:(not ch['active'],ch['id']))
        achievements = db.list_player_achievement_grants(user_id)
        profile = read_profile(db, user_id)
        avatars = [{'path': c['avatar_path'], 'name': c['name']} for c in characters if c.get('avatar_path')]
        avatars += profile['uploads']
        unlocked=set(db.list_unlocked_inventory_model_ids(user_id))
        models=[{'id':m['id'],'path':m['asset_path'],'name':m['name']} for m in db.list_inventory_models() if m['id'] in unlocked and m.get('asset_path')]
        # Old avatar shelves contained portrait paths, not inventory models.
        for shelf in profile['showcases']:
            if shelf['kind']=='avatars':
                converted=[]
                for item in shelf['items']:
                    if item in unlocked:converted.append(item);continue
                    ch=next((c for c in characters if c.get('avatar_path')==item),None)
                    if ch and ch.get('selected_inventory_model_id') in unlocked:converted.append(ch['selected_inventory_model_id'])
                shelf['items']=list(dict.fromkeys(converted))
        return {"user": user, "games": games, "characters": characters,
                "achievements": achievements, "profile": profile, "avatars": avatars,"models":models,
                "stats": profile_stats(db, user_id, characters, games, achievements),
                "balance": db.get_currency_balance(user_id)}

    def require_local_actor(user_id, actor):
        if actor != user_id:
            raise HTTPException(403, 'Войди в свой профиль')
        if not any(u['telegram_user_id'] == user_id for u in list_local_users()):
            raise HTTPException(404, 'Пользователь не найден')

    @app.get('/local-api/hub/{user_id}/public')
    async def public_local_profile(user_id: int):
        hub = await local_player_hub(user_id)
        selected = {kind: set() for kind in ('achievements', 'characters', 'avatars', 'stats')}
        for shelf in hub['profile']['showcases']:
            selected[shelf['kind']].update(shelf['items'])
        hub['achievements'] = [{'id': g['id'], 'achievement': g['achievement']} for g in hub['achievements'] if str(g['id']) in selected['achievements']]
        hub['characters'] = [{k: c[k] for k in ('id', 'name', 'campaign_id', 'avatar_path', 'avatar_thumb_path')} for c in hub['characters'] if str(c['id']) in selected['characters']]
        hub['models'] = [m for m in hub['models'] if m['id'] in selected['avatars']]
        hub['avatars'] = [a for a in hub['avatars'] if a['path']==hub['profile']['avatar_path']]
        hub['stats'] = [s for s in hub['stats'] if s['id'] in selected['stats']]
        hub['profile'] = {k: v for k, v in hub['profile'].items() if k != 'uploads'}
        hub.pop('balance')
        return hub

    @app.patch('/local-api/hub/{user_id}/profile')
    async def save_local_profile(user_id: int, data: PlayerProfileIn, x_local_user: int = Header(default=0)):
        require_local_actor(user_id, x_local_user)
        hub = await local_player_hub(user_id)
        allowed = {'achievements': {str(g['id']) for g in hub['achievements']},
                   'characters': {str(c['id']) for c in hub['characters']},
                   'avatars': {m['id'] for m in hub['models']}, 'stats': set(STAT_LABELS)}
        if data.avatar_path and data.avatar_path not in {a['path'] for a in hub['avatars']}:
            raise HTTPException(400, 'Выбери свою аватарку')
        for shelf in data.showcases:
            if any(item not in allowed[shelf.kind] for item in shelf.items):
                raise HTTPException(400, 'Витрина содержит недоступный элемент')
        profile = {**hub['profile'], **data.model_dump()}
        write_profile(db, user_id, profile)
        return {'profile': profile}

    @app.post('/local-api/hub/{user_id}/avatar')
    async def upload_profile_avatar(user_id: int, file: UploadFile = File(...), x_local_user: int = Header(default=0)):
        require_local_actor(user_id, x_local_user)
        profile = read_profile(db, user_id)
        if len(profile['uploads']) >= 24:
            raise HTTPException(400, 'В галерее уже 24 загруженные аватарки')
        raw = await file.read(5 * 1024 * 1024 + 1)
        try:
            image = optimize_upload(raw, upload_root=_upload_root(settings), kind='avatar',
                                    stem=f'profile_{user_id}_{uuid.uuid4().hex}', max_bytes=5 * 1024 * 1024)
        except ValueError as error:
            raise HTTPException(400, str(error))
        profile['uploads'].append({'path': image.asset_path, 'name': 'Загруженная аватарка'})
        write_profile(db, user_id, profile)
        return {'profile': profile, 'avatar_path': image.asset_path}

    @app.post('/local-api/hub/{user_id}/active-game')
    async def activate_own_game(user_id: int, data: LocalActiveCampaignIn, x_local_user: int = Header(default=0)):
        require_local_actor(user_id, x_local_user)
        campaign = db.get_campaign(data.campaign_id)
        if not campaign or int(campaign.get('master_tg_id') or 0) != user_id:
            raise HTTPException(403, 'Только мастер этой игры может сделать её активной')
        write_local_state({'active_campaign_id': data.campaign_id})
        return {'active_campaign_id': data.campaign_id}

    @app.get("/local-api/active-campaign")
    async def local_active_campaign() -> dict:
        active_id = int(read_local_state().get("active_campaign_id") or 0)
        payload = local_campaign_payload(active_id or None)
        payload["active_campaign_id"] = active_id or None
        return payload

    @app.post("/local-api/active-campaign")
    async def set_local_active_campaign(data: LocalActiveCampaignIn) -> dict:
        campaign = db.get_campaign(data.campaign_id)
        if not campaign:
            raise HTTPException(404, "Кампания не найдена")
        write_local_state({"active_campaign_id": int(data.campaign_id)})
        payload = local_campaign_payload(int(data.campaign_id))
        payload["active_campaign_id"] = int(data.campaign_id)
        return payload

    @app.get("/local")
    async def local_root_redirect() -> RedirectResponse:
        return RedirectResponse(url="/local/")

    @app.get("/local/")
    async def local_index() -> FileResponse:
        return FileResponse(LOCAL_ROOT / "index.html")

    @app.get("/local-app")
    async def local_app_redirect() -> RedirectResponse:
        return RedirectResponse(url="/local-app/")

    @app.get("/local-app/")
    async def local_miniapp() -> FileResponse:
        return FileResponse(LOCAL_ROOT / "miniapp.html")

    app.mount("/local", StaticFiles(directory=str(LOCAL_ROOT), html=True), name="local_host")
    app.mount("/", create_app(db, settings, bot=None), name="miniapp")
    return app


def main() -> None:
    port = int(os.getenv("LOCAL_PORT", os.getenv("PORT", "8000")) or "8000")
    stop_port_listeners(port)
    db_path = os.getenv("DB_PATH", "data/dnd_bot.sqlite3")
    settings = Settings(
        bot_token="",
        base_url=f"http://localhost:{port}",
        db_path=db_path,
        host="0.0.0.0",
        port=port,
        dev_mode=True,
        main_master_tg_id=int(os.getenv("MAIN_MASTER_TG_ID", "0") or 0),
    )
    db: Database | None = None
    for attempt in range(6):
        candidate = Database(settings.db_path)
        try:
            candidate.init_schema()
            db = candidate
            break
        except sqlite3.OperationalError as exc:
            candidate.conn.close()
            if "database is locked" not in str(exc).lower():
                raise
            if attempt < 5:
                time.sleep(1)
    if db is None:
        print("")
        print("The SQLite database is locked.")
        print("Close the Telegram bot, old local-site windows, or any other running server for this project.")
        print("Then start START_LOCAL_SITE.bat again.")
        print("")
        return
    player_ip = preferred_local_ipv4()
    player_url = f"http://{player_ip}:{port}/local/" if player_ip else f"http://localhost:{port}/local/"
    try:
        (LOCAL_ROOT / "SERVER_ADDRESS.txt").write_text(
            f"Ссылка для игроков:\n{player_url}\n\nСсылка на этом компьютере:\nhttp://127.0.0.1:{port}/local/\n",
            encoding="utf-8",
        )
    except OSError:
        pass
    app = build_local_app(db, settings, player_url=player_url)

    print("")
    print("DND local site is running.")
    print("Give this link to players:")
    print(player_url)
    print("")
    print("Press Ctrl+C to stop.")
    print("If a phone shows detail: Not Found, close old server windows and start local_host\\START_LOCAL_SITE.bat again.")
    print("If phones cannot open the link at all, run local_host\\ALLOW_FIREWALL_PORT_8000_AS_ADMIN.bat once.")
    print("")
    uvicorn.run(app, host=settings.host, port=settings.port, log_level="warning")


if __name__ == "__main__":
    main()
