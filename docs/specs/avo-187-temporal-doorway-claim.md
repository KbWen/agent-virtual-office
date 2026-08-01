---
title: "AVO-187 — Temporal Doorway Claim"
status: shipped
classification: feature
ticket: AVO-187
created: 2026-07-31
primary_domain: office-runtime
secondary_domains: [game-feel, ci-infra]
adr: docs/adr/ADR-010-atomic-door-route-claims.md
---

# AVO-187 — Temporal Doorway Claim

## Goal

Prevent Agents from visibly stacking while paused at a doorway by allowing only one active journey
to own a physical door at a time. Preserve ordinary in-transit ghost-through, existing destinations,
floor/obstacle validity, and the current RAF movement architecture.

## Problem evidence

- `jitterDoorCrossing` offsets only perpendicular to travel. Two Agents at one door side can be at
  most 20 px apart, below the 30 px stack alarm and inside the 32×44 sprite footprint.
- The 2026-06-10 forensic found 10 of 12 real standing stacks at `(240,386)`; the 2026-07-16 clean-CI
  sample found 4 of 4 door stacks pinned at `x=585`.
- The roughly 50 px openings cannot guarantee two Agents more than 30 px apart without placing a
  waypoint off-floor or inside an obstacle.
- `tests/doorCrossingSeparation.test.js` intentionally passes while proving the defect still exists;
  it is characterization, not the desired contract.

## Player-visible sequence

```text
Agent A requests route using door D ── granted ── moves normally ── arrives/aborts ── releases D
Agent B requests route using door D ── queued  ── stays in place ─── granted next ─── moves normally
Agent C requests unrelated door E ──── granted ── may move concurrently
```

No queue UI, waiting marker, door animation, or new staging tile is introduced.

## Acceptance criteria

1. **Physical-door exclusivity**: for every door in `DOOR_SIDES`, at most one live `journeyId` owns
   that physical `doorId`; the two directions and both sides share the same key.
2. **Atomic route acquisition**: a cross-zone journey obtains all one or two required door IDs in
   one store transition before setting `isMoving=true` or starting RAF. Failed requests acquire none.
3. **Safe waiting**: a denied Agent remains at its current rendered position, is not marked moving,
   and does not advance toward a door. It retries the same request without receiving a new ticket.
4. **Deterministic fairness**: requests that share any door are ordered by the first monotonic ticket;
   disjoint requests may run concurrently. Repeated retries cannot move a request backward.
5. **Fenced lifecycle**: claim grant and release identify both `agentId` and unique `journeyId`.
   A late callback from an old journey cannot clear a newer claim owned by the same Agent.
6. **Complete release coverage**: final arrival, explicit abort/stuck recovery, queued cancellation,
   confirmed true removal, dynamic eviction, single-agent clear, and clear-all release the matching
   request and claims. Release is idempotent; a non-owner cannot release another journey.
7. **StrictMode safety**: transient passive-effect teardown/reconnect does not release or duplicate a
   claim. A true removal uses the existing deferred removal decision, aborts in place, then releases.
8. **Timeout safety**: a deadline never transfers a live claim by itself. Timeout recovery first
   stops the owner at the component's rendered position through a fenced in-place abort, then releases.
   Hidden/unfocused browser throttling cannot create two owners.
9. **Route compatibility**: `calculateJourney(from,to)` returns the same waypoint coordinates and
   ordering as today's `calculatePath(from,to)`, plus ordered unique `doorIds`; `calculatePath` remains
   a wrapper for existing callers. Same-zone routes require no claim.
10. **Multi-room deadlock proof**: opposite two-door journeys cannot partially hold different doors;
    all-or-none acquisition guarantees no hold-and-wait cycle and eventual progress under release.
11. **Focused test-the-test**: tests fail when exclusivity is removed, a side/direction key is used,
    FIFO becomes LIFO, a release path is disabled, the fencing token is ignored, or a two-door request
    is changed to partial acquisition.
12. **Forced-contention evidence**: a deterministic scenario exercises every physical door in both
    directions, includes same-door and two-door contention, completes queued journeys, and records
    `maxConcurrentOwnerPerDoor=1`. It preserves zero teleport, sustained stack, frozen-walker, and
    off-floor violations.
13. **Visual confirmation**: before ship, the owner cold-watches forced bidirectional contention at
    every door plus at least ten minutes of natural activity, confirming no shimmy, snapback, hidden
    Agent, unexplained idle-door blocking, or mechanical burst release.

## Data contract

The implementation may choose equivalent names, but it must preserve this minimal information:

```js
doorTraffic: {
  nextTicket: number,
  requests: {
    [journeyId]: {
      journeyId: string,
      agentId: string,
      doorIds: string[],       // ordered, unique physical-door IDs; one or two entries
      ticket: number,
      state: 'queued' | 'granted',
      enqueuedAt: number,
      deadlineAt: number,
      lastProgressAt: number,
    },
  },
  ownerByDoor: {
    [doorId]: string,          // journeyId
  },
}
```

Requests are transient runtime state: they are not persisted, sent through status transport, or
rendered as product status. Queue order is derived from tickets; do not maintain a second queue that
can drift from the request table.

## Required behavior boundaries

- `movementSystem.js` owns pure route metadata: waypoint calculation and physical `doorId` sequence.
- `store.js` owns atomic arbitration, tickets, fencing, lifecycle release, and test-reset cleanup.
- `AgentCharacter.jsx` owns the rendered-position timeout abort and must gate every journey-start
  path before publishing movement. It does not own claim truth in React refs.
- Soak tooling owns forced contention and measured door-owner/coverage evidence; it does not alter
  production arbitration behavior.

## Non-goals

- Per-frame separation, mutual pushing, collision response, crowd steering, navmesh, or A* changes.
- Increasing `DOOR_JITTER`, widening doors, moving furniture, or changing existing destination points.
- Staging/queue tiles, direction signals, traffic lights, time slots, role priority, queue UI, sound,
  particles, or new door animations.
- Splitting or broadly refactoring `AgentCharacter.jsx`, `store.js`, or `movementSystem.js`.
- Preventing brief ghost-through away from a claimed doorway.

## Constraints and risks

- ADR-004 remains authoritative: this is target/route-time coordination, never per-frame separation.
- A two-door journey intentionally over-reserves its second door until completion. This is accepted
  for the first version because current routes use no more than two doors and it removes deadlock.
- A timer-only lease transfer is prohibited; the old sprite may still be visually active after the
  store clock expires.
- The existing passive-effect teardown temporarily clears `journeyTarget`; door ownership must not
  be coupled to that transient write.
- Protected movement coordinates are unchanged. Code tests prove arbitration; only owner observation
  can approve game feel.

## Likely implementation surface

- `src/systems/movementSystem.js`
- `src/systems/store.js`
- `src/components/AgentCharacter.jsx`
- `tests/doorCrossingSeparation.test.js`
- `tests/journeyDeconfliction.test.js`
- focused store/FSM tests and `scripts/sim-soak.mjs` or a bounded forced-contention companion

## File relationship

This spec **EXTENDS** the shipped historical `docs/specs/standing-overlap-deconfliction.md` with the
remaining doorway-specific temporal fix. It is governed by ADR-004 and ADR-010; it neither replaces
nor unfreezes those prior artifacts.

## Domain Decisions

- [DECISION] Use physical-door IDs, not direction or side, because both directions share one opening.
- [DECISION] Atomically reserve every door in the complete route before movement; all-or-none removes
  partial ownership and multi-door deadlock without a traffic graph.
- [DECISION] Preserve FIFO position across retries and fence ownership by `journeyId`, so contention is
  deterministic and stale callbacks cannot release a newer journey.
- [CONSTRAINT] Timeout recovery must abort the owner at rendered truth before release; clock expiry
  alone can never transfer a live claim.
- [CONSTRAINT] StrictMode/live teardown is not removal and cannot release door ownership.
- [TRADEOFF] Full-route claims reduce throughput versus next-door claims; accept this bounded cost for
  the first version and reopen only with measured wait or owner game-feel evidence.
