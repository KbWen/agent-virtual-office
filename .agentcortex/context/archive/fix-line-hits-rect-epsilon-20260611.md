# Work Log: fix/line-hits-rect-epsilon

## Header

- Branch: `fix/line-hits-rect-epsilon`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `f150643`
- Recommended Skills: `none`
- Primary Domain Snapshot: `office-runtime/movement`
- SSoT Sequence: `81`

---

## Session Info

- Agent: `claude-fable-5`
- Session: `2026-06-11 17:30 UTC`
- Platform: `claude-code`
- Origin: chip task_4be9264a (spawned by the zone-mouth fresh reviewer), prompt pasted into main conversation by owner.

---

## Task Description

`lineHitsRect` treated |dx| ≤ 0.1 (or |dy| ≤ 0.1) segments as axis-parallel and tested ONLY the start coordinate against the slab — a near-vertical segment drifting <0.1px across a furniture edge plane was reported as a miss. Reviewer reproduced real 0.005–0.3px furniture grazes at ~0.3% of random in-rect pairs via jittered Dijkstra nodes (e.g. (295.000108,285.85)→(294.9917,185.68) clipping archDesk x2=295). Visually sub-pixel; latent flake source for the seeded pathing oracles.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; hole hand-verified against current code + reviewer counterexample |
| plan | done | 2026-06-11 | Range-check fix (reviewer's primary suggestion): near-axis branch tests min/max of BOTH endpoints; conservative — over-flag only falls back to exact node |
| implement | done | 2026-06-11 | 2-line fix + export for direct unit pins |
| review | done | 2026-06-11 | Self-review (right-sized: pure-function 2-line conservative change SPECIFIED by the previous fresh reviewer; direct pins + full seeded suites + soak). Asymmetry of the bug confirmed by pins: drift-outward direction passed pre-fix, drift-inward failed. |
| test | done | 2026-06-11 | tests/lineHitsRect.test.js (7 pins): 2 hole pins FAIL pre-fix, all pass post-fix; wedge-canyon class pinned as still-miss. Full suite 1913 → 1920, all seeded pathing suites stable. 2-min soak PASS. |
| ship | done | 2026-06-11 | PR + SSoT + archive same PR. |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T17:25:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T17:30:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T17:38:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T17:42:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T17:50:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T17:55:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Chip | task_4be9264a | spawned by zone-mouth fresh reviewer (PR #133 review) |

---

## Known Risk

- Stricter detection could reject previously-accepted jitter candidates → falls back to exact nodes (never-worse by the jitter chain's own fallback design). Full seeded suites (484-pair deep, 1000-pair fuzz, wedge matrix, door-strip grid) all green — no path decision broke in practice.
- Rollback: revert single commit.

---

## Drift Log

none

---

## Evidence

- Pre-fix: `tests/lineHitsRect.test.js` hole pins FAIL exactly as the mechanism predicts (drift-inward start point passes the ax-only check, drift-outward fails) — 2 failed / 5 passed.
- Post-fix: 7/7 pins pass; full suite 1913 → 1920; soak 2-min PASS.
