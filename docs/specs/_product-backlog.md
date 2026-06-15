---
status: living
title: Agent Virtual Office — Product Backlog
created: 2026-05-29
last_updated: 2026-06-15
---

# Agent Virtual Office — Product Backlog

> Living index of planned features. Bootstrap reads this to detect ongoing product work.

> [!IMPORTANT]
> **Backlog hygiene rule (owner, 2026-06-15): there is no "Deferred" limbo state.** Every item is
> exactly one of: **DO** (open + actionable), **REFINE** (rewrite into a more precise item), or
> **CLOSE** (`Cancelled` — won't build; reason + decision record required). Items never linger as
> "maybe later". When closing, either delete or move to `## Closed` with a one-line reason.

> **Rotations:**
> - 2026-05-29 — prior backlog #1–#73 (~100% Done) rotated to `_shipped-log.md`.
> - 2026-06-15 — AVO-101+ wave (54 Done/Shipped rows) rotated to `_shipped-log.md`; 11 items
>   closed (7 off-mission per ADR-006 · 2 ADR-rejected · AVO-112 + AVO-137 closed on review).
>   `main` is the canonical product state (all waves merged).

---

## Feature Inventory — Open / On-Mission Work

> The genuinely-remaining, actionable backlog. Theme law: **chill + fun, honest, REDUCE-not-add.**

| # | Feature | Kind | Labels | Priority | Spec File | Tier | Status | Dependencies |
|---|---------|------|--------|----------|-----------|------|--------|--------------|
| AVO-160 | Custom sprite-asset pipeline (public/sprites/ PNG auto-load → replace procedural SVG) | product | brand | P3 | docs/SPRITE_REQUIREMENTS.md | feature | Pending | foundation for hand-drawn art + AVO-124(b) |
| AVO-124 | Agent appearance customization (sprite cosmetics — hats/accessories/outfits) | product | brand | P3 | — | feature | Pending | AVO-160 for PNG path |
| AVO-141 | Comms / vertical (☰ roster) deeper optimization — "still lots of room" | product | vibe-rebalance | P2 | docs/specs/living-office-events.md | feature | Pending | AVO-140 (shipped) |
| AVO-161 | Dialogue & interaction layer (台詞/文字) — Wave A SHIPPED, Wave B open | product | game-feel | P1 | docs/specs/dialogue-interaction-layer.md | feature | In Progress | ADR-007. **Wave A SHIPPED 2026-06-15 (PR #166)**: S1 quiet-worker reduction + rng seam · S1b de-fabricate generateCrossReaction · S2 5 voice archetypes (en+zh) + open-ended pools + AC-O2 lint. **Wave B = OPEN** (owner "先A後B", decide after living with A): S3 ≤7 status symbols (10px hard gate) · S4 banter (judged vs alive baseline; ADR-007 fallback = no inter-agent dialogue) · S5 stale-ring decay. |

> [!NOTE]
> **Reality check (2026-06-15):** the planned-feature backlog is essentially exhausted. After the
> sprite-art pair (AVO-160 → AVO-124), only AVO-141 (a small polish) remains. That is a maturity
> signal, not a gap to backfill. **The real next-value work is not yet ticketed:**
> (a) the sprite/character **art** itself (content for AVO-160's pipeline);
> (b) **dialogue / text** (台詞、文字) — bubble message pools + i18n strings (owner's stated next
> direction).
> Open those as precise items when the angle is confirmed — do NOT manufacture busywork to fill
> the backlog (REDUCE-not-add).

---

## Closed

> Decided-out items, kept so they are not silently re-proposed. `Cancelled` = won't build. Each
> carries a reason + decision record. (No `Deferred` — see the hygiene rule above.)

| # | Feature | Status | Decision record | Why |
|---|---------|--------|-----------------|-----|
| AVO-116 | Per-agent cost attribution & daily $ trend | Cancelled | ADR-006 | $ dashboard; contradicts shipped README FAQ "not a cost dashboard" |
| AVO-113 | OpenTelemetry GenAI export (OTLP) | Cancelled | ADR-006 | developer telemetry infra; no chill/fun surface |
| AVO-114 | Event-stream replay scrubber | Cancelled | ADR-006 | observability DVR; the live ambient scene is the point |
| AVO-118 | Workflow graph minimap (DAG view) | Cancelled | ADR-006 | the spatial office (+AVO-105 arrows) IS the multi-agent view |
| AVO-119 | Language / file-type breakdown | Cancelled | ADR-006 | WakaTime-style stats donut; analytics not ambient |
| AVO-109 | Recent-files heatmap | Cancelled | ADR-006 | hot-path stats overlay; clutter vs REDUCE-not-add |
| AVO-120 | Daily MVP / productivity leaderboard | Cancelled | ADR-006 | ranking = fabrication hazard; already decided-closed mid-AVO-115 |
| AVO-112 | Eureka cascade (2+ eureka/10s → office-wide confetti) | Cancelled | 2026-06-15 review | honesty flaw — real eureka comes from a slow `mood→smooth` distillation (`officeLife.js`), so it structurally can't cluster within 10s; the cascade would only ever fire from whiteboard-click theater (the AVO-120 trap). AVO-136 already gives eureka a sparkle. A genuine collective beat would be a NEW item tied to a real done-cluster / `/ship` signal, not this |
| AVO-137 | Density-layer foundation / zen far-view | Cancelled | 2026-06-15 review | the glance-L1-default motivation already shipped (vibe-rebalance AVO-126/127/128 + declutter bubble-cap PR #81); the only unbuilt remainder was a wall-TV/streamer zen far-view, which is not a target use case |
| AVO-142 | Drag-to-move agents | Cancelled | ADR-005 (rejected) | position=state honesty; interaction redirected to AVO-158 Poke (shipped) |
| AVO-144 | Sustained per-frame inter-agent separation | Cancelled | ADR-004 (rejected) | doorway geometry + R1; target-time deconfliction is the mechanism |

> **AVO-108 $ remainder cancelled** (ADR-006): the rolling-1h + $ cost + sparkline portion of the
> token meter is off-mission. AVO-108's honest core (🪙 ctx + model chip, in the inspector per
> AVO-127) stands as shipped.

---

## Status Key

- **Status**: `Pending` | `In Progress` | `Shipped` | `Cancelled` — **no `Deferred`** (banned by the hygiene rule).
- **Priority**: P0 (must) → P3 (nice to have)
- **Kind**: `product` (player-facing feature) | `infra` (developer-facing tooling/telemetry) | `chore` (hardening)
- **Tier**: expected classification when built (`feature` | `quick-win` | `architecture-change`)
- **Labels**: theme — `real-ai-behavior` · `multi-agent` · `info-density` · `game-feel` · `observability` · `brand` · `tech-debt` · `vibe-rebalance`

---

## Implementation Notes (open items only)

### AVO-160 Custom sprite-asset pipeline (P3, brand)
The unbuilt engine spec'd in `docs/SPRITE_REQUIREMENTS.md`: detect `public/sprites/<id>.png`,
switch from procedural `getBaseSprite` to image render, fallback on miss. Foundation for
hand-drawn art + AVO-124(b). Currently 0% built (no loader, no `public/sprites/`). This is the
geometry/loader half; the actual art is separate (and not yet ticketed).

### AVO-124 Agent appearance customization (P3, brand)
Name + color override already EXISTS and is documented (`?agents=` / `window.__office_config__`,
README) — that is identity color (inspector/roster/feed/idle name-pill), NOT pixel sprite
clothing. AVO-124 = the **sprite-cosmetic layer** (hats/accessories/outfits). Two impl paths:
(a) procedural — let users override `CHAR_STYLES` (hairStyle/clothes) per role, no asset pipeline;
(b) PNG sprite-assets via AVO-160. `characters.json` has an `accessory` field the renderer does
NOT consume (CHAR_STYLES is authoritative) — reconcile when building.

### AVO-141 Comms / vertical roster optimization (P2)
The ☰ roster → living-presence rail (PR #44) left "still lots of room". Tighter use of the
vertical comms column — denser presence + activity without adding new chrome. Spec context lives
in `docs/specs/living-office-events.md`.

---

> History: 73 prior items shipped 2026-03–2026-05 and the 54-row AVO-101+ wave shipped
> 2026-05–2026-06 — both in `_shipped-log.md`. Off-mission scope boundary: `docs/adr/ADR-006`.
