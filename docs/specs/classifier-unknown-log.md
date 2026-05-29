---
title: unknownLog — self-improving classifier
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [5175a53]
primary_files: [src/systems/unknownLog.js, src/systems/classify.js]
test_file: tests/unknownLog.test.js
---

# unknownLog — self-improving classifier (#A3)

## Problem

The classifier (#A1) has a Tier 5 fallback for any task/status/mood/role/
workflow it doesn't recognize, but the raw inputs that landed there
were thrown away. With no visibility into what real-world traffic was
missing, the Tier 0 built-in registry could only grow by guesswork.
LangSmith solves the analogous problem by auto-clustering "unknown
topic" buckets — we needed the same loop for our classifier.

## Solution

A dev-mode in-memory aggregator records every Tier 5 fallback per
kind. Five buckets (`task` / `status` / `mood` / `role` / `workflow`),
cap **200 per kind** with oldest-evict via Map insertion order.

- `recordUnknown(kind, raw)` — no-op outside dev mode.
- `getUnknownReport()` — top-20 per kind, count desc.
- `clearUnknownLog()` — resets all buckets.
- `window.__office_unknownLog` — raw Maps for DevTools.
- `window.__office_logUnknowns()` — sorted console reporter.

`classify.js` calls `recordUnknown` from each Tier 5 path; **Tier 0/3/4
hits never record** so only genuine vocabulary gaps surface, not
known-but-unhandled cases. Production safety: `import.meta.env.PROD`
flips `isDevMode()` false → `recordUnknown` is a no-op (bundle still
ships the module, ≈+1 KB raw / +0.45 KB gzip, but no runtime work).

## Files

- `src/systems/unknownLog.js` — aggregator + DevTools globals.
- `src/systems/classify.js` — Tier 5 call sites in all 5 classifiers.
- `tests/unknownLog.test.js` — 24 tests covering cap behavior,
  per-kind isolation, prod no-op, override flag.

## Key decisions

- **Dev-mode gate via `import.meta.env.PROD`** — zero-cost in
  production by construction; the audit is on by default for anyone
  running the dev server, which is where the signal is.
- **200/kind oldest-evict** — bounded memory; insertion-order Map
  gives natural FIFO without extra bookkeeping.
- **Only Tier 5 records** — correctness invariant. Recording Tier 0/3/4
  would drown signal in known-good traffic and bias the "what to add
  next" decision.
- **Override hook `globalThis.__OFFICE_FORCE_UNKNOWN_LOG__`** — used
  by vitest `beforeEach` to force-enable deterministic recording in
  tests without depending on env detection.

## Acceptance criteria (Done)

- [x] All 5 classifier kinds record on Tier 5 fallback
- [x] No recording on Tier 0/3/4 hits
- [x] `getUnknownReport` returns top-20 sorted desc per kind
- [x] Production env → `recordUnknown` is no-op
- [x] DevTools globals exposed on `window`
- [x] 875 tests passing (+24)

## Rollback

`git revert 5175a53` — removes the module + the Tier 5 call sites in
`classify.js`. No persistent state to clean up (in-memory only). Blast
radius is the dev-mode feedback signal; classifier output unchanged.

## References

- Commit: `5175a53 feat(#A3): unknownLog — self-improving classifier
  (LangSmith pattern)`
- CHANGELOG v1.1.0 → "#A3 unknownLog (self-improving classifier)"
- Backlog row: `_shipped-log.md` (rotated 2026-05-29)
- Related: [[classifier-foundation]], [[classifier-wiring]]
