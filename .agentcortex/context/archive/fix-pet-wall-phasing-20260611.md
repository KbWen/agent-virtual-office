# Work Log: fix/pet-wall-phasing

## Header

- Branch: `fix/pet-wall-phasing`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `7048b1c`
- Recommended Skills: `none`
- Primary Domain Snapshot: `game-feel`
- SSoT Sequence: `64`

---

## Session Info

- Agent: `claude-fable-5` (coordinator-implemented; owner-reported live bug)
- Session: `2026-06-11 08:10 UTC`
- Platform: `claude-code`

---

## Task Description

Owner-reported: "寵物的移動路徑也很怪，一直穿牆". Root cause: the pet's wander band
(x 80–750, y 400–525) spans several rooms, the glide is a straight CSS transition, and
`clampToFloor` validates only ENDPOINTS — segments crossed walls/furniture freely. Fix: pure
`segmentWalkable` (4 px sampling, dependency-injected) + `pickWanderTarget` (retry ≤8, else the
pet pauses one tick — calmer AND more honest than phasing). The alert run-to-blocked-desk dash is
deliberately NOT segment-gated (rare, information-bearing, its destination lies outside the
wander band) — documented accepted residual.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; geometry bug, fully headless-provable |
| plan | done | 2026-06-11 | gate PASS in chat |
| implement | done | 2026-06-11 | petState pure helpers + OfficePet wiring |
| review | done | 2026-06-11 | fresh focused reviewer |
| test | done | 2026-06-11 | 1826/1826 (+8); 500-hop seeded real-map invariant |
| ship | done | 2026-06-11 | SSoT seq 65; self-archived in same PR |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T08:10:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T08:12:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T08:30:00Z | +8 tests
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T08:50:00Z | fresh reviewer: 10-point burden ALL PROVEN; sensitivity (weakened picker → 372 crossings caught); 1 MEDIUM advisory (lounge right-wall pocket ~10s stall) → pocket-escape near-hop fallback ADDED in-PR (+1 test, 20-tick success >15 proven on real map)
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T08:55:00Z | 1827/1827; smoke green
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T09:00:00Z | SSoT seq 65

---

## Changes

- `src/systems/petState.js` — `segmentWalkable(from, to, isWalkable, stepPx=4)` +
  `pickWanderTarget(from, sample, isWalkable, attempts=8)` (pure, injected).
- `src/components/OfficePet.jsx` — wander interval routes through `pickWanderTarget` with
  `isOnFloor && !isOnObstacle`; no clean hop → skip tick (pause in place).
- `tests/petWander.test.js` (+8): stub-grid unit tests (mid-segment wall caught with clear
  endpoints; thin-wall sampling density; degenerate inputs; retry/pause) + REAL-MAP invariants
  (500 seeded hops re-verified at 2 px — 0 wall crossings, >300 accepted so the pet is not
  frozen; known cross-room segment rejected with a floor-plan-change guard).

---

## Evidence

- 500 seeded hops over the real floor plan: every accepted hop fully walkable at 2 px
  re-verification; acceptance rate high (no frozen pet), pauses rare.
- Full suite 1818 → **1826**; build + render-smoke green. Geometry = the visual claim here, so
  the headless proof IS the visual proof (no pixel-aesthetics judgment involved); owner will see
  the pet stop phasing in normal use.

---

## Test Gate Results

- 1826/1826; petWander 8/8; build + smoke PASS.

---

## Drift Log

- ADR Coverage Check: pet-local geometry fix; movementSystem only consumed via two existing pure
  exports (`isOnFloor`/`isOnObstacle`) — Protected Surfaces untouched → no ADR.
- Accepted residual: the rare alert dash (run-to-blocked-desk) may still cross furniture — it is
  information-bearing motion to a destination outside the wander band; gating it would frequently
  suppress the honest beat. Revisit only if the owner reports it.

---

## Phase Summary

- Pet wall-phasing fixed at the picker: straight-glide segments are now sampled-walkable or the
  hop is rejected (pause, not phase). 500-hop real-map invariant; 1826 green. ⚡ ACX
