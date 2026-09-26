---
title: Client Runtime Hygiene
status: frozen
classification: feature
primary_domain: office-runtime
date: 2026-09-26
primary_files: [src/inference/inferStatus.js, src/systems/store.js, src/inference/desktopNotifier.js]
test_file: [tests/applyMessage.test.js, tests/inferStatusPolling.test.js, tests/storePersistence.test.js, tests/storeReconcile.test.js, tests/desktopNotifier.test.js, tests/statusIntegrationSSE.test.js]
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
  `STALENESS_TIMEOUT` while the underlying session is still genuinely alive. A confirmed-
  unchanged (304) poll response refreshes that 120s timer, so it no longer fires EARLY. This
  does not make the honesty guarantee unbounded: each `externalStatus` entry independently
  carries its own `expiresAt` (`store.js` `buildExtEntry`, now+300000), re-checked every 5s by
  the client's own `expiryInterval` — that field is untouched by a 304 (only a delivered,
  applied message renews it). So a hook that goes fully silent still goes idle within
  ~300–305s, exactly as it did before this fix — the fix only removes the premature 120s
  cutoff that used to fire well before that pre-existing 5-min backstop.
  *(Corrected 2026-09-26 per fresh review: the original wording attributed the bound to the
  server's `scanSessions.mjs` `STALE_MS` re-deriving a changed `scanAndMerge` output — that
  server-side mechanism exists but is not what actually governs the client-visible bound; the
  client's own pre-existing `expiresAt` is.)*
- AC2: After the SSE channel gives up (5 consecutive errors), it retries the connection on a
  slow (60s) interval instead of staying on HTTP polling for the rest of the page's life. A
  successful reconnect switches back to the 10s heartbeat cadence — but ONLY on a confirmed
  network-level SSE `open` event, never merely on `startSSEListening` returning a cleanup
  function (which happens synchronously for every attempt, including ones about to fail). Until
  then, fast (~1s) polling keeps running unmodified through every retry attempt, so
  `integrationHealth` doesn't flap offline on the retry's own transient errors while GET polling
  is healthy. Retries do not storm the server (each failed retry still pays its own
  ~2s→4s→8s→16s backoff before giving up again).
  *(Corrected 2026-09-26 per fresh review: the first implementation switched to the heartbeat
  cadence at retry-attempt-START, not at confirmed success — see Review Remediation below.)*
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

## Review Remediation (2026-09-26, second pass)

A fresh adversarial `/review` returned NOT READY on the first implementation. Findings and
fixes:

- **R1 (blocking)**: `connectSSE` switched to the 10s heartbeat poller the instant
  `startSSEListening` returned a cleanup function — i.e. at retry-attempt-START, not at
  connection success — killing the fast poller and flapping `integrationHealth` offline on
  every retry's own transient errors even though GET polling was healthy throughout. Fixed:
  added an `onOpen` callback to `startSSEListening`, fired on the genuine network-level 'open'
  event; only `handleSSEOpen` (wired to it) may switch cadence down. `connectSSE` now always
  ensures the fast poller by default.
- **R2 (blocking)**: the original "no-test rationale" for AC2 was wrong — a fake-`EventSource` +
  stubbed `fetch`/`window` + fake-timers harness (proven working by the reviewer) is entirely
  feasible in this repo's default node test environment. Adapted into
  `tests/statusIntegrationSSE.test.js` (retry timing, single-live-connection, StrictMode
  double-mount safety, R1's fast-poll continuity, and AC1's staleness-refresh wiring).
- **R3**: AC1's wiring (not just the `shouldRefreshStalenessOnProbe` predicate) was untested —
  added to the same test file; verified red under a mutation removing both
  `resetStalenessTimer()` call sites.
- **R4**: AC4's wiring was untested. Extracted a pure `resolvePersisted(raw, now)` from
  `loadPersistedState`; tested directly, including a mutation-killing case for a stale branch
  that collapses to `return null`.
- **R5**: corrected the AC1 mechanism (see above) and the stale `store.js` comment near
  `buildExtEntry` that claimed the 120s sweep "clears first, so 5 min is a rarely-reached
  backstop" — since the fix, the reverse is generally true.
- **R6 (low)**: the finding-3 dedup meant `_savedAt` stopped advancing while content was
  unchanged, so the 4h cutoff silently started measuring "since last content change" instead of
  "since the tab was last open." Fixed cheaply: `shouldWritePersistedSnapshot` still writes
  (refreshing only `_savedAt`) at least once per 30 minutes even when content is unchanged.

All fixes re-verified: full `npx vitest run` green, new/adapted tests confirmed red-then-green
against their respective mutations (see Work Log `## Evidence`).

## Rollback

`git revert <commit-sha>` — each fix touches only its own function(s); no schema/migration,
no new persisted-data shape, no new external API. Reverting restores the exact prior behavior.

## References

- Work Log: `.agentcortex/context/work/fix-client-runtime-hygiene.md` (Known Risk section has
  full root-cause detail per finding).
- Related specs updated in the same change: `docs/specs/desktop-notifications.md`,
  `docs/specs/perf-metrics-chip.md`, `docs/specs/codex-status-parity-and-done-count.md`.
