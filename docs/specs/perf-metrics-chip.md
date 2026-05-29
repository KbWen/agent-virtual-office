---
title: Perf metrics chip
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [fca854a, 0f4ef51]
primary_files: [src/systems/store.js, src/components/ControlPanel.jsx]
test_file: tests/storeBlockedLedger.test.js
---

# Perf metrics chip (#6)

## Problem

The bottom status bar showed per-agent state and platform badge but no
aggregate "how is today going?" signal. `dailyDoneLedger` already counted
completions for character growth (#1), but `blocked` events were
visualized only per-agent and vanished as soon as the agent recovered —
there was no day-level tally to glance at.

## Solution

Add `dailyBlockedLedger` as a per-day transition counter parallel to
`dailyDoneLedger`: increment only when `previousStatus !== 'blocked' &&
nextStatus === 'blocked'` so a polling/SSE flap on a single stuck tool
call doesn't double-count. Both ledgers share the same `dayChanged`
gate inside `applyExternalStatus` so midnight rollover resets them
atomically even when the first cross-midnight update touches only one
counter. ControlPanel subscribes to both ledger objects via `useShallow`
(clone-on-write identity), sums in `useMemo`, and renders a compact
monospace `✓N / ✗M` chip in both Full and Panel modes with tooltip,
sr-only mirror, and i18n in en + zh-TW. No `eventKey` dedup — `blocked`
has no PostToolUse-style anchor to key on.

## Files

- `src/systems/store.js` — `createDailyBlockedLedger`,
  `ensureCurrentDailyBlockedLedger`, `validatePersistedDailyBlockedLedger`,
  transition-counting branch in `applyExternalStatus`, atomic dayChanged gate.
- `src/components/ControlPanel.jsx` — `useShallow` ledger subscription,
  `useMemo` reduction, two chip render sites (Full + Panel modes).
- `src/locales/en.json`, `src/locales/zh-TW.json` — `ui.todayMetricsTooltip`
  + `ui.todayMetricsA11y` keys.
- `tests/storeBlockedLedger.test.js` — 12 cases for transition counting,
  flap dedup, day rollover, clone-on-write identity, sanitization.

## Key decisions

- **Transition counter, not event counter**: `blocked` has no
  PostToolUse-anchored `eventKey`; the simpler "only count the first
  blocked tick in a contiguous run" rule avoids over-counting polling
  duplicates without inventing a fragile dedup key.
- **Shared dayChanged gate**: both ledgers must reset on the same tick.
  The 0f4ef51 follow-up hardens this so a stale dayKey in either ledger
  alone still triggers a full atomic rollover.
- **`useShallow` + `useMemo`**: ledger objects are clone-on-write — identity
  changes only on actual increment or rollover. The reduction therefore
  doesn't re-run on minute ticks or agent movement.

## Acceptance criteria (Done)

- [x] `dailyBlockedLedger` increments only on working→blocked transition
- [x] Day rollover resets both ledgers atomically
- [x] Chip visible in Full and Panel modes with i18n + sr-only + tooltip
- [x] 12 unit tests, 552/552 vitest at ship

## Rollback

`git revert 0f4ef51 fca854a` — removes the ledger field, chip, and i18n
keys. No data migration needed (persisted blocked ledger sanitizes to
null on load and re-seeds). Blast radius: ControlPanel chrome + store
state shape; no downstream consumers.

## References

- Commits: `fca854a feat(#6)`, `0f4ef51 fix(#6)` atomic rollover
- CHANGELOG v1.1.0 → "#6 底部效能指標"
- Backlog row: `_shipped-log.md` #6
- Related: [[character-growth-system]] (parallel `dailyDoneLedger`)
