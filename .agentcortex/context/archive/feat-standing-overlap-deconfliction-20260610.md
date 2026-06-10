# Work Log — feat/standing-overlap-deconfliction

- Branch: feat/standing-overlap-deconfliction
- Classification: feature
- Owner: claude-fable5
- Current Phase: plan
- Checkpoint SHA: c557f69
- Created: 2026-06-10

## Session Info
- Fable 5 main conversation. Owner screenshot (3rd overlap report): 8 agents, 6 visible — two pairs stacked at NEW places. Owner: 「好好規劃再處理吧」 → feature-grade plan.

## Goal
Close the remaining structural standing-overlap channels: (1) leg-target blindness — ambient walk journeys invisible to other pickers; (2) isotropic 35px spacing on ~32×44px anisotropic sprites. Spec: docs/specs/standing-overlap-deconfliction.md (AVO-156).

## Constraints
- ADR-004: NO per-frame separation. Everything here is target-time / arrival-time (event-edge) deconfliction.
- R1: no modulation of tracked agents' status; nudge is ambient-positional only, never during group events.
- Reduction doctrine: no new visible features — this is correctness of an existing promise.

## AC
See spec AC-1..AC-6.

## Risks
- Stale journeyTarget blocking spots forever → AC-2 exhaustive clear-on-abort + test pins.
- Elliptical avoidOverlap changes group-spot spacing → agentSeparationInvariants must stay green (AC-5).
- Arrival nudge cascade → single-attempt, arriver-only, validated against all stationary agents.

## Drift Log
- none

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T14:05:00Z
- Gate: plan | Verdict: PASS | Classification: feature | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T14:40:00Z
- Gate: implement | Verdict: PASS | Classification: feature | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T15:30:00Z
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T16:20:00Z
- Gate: test | Verdict: PASS | Classification: feature | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T16:30:00Z
- Gate: handoff | Verdict: PASS | Classification: feature | Transition: TESTED→HANDEDOFF | Timestamp: 2026-06-10T17:05:00Z | Doc: docs/specs/standing-overlap-deconfliction.md | Code: src/systems/movementSystem.js + src/systems/store.js + src/components/AgentCharacter.jsx | Log: .agentcortex/context/archive/feat-standing-overlap-deconfliction-20260610.md
- Gate: ship | Verdict: PASS | Classification: feature | Transition: HANDEDOFF→SHIPPED | Timestamp: 2026-06-10T17:10:00Z

## Review (fresh adversarial, diff+spec only)
- Round 1: NOT READY — 5 findings. HIGH: avoidOverlap v1 "set-x" resolution oscillated between two same-rank pushers (coffee+water config): 12.4%/2000 still-overlapping outputs (NUMERICALLY verified by reviewer) vs old code 0%. MED: journeyTarget not cleared on unmount (roster toggle strands claims); MED: nudge blind to in-flight journey claims (re-stack scenario); LOW: straight-line nudge segment; LOW: dead reference-equality guard.
- Fixes: cumulative radial-elliptical push (direction-preserving, composes) + ring-search fallback validated against ALL occupants; unmount clear; nudge claims = standers + journeyTargets with verified-clear before spending the single attempt; calculatePath nudge routing; coordinate-equality guard.
- Round 2: PASS — reviewer re-ran 550k-iteration numerical probes incl. pathological clamp cases: 0 bad, 0 off-floor, 0 on-obstacle. Non-blocking nits noted (dead import → cleaned; rare far-resolution; nudge-vs-chair-squatter bounded).

## Evidence
- Forensic baseline (12-min live, scripts/overlap-recorder.mjs): 12 sustained stationary-stack events, 189 pair-seconds overlapped; 10/12 at literal (240,386); tracked pm frozen at that node across 8 min.
- Interim A/B (after F1-F5 v1, same 12-min protocol): 1 event / 19 pair-seconds — the residual event (dist 22px) was the two-pusher class the fresh review then caught and fixed.
- Final A/B (after review fixes, same 12-min protocol): **0 sustained stationary-stack events** (baseline 12); pair-seconds-under-30-at-rest 189 → 27.8 (residual = sub-2s transit near-passes, ADR-004-accepted). AC-6 met.
- Suite: 1885/1885 (+11 new pins incl. 2000-iter two-pusher regression = 0 bad). render-smoke PASS (2148 descendants, 0 errors).

## Phase Summary

- Third overlap report root-caused by 12-min forensics: walks froze on unguarded legs (isWalking
  cleared at every waypoint → stall watchdog off after leg 1), all transits funneled through ONE
  exact door pixel, walkers' landing spots invisible to pickers, circular 35px spacing let
  vertical stacks through, and nothing recovered a formed stack. F1-F5 shipped; fresh review
  caught a HIGH two-pusher oscillation in my v1 avoidOverlap (12.4% bad) → radial-elliptical v2
  (550k-probe 0 bad). Live A/B: 12 stack events → 0. ⚡ ACX

## Recommended Skills
- none matched (movement-correctness work; no skill triggers)
