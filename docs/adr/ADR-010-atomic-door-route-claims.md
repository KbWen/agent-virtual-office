---
title: "ADR-010 — Atomic Door-Route Claims"
date: 2026-07-31
status: accepted
applies_to:
  - "src/systems/movementSystem.js"
  - "src/systems/store.js"
  - "src/systems/doorClaims.js"
  - "src/components/AgentCharacter.jsx"
  - "tests/doorClaims.test.js"
  - "tests/doorCrossingSeparation.test.js"
  - "scripts/sim-soak.mjs"
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "AVO-187 implementation evidence shows visible idle-door blocking or a route requires more than two physical doors"
  supersedes: null
  superseded_by: null
---

# ADR-010: Atomic Door-Route Claims

- **Status**: Accepted (2026-07-31)
- **Applies to**: `src/systems/movementSystem.js`, `src/systems/store.js`, `src/components/AgentCharacter.jsx`, doorway contention tests and soak instrumentation
- **Extends**: ADR-004; it does not reopen per-frame separation

## Context

Every cross-zone route currently funnels through one of four physical doors. `jitterDoorCrossing`
only spreads agents along the opening, so two agents paused at the same door remain within both the
30 px soak alarm and the 32×44 sprite footprint. The opening cannot geometrically hold two sprites
far enough apart; increasing `DOOR_JITTER` is not a solution.

AVO-187 therefore needs temporal exclusion at route-assignment time. The design must remain safe
across final arrival, abort, redirect, true removal, transient React teardown, timeout recovery, and
the two-door routes between non-main rooms. It must also preserve ADR-004's accepted limitation:
agents may ghost through each other in ordinary transit, and no per-frame mutual push is introduced.

## Expert panel

- **Movement systems** recommended atomically reserving the full route's door set. Routes use at
  most two doors, so the stronger reservation removes partial ownership and makes deadlock impossible.
- **Game AI/concurrency** agreed, adding FIFO tickets and a journey fencing token so retries remain
  fair and stale callbacks cannot release a newer journey.
- **Gameplay QA** preferred acquiring only the next door for higher throughput, but found that it
  requires safe staging positions, near/far waypoint metadata, and additional stop/resume behavior.
  That is retained as a measured re-open option, not included in the first implementation.

## Decision

For the first AVO-187 implementation, a cross-zone journey MUST atomically claim the set of physical
`doorId` values used by its complete route before the Agent begins moving.

1. Claims are keyed by physical door, never by direction or side. Opposite directions contend for
   the same key.
2. A request receives one monotonic FIFO ticket and one unique `journeyId`. Retrying preserves both.
3. The request is granted only when every required door is free and no older queued request shares
   any requested door. Requests with disjoint door sets may proceed concurrently.
4. Acquisition is all-or-none. A journey never holds one door while waiting for another, so
   multi-room routes cannot form a hold-and-wait cycle.
5. A queued Agent stays at its current safe position with `isMoving=false`. Only a granted request
   may publish the journey and start the existing RAF walk.
6. All claims release on final arrival, explicit abort, confirmed true removal, dynamic eviction,
   or cancellation before departure. A release must match both `agentId` and `journeyId`.
7. Transient StrictMode/live teardown MUST NOT release the door claim. The existing deferred true-
   removal path remains the boundary that may abort and release.
8. A timeout is not permission for another Agent to steal a live claim. The owner must first stop
   at its rendered position through the existing in-place abort path; only that fenced abort may
   release and allow the next request.
9. `calculateJourney(from, to)` will return `{ waypoints, doorIds }` from one route calculation.
   Existing `calculatePath(from, to)` remains a compatibility wrapper returning only `waypoints`.

The minimal state progression is `none → queued → granted → walking → released`. This is a bounded
door reservation inside the existing Zustand store, not a general traffic manager.

## Alternatives considered

### Global cross-zone mutex

Serialize every cross-zone journey, regardless of door. This is smallest in code and trivially safe,
but unrelated doors would visibly block each other. Rejected because physical-door concurrency is
available without meaningful extra machinery.

### Claim only the next door

Acquire at a safe staging point and release after the far-side waypoint. This improves throughput
and was the gameplay-QA preference. Rejected for the first version because it needs new staging
geometry, door-phase path metadata, stop/resume states, and proof that waiting Agents do not stack at
the staging point. Re-open only if owner cold-watch or measured wait evidence shows that full-route
claims make empty doors appear materially blocked.

### Owner-only retry with random backoff

Keep no FIFO request state and let Agents retry randomly. Rejected because starvation is possible,
reproduction is non-deterministic, and fairness cannot be verified.

### More spatial jitter or per-frame separation

Rejected by geometry and ADR-004. The opening cannot guarantee sufficient sprite separation, while
per-frame pushing would reintroduce oscillation, shared visual-position state, and an unavailable
deterministic convergence proof.

## Consequences

### Positive

- One proof-friendly invariant replaces an unfixable spatial heuristic at doors.
- Atomic full-route acquisition eliminates ABBA deadlock without a generalized lock graph.
- FIFO tickets make contention deterministic and testable; disjoint doors still run concurrently.
- Existing journey arrival, abort, and true-removal boundaries can own most claim cleanup.

### Negative

- A two-door journey reserves its second door before reaching it, temporarily reducing throughput.
- Route identity becomes an explicit contract alongside waypoints.
- Claim timeout requires a fenced in-place abort; a clock-only lease expiry is intentionally
  insufficient.
- Movement is a protected visual surface, so ship still requires forced-contention evidence and
  owner visual confirmation.

## Re-open conditions

Reconsider next-door acquisition only when evidence shows at least one of the following:

- owner cold-watch repeatedly observes an empty physical door blocked by a remote two-door journey;
- forced-contention evidence shows unacceptable wait growth while correctness invariants remain green;
- a future route requires more than two doors, making full-route over-reservation materially broader.

Any re-open must retain physical-door keys, FIFO fairness, fencing tokens, safe timeout abort, and
ADR-004's prohibition on per-frame separation.
