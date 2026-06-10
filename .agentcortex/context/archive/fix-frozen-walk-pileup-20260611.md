# Work Log: fix/frozen-walk-pileup

## Header

- Branch: `fix/frozen-walk-pileup`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `3597e3d`
- Recommended Skills: `none`
- Primary Domain Snapshot: `movement`
- SSoT Sequence: `66`

---

## Session Info

- Agent: `claude-fable-5` (owner bug #3 of the day: "8人只看到6人/PM跟開發者疊在一起/現在又分開了")
- Session: `2026-06-11 11:00 UTC`
- Platform: `claude-code`

---

## Task Description

The deepest of the three stacking reports. LIVE measurement: a 96-second continuous dist-0
overlap of pm+dev, both `isMoving:true`, store frozen at the shared node — and
`watchdogRestarts=25`. Mechanism: **rAF does not fire in hidden tabs** (same root as the
preview_screenshot finding); the user tabs away → all in-flight walks freeze wherever they are
(piling on shared nodes pre-jitter) → on tab return the first frame's dt clamp resumed a slow
glide from the frozen pile — the user literally watched them separate ("現在又分開了 不準").
Visible-tab ≥1.5s jank stalls hit the same path via watchdog restarts.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; mechanism proven by live 96s dist-0 capture + watchdog=25 + hidden-rAF proof |
| plan | done | 2026-06-11 | gate PASS in chat |
| implement | done | 2026-06-11 | pure stepWalkFrame extraction + gap-snap; watchdog fast-forward |
| review | done | 2026-06-11 | fresh reviewer |
| test | done | 2026-06-11 | 1839/1839 (+8 pure walk-frame tests incl. pre-fix-vs-fix pin) |
| ship | done | 2026-06-11 | SSoT seq 67; live user verification = the office they watch daily |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T11:00:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T11:05:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T11:40:00Z | +8 tests
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T11:55:00Z | fresh reviewer: extraction byte-equivalent (one edge strictly improved: 1-frame-faster arrival in the 1.5px–step window); first-frame/next-leg/watchdog-restart gap=0 all proven; only the frozen leg snaps (chain walks on normally); sensitivity GAP=∞ kills the test; 1 LOW cosmetic
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T11:57:00Z | 1839/1839
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T12:00:00Z | SSoT seq 67

---

## Changes

- `src/systems/walkFrame.js` (NEW) — pure `stepWalkFrame(vp, tp, dt, gapMs, walkSpeed)`:
  gap > GAP_SNAP_MS (1500) → snap leg to target + arrived; else normal glide math
  (byte-equivalent to the old inline math incl. ARRIVE_EPSILON 1.5 / step>=dist snap).
- `src/components/AgentCharacter.jsx` — animate() delegates the frame math to stepWalkFrame
  (rAF loop structure unchanged); watchdog restart fast-forwards the frozen leg
  (dist0FastForward + setRenderPos) before startRaf so a visible-jank restart also resumes
  AT the target, not gliding from the pile.
- `tests/walkFrame.test.js` (+8) — glide/arrival/diagonal/boundary semantics + THE pin:
  4.2s gap snaps to the leg target, and a reproduction of the PRE-FIX math showing the ~8px
  glide that made the pile visibly drift apart.

---

## Evidence

- LIVE mechanism proof (pre-fix): 96s continuous pm+dev dist-0 at (300,180) with
  isMoving:true; watchdogRestarts=25; the diagnostic page's hidden-rAF behavior (rAF never
  fires when visibilityState=hidden) was independently proven during the preview_screenshot
  investigation the same day.
- Pure math: 8/8 walkFrame tests incl. the pre-fix-vs-fix differential pin.
- 1839/1839 full suite; build + render-smoke green.
- Harness exploration note: app-level freeze-resume simulation was attempted (rAF wrapper +
  organic walks in headless) and abandoned — tracked agents don't wander (R1), idle agents
  rarely walk, and gating fought every trigger; the pure-extraction path provides the
  testable seam instead. Exploration scripts removed.

---

## Test Gate Results

- 1839/1839; walkFrame 8/8; movement suites green; build + smoke PASS.

---

## Drift Log

- ADR Coverage Check: frame-math extraction + resume semantics; no architecture boundary →
  no ADR.
- Honest residual: on a FULLY hidden page nothing advances at all (no frames) — the fix acts
  at the first visible frame, which is exactly when the user can see anything. Walk state
  while hidden remains frozen (invisible, harmless).

---

## Phase Summary

- Frozen-walk pileup fixed at the resume frame: gap>1.5s → leg snaps to its (de-stacked)
  waypoint before the user's first visible frame; watchdog restarts fast-forward too. Pure
  extraction made the semantics unit-testable. 1839 green. ⚡ ACX
