# Deployment Guide

Production deployment options for **agent-virtual-office**. The runtime is
`server.mjs` — a standalone Node.js server (built-ins only, no Express) that
serves the built `dist/` bundle and the `/api/*` endpoints on port `5174`.

## Prerequisites

- Node.js **>= 22** (see `engines` in `package.json`).
- Build the static bundle first — `server.mjs` refuses to start without it:

  ```bash
  npm ci
  npm run build      # produces dist/
  ```

- Verify the server runs: `node server.mjs --no-open`, then
  `curl http://localhost:5174/api/health` → `{ "ok": true, "uptime": <seconds> }`.
  (Add `--host` only if you need LAN access without a reverse proxy.)

## Nginx reverse proxy

Put Nginx in front of `server.mjs` for TLS termination and a clean hostname.

```bash
sudo cp docs/deployment/nginx.conf /etc/nginx/sites-available/office.conf
sudo ln -s /etc/nginx/sites-available/office.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Edit `server_name` in the config to match your domain. The block proxies to
`127.0.0.1:5174` and disables caching on `/api/`. For HTTPS, switch the
`listen` directive to `443 ssl` and add your certificates (commented hints
are in `nginx.conf`).

**Required**: `server.mjs` validates the `Host` header on every request (a DNS-rebinding
guard — see [Environment variables](#environment-variables) below), and Nginx forwards the
incoming request's Host via `proxy_set_header Host $host` — for a legitimate client this is
whichever `server_name` alias they used to reach Nginx (list every alias if `server_name`
names more than one). Without telling `server.mjs` to trust that hostname, every proxied
request — page, API, and the SSE stream — gets `403 Forbidden`. Set `OFFICE_ALLOWED_HOSTS`
to the same value(s) as `server_name` before starting `server.mjs`, e.g.:

```bash
OFFICE_ALLOWED_HOSTS=office.example.com node server.mjs --no-open
```

(For PM2, systemd, or **Docker**, set it in that runtime's own env mechanism instead — see
those sections below; the Docker section in particular needs it forwarded through
`docker-compose.yml`/`docker run`, not just set in your shell.)

## TLS certificates (Let's Encrypt)

After setting up Nginx on port 80, obtain a free certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d office.example.com
```

Certbot edits `nginx.conf` to add the `443 ssl` block and installs a systemd
timer that auto-renews certificates. Test renewal at any time with:

```bash
sudo certbot renew --dry-run
```

Once HTTPS is working, uncomment the `Strict-Transport-Security` header in
`docs/deployment/nginx.conf` and reload Nginx.

## PM2 process manager

PM2 keeps the server alive and restarts it on crash or reboot.

```bash
npm install -g pm2
pm2 start docs/deployment/pm2.config.cjs
pm2 save                    # persist the process list
pm2 startup                 # print a boot command — run it as instructed
pm2 logs agent-virtual-office
```

The config sets `instances: 1` (the server reads local files, so a single
instance only) and `max_memory_restart: '256M'`.

## Systemd service

On systemd-based Linux, run the server as a managed service instead of PM2.

```bash
sudo cp docs/deployment/office.service /etc/systemd/system/office.service
# Edit User, WorkingDirectory, and ExecStart paths first.
sudo systemctl daemon-reload
sudo systemctl enable --now office.service
sudo systemctl status office.service
journalctl -u office.service -f      # tail logs
```

## Docker

A multi-stage `Dockerfile` exists at the repository root (builds `dist/`,
then ships a minimal runtime image). A `docker-compose.yml` is also provided.

```bash
docker build -t agent-virtual-office .
# Bind to loopback only — safe behind Nginx. For direct LAN without a proxy,
# change to -p 5174:5174 AND set OFFICE_API_TOKEN to protect the API.
docker run -d --restart unless-stopped \
  -p 127.0.0.1:5174:5174 \
  -e OFFICE_ALLOWED_HOSTS=office.example.com \
  -v "${HOME}/.claude:/home/node/.claude:rw" \
  --read-only --tmpfs /tmp \
  --security-opt no-new-privileges:true --cap-drop ALL \
  --memory 256m \
  --log-opt max-size=10m --log-opt max-file=3 \
  agent-virtual-office
# or (recommended — all options pre-configured): OFFICE_ALLOWED_HOSTS=office.example.com docker compose up -d
```

**Required if this container sits behind Nginx (or any reverse proxy) using a hostname**:
same reasoning as the bare-`node` case in the Nginx section above — `-e OFFICE_ALLOWED_HOSTS=...`
for `docker run`, or set it in your shell/`.env` for `docker compose` (the `docker-compose.yml`
in this repo already forwards it via `OFFICE_ALLOWED_HOSTS: ${OFFICE_ALLOWED_HOSTS:-}`, but
compose does **not** auto-forward an arbitrary shell variable that isn't listed in
`environment:`, so this only works because that line exists — don't remove it).

> **Before first run** ensure `~/.claude` exists and is writable by UID 1000:
> ```bash
> mkdir -p ~/.claude && sudo chown 1000 ~/.claude
> ```
> If you run `docker compose` under `sudo`, `${HOME}` resolves to `/root`.
> Set it explicitly: `HOME=/home/youruser docker compose up -d`

## Firewall

`server.mjs` binds to `127.0.0.1:5174` by default (loopback). When running
behind Nginx **do not add `--host`** and do not open port 5174 externally —
only ports 80 and 443 should be reachable from the internet.

```bash
# Ubuntu / Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Port 5174 should never be opened when Nginx is the front door.
sudo ufw enable

# CentOS / RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

If you are running `server.mjs` **without** Nginx (direct access), add `--host`
to expose it to the LAN and open port 5174 instead:

```bash
sudo ufw allow 5174/tcp
```

## Updating

**PM2 / systemd:**

```bash
cd /path/to/agent-virtual-office
git pull
npm ci
npm run build                            # regenerate dist/
pm2 restart agent-virtual-office         # PM2
# — or —
sudo systemctl restart office.service    # systemd
```

**Docker:**

```bash
git pull
docker compose up -d --build             # rebuild image and recreate container
```

## Log rotation

| Method | How logs are stored | Rotation |
|--------|--------------------|------------------------------------|
| **PM2** | `logs/office-*.log` in project dir | `pm2 install pm2-logrotate` (run once) |
| **systemd** | systemd journal (`journalctl -u office`) | Auto-rotated; cap size via `SystemMaxUse=200M` in `/etc/systemd/journald.conf` |
| **Docker** | JSON files managed by Docker daemon | Set in `docker-compose.yml` (`max-size: "10m"`, `max-file: "3"`) — already configured |

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OFFICE_API_TOKEN` | No | If set, all API **write** endpoints (POST) require this token via the `X-Office-Token` header or `Authorization: Bearer <token>`. GET `/api/status` is always readable (status data only, no secrets). Leave unset for trusted local networks. |
| `OFFICE_API_ALLOWED_ORIGINS` | No | Comma-separated list of allowed CORS origins (e.g. `https://office.example.com`). If unset, only loopback and the server's own IPs are accepted. |
| `OFFICE_ALLOWED_HOSTS` | **Required behind Nginx/PM2/systemd/Docker with a hostname** | Comma-separated list of extra hostnames allowed in the request `Host` header (e.g. `office.example.com`). Every request is rejected with 403 unless its `Host` is `localhost`/`*.localhost`, an IP literal in bracket notation for IPv6 (`[::1]`) or plain for IPv4 — an **unbracketed** IPv6 Host is rejected, deliberately: RFC 3986/7230 require brackets so the address's colons aren't ambiguous with a port, and a compliant client never omits them — one of the server's own IPs, or in this allowlist; a DNS-rebinding guard modeled on (not identical to) Vite's `allowedHosts`. **Exemption**: a request carrying a *valid* `OFFICE_API_TOKEN` bypasses this check entirely (a rebinding browser can't know the token — see `docs/INTEGRATIONS.md`'s CI example). **A colleague reaching the office via a LAN hostname needs this set** (by IP or `--host` LAN IP already works without it) — **so does the documented Nginx reverse-proxy setup and the Docker image behind it**: Nginx forwards the incoming request's Host via `$host` (for a legitimate client this equals whichever `server_name` alias they used — list **every** alias if `server_name` has more than one), and `docker-compose.yml`/`docker run` need the variable forwarded explicitly into the container (see the Docker section). A request with **no** `Host` header, or an **empty** `Host:` header, is allowed through either way (neither can be part of a rebinding attack — a browser never omits or empties `Host`). An entry may start with `.` for a suffix match (`.example.com` matches `example.com` and any subdomain, at a real label boundary only — `evilexample.com` does not match); a bare `.` entry is ignored rather than treated as a match-everything wildcard; a trailing `:port` on an entry is stripped, so `mypc.local:5174` behaves the same as `mypc.local`. Rejected hosts are logged once per distinct hostname, capped at 50 for the lifetime of the process (not a time-windowed rate limit — once 50 distinct hostnames have been logged, no further new ones are, until restart), so a misconfigured proxy is visible in the server's own log output without unbounded log growth. |
| `OFFICE_MAX_SSE_CLIENTS` | No | Maximum concurrent `/api/status/stream` connections before new ones get `503`. Defaults to `500`. The per-connection idle-socket timeout is intentionally disabled for SSE (streams are long-lived by design), so this is the backstop against unbounded socket growth — raise it only if you have many simultaneous viewers. |
| `OFFICE_PROJECT_ROOT` | No | Project directory that session files are matched against (each file carries the `_cwd` the hook ran in). Defaults to the directory the office was launched from — `bin/cli.js` forwards it, since both servers are spawned with their cwd set to the package directory. Set it explicitly to watch a different project root, e.g. a shared worktree. |

## Hook integration note

The architecture has two halves:

1. **Hooks** run on the **developer's machine**. They write agent status to
   `~/.claude/office-status-*.json` on that same machine.
2. **The office UI** polls `/api/status` from wherever `server.mjs` runs.

`server.mjs` reads those JSON files from the **local** `~/.claude/` directory.
This means:

- **Same-machine setup** (simplest): run `server.mjs` on the developer's
  machine. Hooks write files, the server reads them — no extra wiring.
- **Remote server setup**: the hook files on the developer's machine are *not*
  visible to a remote server. Either run the server on the same machine as the
  hooks, **or** configure the hooks to `POST` status to the remote server's
  `/api/status` endpoint instead of (or in addition to) writing local files.
  If the remote server has `OFFICE_API_TOKEN` set, the hook's POST must include
  that token header.

> **Note:** Hooks (Claude Code, Codex, etc.) always run on the **same machine
> as the developer** and write status files to `~/.claude/` locally. If the
> office server runs on a remote machine, hooks must `POST` to the remote
> server's `/api/status` endpoint — the hook script must know the server URL
> and optionally the `OFFICE_API_TOKEN`. The file-read path (`~/.claude/`) is
> only relevant when server and hooks share a filesystem.
