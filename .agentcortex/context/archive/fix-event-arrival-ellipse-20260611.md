# Work Log — fix/event-arrival-ellipse (+ corridor-fallback validation)

- Branch: fix/event-arrival-ellipse
- Classification: quick-win
- Owner: claude-fable5
- Current Phase: ship
- Checkpoint SHA: a1c3560
- Created: 2026-06-11

## Session Info
- Fable 5 main conversation. Owner pasted both follow-up chips (task_47460ed1 + task_d8b10aa8) into the session — executed together (movement-robustness pair). Spawned chip sessions produced no branches/worktrees (verified) — owner should close them.

## Goal
A) Corridor-fallback hardening: findBestCorridor jittered AFTER validation (clip class observed in one fuzz burst); final CORRIDORS[2] relay unvalidated; nearestCorridor dead code.
B) Group-event arrival geometry: nightly soak caught arch+dev 23px at dev's chair (group:true). Root cause: BOTH store chokepoints' occupied sets held only IN-GROUP agents — bystanders invisible; plus react-in-place (groupTarget:null) participants could freeze mid-overlap. Then re-tighten the soak gate (group stacks fail again).

## Drift Log
- none

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T00:20:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T00:25:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T01:00:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T01:10:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T01:15:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T01:25:00Z

## Review (self, geometry pins)
- A: jitter now validated (floor + obstacle + BOTH segments) with exact-point fallback — never worse than the validated pick; last-resort relay documented + copies (aliasing). Fuzz seeded (mulberry32, both RNG layers now deterministic) + new corner-hugging stress (~600 pairs at MARGIN+2 off every main-office furniture corner).
- B: collectClaimedSpots mirrors getOccupiedPositions resolution (journeyTarget > groupTarget > targetPosition > position); react-in-place side-step is R1-safe (pickParticipants excludes tracked working/blocked); batch participants' standing spots pushed into `assigned` so later batch entries can't land on them. Soak gate re-tightened; warnings bucket kept in report shape.
- Verdict: PASS

## Evidence
- Suite 1898 → 1903 (+1 fuzz corner stress, +4 chokepoint pins; group-stack soak test flipped to failing).
- Local 3-min soak: (fill before merge) · CI soak dispatch post-merge: (fill)

## Phase Summary

- Both owner-pasted chips closed in one movement-robustness pass: corridor jitter/fallback
  validated (the fuzz-burst clip class), and event arrivals now respect EVERY claimed
  standing spot — bystanders included — with react-in-place side-steps; the soak gate's
  group-stack rule re-tightened to failing. ⚡ ACX
