<div align="center">

# Agent Virtual Office

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![React 19](https://img.shields.io/badge/react-19-61dafb.svg)](https://react.dev)

**A tiny pixel office where your coding agents come to life.**

![Virtual Office Screenshot](https://raw.githubusercontent.com/KbWen/agent-virtual-office/main/docs/screenshot.png)

<sub><i>The whole office, mid-session — someone heads-down, someone blocked, someone just shipped. All live.</i></sub>

While Claude Code grinds through your codebase, a pixel version of it sits at a desk doing the same
thing — typing, getting blocked, stomping off to argue with QA about whether that's *really* a bug.
Point it at your Claude Code / Codex / CI session and your agents clock in for real: `working`,
`blocked`, shipping, bickering — live.

It's not a dashboard. It's useful for approximately nothing, and you'll leave it open all day anyway.

[Quick Start](#quick-start) · [Meet the Team](#meet-the-team) · [中文版](README.zh-TW.md)

</div>

---

## Meet the Team

| Character | Personality | Usually spotted... |
|-----------|------------|------------------------|
| **PM** | Meetings are a love language | Realigning a Gantt chart that needed no realigning |
| **Architect** | Beret. Opinions. | Bolting to the whiteboard mid-thought yelling "Eureka!" |
| **Developer** | Twin-tails, running on caffeine | Five empty cups deep, brewing number six |
| **QA** | Trusts nothing, magnifying glass ready | Telling Dev the bug is real. It's real. |
| **DevOps** | Hard hat, no fear | One deep breath, then hitting the big red button |
| **Researcher** | Lives behind a book fort | Adding to the pile until something clicks |
| **Gatekeeper** | The bouncer of your pipeline | Shield up: "Prerequisites not met." Try again. |
| **Designer** | Pink hair, strong opinions on padding | Nudging a swatch 2px left, for the third time |

## Office Life

Leave it running and stuff just… happens. Some events fire on **real signals** from your session —
a real deploy sets off the celebration, a blocked streak kicks off the argument — while the social
stuff drifts in on a timer and quietly backs off when a live session is busy, so the office never
talks over real work:

- **Tea Break** — a few sneak off to the coffee machine to talk about the others
- **Stand-up** — PM herds everyone to the whiteboard. Nobody escapes.
- **Food's Here** — someone walks in with a bag. Productivity ends.
- **Review Beef** — Dev: "no bug." QA: "look here." Dev: "…fine."
- **It Deployed** — Ops slaps the button, the whole room loses it
- **Eureka** — Architect freezes, then sprints to the whiteboard

…and the rare stuff: someone brings a dog, the AC dies and everyone fans themselves, the boss does a
walkthrough and the whole office *suddenly looks very busy*.

The office fills the width of whatever you dock it in — IDE sidebar, half-screen, full window — with no
dead gutters. Hit **☰** for a vertical roster: who's working, who's blocked, and a live feed of what just happened.

## Why it's nice

- **Pure SVG pixel art** — 8 hand-drawn characters. No canvas, no GPU, no GB-sized bundle.
- **Role-aware animations** — same tool, different role, different scene: `qa + Bash` → magnifier, `ops + Bash` → deploy button, `designer + Edit` → whiteboard.
- **Honest, signal-driven life** — events fire from your *real* session; an agent's status is never faked.
- **Calm by design** — mood-driven weather, idle-gap inference (`working+45s` → thinking), reduced-motion + a11y, and a never-stuck behavior watchdog.

→ Full internals (classifier tiers, movement, behavior engine, weather, inference) live in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Quick Start

```bash
# Straight from the public GitHub repo — no clone, no install:
npx github:KbWen/agent-virtual-office

# Using Claude Code? Wire up automatic status in one command:
npx github:KbWen/agent-virtual-office setup
```

Open the browser tab it pops, and your agents are already at their desks. That's it — no backend, no
database, no WebSocket.

<details>
<summary>Prefer to clone, or want options?</summary>

```bash
git clone https://github.com/KbWen/agent-virtual-office.git
cd agent-virtual-office
npm install
npm run dev
```

CLI flags: `--port=PORT` · `--lang=en|zh-TW` · `--no-open` · `--no-host` (localhost only; the dev
server otherwise binds all interfaces).

> The dev server has no authentication and exposes to your LAN by default. Use `--no-host` for
> localhost-only, or the production `serve` mode with an `OFFICE_API_TOKEN` for a secured deploy.

**Hosting it for a team** (production build, Docker, Nginx, PM2, TLS) → **[docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)**.

</details>

## Connect Your Agent

The office reacts to any tool that can send an HTTP request:

```bash
# Tell the office an agent is working:
curl -X POST http://localhost:5174/api/status \
  -H "Content-Type: application/json" \
  -d '{"dev":"working","workflow":"Sprint 42"}'

# Or fire a one-shot CI moment:
curl -X POST http://localhost:5174/api/event -d '{"event":"deploy-success"}'
```

- **Claude Code** → `npx agent-virtual-office setup`, and every tool call routes itself. Done.
- **Codex CLI / Codex App / Gemini CLI / GitHub Actions / any CI** → see the **[Integration guide](docs/INTEGRATIONS.md)**.

## Embedding & language

```
http://localhost:5174?mode=panel     # compact panel for IDE sidebars
http://localhost:5174?lang=zh-TW     # force Traditional Chinese
```

English is the default; Traditional Chinese is available via `?lang=zh-TW`, the in-app **EN/中** toggle,
the `--lang` flag, or browser auto-detect (`zh-TW` / `zh-Hant`).

---

## Troubleshooting

<details>
<summary><b>Common issues</b></summary>

**Office is blank — no agents appear**
1. No hooks installed? Run `npx agent-virtual-office setup`.
2. Wrong directory? The office filters by `process.cwd()` — run it in the same directory as your session.
3. Stale status? Status expires after 5 minutes of inactivity — start a new session.
4. Not using Claude Code? Push status with `curl` (see [Connect Your Agent](#connect-your-agent)).

**Port 5174 in use** → `npx agent-virtual-office --port=5175`

**Browser doesn't open** (headless Linux / WSL / remote) → open `http://localhost:5174` manually.

**Colleagues can't see it (LAN)** → set `OFFICE_API_ALLOWED_ORIGINS=http://192.168.1.100:5174`, or use `--no-host` for localhost only.

**Windows Firewall prompt** → the dev server binds all interfaces; use `--no-host` to avoid it.

**Node version error** → requires Node ≥ 22 (`node --version`).

**Strict CSP — animations missing** → allow `style-src 'self' 'unsafe-inline'` (the exception applies to
`style=` attributes only). The office still works without it — only the weather/movement decoration drops.
Full notes in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

</details>

## Tech stack

React 19 + Vite 6 · SVG (no canvas, no GPU) · Zustand · Tailwind CSS v4 · `requestAnimationFrame` · zero backend.
1263 tests (classifier, inference, store, movement, event honesty). Deep dive → **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Contributing

PRs welcome — the office can always use more life. Skim the [docs](docs/) for the technical lay of the
land before diving in.

## License

MIT

---

<div align="center">

**[English](README.md)** · **[中文](README.zh-TW.md)**

Made with pixels and coffee.

</div>
