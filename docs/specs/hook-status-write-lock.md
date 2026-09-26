---
status: shipped
title: "#20 (H3) — Hook status-file write lock (read-modify-write race fix)"
created: 2026-06-10
last_updated: 2026-09-26T09:56Z
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
  Date-loop — keep it simple and bounded; see corrected worst-case figures below, updated
  2026-09-26 review); stale lock (mtime older than 2s) is stolen via an identity-verified
  renameSync (not a bare rmdir + retake — see the Risks correction below) so a crashed holder
  can't brick the office.

## Acceptance Criteria

- **AC-1** Exported `acquireStatusLock()` / `releaseStatusLock()` helpers in the hook; every
  STATUS_FILE read-modify-write section runs under the lock (acquire before the read, release
  after the rename, ALWAYS released via try/finally).
- **AC-2** Bounded: acquire returns `{ok:false}` after the retry budget and the handler proceeds
  unlocked exactly as today (no thrown errors, no user-visible stall). Total worst-case added
  latency (corrected 2026-09-26, see Risks) — **nominal** (from the constants alone) vs
  **measured** (2026-09-26 review, this Windows box, forced-failure probe — real syscall/OS
  scheduling overhead the constants don't capture):

  | Component | Nominal (10 × 25ms / 3 × 15ms) | Measured (this box) |
  | --- | --- | --- |
  | Lock acquire alone (contended, budget exhausted) | ≤ ~250ms | **~320ms** (310–345ms observed) |
  | `atomicWriteJson` alone (rename always fails, falls back) | ≤ ~45ms | **~93ms** |
  | Combined, single write attempt (most events) | ≤ ~295ms | **~413ms** |
  | Combined, `UserPromptSubmit`/`PreToolUse` (3 write attempts) | ≤ ~385ms | **~599ms** (320 + 3×93) |

  The nominal figures are what the constants (`maxRetries×waitMs`, `atomicWriteJson`'s
  `retries×waitMs`) sum to; the measured figures include real `fs.mkdirSync`/`renameSync`
  syscall latency and OS scheduling jitter that a pure sleep-budget sum does not model. Both are
  still well under a second and only apply under active contention (the common case is 0ms
  added latency — the very first `mkdirSync` succeeds). The previous "≤ ~300ms" figure here was
  the nominal lock-only number, presented as the combined total, and predates the write-retry
  budget added alongside the lock.
- **AC-3** Stale-lock steal: a lock dir whose mtime is older than 2s is removed and retaken via an
  identity-verified renameSync steal (owner token + mtime compared before/after the rename — see
  Risks correction below); a crashed hook process cannot wedge subsequent hooks.
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

- **Risk**: sync busy-wait adds latency under contention — see the corrected worst-case figures in
  AC-2 above (previously stated as a flat "≤300ms", which did not account for the write-retry
  budget added alongside the lock).
- **Risk (corrected 2026-09-26, `docs/specs/hook-robustness-privacy.md`)**: the original text here
  claimed "mkdir atomicity means exactly one wins the retake" for the *steal* path. That is false:
  the steal path is `rmdirSync(stale-lock)` followed by a separate `mkdirSync`, two independent
  syscalls. Two racing stealers can both pass the staleness check, both call `rmdirSync` (the
  second is a silent no-op on an already-removed dir), and both then succeed at `mkdirSync` at
  different points in time — including one stealer's `mkdirSync` landing, then the *other*
  stealer's later `rmdirSync` (from its own steal attempt against what it still believes is the
  stale dir) removing the first stealer's fresh lock out from under it. Both processes can end up
  believing they hold the lock.
- **Risk (corrected AGAIN 2026-09-26, same-day fresh-reviewer /review — the first correction above
  was itself incomplete)**: replacing the steal with `renameSync(lockDir, uniqueName)` closes the
  *"two stealers race the identical rmdir+mkdir sequence"* class, but a fresh adversarial review
  proved a DIFFERENT interleaving still let two processes both win: renaming a source path is
  exclusive against other renames of that *exact* path, but it does nothing to stop a stealer from
  renaming away a lock that a completely different process had *already legitimately replaced*
  with a brand-new, non-stale lock in the window between "we observed staleness" and "we renamed
  it away" — the claim "two racers can never BOTH win" was, again, false, and was disproven with a
  deterministic `fs.statSync` interception (forcing one process to complete an entire steal cycle
  synchronously inside the other's staleness check). **Actual fix**: capture the stale lock's
  identity (its owner token + the same mtime value used to judge it stale) immediately before
  renaming it away, then re-read that identity from the *moved* directory afterward. Renaming
  does not change a directory's mtime or contents, so if the moved directory's identity doesn't
  match what was observed, the rename evicted a *different, currently-valid* lock — best-effort
  put it back (only succeeds if the lock path is currently free) and go back to waiting; ownership
  is never claimed on a mismatch. `releaseStatusLock`'s owner-token gate (added by the first
  correction) is still correct and necessary but was never sufficient on its own to prevent
  concurrent ownership in the first place — it only limits the blast radius (a stale release
  no-ops instead of evicting a live lock) once double-ownership has already occurred.
  **Honest residual — this narrows the window, it does not close it to zero**: a filesystem
  offers no atomic compare-and-swap across a stat + a rename. The owner-token read and the mtime
  read happen as two back-to-back synchronous calls immediately before the rename, not atomically
  with it; a process could still be descheduled in that exact gap. Worst case if that ever landed
  is the ORIGINAL pre-lock hazard this file exists to narrow (one lost STATUS_FILE update), not a
  new or larger failure mode. `releaseStatusLock` has a symmetric, narrower residual: it is
  read-token-then-`rmSync`, not atomic with the read, and treats a `null` owner token (the brief
  window between a fresh `mkdirSync` and its own token write) as "safe to remove". Both residuals
  are documented in the hook source (`acquireStatusLock`/`releaseStatusLock` doc comments) rather
  than closed with a rename-verify release, which the severity of this specific window (LOW, per
  2026-09-26 review) does not currently justify.
- **Rollback**: revert the single hook file + test; no data-format change.
