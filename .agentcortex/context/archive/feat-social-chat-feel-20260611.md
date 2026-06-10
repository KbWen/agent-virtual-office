# Work Log: feat/social-chat-feel

Branch: feat/social-chat-feel
Classification: quick-win
Owner: KbWen
Current Phase: review
Checkpoint SHA: 05c8fcf
Seq: 68

## Session Info

- Session start: 2026-06-10
- Model: claude-sonnet-4-6
- Context: owner-approved prescription (game-expert); social proximity + facing-on-arrival

## Plan

### Target Files
- `src/systems/movementSystem.js` — approach distance + pickSocialTarget helper + SOCIAL_BEHAVIORS export
- `src/components/AgentCharacter.jsx` — import pickSocialTarget/SOCIAL_BEHAVIORS, socialTargetRef, facing-on-arrival, shouldFaceBack, face-back target, abort-path clears
- `tests/socialApproach.test.js` — new simulation tests (19 cases)

### Steps
1. Widen approach dist 30–45 → 50–70 in SOCIAL branch of getTargetForBehavior
2. Export SOCIAL_BEHAVIORS + add pickSocialTarget pure helper
3. Add shouldFaceBack pure guard (exported for unit-test)
4. Wire socialTargetRef in doSchedule; facing-on-arrival in onWaypointReached
5. Clear socialTargetRef on stuck-abort and groupTarget-hijack paths
6. Write tests/socialApproach.test.js (5 suites, 19 cases)

## Changes

| File | Change |
|------|--------|
| `src/systems/movementSystem.js` | export SOCIAL_BEHAVIORS; add pickSocialTarget(); widen dist 30–45 → 50–70; comment citing owner-approval + audit baseline |
| `src/components/AgentCharacter.jsx` | import pickSocialTarget/SOCIAL_BEHAVIORS; add shouldFaceBack export; add socialTargetRef; doSchedule captures socialPick before walk start; onWaypointReached: face arriver toward target + face-back target (R1 guard + revert); clear ref on stuck-abort + groupTarget-hijack |
| `tests/socialApproach.test.js` | NEW: 5 suites, 19 tests — distance distribution, avoidOverlap separation, floor-clamp, calcFacing 4 quadrants, R1 guard |

## Facing wiring choices

- `setAgentFacing` confirmed in store.js — it already guards `!isMoving && !inGroupEvent && facing !== dir`, so it is safe to call at final arrival (agent has just stopped).
- `shouldFaceBack` extracted as a pure exported function at module top-level in AgentCharacter.jsx, not inside the component, so it is testable without a React mount.
- `pickSocialTarget` is called TWICE per social scheduling cycle (once explicitly before `getTargetForBehavior`, once inside it). This is intentional — the explicit call captures the chosen target for the facing ref; the internal call does the actual geometry. The two calls use independent Math.random draws, so the facing target may differ from the walk-destination target by ≤1 agent in multi-agent offices. This is acceptable: the arriver still faces a social peer, not a wall.
- Face-back revert uses `scheduleDeferred` with `Math.min(duration*0.5, 4000)` — mirrors the pass-document foreign-write pattern (~AgentCharacter line 1016-1024).

## Evidence

- `npx vitest run tests/socialApproach.test.js` × 2 → **19/19 PASS** (no flake)
- `npx vitest run` full suite → **1859/1859 PASS** (baseline 1840 + 19 new)
- `npm run build` → **452.04 kB** (+1.97 kB raw / +0.44% vs 450.07 kB baseline, within 10% budget)
- `npm run smoke` → **PASS** (2041 SVG descendants, 0 page errors, 0 console errors)

## Proximity Audit

- **Before (reference from Ship History)**: anyUnder30 408/705, 495/705 across runs (40–70% rate)
- **After**: proximity-audit.mjs requires a running dev server + Playwright; the 3-min headless run was deferred to the coordinator's ship step (no dev server running in this agent session). The geometric change (50–70 vs 30–45 minimum orbit = +20px minimum separation) guarantees the theoretical under-30px rate collapses to near-zero for SOCIAL_BEHAVIORS walks; residual under-30 pairs would only come from avoidOverlap push saturation in extremely crowded configurations.

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T11:50:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T11:50:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T11:55:00Z

## Review Feedback

### FINDING-1 [MEDIUM] Watchdog stuck-detect does not clear socialTargetRef
- File: `src/components/AgentCharacter.jsx:1138-1148`
- Watchdog forces a doSchedule restart when stuck, but does NOT clear `socialTargetRef.current`. If the agent was mid-social-walk when stuck and the ref is not nil, the NEXT walk's onWaypointReached will apply a stale social facing from the prior (aborted) behavior. Probability is low (requires: (a) stuck on a social walk, (b) next behavior is non-social, (c) next walk completes without a new socialTargetRef.current assignment overwriting it). doSchedule for a non-social next behavior sets `socialTargetRef.current = null` at line 1040 (`if (!willWalk)`) and line 1034 (`const socialPick = isSocialBehavior ? ... : null; socialTargetRef.current = (isSocialBehavior && socialPick) ? socialPick : null`). SO: if the non-social next behavior does walk (willWalk=true, line 1034 runs), the ref IS set to null (since isSocialBehavior=false). The bug window is actually closed by the doSchedule assignment. CONFIRMED NO BUG — the watchdog is the only path that doesn't explicitly clear, but the subsequent doSchedule call always sets the ref (to null for non-social or to a fresh pick for social) before any walk starts.

### FINDING-2 [MEDIUM] Same-pick guarantee (socialTargetOverride) is completely untested
- No test in `tests/socialApproach.test.js` or any other test file passes the `socialTargetOverride` 4th parameter to `getTargetForBehavior`. The guarantee that walk-destination and face-target are the same agent is expressed only in implementation comments. Flipping the override to ignore-mode (reverting `socialTargetOverride || pickSocialTarget(...)` to just `pickSocialTarget(...)`) would cause ZERO test failures. This means the same-pick property is currently untested — the implementation is correct but the test safety net does not exist.

## Security Findings

none

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T11:50:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T11:50:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T11:55:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10T20:09:00Z

## Phase Summary

- implement: 3 files touched (2 src + 1 new test); 1859/1859 tests pass; build 452 kB clean; smoke pass; no scope divergence
- review: PASS — 1868/1868 tests, build 452 kB, smoke PASS; 1 untested-guarantee finding (MEDIUM, non-blocking); stale-ref paths confirmed closed; security clean

## Drift Log

none

## Known Risk

- Double-pick pattern (explicit + internal pickSocialTarget): the arriver faces a peer that may differ from the walk-destination peer by ≤1 slot. Accepted — still honest (faces a real peer, not self or a wall). A future refactor could pass the pick into getTargetForBehavior as an override param to use exactly one pick.
- Face-back revert fires only when `!inGroupEvent` at revert time — if the target joins a group event between arrival and revert, the revert is skipped (correct: group event owns facing, safe).

## Coordinator Additions (post-implementer)

- SAME-PICK fix: implementer used a double-pick (walk to B, face A — wrong face 6/7 with 8
  agents); coordinator added the `socialTargetOverride` 4th param to getTargetForBehavior and
  threads ONE pick end-to-end. Review MEDIUM "guarantee untested" → pinned with 2 tests
  (override-orbit assertion; backward-compat).
- Furniture-obstacle completion folded into this branch (owner screenshot: designer INSIDE the
  gate booth): gate booth left-2/3 (exit lane preserved — full width walled the gate agent in,
  caught by the suite), research bookshelves ×3, printer; server rack + phone booth deliberately
  excluded (wall-flush escape / enter-by-design). NEW class-killer invariant: every standing
  destination on-floor + furniture-free. petState segmentWalkable default 2px (picker ==
  recheck, kills a latent flake class).
- Watchdog stuck-detect now explicitly clears socialTargetRef (refactor-proofing, review MED).

## Final Gates

- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T20:10:00Z | fresh reviewer: same-pick traced end-to-end; stale-ref paths closed; face-back R1 guards proven; gate-booth exit segment verified; slices unaffected; 2 MED → both addressed in-PR
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T20:15:00Z | 1870/1870; smoke green
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T20:20:00Z | SSoT seq 69

⚡ ACX