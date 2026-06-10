# Work Log: fix/gap-snap-threshold

## Header

- Branch: `fix/gap-snap-threshold`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-11`
- Created Date: `2026-06-11`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `c579007`
- Recommended Skills: `none`
- Primary Domain Snapshot: `movement`
- SSoT Sequence: `67`

---

## Session Info

- Agent: `claude-fable-5` (owner: "新版還是有問題/有根本性原因/用不信任的角度" — vindicated)
- Session: `2026-06-11 13:30 UTC`
- Platform: `claude-code`

---

## Task Description

REGRESSION FIX of my own frozen-walk change, proven by distrust-mode A/B: a fresh-page 3-min
visual audit (250ms DOM-transform sampling) caught **20 teleports of 89–225px** on the new code
vs **ZERO on the d260827 baseline** (parallel worktree on :5174). Root cause: GAP_SNAP_MS=1500
converts every heavy-load render stall (this machine runs CI constantly; 1.5–5s jank is routine)
into a visible teleport, and the watchdog fast-forward (fires at 1.5s) did the same on the
visible-stall path. The cure for the frozen-pile became the owner-reported "人物不連貫".

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-11 | quick-win; A/B baseline worktree (d260827, :5174) = the discriminator |
| plan | done | 2026-06-11 | gate PASS in chat; design: 5s threshold separates tab-hide (>5s, snap) from jank (1.5–5s, glide) |
| implement | done | 2026-06-11 | GAP_SNAP_MS 1500→5000; watchdog fast-forward REMOVED (glide resume restored); dead helper deleted |
| review | done | 2026-06-11 | fresh reviewer |
| test | done | 2026-06-11 | 1840/1840 (+1 jank-glide regression pin); re-audit 0 teleports |
| ship | done | 2026-06-11 | SSoT seq 68 |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-11T13:30:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-11T13:35:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-11T13:50:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-11T14:10:00Z | fresh reviewer: 5-scenario freeze truth table all coherent (hidden>5s snap / hidden≤5s glide / visible-jank glide via gapMs=0 reset / visible>5s race both-acceptable / boundary strict-gt); scope exact; SIGKILL .pa-bak residual noted
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-11T14:12:00Z | 1840/1840; re-audit 0 teleports maxStep 22px
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-11T14:15:00Z | SSoT seq 68

---

## Changes

- `src/systems/walkFrame.js` — GAP_SNAP_MS 1500 → **5000** with the A/B rationale in the comment.
- `src/components/AgentCharacter.jsx` — watchdog fast-forward REMOVED (restart resumes the
  smooth glide; long-freeze snap now lives ONLY in stepWalkFrame's first resumed frame);
  dead `dist0FastForward` helper deleted.
- `tests/walkFrame.test.js` — snap test re-parameterized (GAP_SNAP_MS+1200); NEW jank-range
  regression pin: a 4.2s gap must NOT snap (glides, the pre-existing behavior).
- `scripts/proximity-audit.mjs` — committed as a tracked diagnostic tool (fresh-page 3-min
  visual proximity + continuity audit; organic-mode via status-file shelving; self-restoring).

---

## Evidence

- A/B: baseline d260827 (parallel worktree, :5174, same machine load) = **0 teleports / 468
  samples**; new code pre-fix = **20 teleports (89–225px, cap hit) / 705 samples**.
- Post-fix re-audit (same script, 3 min): **0 teleports; maxStep 22px** (≤ 80px/s × 0.25s + rounding).
- Suite 1839 → **1840** (+1 pin). Proximity note (NOT this fix's scope): under-30px pair-seconds
  remain high (40–70% of samples across runs) — dominated by the SOCIAL approach design
  (chat/thumbs-up walks to 30–45px of a colleague; sprite width ~35px) — surfaced to owner as a
  separate tunable decision.

---

## Test Gate Results

- 1840/1840; walkFrame 9/9; re-audit teleports 0.

---

## Drift Log

- ADR Coverage Check: threshold + revert within the prior fix's scope → no ADR.
- Cleanup: baseline worktree removed; :5174 vite killed; baseline audit-script variant deleted.
- Honest residual: a VISIBLE >5s freeze (rare: sustained CPU saturation while the user watches)
  still snaps on resume — judged better than a 5s+ frozen pile drifting apart.

---

## Phase Summary

- My frozen-walk fix's 1.5s snap threshold turned routine CI-load jank into teleports (the
  owner's 不連貫 report — their distrust instinct was right). A/B-proven, redesigned at 5s +
  watchdog snap removed; re-audit clean (0 teleports, 22px max step). ⚡ ACX
