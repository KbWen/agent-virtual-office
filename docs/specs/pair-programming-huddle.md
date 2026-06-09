---
status: Shipped
title: Pair-Programming Huddle (shared-file collaboration)
ticket: AVO-106
classification: feature
labels: [multi-agent]
created: 2026-06-09
---

# AVO-106 — Pair-Programming Huddle

## Intent

When two distinct agents genuinely touch the **same file** within a short window, both
walk to a shared whiteboard for a brief huddle — a diegetic, honest visualization of a
real shared-artifact correlation. Reuses the existing group-event gather mechanism.

## Honesty Contract (load-bearing)

This is a real-signal feature in the spirit of `office-pet-barometer.md` and
`blocked-reason-tags.md`. The huddle asserts "two agents are both working on the same
file" — it MUST only fire when that is literally true:

1. **Distinct identities** — the two participants are different office agent ids
   (role or `slug~role`). Two events that both route to the *same* role collapse to one
   agent → no pair, no huddle. (Honest by construction — we never invent a second agent.)
2. **Byte-identical normalized path** — comparison uses the FULL file path (separators
   normalized, lower-cased for the Windows host), NOT the basename. Two different
   `index.js` in different directories are NOT the same file.
3. **Both recently active** — each participant's `activeFileAt` is within
   `PAIR_HUDDLE_WINDOW` (90s) and neither is `idle`. A stale file does not huddle.
4. **Never random** — the `pair-programming` event is NOT in the daily/rare random pool.
   The random scheduler can never fire it. It is triggered ONLY by the shared-file
   detector off a real `externalStatus` edge.
5. **Calm-tech cadence** — mutex'd on `activeEvent`, global seed cooldown + per-pair
   cooldown, so a pair that lingers on a file cannot spam the office.

Realistic signal source: a main session + a subagent (e.g. a reviewer/Explore agent)
operating in the SAME working dir, both reporting the same absolute path. Multi-worktree
co-editing is NOT a source here (hooks don't fire in worktrees, and worktree paths differ
— so it cannot false-trigger).

## Data Path — per-agent `activeFile`

`activeFile` is a NEW per-agent field. It must be threaded through the SAME whitelists the
`reasonCode` field passes through (the AVO-110 lesson: trace a new field through EVERY
normalizer or it is silently dropped):

1. `public/hooks/office-status-hook.js` — emit `activeFile` on Pre/PostToolUse (from
   `extractFilePath`, normalized + capped); carry forward for other agents in the merge.
2. `src/utils/normalizePost.js` — validate in the `office-status` `.map` (server ingest).
3. `src/inference/inferStatus.js` `sanitizeAgent` — validate for in-browser channels.
4. `src/inference/agentRouter.js` `routeExternalAgents` — carry through routing.
5. `src/systems/store.js` `applyExternalStatus` — store `activeFile` + stamp `activeFileAt`
   when the file changes (independent of `sigChanged` — does NOT touch the bubble path).

## Behavior

- New pure module `src/systems/pairHuddle.js`: `findSharedFilePair(externalStatus, now, window)`
  → `[id1, id2]` (two most-recent on the shared file) or `null`.
- `src/systems/officeLife.js`: standalone `PAIR_EVENT = { id: 'pair-programming', duration }`,
  `EVENT_HANDLERS['pair-programming']` (both walk to whiteboard-adjacent spots via
  `setMultipleAgentGroupEvents`; honest bubbles — lead shows `🤝 <basename>`, partner a
  localized "same file"), `firePairHuddle(state, pair)` (mutex + cooldown), wired into the
  existing `seedUnsub` subscription, gated on `externalStatus` reference change.
- `src/locales/{en,zh-TW}.json`: `eventBubbles.pair-programming`.

## Acceptance Criteria

- **AC-1** Two distinct agents on the byte-identical path → huddle fires; both gather.
- **AC-2** Two agents on different paths (incl. same basename, different dir) → NO huddle.
- **AC-3** Two events collapsing to the same role → one agent → NO huddle.
- **AC-4** A stale `activeFileAt` (> window) → NO huddle.
- **AC-5** The random daily/rare scheduler can NEVER fire `pair-programming`.
- **AC-6** `activeFile` survives ALL five data-path whitelists (hook → normalizePost →
  sanitizeAgent → routeExternalAgents → applyExternalStatus).
- **AC-7** Cooldown: a lingering pair does not re-trigger every poll.
- **AC-8** Protected Surfaces untouched (coords/movement); gather uses the existing
  deconfliction chokepoint; only 2 participants (never all-gather).
- **AC-9** Load-the-page: injecting two same-file agents renders the huddle with 0 console
  errors / no ErrorBoundary (green tests ≠ renders).

## Rollback

Pure additions + additive field on existing paths. Remove `pairHuddle.js` + the
`pair-programming` handler/trigger and revert the `activeFile` field additions.
