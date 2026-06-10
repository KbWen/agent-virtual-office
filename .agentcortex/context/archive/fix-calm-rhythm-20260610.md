# Work Log — fix/calm-rhythm

- Branch: fix/calm-rhythm
- Classification: quick-win
- Owner: claude-fable5
- Current Phase: implement
- Checkpoint SHA: c02b8be
- Created: 2026-06-10

## Session Info
- Session: Fable 5 main conversation (continuation), 2026-06-10. Owner Qs: (1) prior fixes confirmed? (2) agents never visit break/research rooms (3) constant walking feels restless (躁動).

## Goal
Calm the office movement rhythm and make room visits visible. Reduction-only tuning (no new features), no governance-brain changes.

## Diagnosis (evidence-grounded)
- Engine sim (20k samples, tests/tmp-rhythm-sim.test.js): 'working' agent = 48.7 walks/h, 38.5% walk-cycles, avg cycle 28.5s. Cause: solo `meeting` in work pool ≈ 20.5% of ALL cycles for most roles (1/4 of work picks × 82%).
- Live 3-min headless zone audit (scripts/zone-audit.mjs, idle office): ≥1 walker on screen 83% of samples, ≥2 walkers 46%. Meeting room dominates (pm 30% occupancy solo); lounge 1 visitor, research 2% once; qa+designer never left mainOffice. Owner perception fully reproduced.
- Paths desk→all rooms: 0 failures (sim). Store never resets positions — perception is rhythm math, not a bug.

## Expert Panel (2 lenses, Sonnet)
- Game-feel: approve; add WALK_SPEED 80→60px/s (80 reads as "rushing" at this scene size); keep transit < dwell; 0-walker ~65% target ≈ Animal Crossing rhythm; dead-office threshold >80% — not near.
- Honesty: net honesty GAIN (working agents at desks more = closer to real status); verified no UI/signal reads behavior==='meeting' as real state (officeLife group events set it directly, unaffected); quick-win appropriate, no ADR.

## Plan
1. behaviorEngine.js: remove solo `meeting` from work pool; typing [30,65]s, reading [25,55]s, writing [20,50]s; drink-coffee [18,35]s, drink-water/check-phone/eat-snack [15,30]s; FALLBACK matches typing.
2. constants.js: WALK_SPEED 80→60; WATCHDOG_TIMEOUT 90s→120s (longest behavior 65s + walk ~13s @60px/s + 15s stuck-slack = 93s > 90s).
3. tests/behaviorEngine.test.js: pin (a) solo engine never emits 'meeting', (b) working walk-cycle share ≤ 22%.
4. Evidence: post-fix zone-audit A/B + full suite + render-smoke.

## Drift Log
- none

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T12:10:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T12:20:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T12:45:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T12:55:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T13:00:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-10T13:10:00Z

## Phase Summary

- Restlessness + empty-rooms were one root cause: solo `meeting` marched lone agents to the
  meeting room ~20% of cycles. Removed (group events own that room), desk durations 30-65s,
  WALK_SPEED 60, dwells lengthened. Live A/B: ≥2 walkers 46→24%, lounge visits 1→9. ⚡ ACX

## Review (light ceremony — parameter tuning)
- Adversarial pass: WATCHDOG math re-derived (65s + 15s walk@60px/s + 15s slack = 95s < 120s ✓); BEHAVIOR_STUCK window 23s > longest walk 15s ✓; officeLife mid-event timers only flip bubbles (cosmetic, pre-existing class) ✓; no UI/signal reads behavior==='meeting' as real state (locales label still used by group events) ✓; gate/designer thin work pools non-empty post-removal (exhaustive sweep test) ✓.
- Verdict: PASS

## Evidence
- Engine sim A/B (20k samples): working 48.7→17.6 walks/h (share 38.5%→18.2%); 8-agent screen 2+ walkers 23%→10%, nobody-walking 41%→58%.
- Full suite: 1874/1874 pass (3 new pins: no-solo-meeting, working walk-share <22%, break-room reachability).
- render-smoke PASS — 2078 SVG descendants, 0 pageerrors, 0 console errors.
- Live zone-audit A/B (3 min, 702 samples each): ≥1 walker 83%→66%; ≥2 walkers 46%→24%; solo meeting-room occupancy pm-30%→0; lounge visits 1→9 agent-visits (dev 19% of its time there) + res visited research. Post run had 4 REAL tracked sessions (matches owner condition).
- Checkpoint: e595924

## Recommended Skills
- none (parameter tuning; no skill triggers matched)
