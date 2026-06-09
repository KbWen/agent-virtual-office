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
| implement | complete | 2026-06-09 | bubble cap + OVERTIME de-alarm + status-chip removal |
| test | complete | 2026-06-09 | +9 tests; suite 1420; build clean; load-page verified |
| ship | in-progress | 2026-06-09 | PR pending (main protected) |

---

## Phase Summary

- **plan**: evidence-first — captured a real busy-moment screenshot, then a 4-lens panel read it +
  the code. Unanimous: #1 noise = N-active→N-bubbles with no cap; fix = cap 2–3 + priority
  (blocked>done>working) + the honest guarantee that suppressing a bubble hides TEXT not STATUS.
- **implement**: pure `bubbleVisibility.js` (`selectVisibleBubbles`) + a per-agent boolean selector
  in AgentCharacter gating `BehaviorBubble`; OVERTIME red pulse → static muted chip; removed the
  redundant corner status glyph (color pill + glow ring already encode status), folded status into
  the group aria-label (net a11y gain). Deferred: bottom role-legend demote = its own ticket AVO-130.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | owner clutter concern; evidence-based screenshot audit
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | 4-lens declutter panel → reduction plan (no spec for quick-win; theme spec ux-vibe-rebalance.md)
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | bubbleVisibility.js + AgentCharacter bubble gate + OVERTIME de-alarm + status-chip removal
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | suite 1420 (+9); build clean; load-page: bubbles 7→3 ≤ cap, blocked kept slot, 0 console errors
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-06-09 | SSoT Ship History updated; PR pending (main protected)

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Spec | docs/specs/ux-vibe-rebalance.md | declutter theme (glance-L1 doctrine) |
| Issue | AVO-130 | bottom role-legend demote — deferred follow-up |
| PR | — | pending |

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

- `npx vitest run` → 1420 passed (+9 `bubbleVisibility`). Build clean (444.5 KB JS).
- Load-the-page (headless Playwright `scripts/clutter-after-shot.mjs`): busy 7-agent scene → 3
  visible bubbles ≤ cap 3, blocked agent kept a slot, 0 console errors, no ErrorBoundary.

---

## Evidence

- Pure `selectVisibleBubbles` honesty/priority invariants: 9 tests (cap, blocked>done>working,
  recency, stable tiebreak, bubble-only candidates, empty/cap-0).
- Before/after screenshots: `.pet-shots/clutter-audit.png` (7 bubbles) → `.pet-shots/clutter-after.png`
  (3 bubbles, chips gone, OVERTIME muted). Owner confirmed visually.

---

## Resume

none
