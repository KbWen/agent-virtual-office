# Work Log: fix/door-strip-floor-routing

## Header

- Branch: `fix/door-strip-floor-routing`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5`
- Guardrails Mode: `Quick`
- Current Phase: `implement`
- Checkpoint SHA: `02509ce`
- Recommended Skills: `none`
- Primary Domain Snapshot: `office-runtime/movement`
- SSoT Sequence: `78`

---

## Session Info

- Agent: `claude-fable-5`
- Session: `2026-06-11 14:00 UTC`
- Platform: `claude-code`
- Origin: chip task_2b246e48 (issue-#27 review Finding 2), prompt pasted back into main conversation by owner.

---

## Task Description

Pre-existing hole (predates #132, measured during its fresh review): zone routers' early return `[to]` never checks floor membership of the segment INTERIOR. Endpoints on door-passage floor get classified into an adjacent zone by `getZone` (e.g. door-lounge passage y 418–424 → lounge), and a furniture-free diagonal then cuts through the wall band (130/720 door-strip pairs off-floor, e.g. (218,418.5)→(430,428) off-floor at (266.8,420.7)). Analogous strips exist for every zone (mainOffice y 394–418 and x 593–598, entrance y 133–148, meetingRoom x 598–628, research y 418–424).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; chip prompt = confirmed problem statement w/ measured counterexamples |
| plan | done | 2026-06-11 | Single choke point: `routeWithinZone` adds a "zone mouth" stub for any on-floor endpoint outside its zone's convex floor rect; inner routers then operate entirely inside the convex rect where furniture-rect validation is sufficient. Never-worse: stubs run along the passage axis (on passage floor by construction); in-rect inputs are byte-identical to today. |
| implement | done | 2026-06-11 | ZONE_FLOOR_RECTS + zoneMouth + routeWithinZone choke point (~40 lines, single mechanism). |
| review | done | 2026-06-11 | Fresh adversarial: PASS. Core claim verified by 0.25px exhaustive grid (101,332 strip points, 0 bad stubs, 0 corner clamps on real floor); in-rect pairs byte-identical to HEAD (1,537-pair differential probe); door anchors ±jitter all in-rect; 4 LOW findings (cosmetic/pre-existing). Pre-existing lineHitsRect axis-epsilon hole → chip task_4be9264a. |
| test | done | 2026-06-11 | Grid un-guarded + 6-zone strip pins: 2 tests FAIL pre-fix (lounge grid + zone strips incl. mainOffice graph edges, entrance/meeting directs) → all green. Suite 1912 → 1913. Reviewer fuzz: 24,732 strip↔room + 471,282 strip↔strip pairs, 0 mouth-attributable violations. 2-min soak PASS (471 samples, 0 violations). |
| ship | done | 2026-06-11 | PR + SSoT + archive same PR. |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T13:55:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T14:00:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T14:15:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T14:35:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T14:40:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T14:50:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Issue | https://github.com/KbWen/agent-virtual-office/issues/27 | Finding 2 of its fresh review (comment notes the follow-up) |
| PR | https://github.com/KbWen/agent-virtual-office/pull/132 | predecessor fix; this closes the class it deliberately left |

---

## Known Risk

- Protected surface (movementSystem). Mitigation: one choke-point addition; door-leg anchors (DOOR_SIDES ± jitter) verified to sit INSIDE their zone rects, so cross-zone legs are unaffected; off-floor (bogus) inputs keep pre-fix behavior via an isOnFloor guard.
- Rollback: revert single commit.

---

## Drift Log

- Chip task_2b246e48 dismiss attempted — already user-started; owner pasted the prompt into the main conversation instead, no spawned worktree/branch exists (verified `git worktree list` + branch scan). Handled here.

---

## Evidence

- Inherited measurements (review Finding 2): 130/720 door-strip pairs off-floor pre-fix via early return, identical before/after #132.
- Sensitivity: un-guarded grid + zone-strip pins → 2 tests FAIL pre-fix with concrete off-floor coordinates in 4 zones (e.g. (216,420)→(40,480) off-floor at (214.1,420.6); (537,400)→(60,300) off-floor at (509.3,398.5) via graph edge; (115,140)→(400,60) off-floor at (139.9,133.0) direct; (610,210)→(700,350) off-floor at (625.0,233.3) direct).
- Post-fix: full suite 1913/1913 pass; `npm run soak -- --minutes 2` PASS (471 samples, 0 invariant violations).
- Fresh review PASS with exhaustive verification: 0.25px grid — 101,332 on-floor outside-rect points, 0 bad stubs, 0 real-floor corner clamps; 1,537-pair in-rect differential probe byte-identical to HEAD; 24,732 strip↔room + 471,282 strip↔strip fuzz pairs with 0 mouth-attributable violations (1 hit = pre-existing lineHitsRect axis-epsilon hole, chip task_4be9264a).
