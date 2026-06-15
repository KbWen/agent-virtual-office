---
title: "ADR-006 — AVO is not an observability / cost dashboard (off-mission backlog closures)"
date: 2026-06-15
status: accepted
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "any proposal to add a cost/$ meter, telemetry export, analytics panel, or productivity-ranking surface to AVO"
  supersedes: null
  superseded_by: null
---

# ADR-006: AVO is not an observability / cost dashboard (off-mission backlog closures)

- **Status**: Accepted (2026-06-15)
- **Context**: The competitive-research wave (AVO-116..AVO-120, added 2026-06-02) and earlier
  info-density items seeded several features that port observability-tool / WakaTime / LangGraph
  Studio idioms onto AVO: per-agent **$ cost** attribution, an **OTLP telemetry export**, a
  WakaTime-style **language/file-type** breakdown, a LangGraph-style **workflow DAG minimap**, a
  recent-files **heatmap**, an event-stream **replay scrubber**, and a productivity
  **leaderboard**. The owner asked to clean the backlog down to what is genuinely worth building.

## Decision

**AVO's product value is "chill + fun" — an honest, ambient visualization of real agent
behavior that makes people *want to open it*. It is NOT a cost dashboard, NOT an observability
console, and NOT a productivity scoreboard.** The following backlog items are closed as
**Cancelled (off-mission — won't build)** (kept for traceability, not silently dropped; per the
backlog's no-"Deferred" hygiene rule these are decided-out, not parked):

| Item | Feature | Why off-mission |
|---|---|---|
| AVO-116 | Per-agent cost attribution & daily $ trend | A literal $ dashboard. Directly contradicts the product positioning — and the *shipped public* README FAQ already states AVO "不追蹤 token 成本 / is not a cost dashboard". |
| AVO-113 | OpenTelemetry GenAI export (OTLP) | Developer observability infra; no chill/fun surface; belongs to LangSmith/Langfuse, not a pixel office. |
| AVO-114 | Event-stream replay scrubber | Observability timeline tooling; heavy; the live ambient scene is the point, not a DVR. |
| AVO-118 | Workflow graph minimap (DAG view) | A LangGraph-Studio analytics panel. The **spatial office is already the multi-agent view** (AVO-105 handoff arrows); a DAG duplicates it as a dashboard. |
| AVO-119 | Language / file-type breakdown | WakaTime-style stats donut; analytics, not ambient charm. |
| AVO-109 | Recent-files heatmap | Stats overlay (hot-path analytics); adds clutter against the REDUCE-not-add law. |
| AVO-120 | Daily MVP / productivity leaderboard | Ranking agents by output is a fabrication/comparison hazard; **already decided-closed** during AVO-115 ("same anti-pattern that closed AVO-120") — this ADR formalizes the drift. |

The token-meter **$ remainder** of the already-shipped AVO-108 (rolling-1h window + $ cost +
sparkline) is **descoped** under the same boundary; AVO-108's shipped honest core (🪙 context
size + model chip, demoted to the inspector per AVO-127) stands.

## Why

1. **Mission fit**: the product law is *chill + fun → want-to-open*. Cost/telemetry/analytics
   surfaces are work-dashboard idioms; they make AVO a tool you *have to* check, not one you
   *want to* open.
2. **Honesty contract**: a $ figure or productivity rank asserts a precise claim from coarse
   signals (token counts vary by cache/model; "MVP" implies a comparison the data can't honestly
   support). The same fabrication concern already closed AVO-120 mid-AVO-115.
3. **REDUCE-not-add**: AVO clutters easily; the standing optimization is deletion, not new
   panels/overlays. Six of these seven are net-new chrome.
4. **Non-duplication**: the office scene + handoff arrows + roster rail already carry the
   multi-agent / activity story spatially; DAG/heatmap/breakdown re-encode the same data as a
   dashboard.
5. **Public consistency**: the shipped README/AEO FAQ already tells users AVO is not a cost
   dashboard and does not track token cost — building AVO-116 would contradict shipped copy.

## Conditions to open a NEW item later (these stay Cancelled)

> Per the no-"Deferred" hygiene rule these items are **Cancelled**, not parked. If the conditions
> below are ever met, open a fresh, precise item — do NOT revive these rows. (ANY one alone is
> insufficient.)

- A concrete owner brief that explicitly re-scopes AVO toward an observability/cost product
  (a deliberate mission change, recorded as a superseding ADR); AND
- For any $/ranking surface: a design that carries an honest uncertainty floor (no precise
  claim a coarse signal can't support), mirroring the AVO-110/pet "unknown is the default"
  guarantee.

## Consequences

- AVO-109/113/114/116/118/119/120 are **Cancelled** in `_product-backlog.md` (`## Closed`
  table), each pointing here.
- AVO-108's $/rolling-window remainder is descoped (not a pending obligation).
- Future cost/telemetry/analytics proposals are answered by this ADR before re-deriving the
  rationale (the recurring-proposal pattern this ADR exists to stop).
- Genuinely on-mission remaining work after the 2026-06-15 cleanup: **AVO-160 + AVO-124**
  (sprite-art pipeline / customization) and **AVO-141** (comms rail optimization). AVO-112
  (eureka cascade) and AVO-137 (density-layer / zen far-view) were also **Cancelled** in the same
  review — see `_product-backlog.md → Closed`.
