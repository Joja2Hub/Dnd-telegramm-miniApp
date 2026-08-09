# Public Server Launcher

Use `START_PUBLIC_SERVER.bat` when players need to connect from outside your Wi-Fi.

What it does:

- starts a Cloudflare Tunnel to the local FastAPI server;
- writes the new public HTTPS address into `.env` as `BASE_URL`;
- starts `main.py`, so the Telegram bot and Mini App use that public address;
- disables `DEV_MODE`, so the public URL accepts only signed Telegram Mini App users;
- stops old `cloudflared` processes and the old server on the configured port before launch.

Requirements:

- `BOT_TOKEN` must be set in `.env`;
- `cloudflared` must be installed. If it is missing, run `INSTALL_CLOUDFLARED.bat` once;
- keep the launcher window open while the game is running.

Which launcher to use:

- same Wi-Fi only: `local_host\START_LOCAL_SITE.bat`;
- public internet / Telegram Mini App: `public_host\START_PUBLIC_SERVER.bat`.

The public link usually looks like `https://something.trycloudflare.com`. With the free quick tunnel it can change after restart.
