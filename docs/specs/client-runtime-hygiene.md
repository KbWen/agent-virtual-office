---
title: Client Runtime Hygiene
status: frozen
classification: feature
primary_domain: office-runtime
date: 2026-09-26
primary_files: [src/inference/inferStatus.js, src/systems/store.js, src/inference/desktopNotifier.js]
test_file: [tests/applyMessage.test.js, tests/inferStatusPolling.test.js, tests/storePersistence.test.js, tests/storeReconcile.test.js, tests/desktopNotifier.test.js]
---

# Client Runtime Hygiene

## Problem

A 2026-09-26 audit of the client status-integration runtime surfaced 6 candidate hygiene
issues in `src/inference/inferStatus.js`, `src/systems/store.js`, and
`src/inference/desktopNotifier.js`. Each was re-derived directly against current source (not
taken on the audit's word) before being fixed. All 6 were confirmed real; none were dropped.

## Acceptance Criteria

- AC1: A long-running single tool call with no intermediate hook file writes (e.g. a
  multi-minute test run) is no longer shown as `idle` after the client's 120s
  `STALENESS_TIMEOUT` while the underlying session is still genuinely alive server-side. A
  confirmed-unchanged (304) poll response refreshes the staleness timer; a genuinely dead hook
  still clears once the server's own 300s session-liveness window (`scanSessions.mjs` `STALE_MS`)
  elapses and `scanAndMerge`'s output actually changes.
- AC2: After the SSE channel gives up (5 consecutive errors), it retries the connection on a
  slow (60s) interval instead of staying on HTTP polling for the rest of the page's life. A
  successful reconnect switches back to the 10s heartbeat cadence. Retries do not storm the
  server (each failed retry still pays its own ~2s→4s→8s→16s backoff before giving up again).
- AC3: `savePersistedState`'s change-detection dedup key excludes the `_savedAt` timestamp, so
  `localStorage.setItem` only runs when `agents`/ledger content actually changed, not on every
  autosave tick.
- AC4: Closing the tab for more than 4 hours on the SAME calendar day preserves
  `dailyDoneLedger`/`dailyBlockedLedger` (their existing dayKey-based validators still reset a
  ledger whose dayKey is a genuinely different day). Only the per-agent position/behavior
  restore is discarded past the 4h cutoff.
- AC5: `desktopNotifier`'s `blockedSince`/`notifiedFor`/`recurringNotifiedFor` dedupe maps are
  pruned for evicted agent ids on every polling tick, not only when the notifier is stopped — a
  dynamic `slug~role` id reused by a fresh worktree session mid-run starts a fresh episode
  instead of inheriting a stale `blockedSince` timestamp (which previously could fire an
  instant false "blocked 30+s" notification).
- AC6: `clearExternalStatus`'s two eviction sites (single-id expiry, clear-all staleness sweep)
  prune `_storeRecentPicks` and `recurringFailureLog` for the deleted dynamic agent id, matching
  the cleanup already done by `applyExternalStatus`'s multi-session eviction path and
  `abortAgentMovement`'s `removeAfterDoorAbort` branch.

## Non-goals

- Do not redesign the status-integration channel architecture (SSE/polling/postMessage/hash) —
  only fix the identified hygiene defects within it.
- Do not unify the 3 separate dynamic-agent-eviction call sites (`applyExternalStatus`,
  `abortAgentMovement`, `clearExternalStatus`) into a single shared code path beyond the small
  `pruneEvictedId` helper added for AC6 — that is a larger refactor than this fix requires.
- Do not change `idleGapInfer.js` or the intentional 45s idle-gap-inference threshold.
- Do not change the server (`server.mjs`, `scanSessions.mjs`) — both were read to confirm the
  client-side fixes' safety, but neither was modified.

## Constraints

- No change to the `office-status` message contract or any external API.
- Small, reversible changes — each of the 6 fixes is independently revertible.
- Preserve the "a dead hook eventually clears" honesty guarantee (AC1's server-side liveness
  argument; AC4's dayKey re-validation on salvaged ledgers).

## Findings & Disposition

| # | Finding | Disposition | Fix location |
|---|---|---|---|
| 1 | Long tool call shows idle after 120s | Fixed | `inferStatus.js` `handleProbe`/`heartbeatProbe` + `shouldRefreshStalenessOnProbe` |
| 2 | SSE never reconnects after giving up | Fixed | `inferStatus.js` `handleSSEGiveUp`/`connectSSE` retry loop |
| 3 | Persist dedupe never matches | Fixed | `store.js` `persistedSnapshotKey` |
| 4 | "Done today" resets after >4h tab-closed same day | Fixed | `store.js` `salvageStalePersistedState` |
| 5 | Stale notifier maps for evicted agents | Fixed | `desktopNotifier.js` `pruneEvictedAgents` (per-tick) |
| 6 | `clearExternalStatus` skips eviction cleanup | Fixed | `store.js` `clearExternalStatus` `pruneEvictedId` |

All 6 findings were re-derived from source before fixing; none were dropped or found incorrect.

## Rollback

`git revert <commit-sha>` — each fix touches only its own function(s); no schema/migration,
no new persisted-data shape, no new external API. Reverting restores the exact prior behavior.

## References

- Work Log: `.agentcortex/context/work/fix-client-runtime-hygiene.md` (Known Risk section has
  full root-cause detail per finding).
- Related specs updated in the same change: `docs/specs/desktop-notifications.md`,
  `docs/specs/perf-metrics-chip.md`, `docs/specs/codex-status-parity-and-done-count.md`.
