---
status: living
title: Agent Virtual Office — Product Backlog
created: 2026-05-29
last_updated: 2026-06-02
---

# Agent Virtual Office — Product Backlog

> Living index of planned features. Bootstrap reads this to detect ongoing product work.
>
> **Shipped items rotated to `_shipped-log.md` on 2026-05-29** after the v0.10 +
> classifier + observability wave brought the prior backlog (#1–#73) to ~100% Done.
> This file tracks the next wave (AVO-101+).

---

## Feature Inventory

| # | Feature | Kind | Labels | Priority | Spec File | Tier | Status | Dependencies |
|---|---------|------|--------|----------|-----------|------|--------|--------------|
| AVO-101 | Plan-Mode visualization | product | real-ai-behavior | P0 | — | feature | Done | — |
| AVO-102 | Extended-thinking aura | product | real-ai-behavior | P1 | — | feature | Done | — |
| AVO-103 | Tool inventory label | product | real-ai-behavior | P1 | — | feature | Done | — |
| AVO-104 | Skill activation badge | product | real-ai-behavior | P2 | — | feature | Pending | — |
| AVO-105 | Handoff arrows | product | multi-agent | P0 | — | feature | Done | — |
| AVO-106 | Pair-programming huddle | product | multi-agent | P1 | — | feature | Pending | — |
| AVO-107 | Review-gate queue | product | multi-agent | P1 | — | feature | Pending | — |
| AVO-108 | Token & cost meter | product | info-density | P0 | — | feature | In Progress | — |
| AVO-109 | Recent-files heatmap | product | info-density | P2 | — | feature | Pending | — |
| AVO-110 | Blocked-reason tags | product | info-density | P1 | — | feature | Pending | — |
| AVO-111 | Time-of-day lighting | product | game-feel | P2 | — | feature | Pending | — |
| AVO-112 | Eureka cascade | product | game-feel | P3 | — | feature | Pending | — |
| AVO-113 | OpenTelemetry GenAI export | infra | observability | P1 | — | feature | Pending | — |
| AVO-114 | Event-stream replay scrubber | product | observability | P2 | — | feature | Pending | — |
| AVO-115 | Shareable daily card | product | brand | P1 | — | feature | Pending | — |
| #20 | Hook read-modify-write atomic | chore | tech-debt | P3 | — | quick-win | Deferred | — |

## Status Key

- **Status**: `Pending` | `In Progress` | `Done` | `Deferred`
- **Priority**: P0 (must) → P3 (nice to have)
- **Kind**: `product` (player-facing feature) | `infra` (developer-facing tooling/telemetry) | `chore` (hardening)
- **Tier**: expected classification when built (`feature` | `quick-win` | `architecture-change`)
- **Labels**: theme — `real-ai-behavior` · `multi-agent` · `info-density` · `game-feel` · `observability` · `brand` · `tech-debt`

> Done rows are kept here for one wave for traceability, then rotate to `_shipped-log.md`.
> AVO-103/105 shipped 2026-05-29; AVO-101/102 shipped + AVO-108 core shipped in PR #22 (2026-05-29/30); the rolling-1h / $ cost / sparkline portion of AVO-108 remains.

---

## Implementation Notes

### 🎯 Real AI Behavior Coverage
- **AVO-101 Plan-Mode visualization** — Claude `plan` mode / Codex planning looked identical to `working`. New `planning` status with a scrolling outline above the agent's whiteboard until plan-approval. *Shipped (92198e5): hook emits `status:'planning'` on `permission_mode==='plan'`; the scrolling-outline polish is deferred.*
- **AVO-102 Extended-thinking aura** — Subtle pulsing halo around the agent's head whose radius scales with thinking-budget. *Shipped (a62cd14): violet aura from `effort.level`.*
- **AVO-103 Tool inventory label** — Small monospace pill below name tag showing the active tool. *Shipped 2026-05-29: `AgentCharacter.jsx` `TaskLabel`; built-ins show short names, MCP tools collapse to `server::tool`; 17 routing tests.*
- **AVO-104 Skill activation badge** — Flip a small skill badge above the agent on activation. Skill name already in some hook payloads (Stop/UserPromptSubmit context); needs i18n + icon mapping.

### 🤝 Multi-Agent Collaboration
- **AVO-105 Handoff arrows** — Animated paper-document arc between desks on workflow phase transitions. *Shipped 2026-05-29: `src/inference/workflowHandoff.js`, 7 mapped transitions, `FlyingDocument` `subtle` prop; re-entrancy bug-pinned.*
- **AVO-106 Pair-programming huddle** — When two agents work on the same file/PR, both walk to a shared whiteboard. Detect shared-artifact correlation from hook events; reuse meeting group-behavior pattern.
- **AVO-107 Review-gate queue** — Gate role gets a literal queue of waiting tickets next to their desk. Track pending approvals per gate role; small ticket SVG stack.

### 📊 Information Density
- **AVO-108 Token & cost meter** — Status-bar chip: rolling 1h tokens-in/out + $ estimate per model with sparkline. *Core shipped (11c73f8): 🪙 chip shows context size + model. Remaining: rolling-1h window, $ cost, sparkline.*
- **AVO-109 Recent-files heatmap** — Toggle minimap overlay: top 10 hot file paths colored by edit frequency. File-path data flows via `Edit`/`Write` tool args; aggregate into 1h rolling window.
- **AVO-110 Blocked-reason tags** — Classifier extension → `blocked.reason` enum, colored sub-icon on status bubble (auth-error vs test-fail vs waiting-on-human). Extend `classifyStatus` with sub-reason; OpenTelemetry GenAI error taxonomy as reference.

### 🎨 Game Feel / Ambient
- **AVO-111 Time-of-day lighting** — Global color-grade layer shifting with wall-clock time (warm dawn / neutral noon / blue evening / dim night with desk-lamp halos). Existing `getLightingOverlay` (PixelOffice.jsx) handles night; extend to full day cycle.
- **AVO-112 Eureka cascade** — 2+ eurekas within 10s → confetti cascade across the whole office. Hook into existing eureka handler; tiny SVG particle system.

### 📈 Performance / Observability
- **AVO-113 OpenTelemetry GenAI export** — Optional OTLP exporter emitting spans per agent action with `gen_ai.*` semantic conventions; toggle in settings. Aligns with classifier panel discussion #B1.
- **AVO-114 Event-stream replay scrubber** — Timeline scrubber at bottom: drag back to replay last 30min at 4x/8x/16x. Event log capped at 50 entries in store; extend retention + render timeline.

### 📣 Brand / USP
- **AVO-115 Shareable daily card** — End-of-day "office card" generator: single pixel-art PNG summarizing today's done/blocked/eurekas/weather, branded, one-click share. Use OffscreenCanvas; pull from ledgers + activeEvent history.

### 🔧 Carried-over from prior wave
- **#20 Hook read-modify-write atomic** — PID isolation + rename fallback already mitigates risk; full file lock or append-only design would be ideal. *Deferred — current mitigation acceptable; revisit only if state-loss reports surface.*

---

> History: 73 prior items shipped 2026-03–2026-05; see `_shipped-log.md`.
