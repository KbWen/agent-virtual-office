<div align="center">

# Agent Virtual Office

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)
[![Vite 6](https://img.shields.io/badge/vite-6-646cff.svg)](https://vitejs.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/KbWen/agent-virtual-office/pulls)

**Your AI agents aren't just running code — they're at the office.**

![Virtual Office Screenshot](docs/screenshot.png)

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
npx agent-virtual-office
```

Options:
```
--port=PORT    Port number (default: 5174)
--lang=LANG    Language: en, zh-TW (default: auto-detect)
--no-open      Don't open browser automatically
```

### Option 2: Clone & dev

```bash
git clone https://github.com/KbWen/agent-virtual-office.git
cd agent-virtual-office
npm install
npm run dev
```

Open your browser and watch your agents work. That's it. No backend, no database, no WebSocket.

---

## Status API

Any tool can push real-time status to the office via HTTP:

```bash
# Simple: set agent statuses directly
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","qa":"testing","workflow":"Sprint 42"}'

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
  -d '{"event":"deploy-success","role":"ops","status":"done"}'

# Mark a character as blocked with a label
curl -X POST http://localhost:5174/api/event \
  -H "Content-Type: application/json" \
  -d '{"event":"custom","role":"dev","status":"blocked","label":"Waiting on API keys"}'
```

**Supported events:** `deploy-success` · `review-approved` · `test-passed` · `test-failed` · `build-failed` · `pr-merged` · `release-cut` · `rollback` · `incident-start` · `incident-resolved` · `custom`

Both `role` and `status` are validated — invalid values return HTTP 400.

### Claude Code Hook Install

The hook updates character status in real-time as Claude uses tools. Copy the hook to your project:

```bash
# From inside your project directory (with office running):
cp node_modules/agent-virtual-office/public/hooks/office-status-hook.js \
   .claude/hooks/office-status-hook.js
```

Register it in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse":       [{ "type": "command", "command": "node .claude/hooks/office-status-hook.js PreToolUse" }],
    "PostToolUse":      [{ "type": "command", "command": "node .claude/hooks/office-status-hook.js PostToolUse" }],
    "SubagentStart":    [{ "type": "command", "command": "node .claude/hooks/office-status-hook.js SubagentStart" }],
    "SubagentStop":     [{ "type": "command", "command": "node .claude/hooks/office-status-hook.js SubagentStop" }],
    "UserPromptSubmit": [{ "type": "command", "command": "node .claude/hooks/office-status-hook.js UserPromptSubmit" }],
    "Stop":             [{ "type": "command", "command": "node .claude/hooks/office-status-hook.js Stop" }]
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

## Tech Highlights

| Feature | Detail |
|---------|--------|
| **Pure SVG pixel art** | 16×20 hand-drawn characters, 7 hairstyles + 7 expressions + 2 genders |
| **25 behavior animations** | Each behavior has a matching icon (keyboard, coffee cup, magnifier...) |
| **RAF movement** | requestAnimationFrame-driven smooth walking at 80px/s |
| **Corridor routing** | Characters walk through doorways and corridors, no clipping |
| **Behavior engine** | Weighted random: work 65% / daily 12% / social 13% / away 10% |
| **Status-aware speech** | "Let's go!" when working, "Help..." when blocked |
| **Real-time clock** | Nap at noon, only Dev stays late with one lamp on |
| **Never-stuck guarantee** | try/catch + watchdog timer, behavior chain never breaks |

---

## Architecture

```
.
├── bin/
│   └── cli.js                  # npx entry point
├── src/
│   ├── components/
│   │   ├── AgentCharacter.jsx  # Character sprite + behavior scheduler + RAF movement
│   │   ├── PixelOffice.jsx     # Main scene (SVG office + furniture)
│   │   ├── BehaviorBubble.jsx  # Speech bubbles
│   │   ├── TopDownFurniture.jsx # Desk & furniture SVG components
│   │   └── ControlPanel.jsx    # Bottom status panel + language toggle
│   ├── systems/
│   │   ├── behaviorEngine.js   # Weighted random behavior engine
│   │   ├── movementSystem.js   # Floor areas + obstacles + pathfinding
│   │   ├── officeLife.js       # Group event system (8+ events)
│   │   └── store.js            # Zustand state management
│   ├── inference/
│   │   ├── inferStatus.js      # External status integration
│   │   └── agentRouter.js      # Agent routing logic
│   ├── i18n.js                 # Lightweight i18n (~90 lines)
│   ├── locales/
│   │   ├── en.json             # English strings
│   │   └── zh-TW.json          # Traditional Chinese strings
│   └── config/
│       ├── characters.json     # Character definitions
│       └── officeEvents.json   # Event pool + message library
├── public/
│   ├── bridge.html             # Status bridge for iframe embedding
│   └── hooks/                  # Example hook configs
├── docs/                       # Design specs & architecture docs
├── vite.config.js              # Vite + status API middleware
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

- [Architecture & Technical Design](docs/ARCHITECTURE.md) — System architecture, movement system, behavior engine internals
- [Design Specification](docs/DESIGN_SPEC.md) — Visual style, sprite system, animation states, event scripts
- [Sprite Requirements](docs/SPRITE_REQUIREMENTS.md) — Pixel art asset specs for contributors

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
