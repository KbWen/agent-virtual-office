# Work Log: feat/recurring-failure-detection

Branch: feat/recurring-failure-detection
Classification: feature
Owner: KbWen
Current Phase: handoff (HANDEDOFF); next /ship
Checkpoint SHA: 47724e9
Spec: docs/specs/recurring-failure-detection.md [Frozen]
Backlog: AVO-117
Recommended Skills: none

## Session Info

- 2026-06-08 — AVO-117 started off main 33320eb (AVO-110 merged via PR #77). Downstream of AVO-110's reasonCode stream. Owner: "直接繼續做完" (drive to merge; lean ceremony — self-designed spec, single fresh adversarial review).

## Design Decisions (resolving bootstrap's 4 honesty tensions)

1. Coarse reasonCode → claim the PATTERN ("same kind keeps failing"), never "same bug"; no error-text parsing.
2. blocked-unknown EXCLUDED from recurrence (noise/over-claim); only the 3 specific reasons accrue.
3. Count distinct blocked EPISODES (edge into blocked / reason-change while blocked), NOT poll ticks.
4. State in-memory in store (whitelist-persist excludes it); reload resets window (mirrors externalStatus).
- Threshold 3, window 10 min, cap 20. EPHEMERAL sign: only while currently blocked AND currently recurring.

## Drift Log

- Design Gate (UI): no external DSoT (same as AVO-110); spec §AC-5 is the design SoT, recurring sign defined as SVG in implement, owner visual confirm at /test via headless Playwright.

## Design Reference

- Tool: spec | Link: docs/specs/recurring-failure-detection.md §AC-5 (recurring sign) | Approved: yes (owner "直接做完")
- Coverage: recurring sign → AgentCharacter; pure logic → recurringFailure.js; notification → desktopNotifier

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08
- Gate: plan | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08
- Gate: implement (truth-half) | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08 | Commit: 74d03e8 | recurringFailure.js + store episode-edge; 1398 green
- Gate: review (truth-half) | Verdict: NOT READY | Classification: feature | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-06-08 | fresh acx-reviewer: 1 HIGH BLOCKER (idle-gap blocked↔awaiting-approval flap manufactured false recurrence) + 1 MED (missing flap test)
- Gate: implement (review fix) | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08 | Commit: 847d235 | pure isNewBlockedEpisode (blocked-family = one episode, mirrors desktopNotifier BLOCKED_DERIVED) + flap tests; reviewer's exact regression test green
- Gate: implement (cosmetic-half) | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08 | Commit: 47724e9 | ↻ recurring sign + desktop notice + i18n
- Gate: test | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08 | full suite 1411 green; build clean (444 KB); load-the-page verified (3 real episodes → ↻ sign, 0 console errors, no ErrorBoundary)
- Gate: handoff | Verdict: PASS | Classification: feature | Timestamp: 2026-06-08 | TESTED→HANDEDOFF

## Evidence

- `npx vitest run` → **1411 passed / 63 files**, 0 failed. `npm run build` → clean, 444 KB JS.
- AVO-117 tests: recurringFailure.test.js (15: SPECIFIC-ONLY, WINDOW-DECAY incl. cutoff boundary, THRESHOLD-FLOOR, cap, immutability, isNewBlockedEpisode incl. idle-gap flap), storeReconcile.test.js (+5: EPISODE-EDGE no-double-count, flap→count 1, reason-change-new, SPECIFIC-ONLY), recurringSign.test.jsx (4), desktopNotifier.test.js (+2: recurring fires-once / below-threshold).
- AC map: AC-1→recurringFailure; AC-2→SPECIFIC-ONLY tests; AC-3→isNewBlockedEpisode + store EPISODE-EDGE + flap; AC-4→recurring a11y wording (pattern not bug) + render assert; AC-5→AgentCharacter EPHEMERAL gate + recurringSign render (live-verified); AC-6→desktopNotifier recurring tests; AC-7→constants + locales parity; AC-8→WINDOW-DECAY + cutoff boundary; AC-9→named tests; AC-10→headless Playwright (scripts/recurring-shot.mjs).
- Review: fresh adversarial reviewer caught the idle-gap flap false-recurrence BLOCKER (green tests hid it again) → fixed via pure isNewBlockedEpisode + the reviewer's prescribed flap test → verified.

## Resume
- State: HANDEDOFF (feature) → ready for /ship
- Completed: spec[Frozen] · plan · implement truth-half (74d03e8) · review NOT-READY→fix(847d235)→PASS · implement cosmetic-half (47724e9) · test PASS (1411) · load-the-page verified
- Next: /ship — SSoT Ship History + Spec Index [Shipped] + backlog AVO-117 Done + office-runtime L2 + heartbeat; archive + INDEX; PR + merge (CI green). ALSO: correct the AVO-110 Ship History pre-squash SHAs → 33320eb (the small follow-up noted last session).
- Context: AVO-117 = honest recurring detection over AVO-110's reasonCode. Pure recurringFailure.js (threshold 3 / 10-min window / specific-reasons-only / blocked-family=one-episode) + store episode-edge + ↻ over-head sign + once-per-episode desktop notice. The fresh review's idle-gap-flap BLOCKER is the headline lesson (false-recurrence trap).

## Risks

- [False recurrence]: coarse reasonCode bundles distinct root causes → mitigate with threshold ≥3 + specific-only + honest "same kind" wording. Rollback: branch additive (new module + new store field + new sign), revert branch.
- [Double-count on poll]: 5s poll re-reads same block → mitigate with EPISODE-EDGE detection in store (only on transition into blocked / reason change), named test.
- [Notification spam]: mitigate by reusing desktopNotifier dedup (once per recurring episode, reset on clear).

## External References

- none (in-repo; OTel/LangSmith trace-clustering cited as design rationale only, not a runtime dep)

## Phase Summary

- plan: recurringFailure.js (pure) + store episode-edge recording + EPHEMERAL recurring sign + desktopNotifier recurring path + i18n; 6 modify/new src + 4 test files; truth-half (logic+store) heavy-review before sign/notify. | Confidence: 88% — main unknown is the cleanest edge-detection hook in applyExternalStatus + the persist-whitelist exclusion (both inspected, look straightforward).

## Evidence

(pending implement)
