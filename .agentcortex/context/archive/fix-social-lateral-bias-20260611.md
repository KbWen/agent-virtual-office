# Work Log: fix/social-lateral-bias

## Header

- Branch: `fix/social-lateral-bias`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `cc5c11a`
- Recommended Skills: `none`
- Primary Domain Snapshot: `movement`
- SSoT Sequence: `69`

## Session Info

- Agent: `claude-fable-5` (owner correction: the night screenshot had THREE stacked sprites at the gate, not just furniture clipping)
- Session: `2026-06-11 21:00 UTC`
- Platform: `claude-code`

## Task Description

Three-stack root cause: gate agent + two social visitors. Entrance has NO event gather points
(verified by grep of all officeLife coordinates) — the mechanism is uniform 0–2π approach
angles letting visitors land directly above/below the ~40px-TALL peer; vertically aligned
sprites overlap in the 3/4 view even at the new 70px ring. Fix: ±45° lateral cones (|dx| ≥ |dy|
by construction — vertical columns impossible; 並肩聊天). Plus deflake: movementPathingDeep +
behaviorEngine seeded (both flaked ~1/500 unseeded full-suite runs).

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T21:00:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T21:02:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T21:15:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T21:18:00Z | self-review (right-sized: 3-line angle cone; the 200-sample distribution pin IS the construction proof; same surface fresh-reviewed twice today)
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T21:20:00Z | 1871/1871; smoke green
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T21:25:00Z | SSoT seq 70

## Changes

- movementSystem.js social branch: approach angle = ±45° cones around horizontal.
- tests/socialApproach.test.js: +1 lateral-bias pin (200 seeded approaches, |dx| ≥ |dy|−2).
- tests/movementPathingDeep.test.js + tests/behaviorEngine.test.js: seeded (mulberry32) — deflake.

## Evidence

- 1871/1871; the pin proves vertical columns impossible by construction; deflake suites 4×4 green.

## Drift Log

- ADR Coverage Check: angle-distribution tweak within the just-shipped social design → no ADR.

## Phase Summary

- Three-stack at the gate dissolved at the geometry: visitors stand BESIDE peers (±45° cones);
  vertical stacking structurally impossible; two flaky suites seeded. ⚡ ACX