---
status: shipped
title: "#20 (H3) — Hook status-file write lock (read-modify-write race fix)"
created: 2026-06-10
last_updated: 2026-09-26
---

# #20 / H3 — Hook Status-File Write Lock

## Problem

`public/hooks/office-status-hook.js` does read→modify→write of `STATUS_FILE` at several event
handlers. Writes are individually atomic (tmp + rename), but the read-modify-write WINDOW is not:
two concurrent hook processes (real case: a SubagentStart hook racing the main session's
PostToolUse in the same cwd → same status file) both read, both modify, last rename wins → the
other update is silently lost. Backlog #20, deferred since the v0.x wave; reactivated as
hardening-wave H3.

## Design constraints (non-negotiable)

- The hook runs on EVERY tool use inside users' Claude Code sessions. It MUST NEVER hang or add
  perceptible latency: **bounded wait, then proceed unlocked** (availability over consistency —
  worst case equals today's behavior, vastly narrowed window).
- Standalone CJS, zero dependencies, Windows + POSIX.
- Lock primitive: `fs.mkdirSync(lockDir)` — atomic existence-check-and-create on all platforms.
  `STATUS_FILE + '.lock'` directory; retry ~10 × 25ms sleep (sync busy-wait via Atomics.wait or
  Date-loop — keep it simple and bounded ≤ ~300ms total); stale lock (mtime older than 2s) is
  stolen (rmdir + retake) so a crashed holder can't brick the office.

## Acceptance Criteria

- **AC-1** Exported `acquireStatusLock()` / `releaseStatusLock()` helpers in the hook; every
  STATUS_FILE read-modify-write section runs under the lock (acquire before the read, release
  after the rename, ALWAYS released via try/finally).
- **AC-2** Bounded: acquire returns `{ok:false}` after the retry budget and the handler proceeds
  unlocked exactly as today (no thrown errors, no user-visible stall). Total worst-case added
  latency ≤ ~300ms only under active contention.
- **AC-3** Stale-lock steal: a lock dir whose mtime is older than 2s is removed and retaken; a
  crashed hook process cannot wedge subsequent hooks.
- **AC-4 (load-bearing)** Multi-process mutual-exclusion proof: a vitest test spawns ≥6 concurrent
  Node child processes, each performing N lock-protected read-increment-write cycles on a shared
  temp JSON file via the EXPORTED helpers; final counter MUST equal exactly 6×N (lost-update-free).
  A control variant without the lock demonstrating loss is not required (non-deterministic), but
  the locked variant must be deterministic-exact.
- **AC-5** Hook unit tests still green; full suite green; smoke exit 0. No change to payload
  shape, field handling, or any non-I/O logic (drift guards must stay byte-green).

## Non-Goals

- Append-only journal redesign (rejected: hook simplicity + reader compatibility).
- Cross-file locking of per-session slug files against each other (different files, no race).

## Risks & Rollback

- **Risk**: sync busy-wait adds latency under contention — bounded ≤300ms and only when contended.
- **Risk (corrected 2026-09-26, `docs/specs/hook-robustness-privacy.md`)**: the original text here
  claimed "mkdir atomicity means exactly one wins the retake" for the *steal* path. That is false:
  the steal path is `rmdirSync(stale-lock)` followed by a separate `mkdirSync`, two independent
  syscalls. Two racing stealers can both pass the staleness check, both call `rmdirSync` (the
  second is a silent no-op on an already-removed dir), and both then succeed at `mkdirSync` at
  different points in time — including one stealer's `mkdirSync` landing, then the *other*
  stealer's later `rmdirSync` (from its own steal attempt against what it still believes is the
  stale dir) removing the first stealer's fresh lock out from under it. Both processes can end up
  believing they hold the lock. Fixed by making the steal atomic
  (`renameSync(lockDir, uniqueName)` — only one racing rename can win against the same source
  name) and by gating `releaseStatusLock` on an owner token so a process can never remove a lock
  it does not currently hold. mkdir atomicity is still true and load-bearing for the *fresh-lock*
  race (two processes racing to acquire an absent lock) — the false claim was specifically about
  applying that same guarantee to the two-step steal sequence.
- **Rollback**: revert the single hook file + test; no data-format change.
