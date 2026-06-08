---
title: Office pet (signal-driven barometer)
status: shipped
date: 2026-06-08
primary_files: [src/components/OfficePet.jsx, src/components/PixelOffice.jsx, src/systems/store.js, src/components/ControlPanel.jsx, src/systems/petState.js]
test_file: tests/petState.test.js
related_issue: 39
backlog_id: AVO-121
---

# Office pet — signal-driven barometer (#39 / AVO-121)

## Problem

#39 (competitive research: Gather.town added follow-along pets for charm) asks for a
cute ambient companion. But a *decorative* pet that wanders/naps on its own timer is a
**second motion source whose state is fiction** — it competes with the office's honest
real-work signal and reproduces the "cute engine with a dashboard bolted on" failure mode
that was deliberately deleted in the ux-vibe-rebalance wave. A 5-expert brainstorm panel
(game-design · game-feel · calm-tech guardian · feasibility · product) independently
converged: **keep the charm, but make the pet's behavior an HONEST readout of real office
state** — then the toy and the truth become the same thing. Draggable agents (the
considered alternative) was rejected 4/5: it breaks "position = real status" and fights the
movement system.

## Solution

A small ambient pet sprite (cat) rendered once in the office. Its mode is **derived from
real aggregate office state**, mirroring the established honest `moodToWeather(mood)`
pattern — no independent "fake" emotional life.

### Pure state derivation — `src/systems/petState.js`

`derivePetState({ mood, blockedCount })` → one of:

| Pet mode | Real trigger | Read as |
|----------|--------------|---------|
| `hide`   | `blockedCount > 0` **OR** mood `stuck`/`frustrated` | something needs a human / things are rough |
| `nap`    | mood `idle` (and nobody blocked) | the team is resting |
| `excited`| mood `smooth`/`rushing`/`intense` | momentum — work is flowing |
| `wander` | mood `normal` (default) | steady, ordinary activity |

Priority: `hide` (real blocker) wins over everything — the pet never looks happy while an
agent is actually blocked. This is the honesty guarantee. The mapping is a frozen table so
it's unit-testable in isolation (same shape as `classify.js` / `moodToWeather`).

A transient **`perk`** beat (a brief excited hop) is layered on real positive *events*
(`eureka`, `deploy-success`) by subscribing to the same signals officeLife already fires —
reusing the existing event surface, never a synthetic timer.

### Sprite + movement — `src/components/OfficePet.jsx`

- A compact pixel-art cat (small DOM, own colour). Modes map to pose/animation:
  `wander` = slow drift + occasional blink; `nap` = curled with a rising "z"; `excited` =
  faster trot / tail-up; `hide` = crouched still (ears down).
- Movement is a **simple wander** (pick a random nearby floor point, walk straight),
  reusing the exported `clampToFloor` / obstacle helpers from `movementSystem.js`. It does
  **NOT** use `calculatePath` (no desk-graph routing needed) and does **NOT** touch
  `HOME_POSITIONS`, agent coords, or the per-agent separation invariants (Protected
  Surfaces untouched).
- `reduced-motion`: the pet still renders in its mode-appropriate **static pose** (so it
  keeps conveying the signal) but performs **no wander and no per-frame animation**.

### Toggle — `store.js` + `ControlPanel.jsx`

`officePet` boolean (default ON), persisted via a dedicated `office-pet` localStorage key
(same lightweight pattern as `weatherEffects`/`isPaused`/`rosterMode`). ControlPanel gets a
🐈 toggle. OFF → no pet rendered at all (zero cost). PixelOffice renders `<OfficePet>` once,
gated by the toggle.

## Acceptance criteria

- AC-1 `derivePetState` returns `hide` whenever `blockedCount > 0`, regardless of mood
  (honesty guarantee), and maps the mood enum as tabled above. (unit-tested)
- AC-2 The pet is HONEST: it never shows `excited`/`nap` while any agent is blocked.
- AC-3 Pet wander never lands on furniture/walls (uses `clampToFloor`/obstacle check);
  Protected Surfaces (HOME_POSITIONS, agent coords, separation) are untouched.
- AC-4 `reduced-motion` → static mode-pose, no wander, no animation.
- AC-5 `officePet` toggle (default ON) persists across reload; OFF removes the pet entirely.
- AC-6 No regression: full vitest suite green; build clean; weather/agent/roster behavior
  unchanged.

## Non-goals / deferred

- Multiple pets, pet customization, pet naming, click-to-pet interactions — future.
- Sound (the panel said sound stays off/optional; not in this MVP).
- Draggable agents — explicitly rejected by the panel (breaks position-as-truth).

## Verification

- Behavioral correctness = vitest on `derivePetState` (pure) + store toggle test.
- Pixel/visual = owner confirm per Protected-Surfaces policy + `getBoundingClientRect`
  measurement (pet stays on floor; absent when toggled off / blocked-state pose). The
  `preview_screenshot` transport is broken in this environment.
