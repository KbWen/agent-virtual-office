---
status: shipped
title: Character Growth System
source: external
source_doc: docs/specs/_product-backlog.md#1
created: 2026-05-16
---

# Character Growth System

## Goal

Make each agent's desk visually reflect accumulated **today's** work output: coffee cups pile up, sticky notes multiply, book stacks grow taller as the agent completes tasks during the current day. The desk resets each morning so it always tells today's story, not a lifetime average. Visual changes must be immediately obvious — "畫面看得懂就是好設計."

## Background (Current State)

The store growth mechanism already exists and is wired to `done` events:

- `store.js:418–431` increments `deskItemCount[item]` on each unique `done` transition
- Role → item mapping: `dev/ops → coffee`, `pm/qa/gate/designer → sticky`, `arch/res → books`
- Counts are persisted to localStorage
- **Bug**: `count % 6` causes the counter to wrap back to 0 after 5

`PersonalDesk` currently renders counts as follows:
- `dev`: 1 extra cup when `coffeeCount >= 1` only
- All other roles: static hardcoded items — `stickyCount` / `booksCount` are passed as props but not used in rendering

## Acceptance Criteria

1. Each role's desk renders at **4 clearly distinct visual levels** (0–3) based on today's done count.
2. Level thresholds (daily done count): `0=level 0`, `1-2=level 1`, `3-5=level 2`, `6+=level 3`.
3. `deskItemCount` values are reset each day using the same `dayKey` mechanism as `dailyDoneLedger` — when `dayKey` changes, all three counts (`coffee`, `sticky`, `books`) reset to 0.
4. The wrapping bug (`% 6`) is fixed: raw count is an uncapped integer; visual level is derived from thresholds, not from the raw count directly.
5. Visual changes per role are **obvious at a glance** (object count, not subtle opacity shifts):
   - `dev`: level 0 = 2 base cups; level 1 = +1 cup right side; level 2 = +1 cup near monitor; level 3 = cups arranged in a cluster with steam
   - `pm`/`qa`/`gate`/`designer`: level 0 = 0 extra stickies; level 1 = 1 sticky lower-left; level 2 = 2 stickies; level 3 = 3 stickies in a spread
   - `arch`/`res`: level 0 = existing static stack; level 1 = +1 thin book on top; level 2 = +2 books; level 3 = stack visibly overflowing (books spreading)
   - `ops`: level 0 = static terminal + deploy button; level 1 = +1 terminal line; level 2 = +1 coffee cup near terminal; level 3 = button glow + 2 extra lines
6. New growth SVG elements fit within the existing desk footprint (`W=60, H=38`) and do not overlap character sprites.
7. No new backend endpoints, file I/O, or hook changes required.
8. The `GROWTH_LEVELS` constant is defined once at the top of `PixelOffice.jsx` so thresholds are easy to tune.

## Non-goals

- No animation on item appearance (that's backlog #15).
- No randomness / special items (Dr. Suki's variable ratio idea — possible future enhancement).
- No status-linked items (old Wang's blocked = headache pill idea — future enhancement).
- No lifetime accumulation across days.
- No reset button or user controls.
- No changes to role→item mapping.
- No changes to designer character's iPad/color-swatch (static flavor).

## Constraints

- Changes confined to `src/components/PixelOffice.jsx` and `src/systems/store.js`.
- `PersonalDesk` receives raw counts as props (already wired); level computation lives **inside** `PersonalDesk` via the shared `growthLevel()` helper.
- Daily reset must piggyback on existing `dayKey` logic in `applyExternalStatus` — do not introduce a new timer or reset mechanism.
- Reduced-motion: static SVG elements satisfy this automatically (no CSS transitions added).

## API / Data Contract

**store.js changes:**
- Remove `% 6` from `deskItemCount` increment (line 429): `count[growthItem] = (count[growthItem] || 0) + 1`
- Add daily reset: when `dayKey` changes inside `applyExternalStatus`, also reset `deskItemCount` for all agents to `{ coffee: 0, sticky: 0, books: 0 }`

**PixelOffice.jsx changes:**
```js
const GROWTH_LEVELS = [0, 1, 3, 6] // min daily done count for level 0..3

function growthLevel(count) {
  let lvl = 0
  for (let i = 0; i < GROWTH_LEVELS.length; i++) if (count >= GROWTH_LEVELS[i]) lvl = i
  return lvl
}
```
- `PersonalDesk` receives existing props `coffeeCount`, `stickyCount`, `booksCount` unchanged
- Each role branch calls `growthLevel(relevantCount)` and renders accordingly

**No new store fields** — `deskItemCount: { coffee, sticky, books }` shape unchanged.

## File Relationship

INDEPENDENT
