# Work Log: feat/declutter-glance-layer

## Header

- Branch: `feat/declutter-glance-layer`
- Classification: `quick-win`
- Classified by: `claude-opus-4-8`
- Frozen: `2026-06-09`
- Created Date: `2026-06-09`
- Owner: `claude-opus-4-8 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `8c671d5`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `48`

---

## Session Info

- Agent: `claude-opus-4-8`
- Session: `2026-06-09`
- Platform: `claude-code`
- Files Read: `30`

---

## Task Description

Owner worried "畫面太亂". A 4-lens declutter panel (clutter-auditor · first-time-user · wall-TV
readability · calm-tech), each reading the actual busy-moment screenshot + the real code,
unanimously named the dominant noise = **simultaneous speech bubbles (no concurrency cap)**.
This ships the agreed REDUCTION (not new features): bubble cap + 2 cheap subtractions.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-06-09 | owner clutter concern; evidence-based audit screenshot |
| plan | complete | 2026-06-09 | 4-expert declutter panel → reduction plan (quick-win, no spec) |
| implement | complete | 2026-06-10 | cap + OVERTIME de-alarm + status-chip removal; +time-rotation (liveliness) |
| review | complete | 2026-06-10 | fresh acx-reviewer (owner-requested) → NOT READY (uncommitted rotation + cadence + LOWs) → all fixed |
| test | complete | 2026-06-10 | +13 tests; suite 1424; build clean; load-page + liveliness-over-time verified |
| ship | in-progress | 2026-06-10 | PR #81 (main protected) |

---

## Phase Summary

- **plan**: evidence-first — captured a real busy-moment screenshot, then a 4-lens panel read it +
  the code. Unanimous: #1 noise = N-active→N-bubbles with no cap; fix = cap 2–3 + priority
  (blocked>done>working) + the honest guarantee that suppressing a bubble hides TEXT not STATUS.
- **implement**: pure `bubbleVisibility.js` (`selectVisibleBubbles`) + a per-agent boolean selector
  in AgentCharacter gating `BehaviorBubble`; OVERTIME red pulse → static muted chip; removed the
  redundant corner status glyph (color pill + glow ring already encode status), folded status into
  the group aria-label (net a11y gain). Deferred: bottom role-legend demote = its own ticket AVO-130.
- **liveliness (owner: "蓋掉的方式是活躍的嗎? 別蓋死/死氣沉沉")**: the cap originally sorted by recency
  then STABLE id → when several agents held ambient bubbles with stale changedAt, the same low-id ones
  always won → others permanently mute (dead). Fixed: `selectVisibleBubbles` now takes `now` and breaks
  priority+recency TIES with a time-rotation (`BUBBLE_ROTATE_MS=2500`), so tied agents take turns; real
  recency still wins (meaningful) and blocked/done stay pinned. AgentCharacter passes `Date.now()`.
- **review (owner-requested, fresh adversarial)**: NOT READY → 3 findings, all addressed: (1) HIGH the
  rotation was uncommitted (now committed); (2) MED rotation cadence is coupled to store-emit frequency
  — ACCEPTED + documented: any active office churns sub-second (doSchedule/waypoints/poll) so rotation
  is smooth when it matters; a paused office intentionally freezes; (3) LOW added `awaiting-approval` +
  `thinking` to statusLabels (en+zh). Honesty (suppress hides text not status) verified live (capped
  agents keep ring+badge). Liveliness verified live: ≤3 at once but 5 distinct agents shown over time.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | owner clutter concern; evidence-based screenshot audit
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | 4-lens declutter panel → reduction plan (no spec for quick-win; theme spec ux-vibe-rebalance.md)
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10 | bubbleVisibility.js + AgentCharacter bubble gate + OVERTIME de-alarm + status-chip removal + time-rotation (liveliness)
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10 | fresh acx-reviewer (owner-requested) → NOT READY (3 findings) → all addressed (committed rotation, cadence accepted+documented, statusLabels keys added); honesty + liveliness verified live
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10 | suite 1424 (+13); build clean; load-page: bubbles 7→3 ≤ cap, blocked kept slot; liveliness-over-time: ≤3 at once / 5 distinct shown across windows; 0 console errors
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-10 | SSoT Ship History updated; PR #81 (main protected)

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/ux-vibe-rebalance.md | declutter theme (glance-L1 doctrine) |
| Issue | AVO-130 | bottom role-legend demote — deferred follow-up |
| PR | https://github.com/KbWen/agent-virtual-office/pull/81 | declutter |

---

## Known Risk

- Touches AgentCharacter (Protected Surface) — but only removes an overlay glyph + gates a bubble +
  enriches aria; NO coordinate/scale/movement change. Load-page verified + owner saw the screenshot.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- ADR Coverage Check: no ADR required — cosmetic render-layer declutter, no architectural boundary.
- Scope: deferred the bottom role-legend demote to its own ticket AVO-130 (different surface — the
  control bar, not the office scene); this PR is the 3 office-scene glance-layer declutters.
- SSoT direct-write (zero-Python fallback): Ship History updated directly; logged here.

---

## Design Reference

none

---

## Test Gate Results

- `npx vitest run` → 1424 passed (+13 `bubbleVisibility`). Build clean (444.8 KB JS).
- Load-the-page (headless Playwright `scripts/clutter-after-shot.mjs`): busy 7-agent scene → 3
  visible bubbles ≤ cap 3, blocked agent kept a slot, 0 console errors, no ErrorBoundary.
- Liveliness-over-time (`scripts/bubble-rotation-shot.mjs`): 5 working agents all bubbling, sampled
  across rotation windows → ≤3 at once but **5 distinct agents shown over time** (rotates, not frozen).

---

## Evidence

- Pure `selectVisibleBubbles` invariants: 13 tests (cap, blocked>done>working priority, recency,
  no-thrash-within-window, ROTATION cycles all tied agents, recency-still-wins, blocked pinned,
  bubble-only candidates, empty/cap-0).
- Honesty (suppress hides TEXT not STATUS): verified live — capped-out agents keep ring + reason
  badge (structural: `bubbleVisible` gates ONLY the bubble `message` prop; rings/badge key on status).
- Screenshots: `.pet-shots/clutter-audit.png` (7 bubbles) → `clutter-after.png` (3, chips gone,
  OVERTIME muted). Owner confirmed visually.

---

## Resume

none
