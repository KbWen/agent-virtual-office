---
title: Standing-overlap deconfliction — journey targets + anisotropic spacing + arrival nudge
status: shipped
date: 2026-06-10
backlog_id: AVO-156
classification: feature
primary_domain: office-runtime
secondary_domains: [movement, store]
primary_files:
  - src/systems/movementSystem.js
  - src/systems/store.js
  - src/components/AgentCharacter.jsx
test_files:
  - tests/movementSystem.test.js        # ellipse predicate + anisotropic avoidOverlap
  - tests/journeyDeconfliction.test.js  # journey publication lifecycle + picker visibility (NEW)
  - tests/agentSeparationInvariants.test.js  # group chokepoints stay green under new avoidOverlap
relationship: COMPLETES the target-time deconfliction mechanism (ADR-004); supersedes nothing
---

# Standing-overlap deconfliction (AVO-156)

## Problem

Owner screenshot 2026-06-10 (3rd overlap report, different place each time): 8 agents, only 6
visible — two pairs standing fully stacked. Prior fixes closed the SOCIAL channel (lateral
cones, PR #103) and the GROUP-EVENT channel (store chokepoint, PR #80-era).

**Forensic baseline (12-min live capture, scripts/overlap-recorder.mjs): 12 sustained
stationary-stack events, 189 pair-seconds of full overlap.** 10 of 12 events sit at the
LITERAL coordinate (240,386) — `DOOR_SIDES.mainToLounge.mainOffice` — at distance **0px**.
One tracked agent (pm, status=working) was caught standing frozen at that node across
events spanning 8 minutes with a stale leg target. The capture pins five stacked causes:

1. **RC-1 — unguarded legs 2..N (freeze trigger).** `animate()`'s arrived branch calls
   `setIsWalking(false)` at EVERY intermediate waypoint, not just final arrival. The 1.5s
   rAF stall watchdog is gated on `isWalking` — so it guards ONLY the first leg. Render
   jank (chronic on this machine; cf. the gap-snap A/B) stalls rAF on any later leg and
   nothing restarts it: the walker freezes mid-route, for seconds to minutes. (Side effect:
   leg-alternation animation also stops after leg 1 — characters glide instead of walk.)
2. **RC-2 — exact shared door coordinates (stack amplifier).** `calculatePath` pushes
   `DOOR_SIDES` anchors RAW (`DOOR_JITTER` exists in constants but is never applied here).
   Every cross-zone walk passes through literally (240,386)→(240,432); every freeze/pause
   there deposits agents on the same pixel → 0px stacks.
3. **RC-3 — leg-target blindness.** The store only holds the CURRENT LEG's
   `targetPosition`; an ambient walk's FINAL destination lives solely in component refs.
   B's destination picker sees mid-route A at a corridor node and can pick A's landing spot.
4. **RC-4 — isotropic spacing on anisotropic sprites.** Circular `MIN_AGENT_DIST = 35px`,
   but sprites are ~32px wide × ~44px tall in 3/4 view: a 35px VERTICAL separation still
   reads as a full stack (the PR #103 geometry lesson, applied there only to social).
5. **RC-5 — no recovery.** Once a stack forms (freeze, race), nothing dissolves it; the
   pair stands overlapped for a whole behavior duration (30–65s post-calm-rhythm).

## Acceptance criteria

- AC-1: While an agent is on a multi-leg ambient walk, every OTHER agent's destination
  picker sees that agent's journey END (not its current leg node).
- AC-2: Journey target is cleared on final arrival and on EVERY abort path (stuck unstick,
  watchdog restart, group-event hijack, unmount) — a stale journey must never block a spot.
- AC-3: `avoidOverlap` separates by a visual ellipse (rx≈32, ry≈44): pure-vertical
  resolutions ≥ ~44px, pure-horizontal ≥ ~32px; push direction biased horizontal
  (並肩 reads natural; vertical columns cannot form at ANY destination type).
- AC-4: Arrival nudge (safety net for residual races): on FINAL arrival only, if visually
  overlapping a STATIONARY other agent, the ARRIVER takes one micro-step aside (event-driven,
  once, never the established stander, never during group events). ADR-004-compliant: this is
  target-time/arrival-time deconfliction, NOT per-frame separation.
- AC-5: Group-event chokepoints (store) inherit the elliptical metric and stay green
  (`agentSeparationInvariants`).
- AC-6: Live forensic evidence: scripts/overlap-recorder.mjs (12 min) — sustained stationary
  stacks (<30px, >2s, both at rest) drop to 0; pre-fix baseline recorded for A/B.

## Non-goals

- Per-frame/transit separation (rejected, ADR-004 — agents may still cross in motion).
- Desk/home seat changes, status logic, hook contract — untouched.
- Pet positioning (independent system).

## Design (F1..F5 ↔ RC-1..RC-5)

1. **F1**: `setIsWalking(false)` moves from `animate()`'s arrived branch to
   `onWaypointReached`'s FINAL-arrival branch only — the stall watchdog (and leg animation)
   then covers the entire journey. Abort paths already reset it.
2. **F2**: door anchors jittered PER TRANSIT along the wall-opening axis (±DOOR_JITTER/2),
   validated `isOnFloor && !isOnObstacle`, falling back to the raw anchor.
3. **F3**: `store.setAgentJourney(id, dest|null)`; published at the walk-start sites
   (doSchedule ambient walk, returnHomeOnIdle, groupTarget effect), cleared on
   `setAgentArrived` + every abort site. `getOccupiedPositions` resolves
   `journeyTarget || targetPosition || position`.
4. **F4**: `visuallyOverlapping(a, b, rx=32, ry=44)` pure predicate; `avoidOverlap`
   rewritten on it with horizontal-biased push; `MIN_AGENT_DIST` kept for BC.
5. **F5**: arrival nudge in `onWaypointReached` final branch (guards: !inGroupEvent, single
   attempt per journey, nudge target validated against all stationary agents).

## Evidence plan

Engine: unit pins per AC. Live: overlap-recorder 12-min A/B (pre-fix run = forensic baseline,
also validates the leg-target mechanism from real captured events). Suite + render-smoke + CI.

## Domain Decisions

1. **Separation contract is the visual ellipse (rx=32, ry=44), not a circular distance.**
   Sprites are anisotropic in the 3/4 view; any future spacing logic must use
   `visuallyOverlapping` rather than reintroducing a radius check.
2. **A walk's journey END is store state (`journeyTarget`), owned by AgentCharacter.**
   Set at walk start, cleared at arrival + every abort + unmount. Any new walk-starting code
   path MUST publish and clear it, or pickers go blind to that walk's landing spot again.
3. **`isWalking` means "journey in progress", not "leg in progress".** Only final arrival
   (or an abort) clears it — the 1.5s rAF stall watchdog depends on this to guard legs 2..N.
4. **Stack recovery is event-edge only** (arrival nudge: once per journey, arriver-only,
   verified-clear). Per-frame separation stays rejected (ADR-004).
