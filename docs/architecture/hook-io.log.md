# Hook I/O — Domain Decisions Log (L2)

> Append-only. Consolidated from specs whose frontmatter declares
> `primary_domain: hook-io`. Never modify or delete existing entries.
> Cross-reference: `docs/architecture/hook-integration.log.md` (adjacent
> hook/bridge transport decisions consolidated under that domain name).

### [hook-io][2026-09-27][fix/hook-robustness-privacy]
source_spec: docs/specs/hook-robustness-privacy.md
source_sha: e3199900f26649a5ccec77e0afb29068319e273c

- [DECISION] `GET /api/status` stays unauthenticated and keeps serving `activeFile`/`_cwd`
  verbatim — the default bind is loopback-only, so exposure only reaches another machine once
  the operator has already opted into `--host` (the same trust boundary the existing write-side
  warning covers); fixing the read side touches `server.mjs`, outside this branch's target files.
- [TRADEOFF] Identity-verified lock steal (owner token + mtime, re-checked after the rename) adds
  ~93-320ms measured worst-case latency under active contention in exchange for closing the
  double-steal TOCTOU; accepted since steals are already the rare, already-contended path and the
  common case (no contention) adds 0ms.
- [DECISION] Accept the move-aside/rename-back window's two residual outcomes — a bounded
  double-claim when a third acquirer races the restore, and a bounded (≤staleMs) self-healing
  zombie lock — rather than adding OS-level file locking (`flock`/`LockFileEx`) or a second lock
  primitive; both match the pre-lock baseline hazard this file exists to narrow, not a new class.
- [CONSTRAINT] The hook must never hang or add unbounded latency — every steal-path addition
  (identity check, EPERM/EBUSY retry, orphan cleanup) stays inside the existing
  `maxRetries × waitMs` budget.
- [DECISION] `WebSearch`/`Agent` privacy fixes reuse the existing generic-noun fallback labels
  (no new locale strings) rather than inventing new office-vibe copy for two tools.
- [DECISION] `bridge.js` duplicates `HOOK_ORIGIN` from `inferStatus.js` (kept in sync via a
  comment) rather than adding a bundler dependency to a standalone, no-build-step script.
- [DECISION] `saveSkillContext`'s non-atomic write is left untouched — it is a single-agent cache
  file, not the shared multi-writer `STATUS_FILE` the audit scoped `atomicWriteJson` to; folding
  it in would be an unrequested refactor of a file the audit never flagged.
- [TRADEOFF] `releaseStatusLock`'s read-token-then-`rmSync` residual (LOW #4) is documented, not
  closed with a rename-verify release — the window is narrower than the acquire-side one and its
  severity (LOW) does not currently justify the added machinery.
