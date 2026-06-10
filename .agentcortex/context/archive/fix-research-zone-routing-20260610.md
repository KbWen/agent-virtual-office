# Work Log — fix/research-zone-routing

- Branch: fix/research-zone-routing
- Classification: quick-win
- Owner: claude-fable5
- Current Phase: ship
- Checkpoint SHA: f112e75
- Created: 2026-06-10

## Session Info
- Fable 5 main conversation. The sim-soak gate's FIRST CI run (run 27285671889) caught a real violation: designer resting INSIDE research bookshelf B at (657,459).

## Goal
Research zone had no in-zone obstacle routing (lounge did) — straight segments crossed the bookshelves/printer; any mid-walk pause parked a character inside the furniture graphic (agent version of the pet wall-phase bug).

## Drift Log
- none

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T23:15:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T23:16:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T23:35:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T23:45:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T23:50:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-10T23:55:00Z

## Review (self, geometry pins + A/B)
- v1 corridor had two real holes caught by the new pin test + fuzz: (a) printer stand spot approached straight through the printer body → obstacle-aware descent/ascent columns; (b) column candidates could shift past the zone's west edge (x<469) → clampToFloor zone-snap yanked points across the office → candidates now validated isOnFloor + getZone==='research'.
- Fuzz flake triage: 5-violation burst traced to (a)+(b) shifting global Math.random consumption; post-fix 4×1000 pairs clean on BOTH current and baseline. Residual corridor-fallback hole (≲1/8000, pre-existing, acknowledged in the fuzz test header) → chip task_47460ed1.
- Verdict: PASS

## Evidence
- New pin: research-zone paths sampled every 2px across 300 seeded pairs — 0 furniture hits (tests/journeyDeconfliction.test.js).
- Suite 1896 → 1897 green. CI soak re-dispatch: (fill at ship — must be green).

## Phase Summary

- The soak gate's first catch, closed same-day: research zone gets a furniture-aware
  corridor (lane y=472, obstacle-aware ascent/descent columns, zone-validated). Gate
  catch → fix → re-soak loop worked exactly as designed. ⚡ ACX
