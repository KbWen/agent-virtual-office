# Work Log: fix/issue-20-hook-write-lock

## Header

- Branch: `fix/issue-20-hook-write-lock`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-10`
- Created Date: `2026-06-10`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `d5eb8e7`
- Recommended Skills: `none`
- Primary Domain Snapshot: `hook-io`
- SSoT Sequence: `52`

---

## Session Info

- Agent: `claude-fable-5` (implementation delegated to sonnet acx-implementer)
- Session: `2026-06-10 16:00 UTC`
- Platform: `claude-code`

---

## Task Description

Hardening-wave H3 (#20, reactivated from Deferred): serialize the hook's STATUS_FILE
read-modify-write sections under a bounded-wait directory lock so concurrent hook processes
(SubagentStart racing the main session in the same cwd) cannot lose updates. Liveness is the
prime constraint: bounded wait → proceed unlocked (never stall a user's session). Spec:
`docs/specs/hook-status-write-lock.md` (AC-1..AC-5).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-10 | quick-win (single hook file + tests; no semantic payload change) |
| plan | done | 2026-06-10 | gate PASS in chat; mini-spec written |
| implement | done | 2026-06-10 | sonnet implementer + coordinator ENOENT-race fix |
| review | done | 2026-06-10 | fresh reviewer → PASS; lock-neutering sensitivity check proved AC-4 has teeth; SITE-A/B nesting hazard disproven structurally |
| test | done | 2026-06-10 | 1499/1499; AC-4 3× non-flaky; smoke exit 0 |
| ship | done | 2026-06-10 | SSoT seq 53; backlog #20 Done; self-archived in same PR |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T16:00:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T16:05:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T10:51:00Z
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T16:50:00Z | fresh reviewer; AC-1..5 PROVEN; lock-neutered sensitivity check (4/5 fail when broken); no liveness path
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T16:55:00Z | 1499/1499; AC-4 ×3 non-flaky
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-10T17:00:00Z | SSoT seq 53; PR for merge after CI

---

## Changes

- `public/hooks/office-status-hook.js` — added `acquireStatusLock()` / `releaseStatusLock()` /
  `STATUS_LOCK_CONFIG` (lines ~100–165). Wrapped 2 RMW sites:
  - **RMW-SITE-A** (`case 'Stop'` handler, ~line 863): full outer try/finally around the existing
    read→build-output→tmp+rename span.
  - **RMW-SITE-B** (merge-read through final write, ~lines 957–1209): `const mainLock =
    acquireStatusLock(); try { ... } finally { if (mainLock.ok) releaseStatusLock() }` wraps the
    entire read-existing→straggler-recheck→build-output→write loop. All inner `return` statements
    release the lock via the finally clause.
  - Pure-read-only guard reads (PreToolUse _stopped check ~695, PostToolUse _stopped check ~722,
    SubagentStop _stopped check ~784) left unlocked — read-only, no write-back.
  - Exported: `acquireStatusLock`, `releaseStatusLock`, `STATUS_LOCK_CONFIG` via module.exports.
- `tests/hookWriteLock.test.js` — new (10 tests): AC-1 basic acquire/release/idempotency,
  AC-3 stale-steal, AC-2 bounded-fallback, AC-4 6×15=90 multi-process mutual exclusion.

---

## Evidence

- `npm test` → 1499 passed (70 test files). Baseline was 1489; +10 new.
- `npx vitest run tests/officeStatusHook.test.js tests/statusFieldsDriftGuard.test.js` → 138 passed (byte-identical baseline).
- `npx vitest run tests/hookWriteLock.test.js` ×3 consecutive runs → 10/10 each (non-flaky).
- `npm run build` → exit 0 (447.41 kB JS / 1.35 s).
- `npm run smoke` → exit 0 (1871 svg descendants, 0 pageerrors, 0 console errors).
- `git diff --stat HEAD` → `public/hooks/office-status-hook.js | 214 +++ (1 file)` + untracked `tests/hookWriteLock.test.js`.

---

## Test Gate Results

- vitest 1499/1499 PASS
- build PASS
- smoke PASS
- AC-4 3×consecutive PASS (non-flaky)

---

## Drift Log

- ADR Coverage Check: I/O-discipline fix inside one existing file; no architecture boundary →
  no ADR required.

---

## Phase Summary

- bootstrap/plan: #20 reactivated as H3; bounded-wait mkdir lock + stale-steal + proceed-unlocked
  fallback (availability over consistency; worst case = today).
- implement: hook.js +147/-67 lines; 2 RMW sites wrapped (Stop + merge-read/write); 10 new tests;
  1499/1499 suite green; build + smoke exit 0; AC-4 3×non-flaky. Coordinator added the
  ENOENT-after-EEXIST retry (release race made acquire give up early — safe direction but lost
  protection).
- review→ship: fresh reviewer PASS (sensitivity-verified AC-4 by neutering the lock — 4/5 runs
  fail broken; nesting hazard structurally impossible: Stop returns before SITE-B acquire).
  2 LOW accepted (time-based steal under >2s OS pause — spec-accepted; AC-4 failure-sensitivity
  probabilistic — spec-waived). SSoT seq 53. Next wave item: H5 (AVO-148). ⚡ ACX
