from __future__ import annotations

import os
import socket
import sqlite3
import subprocess
import sys
import json
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
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


class LocalActiveCampaignIn(BaseModel):
    campaign_id: int = Field(ge=1)


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


def preferred_local_ipv4() -> str | None:
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
        subprocess.run(["taskkill", "/PID", str(pid), "/F", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    deadline = time.time() + 5
    while time.time() < deadline:
        if not port_listener_pids(port):
            return
        time.sleep(0.25)


def build_local_app(db: Database, settings: Settings) -> FastAPI:
    app = FastAPI(title="DND Local Host")
    local_state_path = LOCAL_ROOT / "local_host_state.json"

    def read_local_state() -> dict:
        try:
            return json.loads(local_state_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def write_local_state(data: dict) -> None:
        local_state_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def list_campaigns() -> list[dict]:
        return [db._hydrate_campaign(row) for row in db._many("SELECT * FROM campaigns ORDER BY id DESC")]

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
    db = Database(settings.db_path)
    try:
        db.init_schema()
    except sqlite3.OperationalError as exc:
        if "database is locked" in str(exc).lower():
            print("")
            print("The SQLite database is locked.")
            print("Close the Telegram bot, old local-site windows, or any other running server for this project.")
            print("Then start START_LOCAL_SITE.bat again.")
            print("")
            return
        raise
    app = build_local_app(db, settings)
    player_ip = preferred_local_ipv4()
    player_url = f"http://{player_ip}:{port}/local/" if player_ip else f"http://localhost:{port}/local/"

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
