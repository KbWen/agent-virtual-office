<div align="center">

# Agent Virtual Office

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)
[![Vite 6](https://img.shields.io/badge/vite-6-646cff.svg)](https://vitejs.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/KbWen/agent-virtual-office/pulls)

**Your AI agents aren't just running code — they're at the office.**

![Virtual Office Screenshot](https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot.png)

A pixel-art virtual office where AI agent characters work, grab coffee, argue about code reviews, and hold stand-ups.
They don't know you're watching, but you'll smile anyway.

*This isn't a monitoring dashboard — it's a vibe tool.*

[Quick Start](#quick-start) · [Status API](#status-api) · [中文版](README.zh-TW.md)

</div>

---

## Meet the Team

| Character | Personality | You might catch them... |
|-----------|------------|------------------------|
| **PM** | Meeting-lover, tidy desk | Staring at a Gantt chart, pondering life |
| **Architect** | Beret-wearing philosopher | Sprinting to the whiteboard yelling "Eureka!" |
| **Developer** | Twin-tails, coffee addict | 5 cups on desk, pouring #6 |
| **QA** | Magnifying-glass perfectionist | Arguing with Dev about whether a bug exists |
| **DevOps** | Hard-hat action hero | Taking a deep breath, then pressing the big red button |
| **Researcher** | Long-haired bookworm | Book pile growing taller, occasional epiphany |
| **Gatekeeper** | Spiky-haired bouncer | Holding up a shield: "Prerequisites not met" |
| **Designer** | Pink-haired creative, design corner | Arranging color swatches, sketching on her iPad |

---

## Office Life

Every 1–3 minutes, a random group event fires:

- **Tea Break** — A few people sneak to the coffee machine to gossip
- **Stand-up Meeting** — PM drags everyone to the whiteboard for status
- **Food Delivery** — Someone walks in with a bag, everyone cheers
- **Coffee Spill** — Desk alarm! Neighbor rushes to help
- **Review Debate** — Dev vs QA classic: "No bug!" → "Look here" → "Fine, fixed"
- **Deploy Success** — Ops hits the button, office erupts in celebration
- **Eureka Moment** — Architect has a flash of insight, bolts to the whiteboard
- **Meeting Room** — A few people file in, start nodding "mm-hmm, agreed"

Rare events include: someone brings a dog, AC breaks and everyone fans themselves, boss walkthrough where everyone pretends to be busy...

---

## Quick Start

### Option 1: npx (recommended)

```bash
# Straight from the public GitHub repo — no clone, no npm publish required:
npx github:KbWen/agent-virtual-office

# Once the package is published to npm, the short form also works:
npx agent-virtual-office
```

Options:
```
--port=PORT    Port number (default: 5174)
--lang=LANG    Language: en, zh-TW (default: auto-detect)
--no-open      Don't open browser automatically
--no-host      Restrict to localhost only (dev server binds all interfaces by default)
```

> **Note:** The dev server (`npx agent-virtual-office`) exposes to LAN by default and has no authentication. Use `--no-host` to restrict to localhost, or use `serve` mode with an `OFFICE_API_TOKEN` for a secured deployment.

### Option 2: Clone & dev

```bash
git clone https://github.com/KbWen/agent-virtual-office.git
cd agent-virtual-office
npm install
npm run dev
```

Open your browser and watch your agents work. That's it. No backend, no database, no WebSocket.

### Option 3: Production build (serve dist/)

Use this when you want to host the compiled office on a server or share it with teammates, without needing Vite running.

```bash
# Build once
npm run build

# Start the standalone production server (serves dist/ + /api/status)
npx agent-virtual-office serve

# Or use the npm script
npm run serve
```

The `serve` command requires a pre-built `dist/` — run `npm run build` first (it will exit with an error if `dist/` is missing). Options:
```
--port=PORT    Port number (default: 5174)
--host         Expose to LAN (default: localhost only)
--no-open      Don't open browser automatically
--lang=LANG    Language: en, zh-TW
```

**Environment variables** (optional):

| Variable | Description | Example |
|----------|-------------|---------|
| `OFFICE_API_TOKEN` | Token required in `X-Office-Token` or `Authorization: Bearer` header for POST/event requests | `mysecret123` |
| `OFFICE_API_ALLOWED_ORIGINS` | Comma-separated allowed CORS origins (default: loopback + server IPs) | `http://office.internal:5174` |

```bash
OFFICE_API_TOKEN=secret npx agent-virtual-office serve --host
```

**Health check:** `GET /api/health` returns `{ ok: true, uptime: <seconds> }`.

### Option 4: Docker

Run the production server in a container. The build is multi-stage — Vite compiles `dist/` in a builder image, and the runtime image ships only `server.mjs` (zero runtime dependencies).

```bash
docker compose up -d
```

Then open `http://localhost:5174`.

The compose file mounts `~/.claude` read-write into the container so the server can both read hook-written status files and accept POST writes.

> **Pre-flight (first run only):** The container runs as UID 1000. Make `~/.claude` writable by that UID (not `$USER`, which may differ):
> ```bash
> mkdir -p ~/.claude && sudo chown 1000 ~/.claude
> ```

Pass an optional `OFFICE_API_TOKEN` to gate POST/event requests:

```bash
OFFICE_API_TOKEN=secret docker compose up -d
```

> For Nginx reverse proxy, PM2, and systemd service instructions, see [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md).

---

## Status API

Any tool can push real-time status to the office via HTTP:

```bash
# Simple: set agent statuses directly
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","qa":"blocked","workflow":"Sprint 42"}'

# Full format: explicit agent list
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{
    "type": "office-status",
    "agents": [
      {"role":"dev","task":"implement-auth","status":"working","label":"Coding auth module..."}
    ],
    "workflow": "Build Feature"
  }'
```

### Supported Roles
`pm` · `arch` · `dev` · `qa` · `ops` · `res` · `gate` · `designer`

### Supported Statuses
`idle` · `working` · `blocked` · `done`

### Webhook — One-shot Events

CI/CD pipelines and external tools can push one-shot events via `POST /api/event`:

```bash
# Trigger a deploy-success celebration
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"deploy-success"}'

# Mark a character as blocked with a label
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"custom","role":"dev","status":"blocked","label":"Waiting on API keys"}'
```

**Supported events:** `pr-merged` · `pr-opened` · `pr-reviewed` · `review-approved` · `test-passed` · `test-failed` · `build-success` · `build-failed` · `deploy-start` · `deploy-success` · `deploy-failed` · `release` · `release-cut` · `rollback` · `incident-start` · `incident-resolved` · `custom`

Named events use predefined agents — `role` and `status` are only needed for `custom` events (validated, invalid values return HTTP 400).

#### GitHub Actions example

Add a step to any workflow to light up the office on CI events:

```yaml
# .github/workflows/deploy.yml
- name: Notify office — deploy started
  run: |
    curl -s -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d '{"event":"deploy-start"}'

- name: Deploy
  run: npm run deploy

- name: Notify office — deploy result
  if: always()
  run: |
    EVENT=$([[ "${{ job.status }}" == "success" ]] && echo "deploy-success" || echo "deploy-failed")
    curl -s -X POST ${{ vars.OFFICE_URL }}/api/event \
      -H "Content-Type: application/json" \
      -H "X-Office-Token: ${{ secrets.OFFICE_API_TOKEN }}" \
      -d "{\"event\":\"$EVENT\"}"
```

Set `OFFICE_URL` (e.g. `http://office.internal:5174`) as a repository variable and `OFFICE_API_TOKEN` as a secret. For self-hosted runners on the same LAN the server is reachable without any extra tunneling.

### Claude Code Hook Install

The one-click setup command copies the hook to `~/.claude/office-status-hook.js` and registers it in `~/.claude/settings.json` for all 6 events automatically (idempotent — safe to re-run):

```bash
# If you cloned the repo:
node bin/cli.js setup

# Run straight from the public GitHub repo (no clone, no npm publish needed):
npx github:KbWen/agent-virtual-office setup

# Once the package is published to npm:
npx agent-virtual-office setup
```

**Manual install** (if you prefer):

```bash
# from a clone:
cp public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
# or, if installed from npm:
cp node_modules/agent-virtual-office/public/hooks/office-status-hook.js ~/.claude/office-status-hook.js
```

Register it in `~/.claude/settings.json` (the hook reads events from stdin, no arguments needed):

```json
{
  "hooks": {
    "PreToolUse":       [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "PostToolUse":      [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStart":    [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "SubagentStop":     [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "node ~/.claude/office-status-hook.js" }] }]
  }
}
```

The hook auto-detects the current git branch slug, writes `~/.claude/office-status-{slug}.json`, and the office filters by `process.cwd()` so sessions from other projects never appear.

### Codex CLI Status Bridge

Codex CLI can now use the same file-backed runtime path as Claude by writing a normalized `office-status` payload with the helper script:

```bash
node public/hooks/office-status-codex.js '{"dev":"working","workflow":"Build Feature"}'

# Full payload also works
node public/hooks/office-status-codex.js '{
  "type": "office-status",
  "source": "codex-cli",
  "agents": [
    {"role":"dev","task":"Edit","status":"working","label":"Implementing auth"}
  ],
  "workflow": "Build Feature"
}'
```

The helper writes `~/.claude/office-status-{slug}.json`, so the office picks it up through the existing `/api/status` polling path. This is the recommended Codex CLI producer path for task runners, shell wrappers, or external automations.

### Codex App Bridge

If Codex App can run or embed browser JavaScript, use the built-in bridge:

```html
<script src="http://localhost:5174/bridge.js"></script>
<script>
  officeBridge.send({
    source: 'codex-app',
    workflow: 'Reviewing PR',
    dev: 'working',
  })
</script>
```

You can also open [bridge.html](http://localhost:5174/bridge.html) and send `codex-app` updates through the UI.

Limitation: this project does not receive automatic host-level tool events from the Codex desktop app by itself. Full parity requires a host-side emitter. When the host cannot emit events directly, `bridge.js` / `bridge.html` is the supported Codex App route.

### Multi-Worktree Support

Running multiple worktrees in parallel? Each worktree's agent appears as a separate character in the lobby:

```bash
# Worktree 1: main project
git worktree add ../feat-auth feat/auth
cd ../feat-auth && npx agent-virtual-office --port=5175

# Worktree 2: current project (different port, same office view)
# Both worktrees share the same ~/.claude/ directory but are isolated by branch slug
```

Open `http://localhost:5174?session=feat-auth` to see the characters from a specific session. The office shows one representative per active worktree.

### Platform Integration

| Platform | How to integrate |
|----------|-----------------|
| **Claude Code** | Install the hook (see above) — automatic per-tool routing |
| **Gemini CLI** | `curl POST /api/status` from shell hooks |
| **Codex CLI** | `node public/hooks/office-status-codex.js ...` or `curl POST /api/status` |
| **Any CI/CD** | `curl POST /api/event` for one-shot events |
| **Codex App** | `bridge.js` / `bridge.html` host bridge (host-side emitter required for automatic events) |
| **Browser** | `postMessage` or `BroadcastChannel('agent-office')` |

---

## Embedding

```
http://localhost:5174?mode=panel    # Compact panel for IDE sidebars
http://localhost:5174?lang=zh-TW   # Force Chinese
```

---

## i18n

Default language is English. Chinese (Traditional) is available:

- URL param: `?lang=zh-TW`
- In-app toggle: EN/中 button in the control panel
- CLI flag: `--lang=zh-TW`
- Auto-detect: respects browser language for `zh-TW` / `zh-Hant`

---

## Troubleshooting

<details>
<summary><b>Common Issues</b></summary>

### Port 5174 is already in use
```bash
npx agent-virtual-office --port=5175
```

### npm install fails (corporate proxy)
```bash
npm config set proxy http://your-proxy:8080
npm config set https-proxy http://your-proxy:8080
npm install
```

### Browser doesn't open automatically
This can happen on headless Linux, WSL, or remote servers. Open manually:
```
http://localhost:5174
```

### Office is blank — no agents appear
1. **No hooks installed?** Run `npx agent-virtual-office setup` to install Claude Code hooks.
2. **Different directory?** The office filters by `process.cwd()`. Run the office in the same directory as your Claude Code session.
3. **Stale status?** Status expires after 5 minutes of inactivity — start a new Claude session.
4. **Not using Claude Code?** Use `curl` to push status manually:
   ```bash
   curl -X POST http://localhost:5174/api/status \
     -H "Content-Type: application/json" \
     -d '{"dev":"working","workflow":"Hello Office"}'
   ```

### LAN access doesn't work (colleagues can't see the office)
Set the `OFFICE_API_ALLOWED_ORIGINS` environment variable:
```bash
OFFICE_API_ALLOWED_ORIGINS=http://192.168.1.100:5174 npx agent-virtual-office
```
Or use `--no-host` to restrict to localhost only.

### Windows Firewall blocks the server
The office binds to all interfaces by default (`--host`). Windows may prompt to allow access. Use `--no-host` to avoid this:
```bash
npx agent-virtual-office --no-host
```

### Node.js version error
Requires Node.js 22 or higher:
```bash
node --version  # must be >= 22
```

### Strict Content Security Policy (CSP) — animations missing or layout broken
The office uses CSS animations for the weather overlay, agent movement, and dynamic UI states. Under strict CSP these can be blocked:

- **CSS keyframes** (raindrops, clouds, lightning flash) live in `src/index.css` and are bundled into the regular `assets/index-*.css` file. They work under `style-src 'self'` with no extra config.
- **React inline `style={{ ... }}` attributes** (Tailwind utility computation, dynamic positioning, weather opacity, dark-mode switches) are applied as DOM `style` properties. Modern browsers treat these as DOM-level property writes rather than CSP-relevant inline styles, but the strictest interpretations may still flag them.

**Recommended CSP for the office:**
```
style-src 'self' 'unsafe-inline';
```
The `'unsafe-inline'` exception applies to `style=` attributes only — the bundled stylesheet still benefits from CSP enforcement. If your environment forbids `'unsafe-inline'` entirely, consider:

1. Using nonces: build a custom React renderer that injects a `nonce` attribute on every inline-style-emitting component (out of scope for this project — file an issue if you need help).
2. Replacing the static-build embed with the live `npx agent-virtual-office serve` route, which doesn't require strict CSP since the SPA loads from the same origin.

The animations themselves are visual decoration; in an environment that blocks all inline styles, the office still functions (status colors, agent positions, behavior animations all use the bundled CSS path).

</details>

### Gemini CLI Integration

Gemini CLI doesn't have a built-in hook system like Claude Code. Use `curl` in a wrapper script:

```bash
# In your Gemini CLI workflow, push status updates:
curl -s -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","workflow":"Gemini Session"}'

# When done:
curl -s -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"done"}'
```

Or use the generic LLM bridge for file-watching mode:
```bash
node node_modules/agent-virtual-office/public/hooks/generic-llm-bridge.js --port=5174
```
This watches for file changes and automatically updates the office.

---

## Tech Highlights

| Feature | Detail |
|---------|--------|
| **Pure SVG pixel art** | 16×20 hand-drawn characters, 7 hairstyles + 7 expressions + 2 genders |
| **Standards-aligned classifier** | W3C Activity Streams 2.0 verbs + MCP namespace + role/workflow priority resolver (`src/systems/classify.js`) |
| **Role-aware animations** | `qa+Bash`→magnifier, `ops+Bash`→deploy-button, `gate+Bash`→shield-verify, `designer+Edit`→whiteboard — same tool, different role, different visual |
| **Mood-driven weather** | `frustrated`→rain, `stuck`→thunderstorm, `rushing`→cloudy through 12 wall windows; CSP-safe bundled keyframes |
| **Idle-gap inference** | `working+45s`→`thinking`, `blocked+90s`→`awaiting-approval` (closes Pixel Agents' admitted heuristic gap) |
| **Desktop notifications** | Browser Notification when blocked ≥30s + tab hidden + permission granted; per-episode dedupe |
| **Self-improving classifier** | `unknownLog` aggregates Tier 5 fallbacks (LangSmith pattern); zero-cost in production via `import.meta.env.PROD` gate |
| **Today done/blocked chip** | `✓N / ✗M` bottom-bar metric with i18n + sr-only mirror; atomic day rollover |
| **RAF movement + corridor routing** | requestAnimationFrame-driven walking at 80px/s, characters walk through doorways and corridors without clipping |
| **Behavior engine** | Weighted random: work 65% / daily 12% / social 13% / away 10% — modulated by role, mood, time of day |
| **Status-aware speech** | "Let's go!" when working, "Help..." when blocked, mood-tinted bubbles |
| **Real-time clock + day-night cycle** | Nap at noon, weather/lighting shift through the day, only Dev stays late with one lamp on |
| **Never-stuck guarantee** | try/catch + watchdog timer, behavior chain never breaks |
| **Reduced-motion + a11y** | Honors `prefers-reduced-motion`, sr-only labels on every visual indicator, dark mode |

---

## Architecture

```
.
├── bin/
│   └── cli.js                       # npx entry point
├── src/
│   ├── components/
│   │   ├── AgentCharacter.jsx       # Character sprite + behavior scheduler + RAF movement
│   │   ├── PixelOffice.jsx          # Main scene (SVG office + furniture + weather overlay)
│   │   ├── AgentInspector.jsx       # Per-agent detail panel (clickable agent → details)
│   │   ├── BehaviorBubble.jsx       # Speech bubbles
│   │   ├── TopDownFurniture.jsx     # Desk/furniture SVG + WallWindow + WeatherOverlay
│   │   └── ControlPanel.jsx         # Bottom status panel + ✓N/✗M chip + 🔔 notifications
│   ├── systems/
│   │   ├── classify.js              # 4-tier classifier (built-in / W3C verb / MCP / role+workflow)
│   │   ├── unknownLog.js            # Dev-mode Tier 5 aggregator (LangSmith pattern, prod no-op)
│   │   ├── behaviorEngine.js        # Weighted random behavior engine
│   │   ├── moodEngine.js            # Sliding-window mood (rushing/frustrated/stuck/...)
│   │   ├── movementSystem.js        # Floor areas + obstacles + pathfinding
│   │   ├── officeLife.js            # Group event system (eureka/meeting/deploy-success/...)
│   │   ├── contextBubble.js         # Status × mood × role-aware speech generation
│   │   ├── constants.js             # Shared enums (VALID_STATUSES / VALID_MOODS / STATUS_COLORS)
│   │   └── store.js                 # Zustand state + dailyDoneLedger + dailyBlockedLedger
│   ├── inference/
│   │   ├── inferStatus.js           # External status integration (hook events + SSE/poll)
│   │   ├── desktopNotifier.js       # Browser Notification when blocked ≥30s + tab hidden
│   │   ├── idleGapInfer.js          # Infer 'thinking' (45s gap) / 'awaiting-approval' (90s gap)
│   │   ├── agentRouter.js           # Agent routing logic
│   │   ├── normalizePost.js         # POST /api/status payload sanitization
│   │   └── platformDetect.js        # Browser / CLI / desktop platform detection
│   ├── server/
│   │   └── scanSessions.mjs         # Multi-worktree session scanner
│   ├── i18n.js                      # Lightweight i18n (~90 lines)
│   ├── locales/
│   │   ├── en.json                  # English strings (incl. notify.* + ui.todayMetrics*)
│   │   └── zh-TW.json               # Traditional Chinese strings
│   ├── index.css                    # Bundled keyframes (CSP-safe) + Tailwind import
│   ├── main.jsx                     # React root + error boundaries
│   └── config/
│       ├── characters.json          # Character definitions (8 roles + 3 lightweight)
│       └── officeEvents.json        # Event pool + message library
├── public/
│   ├── bridge.html                  # Status bridge for iframe embedding
│   └── hooks/                       # Example hook configs (PreToolUse/PostToolUse/Stop/...)
├── server.mjs                       # Production standalone server (Node built-ins only)
├── docs/                            # Specs, ADRs, architecture docs
│   ├── specs/                       # Feature specs + product backlog + shipped log
│   ├── adr/                         # Architecture decision records
│   ├── architecture/                # Domain decision logs (per area)
│   └── deployment/                  # Docker / nginx / pm2 / systemd configs
├── tests/                           # vitest — 925 tests covering classifier, inference, store, ledgers
├── vite.config.js                   # Vite + status API middleware (/api/status, /api/event, /api/lang)
└── package.json
```

---

## Tech Stack

<table>
<tr><th>Using</th><th>Why</th></tr>
<tr><td>React 19 + Vite 6</td><td>Fast dev, fast builds</td></tr>
<tr><td>SVG</td><td>Lightweight, no GPU needed</td></tr>
<tr><td>requestAnimationFrame</td><td>Smooth movement, no jank</td></tr>
<tr><td>Zustand</td><td>100× lighter than Redux</td></tr>
<tr><td>Tailwind CSS v4</td><td>Rapid UI iteration</td></tr>
<tr><td><code>new Date()</code></td><td>Time-of-day effects, no server needed</td></tr>
</table>

<details>
<summary><b>Not Using (and why)</b></summary>

| Technology | Why not |
|-----------|---------|
| Canvas / WebGL | Too heavy for this use case |
| WebSocket | Not needed — polling + postMessage is enough |
| Backend / Database | Pure frontend, zero infrastructure |
| Three.js | Bundle too large |

</details>

---

## Documentation

- [Architecture & Technical Design](https://github.com/KbWen/agent-virtual-office/blob/main/docs/ARCHITECTURE.md) — System architecture, movement system, behavior engine internals
- [Design Specification](https://github.com/KbWen/agent-virtual-office/blob/main/docs/DESIGN_SPEC.md) — Visual style, sprite system, animation states, event scripts
- [Sprite Requirements](https://github.com/KbWen/agent-virtual-office/blob/main/docs/SPRITE_REQUIREMENTS.md) — Pixel art asset specs for contributors

---

## Contributing

PRs are welcome! See the [docs](docs/) folder for technical details before diving in.

---

## License

MIT

---

<div align="center">

**[English](README.md)** · **[中文](README.zh-TW.md)**

Made with pixels and coffee.

</div>
