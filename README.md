# Agent Virtual Office

> Your AI agents aren't just running code — they're **at the office**.

![Virtual Office Screenshot](docs/screenshot.png)

A pixel-art isometric office where AI agent characters work, grab coffee, argue about code reviews, and hold stand-ups. They don't know you're watching, but you'll smile anyway.

**This isn't a monitoring dashboard — it's a vibe tool.**

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
git clone https://github.com/anthropics/agent-virtual-office.git
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
`pm`, `arch`, `dev`, `qa`, `ops`, `res`, `gate`

### Supported Statuses
`idle`, `working`, `blocked`, `done`

### Platform Integration

| Platform | How to integrate |
|----------|-----------------|
| **Claude Code** | `curl POST` from hooks or scripts |
| **Gemini CLI** | `curl POST` from shell hooks |
| **Codex CLI** | `curl POST` from task runners |
| **Any CI/CD** | `curl POST` from pipeline steps |
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

- **Pure SVG pixel art** — 16×20 hand-drawn characters, 7 hairstyles + 7 expressions + 2 genders
- **25 behavior animations** — Each behavior has a matching icon (keyboard, coffee cup, magnifier...)
- **RAF movement** — requestAnimationFrame-driven smooth walking at 80px/s
- **Corridor routing** — Characters walk through doorways and corridors, no clipping
- **Behavior engine** — Weighted random: work 65% / daily 12% / social 13% / away 10%
- **Status-aware speech** — "Let's go!" when working, "Help..." when blocked
- **Real-time clock** — Nap at noon, only Dev stays late with one lamp on
- **Never-stuck guarantee** — try/catch + watchdog timer, behavior chain never breaks

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
│   │   └── ControlPanel.jsx    # Bottom status panel + language toggle
│   ├── systems/
│   │   ├── behaviorEngine.js   # Weighted random behavior engine
│   │   ├── movementSystem.js   # Floor areas + obstacles + pathfinding
│   │   ├── officeLife.js       # Group event system (8+ events)
│   │   └── store.js            # Zustand state management
│   ├── inference/
│   │   └── inferStatus.js      # External status integration
│   ├── i18n.js                 # Lightweight i18n (~90 lines)
│   ├── locales/
│   │   ├── en.json             # English strings
│   │   └── zh-TW.json          # Traditional Chinese strings
│   └── config/
│       ├── characters.json     # Character definitions
│       └── officeEvents.json   # Event pool + message library
├── vite.config.js              # Vite + status API middleware
└── package.json
```

---

## Tech Stack

| Using | Why |
|-------|-----|
| React + Vite | Fast dev, fast builds |
| SVG | Lightweight, no GPU needed |
| requestAnimationFrame | Smooth movement, no jank |
| Zustand | 100× lighter than Redux |
| Tailwind CSS | Rapid UI iteration |
| `new Date()` | Time-of-day effects, no server needed |

| Not Using | Why |
|-----------|-----|
| Canvas / WebGL | Too heavy |
| WebSocket | Not needed |
| Backend / Database | Not needed |
| Three.js | Bundle too large |

---

## Language

- [中文版 README](README.zh-TW.md)

## License

MIT
