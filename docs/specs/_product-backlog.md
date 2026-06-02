---
status: living
title: Agent Virtual Office — Product Backlog
created: 2026-05-29
last_updated: 2026-06-02
---

# Agent Virtual Office — Product Backlog

> Living index of planned features. Bootstrap reads this to detect ongoing product work.
> Status: `Pending` | `In Progress` | `Done` | `Deferred`
> Priority: P0 (must) → P3 (nice to have)
>
> **Shipped items rotated to `_shipped-log.md` on 2026-05-29** after the v0.10 +
> classifier + observability wave brought the prior backlog (#1–#73) to ~100% Done.
> This file now tracks the next wave (AVO-101+).

---

## 🎯 Real AI Behavior Coverage

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| AVO-101 | **Plan-Mode visualization** — Claude `plan` mode and Codex planning currently look identical to `working`. New `planning` status with a scrolling outline above the agent's whiteboard until plan-approval. | P0 | Pending | New status emitter from hook; `classify.js` STATUS_TABLE already pre-registers 'thinking' / 'awaiting-approval' — extend with 'planning'. |
| AVO-102 | **Extended-thinking aura** — Long thinking-budget runs are invisible. Subtle pulsing halo around the agent's head whose radius scales with token-budget consumption. | P1 | Pending | Needs token/thinking-budget signal from hook payload; OpenTelemetry GenAI `gen_ai.usage.input_tokens` matches. |
| AVO-103 | **Tool inventory label** — Office classifies but doesn't surface *which* tool each agent is using right now. Small monospace text pill below name tag. | P1 | Done | shipped 2026-05-29; `AgentCharacter.jsx` `TaskLabel` SVG component subscribes to `externalStatus[id]?.task`, renders `classifyTask(task).visualLabel` in a 7px monospace pill at y=-29 (below name tag, above head). Built-in tools show short names (`Bash`/`Read`/`Edit`), MCP tools collapse to `server::tool` via the inner-verb bubble-up. Live verified against real Claude Code hook events; 17 routing tests. |
| AVO-104 | **Skill activation badge** — Claude skills activate invisibly. Flip a small skill badge above the agent on activation. | P2 | Pending | Skill name already in some hook payloads (Stop/UserPromptSubmit hook context); needs i18n + icon mapping. |

---

## 🤝 Multi-Agent Collaboration

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| AVO-105 | **Handoff arrows** — PM→Arch→Dev→QA workflow is the core narrative but invisible. Animated paper-document arc between desks on workflow phase transitions. | P0 | Done | shipped 2026-05-29; `src/inference/workflowHandoff.js` watches `activeWorkflow`, fires `addHandoff(from, to, {subtle: true})` on 7 mapped transitions (`/spec-intake→/spec`, `/spec→/plan`, `/plan→/implement`, `/implement→/test`, `/implement→/review`, `/test→/review`, `/review→/ship`). `FlyingDocument` gained `subtle` prop: no sparkle, 60° rotation (vs 360°), no scale pulse — organic officeLife handoffs keep flashier version. Bug-pinned: prevWorkflow update must come BEFORE addHandoff (zustand sync listener re-entry). |
| AVO-106 | **Pair-programming huddle** — When two agents work on the same file/PR, render a temporary "huddle" — both walk to a shared whiteboard. | P1 | Pending | Detect shared-artifact correlation from hook events; reuse meeting group-behavior pattern. |
| AVO-107 | **Review-gate queue** — `awaiting-approval` (#C) shows one agent; reviewer backlog is invisible. Gate role gets a literal queue of waiting tickets next to their desk. | P1 | Pending | Track pending approvals per gate role; small ticket SVG stack. |

---

## 📊 Information Density

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| AVO-108 | **Token & cost meter** — No visibility into spend; developers care intensely about token burn in 2026. Status-bar chip: rolling 1h tokens-in/out + $ estimate per model with sparkline. | P0 | Pending | OpenTelemetry GenAI `gen_ai.usage.*` already pre-aligned in our classifier roadmap; needs hook payload extension. |
| AVO-109 | **Recent-files heatmap** — Today ledger shows done/blocked but not *where* in the codebase. Toggle minimap overlay: top 10 hot file paths colored by edit frequency. | P2 | Pending | File-path data flows via `Edit`/`Write` tool args; aggregate into 1h rolling window. |
| AVO-110 | **Blocked-reason tags** — `blocked` is monochromatic; auth-error vs. test-fail vs. waiting-on-human are visually identical. Classifier extension → `blocked.reason` enum, colored sub-icon on status bubble. | P1 | Pending | Extend `classifyStatus` with sub-reason field; OpenTelemetry GenAI error taxonomy as reference. |

---

## 🎨 Game Feel / Ambient

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| AVO-111 | **Time-of-day lighting** — Office looks identical at 3am and 3pm. Global color-grade layer shifting with wall-clock time (warm dawn / neutral noon / blue evening / dim night with desk-lamp halos). | P2 | Pending | Existing `getLightingOverlay` (PixelOffice.jsx) handles night already; extend to full day cycle. |
| AVO-112 | **Eureka cascade** — Group `eureka` event fires per-agent; back-to-back wins feel as flat as singletons. 2+ eurekas within 10s → confetti cascade across the whole office. | P3 | Pending | Hook into existing eureka handler; tiny SVG particle system. |

---

## 📈 Performance / Observability

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| AVO-113 | **OpenTelemetry GenAI export** — All this rich event data lives only in UI; can't pipe to Honeycomb/Datadog. Optional OTLP exporter emitting spans per agent action with `gen_ai.*` semantic conventions; toggle in settings. | P1 | Pending | Aligns with classifier panel discussion #B1 direction; concrete deliverable for that planned phase. |
| AVO-114 | **Event-stream replay scrubber** — Users miss events while away. Timeline scrubber at bottom: drag back to replay last 30min at 4x/8x/16x speed. | P2 | Pending | Event log already capped at 50 entries in store; extend retention + render timeline. |

---

## 📣 Brand / USP

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| AVO-115 | **Shareable daily card** — No viral artifact; product is screenshot-worthy but users do it manually. End-of-day "office card" generator — single pixel-art PNG summarizing today's done/blocked/eurekas/weather, branded, one-click share. | P1 | Pending | Use OffscreenCanvas to render; pull from ledgers + activeEvent history. |

---

## 🔧 Carried-over from prior wave

| # | Feature | Priority | Status | Notes |
|---|---------|----------|--------|-------|
| #20 | **Hook read-modify-write atomic** — PID isolation + rename fallback already mitigates risk; full file lock or append-only design would be ideal | P3 | Deferred | Current mitigation is acceptable; revisit only if reports of state loss surface |

---

> History: 73 prior items shipped 2026-03–2026-05; see `_shipped-log.md`.
