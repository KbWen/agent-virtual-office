---
title: 2026-09-19 Review Remediation — Wave 1
status: frozen
classification: feature
primary_domain: ui-rendering
secondary_domains: [office-runtime]
source: docs/reviews/2026-09-19-handoff-review.md
created: 2026-09-19
signal_tier: none
---

# 2026-09-19 Review Remediation — Wave 1

## Goal

Repair the defects that survived independent re-derivation of the 2026-09-19 external review
(`docs/reviews/2026-09-19-handoff-review.md`, treated as untrusted input). Everything in the office
that is supposed to stay inside the visible scene does so in the compact panel crop as well as the
full 800×560 office, and relative-time labels stop lying by omission when nothing else changes.

| Review ID | What is actually wrong (re-derived) | This spec |
|---|---|---|
| REV-01 | `AgentInspector` clamps to a fixed `10..790 × 10..550` box. In panel mode the viewBox is cropped to e.g. `40 135 580 300`, so the card's header and close button render above the crop. `PixelOffice` publishes only `minX`/`w` of the viewBox. | AC-1…AC-4 |
| REV-02 | The bubble flips below the agent only when `pos.y − 68 − 34·labelScale < 6` — the UNCROPPED top. In panel mode an agent in the top aisle or north doorway (y≈176–180) draws its whole bubble above the crop. Desks (y ≥ 244) are not affected. | AC-5…AC-7 |
| REV-03 | The document-title status channel can only observe the office's OWN `<title>`. `index.html` sets a static title and no code writes `document.title`, so the channel never fires in normal use; its only remaining effect is a latent self-feedback path into a fabricated `working`. The review's premise ("while the user looks at other pages") is impossible — a page cannot observe other tabs. | AC-8…AC-9 |
| REV-08 | Relative-time labels are computed once per render, and their components re-render only on store changes. When nothing changes (e.g. every agent waiting on the human) the labels freeze. The review found one surface; there are three: `NarrowRoster` (row "since" + feed "ago"), `AgentInspector` (AVO-169 "waiting · 3m" + activity "ago"), `ActivityFeed` ("ago" + the <30s unread badge). | AC-10…AC-12 |
| REV-09 | `movementSystem.js` still calls the door stack "KNOWN, UNFIXED … The fix must be TEMPORAL", and `tests/doorCrossingSeparation.test.js`'s header says the same (a second site the review missed). AVO-187 / ADR-010 shipped that temporal fix. | AC-13 |

## Acceptance Criteria

### Scene bounds (REV-01 / REV-02 plumbing)

- **AC-1** — `store.sceneBounds` is `{ minX, minY, w, h }`, default `{ 0, 0, 800, 560 }`.
  `setSceneBounds(minX, minY, w, h)` stores all four and is a no-op (same state object) when all four
  are unchanged. `PixelOffice` publishes all four parsed viewBox numbers, and only when all four are finite.

### Inspector placement (REV-01)

- **AC-2** — Inspector placement is a pure exported function in `agentInspectorModel.js` taking the
  anchor, the unscaled card size, the desired counter-scale and the scene bounds. The card's
  scaled footprint lies inside `[minX+10, minX+w−10] × [minY+10, minY+h−10]` for every anchor —
  including anchors outside the bounds — for each panel viewBox `PixelOffice` can produce
  (`80 110 440 440`, `40 120 580 380`, `40 135 580 300`) and for the full office.
- **AC-3** — The counter-scale is reduced only when the scaled card would not fit the bounds; otherwise
  it is the existing `min(3, max(1, 1.6 / sceneScale))`. For the full office `{0,0,800,560}` placement is
  numerically identical to the pre-change code for every case where the card fits (the pre-change
  clamps are `10 / 790 / 10 / 550`).
- **AC-4** — The click-to-close backdrop is NOT shrunk to the bounds: it keeps covering the whole
  authored scene (`0,0,800,560`). With `preserveAspectRatio="xMidYMid meet"` the visible area can be
  LARGER than the viewBox, so a bounds-sized backdrop would shrink the close target. (Review
  suggestion rejected; pinned by a test.)

### Bubble flip (REV-02)

- **AC-5** — The bubble flips below the agent when its projected top is above the visible top,
  `pos.y − 68 − 34·labelScale < minY + 6`.
- **AC-6** — Orphan guard: the bubble does NOT flip below when the agent anchor itself is above the
  visible top (`pos.y < minY`); a flip there would pull the bubble into view with no visible speaker.
- **AC-7** — For the full office (`minY = 0`) the flip decision is identical to the pre-change code for
  every agent position (the anchor is never negative).

### Title channel (REV-03)

- **AC-8** — `listenTitleChanges`, `classifyTitle` and `TITLE_PATTERNS` are removed from
  `inferStatus.js` and the channel is no longer started by `startStatusIntegration`. The other channels
  (URL params, postMessage, BroadcastChannel, window global, URL hash, `/api/status` polling, SSE) are
  unchanged — the existing suites for them pass unmodified.
- **AC-9** — A guard test fails if any file under `src/` reads `document.title` or observes the
  `<title>` element, so a future "status in the tab title" feature cannot quietly feed back into status.

### Relative-time freshness (REV-08)

- **AC-10** — One shared hook re-renders its caller on a fixed tick while enabled and cleans up its
  interval on disable/unmount. The tick is **10 s**, so a displayed relative time is at most ~10 s stale —
  matching the existing 10 s "too fresh to show" floor in the roster.
- **AC-11** — Consumers: `NarrowRoster` (always while mounted), `AgentInspector` (only while an agent is
  selected), `ActivityFeed` (only while it renders — not in panel or roster mode). Each derives all of
  its relative times in one render from the single `now` the hook returns for that render (the clock
  read at render time, so a consumer that has just been enabled never renders against a stale tick),
  not from `Date.now()` calls scattered through render.
- **AC-12** — With no store change at all, advancing time by 60 s changes a displayed "since"/"ago"
  label (proven with fake timers), and the ActivityFeed unread badge drops an entry once it is ≥30 s old.

### Comment drift (REV-09)

- **AC-13** — Both sites keep the still-true SPATIAL finding (jitter cannot hold two agents 30 px apart in
  a ~50 px opening; do not raise `DOOR_JITTER`) and state that the stack is prevented TEMPORALLY by
  AVO-187's physical-door claims (`src/systems/doorClaims.js`, ADR-010). The characterization
  assertions themselves are unchanged.

### Whole-change

- **AC-14** — Full vitest suite green; test count does not regress except for the deleted
  `tests/titleInference.test.js`, which is replaced by the AC-9 guard. `npm run build` and the bundle
  budget pass.
- **AC-15** — Visual proof: same-state BEFORE/AFTER captures of panel mode (inspector open on an
  upper-desk agent; an agent speaking in the top aisle) and of the full office (inspector open) are shown
  to the owner before the change is committed.

## Non-goals

- **Inspector placement strategy.** Above-the-agent-then-clamp is unchanged. When there is no room above,
  the clamped card can overlap the inspected agent — that already happens in the full office today and is
  not addressed here (would need a side-placement design and owner review).
- **Bubbles of agents below the panel crop** (lounge/research, y > crop bottom) keep today's behaviour.
- **Name tags** clipped at the panel top for a hovered agent in the top aisle — tags only show for active
  or hovered agents, and active agents sit at desks.
- REV-04 (render layering), REV-06 (monolith extraction), REV-10 / AVO-193 (coffee-machine feedback),
  REV-07 (bubble truncation — separate visual PR), REV-05 (Vite config warnings — separate PR).
- No change to the panel viewBox crops, `LABEL_SCALE_MAX`, movement coordinates or any Protected Surface.

## Constraints

- Panel crops, the 800×560 authored scene and `preserveAspectRatio="xMidYMid meet"` are Protected
  Surfaces (SSoT) and stay untouched; this spec only makes overlays respect them.
- ADR-007: the bubble stays the voice channel; this spec moves it, never suppresses it.
- ADR-003 line 68 permits ("may remain") passive title heuristics but does not require them; removing an
  unused one needs no ADR change.
- Owner rule: no look change is committed before the owner has seen same-state BEFORE/AFTER captures.

## API / Data Contract

```text
store.sceneBounds : { minX: number, minY: number, w: number, h: number }   // was { minX, w }
store.setSceneBounds(minX, minY, w, h)                                     // was (minX, w)

agentInspectorModel.placeInspector({ anchor:{x,y}, W, H, scale, bounds, pad = 10 })
  -> { px, py, s }        // s <= scale; card [px, px+W*s] x [py, py+H*s] inside bounds − pad

useNowTick(intervalMs = 10000, enabled = true) -> number   // Date.now() for this render; re-renders every intervalMs while enabled
```

Removed exports: `classifyTitle` (inferStatus.js). No payload, transport or persisted-state change.

## Layout (design reference for the UI rows)

Panel, wide crop `40 135 580 300`; `x` = inspected agent at a desk (y = 244):

```text
 BEFORE                                   AFTER
 y=10 ┌────── card ──────┐  ← clamped    y=145 ┌────── card ──────┐
      │  name  ✕         │    to 10            │  name  ✕         │
 y=135├──────────────────┤ ← crop top          │  status · since  │
      │  status · since  │                     │  …               │
      │  …               │                     └──────────────────┘
      └──────────────────┘                       x   (may overlap: see Non-goals)
        x
```

Bubble, top aisle y = 180, same crop:

```text
 BEFORE: bubble box at y 78..104 (entirely above crop top 135)   AFTER: box flipped to y 194..220
```

## File Relationship

INDEPENDENT. Extends no existing spec. It touches surfaces documented in shipped specs
(`poke-acknowledge`, `calm-stationery-palette`, `avo-187-temporal-doorway-claim`) without changing
their contracts. `ux-vibe-rebalance.md` (frozen) mentions panel mode only for AVO-129 tooltips — no overlap.

## Domain Decisions

- [DECISION] Overlays that must stay on-screen (inspector card, speech bubble) clamp against the LIVE viewBox bounds published in `store.sceneBounds`, never against literal 800×560 numbers — panel mode crops the scene, so a literal is a clip waiting to happen.
- [CONSTRAINT] A bubble may be moved to stay visible, but never into view for a speaker who is not visible (orphan guard). Relocating speech without its speaker would detach the voice channel (ADR-007) from its source.
- [TRADEOFF] The inspector's counter-scale is sacrificed before visibility: when the card cannot fit at its readable size it shrinks to fit rather than clipping. Smaller text beats a missing close button.
- [DECISION] The document-title status channel is deleted, not flag-gated: a page can only see its own title, the office never sets it, so the channel is dead code whose only reachable behaviour is self-feedback into a fabricated `working`.
- [CONSTRAINT] A relative-time label must not outlive its truth by more than one tick (10 s); a component that renders "ago"/"since" text owns a clock tick instead of relying on unrelated store churn to re-render it.
