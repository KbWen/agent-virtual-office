# Work Log: fix/bubble-truncation-width

## Header

- Branch: `fix/bubble-truncation-width`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `2026-09-19`
- Created Date: `2026-09-19`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `c77366b`
- Checkpoint SHA: `cde6d42`
- Recommended Skills: `verification-before-completion (auto), systematic-debugging (auto), karpathy-principles (auto), doc-lookup (auto), kb-consult (auto — on-match ≤1pg)`
- Primary Domain Snapshot: `ui-rendering`
- SSoT Sequence: `127`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-09-19 15:19 UTC`
- Platform: `claude-code`
- Files Read: `4`
- Guardrails loaded: skipped (quick-win — AGENTS.md §Core Directives + bootstrap §1 tiers)
- Override: none
- Downstream-Capabilities: `.agentcortex/context/private/downstream-capabilities.yaml` (knowledge_sources: kb-main→OK@328b30ecb33b)

---

## Task Description

REV-07 of the 2026-09-19 external review (`docs/reviews/2026-09-19-handoff-review.md`), deferred from PR #236 to its own PR because it changes how the office looks. `BehaviorBubble.jsx` `computeBubbleLayout` truncates every bubble at 16 characters regardless of script. Measured at triage: 218/469 (46%) of English bubble-ish locale lines exceed 16 characters and get cut mid-word ("forgot a semicol…"), against 22/469 (5%) in zh-TW, whose 16 characters are ~1.7× wider on screen. Goal: make English lines legible without making the office more cluttered — the owner's standing concern is simultaneous bubbles (BUBBLE_VISIBLE_CAP = 3). Visual change: owner sees same-state BEFORE/AFTER captures before commit.

Chain: `/plan → /implement → (light review + test) → /ship` (quick-win; handoff exempt).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-09-19 | Branch from `main`@c77366b (PR #236 merged). |
| plan | complete | 2026-09-19 | Measured first; width budget 140 with canvas measurement chosen from a 5-budget simulation. |
| implement | complete | 2026-09-19 | cde6d42; owner approved the en/zh BEFORE/AFTER sheet ("可以喔 繼續推進吧"). |
| review | skipped (optional for quick-win) | 2026-09-19 | light self-review + 4 mutation checks (one surviving mutant → test added); no fresh-reviewer round — right-sized to a legibility change. |
| test | complete | 2026-09-19 | 130 files / 2481 tests; build; budget +0.63%; render + panel smoke. |
| handoff | n/a | — | quick-win exempt |
| ship | complete | 2026-09-19 | PR #237; SSoT 127→128; closure in the same PR before merge. |

---

## Phase Summary

- bootstrap: quick-win — one module (`BehaviorBubble.jsx` layout helper) + its tests; no spec governs bubble length (grep of dialogue-interaction-layer + ADR-007: none). ADR-007 covers the file (voice channel) — a length change does not touch honesty, but the clutter trade-off is the owner's.

- plan: replace the 16-character cut with a WIDTH budget (140 scene px of text) measured by canvas `measureText` in the bubble's own font (estimate fallback when there is no DOM), grapheme-safe, word-boundary cut for spaced text, trailing punctuation trimmed before the ellipsis; box width from the same measurement. Target: `src/components/BehaviorBubble.jsx` + a new test file. Visual change → owner sees BEFORE/AFTER (en + zh-TW, same staged scene) before commit. | Confidence: 90% — assumption: canvas `measureText` with the SVG text's font string matches the rendered `<text>` width within a few px (to be verified in the browser against `getComputedTextLength`).

- implement: `BehaviorBubble.jsx` — width-budget `fitBubbleText` (canvas measure, grapheme-safe, Latin word back-off, trailing punct trim), `computeBubbleLayout` exported with an injectable measure, one shared font constant for `<text>` and canvas; `tests/bubbleTextFit.test.jsx` (13). Owner approved captures before commit. | Confidence: 93% — high (canvas vs rendered text verified: every staged bubble's text sits inside its box)
- test: 130 files / 2481 tests; mutation checks 4/4 killed after adding the mid-word case; build, bundle-budget +0.63%, render-smoke (4 viewports, 0 errors), panel smoke PASS.

- ship: PASS — PR #237. SSoT Update Sequence 127→128 (Ship History entry on top; oldest rotated verbatim to archive/ship-history-2026.md; caps 10/10 · 30/30). L2 ui-rendering: one [CONSTRAINT] (quick-win knowledge nudge — width, not character count). Review doc note: REV-07 shipped. This log archived by move to .agentcortex/context/archive/fix-bubble-truncation-width-20260919.md.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-19T15:19:56Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-19T15:22:30Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-19T15:32:24Z
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-19T15:32:53Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-19T15:34:03Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Source | docs/reviews/2026-09-19-handoff-review.md §REV-07 | External review input (untrusted; re-derived) |
| ADR | docs/adr/ADR-007-dialogue-channel-separation-and-honesty-gate.md | Bubble = voice channel |
| Precedent | .agentcortex/context/archive/fix-review-2026-09-19-20260919.md | Wave 1; REV-07 deferred here |

---

## Known Risk

- R1: wider English bubbles could add clutter (the owner's #1 concern). Measured instead of assumed: at budget 140 the MEAN bubble narrows in both locales (en 108→101, zh 90→86) and the WIDEST bubble in the office narrows (187→158), because the old 6.5/char estimate over-padded English by ~22%. Max English box grows 138→158.
- R2: canvas `measureText` must use exactly the `<text>` font (weight 500, 11px, 'Segoe UI', system-ui, sans-serif); a mismatch would clip or over-pad. Mitigation: one shared font constant; browser check of canvas vs `getComputedTextLength` for every locale line.
- R3: no DOM in the node suite → the estimate fallback runs there; the algorithm is tested with an injected measure function, the canvas path in a real browser.
- R4: cross-platform — fonts differ on macOS/Linux; measuring at runtime is what makes the layout correct there (the fixed estimate is Segoe-UI-calibrated at best).
- Rollback: single commit; `git revert` restores the 16-character rule. No data, payload or persistence change.

---

## Decisions

none

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- ADR Coverage Check (`check_adr_coverage.py --paths src/components/BehaviorBubble.jsx`, exit 0): ADR-007. Quick-win runs only the no_adr_at_all check; recorded for context.
- Discovery (scratch `rev07-measure.mjs` / `rev07-simulate.mjs`, headless Chromium, every en/zh-TW bubble line with {ctx}=App.jsx): estimate vs real SVG width — en median 0.78 (over-estimated), zh median 1.00; budgets 120/130/140/150/160 simulated with real measurement (table in Evidence). Budget 140 chosen: en whole-line fit 51.7%→85.2%, zh 91.7%→95.4%, mean box narrower in both, max box 187→158. 120 kept as the conservative alternative for the owner (en 76.9%, zh 90.2% — slightly worse than today for zh).
- Correction to my own earlier chat claim: zh text does NOT overflow its box today (18 px padding absorbs the under-estimate); only 1 en line does.
- A literal U+FFFD had landed in the new test file (the Write tool converted my `�` escape); replaced with the escape so the text-integrity check cannot read it as mojibake.
- Review phase skipped as optional for quick-win (engineering_guardrails §10.4); stated in Phase Sequence rather than recorded as a review receipt, because no formal/fresh review ran.
- SSoT Last Verified already 2026-09-19 (refreshed by the previous task today) — no write needed.

---

## Review Feedback

none

---

## Red Team Findings

none

---

## Design Reference

- Tool: other (rendered captures) · Link: owner-approved BEFORE/AFTER sheet (en + zh-TW, same staged scene: pm typing[1], arch arch-working[1], qa qa-error[0] with ctx App.jsx), scratch `rev07-capture.mjs` · Approved: yes (owner, 2026-09-19)

---

## Observability

none

---

## Resume

- State: SHIPPED (quick-win) — PR #237.
- Next: REV-05 (vite.config.js → .mjs; build-warning cleanup, no visible change) is the last open item of the 2026-09-19 review.

---

## Test Gate Results

none

---

## Evidence

- Captures (hermetic dev servers, BEFORE = worktree of c77366b): en before — 3 bubbles all 129 wide, cut "this looks ugly.…" / "this pattern mig…" / "App.jsx failed. …", pm↔arch overlap 13 css px; en after — "this looks ugly..." (98, whole), "this pattern might work…" (146), "App.jsx failed. told you." (136, whole), overlap 3 px; zh before/after — same text, boxes 158→146 / 149→136, overlap 3→0. Text inside its box in every case.
- Mutations (restored byte-identically): no grapheme segmentation / no trailing-punct trim / box from a per-char estimate → each fails a test; no word-boundary back-off SURVIVED the first test set (the only case cut exactly at a space) → added the mid-word case, now fails.
- Gates: `npx vitest run` → 130 files / 2481 tests; build ✓; bundle-budget PASS 499642 B (+0.63%); render-smoke PASS; panel smoke PASS.
- Discovery table (real canvas/SVG measurement, 458 lines per locale): today en fit 51.7% · mean 108 · max 138 | zh 91.7% · 90 · 187. Budget 120: en 76.9% · 96 · 138 | zh 90.2% · 84 · 138. Budget 130: en 81.2% · 98 · 146 | zh 93.2% · 85 · 148. **Budget 140: en 85.2% · 101 · 158 | zh 95.4% · 86 · 158.** Budget 150: en 87.3% · 103 · 168 | zh 97.2% · 87 · 168. Budget 160: en 89.7% · 104 · 178 | zh 97.4% · 87 · 177.
