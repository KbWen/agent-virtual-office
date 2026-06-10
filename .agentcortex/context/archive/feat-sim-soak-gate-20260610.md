# Work Log — feat/sim-soak-gate

- Branch: feat/sim-soak-gate
- Classification: quick-win
- Owner: claude-fable5
- Current Phase: ship
- Checkpoint SHA: b4a2273
- Created: 2026-06-10

## Session Info
- Fable 5 main conversation. Owner approved the soak-gate proposal + asked for docs refresh + small version bump (v1.4.0).

## Goal
Turn the one-off forensic tools into a standing nightly gate (AVO-157) so emergent visual bugs are machine-caught; update CHANGELOG/README; bump v1.4.0. Spec: docs/specs/sim-soak-gate.md.

## Drift Log
- none

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T18:10:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T18:12:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T18:40:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T18:50:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T18:55:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-10T19:05:00Z

## Review (light — tooling + docs, no src changes)
- Adversarial pass: evaluator pure + injected flags (no node-CJS trap — hit it live, fixed by computing geometry in-page); sampler-gap guard kills the GAP_SNAP false-positive class; frozen-walker 90s derived from recovery budgets (3s watchdog + ≤80s doSchedule cycle); spawn path exercised locally via SOAK_SPAWN=1 (deprecation warning fixed); workflow not PR-blocking by design (AC-3).
- Verdict: PASS

## Evidence
- Test-the-test: tests/soakInvariants.test.js 11/11 — every violation class planted+caught, healthy timelines silent.
- Real runs: 2-min reuse-server soak PASS (470 samples, 0 violations); 1-min spawn-server soak PASS (234 samples, report JSON written).
- Full suite + render-smoke: (final numbers at ship)
- Docs: CHANGELOG v1.4.0 story entry; README "Diagnostics & soak testing" section; package.json 1.3.0→1.4.0 + `npm run soak`.

## Phase Summary

- One-off forensics → standing nightly gate: pure evaluator (test-the-test, 11 pins) +
  headless runner (reuse/spawn server) + nightly CI workflow. v1.4.0 release docs. The
  owner's eyes are no longer the only detector for the emergent visual bug class. ⚡ ACX
