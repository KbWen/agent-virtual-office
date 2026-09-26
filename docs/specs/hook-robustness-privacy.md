---
status: frozen
title: "Hook/bridge robustness + privacy remediation (2026-09-26 audit)"
primary_domain: hook-io
created: 2026-09-26
last_updated: 2026-09-26
signal_tier: none
---

# Hook/Bridge Robustness + Privacy Remediation

## Problem

A 2026-09-26 audit of `public/hooks/office-status-hook.js`, `public/bridge.js`,
`public/hooks/generic-llm-bridge.js`, and `bin/cli.js` found six classes of defect: a real
double-ownership race in the STATUS_FILE write-lock's stale-steal path, a non-atomic write
fallback that can hand readers a truncated/reset file, three privacy leaks that violate the
project's established "no raw text in a bubble" posture (AVO-126 / `ux-vibe-rebalance.md`), a
client-forgeable bridge message field, two bugs in the generic (non-Claude) bridge, and three
edge-case bugs in the CLI installer/uninstaller. This spec records root causes, the fix for each,
and what was deliberately left out.

## Root Causes

- **Root Cause (lock double-steal)**: `acquireStatusLock()`'s steal path is `stat` → `rmdirSync`
  → loop-continue → `mkdirSync`, i.e. two independent, non-atomic syscalls. Two processes can
  both pass the staleness check on the same stale lock, both `rmdirSync` it (only the first
  removal matters, the second is a silent no-op on an already-gone dir), and both then win a
  `mkdirSync` — the second `mkdirSync` succeeds because the first stealer's `rmdirSync` (called
  again later by whichever process finishes its own critical section first) can remove the
  *other* stealer's fresh lock dir mid-flight. Two processes then believe they hold the lock
  simultaneously.
- **Root Cause (non-atomic fallback)**: `fs.renameSync(tmp, target)` can fail with `EBUSY`/`EPERM`
  on Windows when AV/indexing holds the target handle. The existing fallback
  (`fs.writeFileSync(target, json)` with no retry) is a *direct, truncating* write — a reader
  racing that exact window can `JSON.parse` a partial file, hit the `catch {}` around the parse,
  and treat the result as `existing = []`, silently resetting `workflow`/`helpers`/`promptIds`/
  `agents`.
- **Root Cause (privacy)**: `extractContext()` for `WebSearch` returns `input.query` verbatim
  (bounded only by the generic 200-char field cap applied at every write site) and for `Agent`
  falls back to `input.prompt.slice(0, 40)` when no `description` is present. Both bypass the
  "office-vibe noun, never raw text" posture the project already established for `Bash`/`PowerShell`
  (AVO-126, `docs/specs/ux-vibe-rebalance.md` line 24: *"No speech-bubble label ever contains a raw
  shell command or filesystem path"*) and for `WebFetch` (hostname-only). Separately, the opt-in
  raw-event capture file (`~/.claude/office-hook-capture.jsonl`) has no size cap — a long capture
  session accumulates full tool inputs/outputs (file contents, commands, stdout) unbounded.
- **Root Cause (bridge spoofing)**: `public/bridge.js` is loaded into arbitrary pages (including
  via `bridge.html?...` URL params, fed straight into `send()`/`parseShorthand()`). Both functions
  forward a caller-supplied `source` and `_seq` unchanged. `src/inference/inferStatus.js` treats
  `HOOK_ORIGIN` sources (`claude-cli`, `codex-cli`, `multi-session`, `file-watcher`) as sharing one
  monotonic clock and uses their `_seq` as a high-water mark for stale-drop. A page (or a crafted
  URL) claiming `source=claude-cli&_seq=<now+N>` raises that high-water mark and causes real,
  later hook updates (smaller `_seq`) to be dropped as "stale".
- **Root Cause (generic bridge)**: `getGitChangedFiles(process.cwd())` is called from
  `onFileChange()`, which itself has no access to the `--watch` directory — it always inspects the
  bridge process's OWN cwd, not the watched project, so the git-diff refresh silently no-ops
  whenever the bridge is launched from a different cwd than `--watch` (the documented
  multi-worktree use case, `docs/INTEGRATIONS.md` "Multi-Worktree Support"). `IGNORE_RE` is an
  unanchored substring match: `\.git` also matches `.github/…`, which permanently kills the
  `.github`→`ops` rule in `fileToRole()` (dead code — the watcher filters those paths out before
  `fileToRole` ever sees them), and `dist` matches any filename containing "dist" as a substring
  (e.g. `distance.js`). `parseArgs()` only recognizes `--port 5174` (two argv tokens); the shipped
  docs (`docs/INTEGRATIONS.md` lines 201/215) use `--port=5174` (one token), which is silently
  ignored, falling back to the default port.
- **Root Cause (CLI edge cases)**: `setup`'s atomic-write (`tmp` + `renameSync`) targets
  `settingsPath` directly; on POSIX, renaming onto a path that is itself a symlink replaces the
  symlink with a regular file, silently breaking any dotfile-symlink setup (chezmoi, GNU stow,
  etc.) pointing `~/.claude/settings.json` elsewhere. `uninstall`'s hook-matching predicate reads
  `hh.command` without checking `hh` is non-null first (`some(hh => hh && hh.command && …)` is
  used in `setup` but `some(hh => hh.command && …)` in `uninstall`) — a malformed/foreign settings
  entry throws and aborts the whole uninstall. `uninstall`'s status/skill/lang file cleanup loop
  calls `fs.unlinkSync` outside any try/catch — one locked/already-removed file aborts cleanup of
  every subsequent file in the same `readdirSync` list. `uninstall`'s `settings.json` rewrite is a
  single direct `fs.writeFileSync` (no tmp+rename), unlike `setup`'s atomic write.

## Fixes (priority order — see "What was dropped" for anything below the cut line)

1. **Lock double-steal** (`office-status-hook.js` `acquireStatusLock`/`releaseStatusLock`) — TWO
   rounds, both from a same-day 2026-09-26 fresh-reviewer `/review`:
   - **Round 1** (this fix's original shape): steal via `fs.renameSync(lockDir, lockDir +
     '.stale.<pid>.<ts>')` instead of `rmdirSync` + `mkdirSync`, on the premise that "rename onto
     a not-yet-existing path is exclusive, so two racing stealers can never both win." **That
     premise was disproven by the review**: exclusivity of the rename call only prevents two
     stealers from both renaming the *same* source successfully — it does nothing to stop a
     stealer from renaming away a lock that a *different* process had already legitimately
     replaced with a fresh, non-stale lock in the window between "we observed staleness" and "we
     renamed it away." A deterministic `fs.statSync` interception (forcing one process's entire
     steal-and-recreate cycle to complete synchronously inside another's staleness check) proved
     two processes could both end up holding the lock.
   - **Round 2** (the actual fix): before renaming, capture the stale lock's identity — its owner
     token (`_readOwnerToken`) and the same mtime value already used to judge it stale. After the
     rename, re-read that identity from the *moved* directory and compare. A rename does not
     change a directory's mtime or contents, so if the moved directory's identity still matches
     what was observed, nothing replaced it in between and it is safe to claim; the winning
     stealer then `mkdirSync`s a fresh lock and writes a random owner token file inside it. If the
     identity does NOT match, the rename evicted a lock someone else legitimately holds:
     best-effort rename it back (only succeeds if the lock path is currently free) and fall back
     into the retry loop — ownership is never claimed on a mismatch. Also treats `EPERM`/`EBUSY`/
     `EACCES` on the steal rename (observed on Windows when another process holds the lock's
     `owner` file open) as contended-not-gone: sleep and retry within the existing bound instead
     of proceeding unlocked immediately.
   - **Honest residual (documented, not eliminated — a filesystem has no compare-and-swap)**: the
     identity-capture reads happen as two back-to-back synchronous calls immediately before the
     rename, not atomically with it; a process could still be descheduled in that exact narrower
     gap. Worst case is the original pre-lock hazard this file exists to narrow (one lost
     STATUS_FILE update), not a new failure class. `releaseStatusLock` has a narrower, symmetric
     residual (read-token-then-`rmSync`, and a `null` token — the brief window between `mkdirSync`
     and its own token write — is treated as safe to remove); this is documented rather than
     closed with a rename-verify release, per review LOW #4 ("document or use rename-verify
     release"). Full text: `docs/specs/hook-status-write-lock.md` Risks (both corrections) and the
     `acquireStatusLock`/`releaseStatusLock` doc comments in the hook source.
   - **Removed claim**: "two racers can never BOTH win" no longer appears anywhere in the spec or
     source comments — it was false both times it was written (once for the original rmdir+mkdir
     steal, once for the round-1 rename-based steal), and the actual guarantee (mkdir atomicity
     for a *fresh*, non-stale lock race) is stated narrowly where it is still true.
   - All three call sites (`StopFailure`, `Stop`, main write path) retain and pass their
     `acquireStatusLock()` result's `.token` to `releaseStatusLock()`.
   - **Worst-case wait updated**: acquire alone ≤ ~250ms; combined with the write-retry budget
     added by fix 2, most events are ≤ ~295ms and `UserPromptSubmit`/`PreToolUse` (which retry the
     write up to 3 times) are ≤ ~385ms — see `hook-status-write-lock.md` AC-2 for the breakdown.
     The previous flat "≤300ms" figure did not account for the write-retry budget.
2. **Non-atomic fallback** (`office-status-hook.js`, 4 call sites: `StopFailure`, `Stop`'s two
   internal writes, and the main write path): extracted into one shared `atomicWriteJson(target,
   json)` helper that retries the tmp-write + rename up to 3 times with a short bounded
   `Atomics.wait` sleep between attempts (worst case ≈ 45ms extra, well inside the hook's existing
   latency budget) before falling back to a direct write. This does not eliminate the fallback (an
   unbounded retry would violate the hook's "never hang" constraint) — it makes the truncating
   path the exception rather than the first response to any transient rename contention.
3. **Privacy**:
   - `extractContext()` `WebSearch` case now returns `null` instead of the raw query. With no
     context, `toolLabel()` falls through to the existing generic-noun fallback
     (`'🌐 Searching'` / `'🌐 搜尋中'` etc.) — the same mechanism `WebFetch`/`Bash` already use, no
     new label strings needed.
   - `extractContext()` `Agent` case drops the `input.prompt.slice(0, 40)` fallback; only
     `input.description` is used (`null` when absent, same generic-fallback path as above).
   - Capture file (`~/.claude/office-hook-capture.jsonl`) rotates to a single `.1` generation once
     it exceeds 10 MB (checked before each append) — bounds total on-disk size to ~2× the cap
     without adding a dependency or a background timer.
   - `activeFile`/`_cwd` exposure over `GET /api/status`: **assessed, not changed** (see
     Decisions). `server.mjs` is outside this branch's target files (owned by the sibling
     `rem-codex-hook-isolation` work / not listed as an in-scope module for this task), and both
     fields are load-bearing for shipped features (AVO-106 pair-programming overlay, project
     scoping) — removing them needs an explicit owner decision, not a drive-by branch.
4. **Bridge spoofing** (`public/bridge.js`): a local `HOOK_ORIGIN` set (kept in sync with
   `src/inference/inferStatus.js`'s set of the same name via a comment — `bridge.js` is a
   standalone script with no bundler, so it cannot `import` the canonical set) gates `source`:
   any caller-supplied `source` that names a hook-origin value is replaced with the page's own
   `DEFAULT_SOURCE`. `_seq` is now always freshly stamped (`String(Date.now())`) in both `send()`
   and `parseShorthand()` — a caller-supplied `_seq` (including one arriving via URL params) is
   never forwarded.
5. **Generic bridge** (`public/hooks/generic-llm-bridge.js`):
   - `onFileChange()` now takes `watchDir` as a parameter (threaded through from the two
     `startWatcher()` call sites, which already close over it); `getGitChangedFiles(watchDir)`
     replaces `getGitChangedFiles(process.cwd())`.
   - `IGNORE_RE` split into a path-segment-anchored directory check
     (`/(^|[\\/])(node_modules|\.git|dist|\.next|\.nuxt|\.turbo)([\\/]|$)/` — matches `.git/` and
     `dist/` as whole path segments, not substrings) plus a basename-only check for
     `office-status` (intentionally still a substring match — it is meant to catch the bridge's
     own hook/status files by name, e.g. `office-status-hook.js`, not a directory).
   - **Amended 2026-09-26 (review LOW #6)**: the anchored regex above was still being tested
     against the ABSOLUTE path, so a `--watch` dir living under any ancestor directory literally
     named `node_modules`/`.git`/`dist`/etc. (e.g. a project checked out at
     `/builds/dist/my-project`) matched every single event and silently ignored the entire watch.
     `shouldIgnorePath(fullPath, watchDir)` now tests the path RELATIVE to `watchDir` — only
     segments INSIDE the watched project can trigger the ignore rule; an ancestor segment outside
     it no longer can.
   - `parseArgs()` now accepts both `--port 5174` and `--port=5174` (and the same two forms for
     `--watch`/`--source`), matching the `--port=` form already documented in
     `docs/INTEGRATIONS.md`.
   - **Accepted residuals (review LOW #7, documented not fixed)**: two concurrent capture-file
     rotators can overwrite the 10MB `.1` generation with a smaller one (debug-only opt-in
     feature, narrow); `uninstall` does not currently remove `office-hook-capture.jsonl`/`.1`
     (pre-existing class of "cleanup glob doesn't cover every debug artifact", same shape as
     other files that already aren't matched by the uninstall glob).
6. **CLI edge cases** (`bin/cli.js`):
   - `setup` resolves `settingsPath` through `fs.realpathSync` when it is a symlink
     (`fs.lstatSync(...).isSymbolicLink()`) before the atomic tmp-write, so the write lands on the
     symlink's target rather than replacing the symlink itself.
   - `uninstall`'s hook-matching predicate gets the same `hh && hh.command && …` null guard `setup`
     already uses.
   - `uninstall`'s per-file cleanup loop (hook files + status/skill/lang glob) wraps each
     `fs.unlinkSync` in its own try/catch with a per-file warning, so one locked/missing file no
     longer aborts cleanup of the rest.
   - `uninstall`'s `settings.json` rewrite is now atomic (tmp + rename, same symlink-aware target
     resolution as `setup`) instead of a bare `fs.writeFileSync`.

## What was dropped

Nothing from the six findings was dropped outright — all six have a code fix or a recorded
decision. Two things were deliberately narrowed rather than fixed in full:

- The `activeFile`/`_cwd` GET-exposure question (finding 3's third clause) is a **decision, not a
  fix** — see Decisions below. Flagging it as a follow-up task rather than doing nothing and
  rather than editing `server.mjs` in this branch.
- `saveSkillContext()` (a fifth, smaller non-atomic-write call site the audit did not name, at
  `office-status-hook.js` ~L664) was **left untouched**: it writes a small, single-agent, rarely
  concurrently-read skill-context cache file, not the shared multi-writer `STATUS_FILE` the audit
  scoped its finding to. Folding it into `atomicWriteJson()` anyway would be an unrequested
  refactor of a file the audit didn't flag as broken.

## Decisions

- **D-1**: `GET /api/status` stays unauthenticated (no `OFFICE_API_TOKEN` gate on reads) and keeps
  serving `activeFile`/`_cwd` verbatim. Rationale: the default bind is loopback-only
  (`server.mjs` `bindHost = '127.0.0.1'` unless `--host` is passed), so the exposure only reaches
  another machine when the operator has already opted into LAN mode — the same trust boundary
  `server.mjs` already warns about for the *write* side (`--host` + no `OFFICE_API_TOKEN` prints a
  startup warning). Extending that warning to cover the read side, or gating GET behind the token
  when one is set, is a reasonable follow-up but touches `server.mjs`, which is outside this
  branch's target files. Recorded here so it isn't lost; not filed as a backlog item without
  owner sign-off on priority.

## Acceptance Criteria

- **AC-1**: A test reproducing the two-stealer race (two processes/simulated racers steal the
  same stale lock) proves at most one holds the lock at a time, and neither's release removes the
  other's active lock. **Amended 2026-09-26 (review round 2)**: the discriminating case is not
  "two racers targeting the identical stale generation simultaneously" (mkdir/rename exclusivity
  already covers that) but "one racer judges staleness on stale data while another has *already*
  completed a full steal-and-recreate cycle in the interim" — a forced `fs.statSync` interception
  test (`tests/hookWriteLock.test.js` "forced-interleaving TOCTOU repro") is required to prove
  this specific case; the original 8-worker spawn test does not discriminate it (it passed even
  against the disproven round-1 fix).
- **AC-2**: `atomicWriteJson` retries rename on failure before falling back to a direct write; a
  unit test forces `renameSync` to fail N times then succeed and asserts the tmp-retry path is
  taken instead of the immediate direct-write fallback.
- **AC-3**: `extractContext('WebSearch', { query: '<anything>' })` returns `null`;
  `extractContext('Agent', { prompt: '<anything>' })` (no `description`) returns `null`. Capture
  file rotation test: append past the byte cap rotates to `.1` and the live file resets.
- **AC-4**: `bridge.js` `send()`/`parseShorthand()` never emit a `source` in `HOOK_ORIGIN` when
  the caller supplied one; `_seq` in the emitted message is always freshly generated, never the
  caller's value.
- **AC-5**: `generic-llm-bridge.js` `parseArgs(['node','bridge','--port=5175'])` yields
  `{ port: 5175, ... }`; the anchored ignore regex does not match `.github/workflows/ci.yml` or
  `src/distance.js` but does match `node_modules/x`, `.git/HEAD`, `dist/index.js`.
- **AC-6**: `bin/cli.js` `setup`/`uninstall` unit-level behavior: symlinked settings path resolves
  to its target before write; malformed hook entry (`null` in `hooks[event]`) does not throw
  during uninstall; one unlinkable file does not stop cleanup of the rest.

## Non-Goals

- Rewriting the lock primitive to use OS-level file locks (`flock`/`LockFileEx`) — the directory
  `mkdirSync` primitive stays; only the steal path changes.
- Any change to `src/inference/inferStatus.js` (sibling-owned in this work split) or `server.mjs`
  (D-1 above).
- Fixing `saveSkillContext`'s non-atomic write (see "What was dropped").

## External References

- `docs/specs/hook-status-write-lock.md` — corrected Risks entry (was: "mkdir atomicity means
  exactly one wins the retake" — false for the steal path specifically; true only for a *fresh*
  `mkdirSync` race, not the rmdir-then-mkdir steal sequence).
- `docs/specs/hook-runtime-contract.md` — no AC changed; read for event-shape context.
- `docs/specs/ux-vibe-rebalance.md` line 24-25 — the "no raw text in a bubble" policy this spec's
  privacy fixes bring `WebSearch`/`Agent` into line with.
- `docs/INTEGRATIONS.md` lines 201/215 — documents the `--port=` form `generic-llm-bridge.js`
  didn't support before this fix.
