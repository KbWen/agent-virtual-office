# Work Log: fix/shared-node-stacking

## Header

- Branch: `fix/shared-node-stacking`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `efa415d`
- Recommended Skills: `none`
- Primary Domain Snapshot: `movement`
- SSoT Sequence: `65`

---

## Session Info

- Agent: `claude-fable-5` (owner-reported bug #2 of the day: "研究員跟不知道誰疊在一起")
- Session: `2026-06-11 09:40 UTC`
- Platform: `claude-code`

---

## Task Description

Owner screenshot showed res stacked with another agent. LIVE store capture caught the mechanism
red-handed: pm and dev at the IDENTICAL pixel (300,180), distance 0 — the "top aisle center"
shared graph node. `findSafePolyline` (the mainOffice Dijkstra router) returned EXACT shared
MAIN_ROUTE_NODES coordinates (and the shared object references themselves), while
findBestCorridor/nearestCorridor already jittered theirs. Two agents traversing the same aisle
simultaneously therefore overlapped at distance zero. Distinct from ADR-004's rejected per-frame
mutual push — this is the panel's pre-blessed "cheap lateral offset" mitigation, now activated by
the owner's report (the ADR's owner-call condition).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; mechanism live-captured (dist 0 store snapshot) |
| plan | done | 2026-06-11 | gate PASS in chat |
| implement | done | 2026-06-11 | findSafePolyline route reconstruction: jitter + chain re-validation + exact fallback |
| review | done | 2026-06-11 | fresh reviewer (Protected Surface; chain-validation correctness) |
| test | done | 2026-06-11 | 1831/1831 (+4); all 5 movement suites green (the 484-route deep suite now validates JITTERED paths) |
| ship | done | 2026-06-11 | SSoT seq 66; owner visual confirmation pending per Protected Surfaces |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T09:40:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T09:42:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T10:00:00Z | +4 tests
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T10:20:00Z | fresh reviewer: chain-validation sound across all 5 cases; global-vs-local obstacle tables proven non-mismatching (range proof + endpoint-inside lineHitsRect); deep suite ×3 no flake; sensitivity probe (jitter removed → spread test fails)
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T10:22:00Z | 1831/1831
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T10:25:00Z | SSoT seq 66; owner visual confirm pending (aesthetic only)

---

## Changes

- `src/systems/movementSystem.js` `findSafePolyline` route reconstruction: INTERMEDIATE nodes get
  jitter candidates (×4, CORRIDOR_JITTER x / ±6 y) accepted only when on-floor, off-furniture, AND
  both adjacent segments stay obstacle-free (chain validation: each final segment is checked when
  its later endpoint is placed, prev = already-final output); failure → EXACT node fallback (never
  worse than today). Destination never offset. Paths now push fresh objects (aliasing fix — the
  old code pushed the shared MAIN_ROUTE_NODES objects themselves into per-agent paths).
- `tests/pathNodeAntiStack.test.js` (+4): seeded 20-run spread assertion at the (300,180) aisle
  node; destination-never-offset; 200 seeded routes segment-walkable at 4px; MAIN_ROUTE_NODES
  aliasing guard.

---

## Evidence

- LIVE capture (pre-fix): pm + dev at (300,180), dist 0, both mid-transit — the smoking gun.
- All 5 movement suites green INCLUDING movementPathingDeep's 484-route matrix, which now
  exercises the jittered reconstruction every run (the existing suite became the safety net).
- Full suite 1818 → **1831**; build + render-smoke green.

---

## Test Gate Results

- 1831/1831; pathNodeAntiStack 4/4; movement suites 72/72.

---

## Drift Log

- ADR Coverage Check: implements ADR-004's documented owner-call mitigation (lateral offset on
  shared corridor traversal) — within the ADR's recorded consequences → no new ADR.
- Protected Surface note: geometric correctness is test-proven (obstacle-free segments, on-floor,
  exact fallback); the AESTHETIC judgment (±15px lane spread looks natural) is OWNER-ONLY —
  visual confirmation pending, flagged in the ship summary.

---

## Phase Summary

- Shared-node distance-0 stacking fixed at the router: intermediate Dijkstra nodes jitter with
  chain re-validation + exact fallback; destinations exact; aliasing closed. Live-captured root
  cause; 1831 green. Owner visual confirm pending. ⚡ ACX
