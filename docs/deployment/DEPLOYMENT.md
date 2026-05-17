# Deployment Guide

Production deployment options for **agent-virtual-office**. The runtime is
`server.mjs` — a standalone Node.js server (built-ins only, no Express) that
serves the built `dist/` bundle and the `/api/*` endpoints on port `5174`.

## Prerequisites

- Node.js **>= 20** (see `engines` in `package.json`).
- Build the static bundle first — `server.mjs` refuses to start without it:

  ```bash
  npm ci
  npm run build      # produces dist/
  ```

- Verify the server runs: `node server.mjs --host --no-open`, then
  `curl http://localhost:5174/api/health` → `{ "ok": true, "uptime": <seconds> }`.

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
docker run -p 5174:5174 agent-virtual-office
# or: docker compose up -d
```

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OFFICE_API_TOKEN` | No | If set, all API writes (and reads) require this token via the `X-Office-Token` header or `Authorization: Bearer <token>`. Leave unset for trusted local networks. |
| `OFFICE_API_ALLOWED_ORIGINS` | No | Comma-separated list of allowed CORS origins (e.g. `https://office.example.com`). If unset, only loopback and the server's own IPs are accepted. |

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
