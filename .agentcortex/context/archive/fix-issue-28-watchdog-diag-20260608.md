# Work Log — fix/issue-28-watchdog-diag

- Branch: fix/issue-28-watchdog-diag
- Classification: quick-win
- Owner: KbWen
- Current Phase: ship (PR pending; main protected → human/auto merge)
- Checkpoint SHA: (pre-commit)
- Issues: #28

## Session Info

- Agent: claude
- Task: surface the existing `store.watchdogRestarts` RAF-stall counter (PR #25 made it observable
  but console-only) as a DEV-only, unobtrusive, zero-prod-cost diagnostic.

## Task Description

#28 — `watchdogRestarts` (RAF walk-loop stall counter, bumped by `recordWatchdogRestart` in
`AgentCharacter.jsx`) had no UI. Surface it in a DEV-only diagnostics spot gated by
`import.meta.env.DEV`, zero cost in production, unobtrusive.

## Changes

- `src/components/ControlPanel.jsx`:
  - pure exported `shouldShowWatchdogDiag(count, isDev=import.meta.env.DEV)` (gate: dev AND count>0).
  - subscribe `watchdogRestarts`; render a small amber chip in the FULL ControlPanel, gated by a
    LITERAL `import.meta.env.DEV && shouldShowWatchdogDiag(...)` so esbuild dead-code-eliminates the
    whole branch (JSX + strings + helper ref) from the prod bundle. Invisible until count>0.
- `tests/watchdogDiag.test.js` (4) — DEV+count>0 → show; DEV+0 → hide; prod (isDev false) → never;
  non-numeric/negative guarded.

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-08T04:20:00+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-08T04:22:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTING | Timestamp: 2026-06-08T04:30:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTING→TESTED | Timestamp: 2026-06-08T04:35:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-08T04:40:00+08:00

## Evidence

- Full suite **1311 passed / 57 files** (+4 watchdogDiag); vite build clean.
- **Prod zero-cost verified**: `grep` of dist bundle for `RAF watchdog restart` / `data-watchdog-diag`
  / `shouldShowWatchdogDiag` → NOT present (true dead-code elimination). Bundle 416.81 KB.
- **DEV live-verified** in the running app via store import: at rest (count 0) chip absent; after 2×
  `recordWatchdogRestart()` the chip renders `⚠ 2 RAF watchdog restarts (dev)` with `data-watchdog-diag="2"`.

## Drift Log

- Archived 2026-06-10 by chore/hardening-h4-zero-noise (validator WARN: shipped log still in
  active work/ — /ship step 3 had been skipped).

## Phase Summary

quick-win: surfaced the RAF-watchdog stall counter as a DEV-only, count>0-gated ControlPanel chip with
true prod dead-code elimination. +4 tests; suite 1311 green; DEV chip + prod-absence both verified.

⚡ ACX
