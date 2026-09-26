# Work Log: fix/codex-hook-isolation

## Header

- Branch: `fix/codex-hook-isolation`
- Classification: `quick-win`
- Classified by: `Claude Opus 5.5`
- Frozen: true
- Created Date: 2026-09-26
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: ship
- Diff Base SHA: `c238a30d51881fb2add5a0a875736d6e32ce542c`
- Checkpoint SHA: `b3489063e0dcf051f7efc8d6ace578c130f5fe45` <!-- merge commit: fix/codex-hook-isolation + origin/main -->
- Prior Checkpoint SHA (pre-merge): `60f61645f8934a73558b2323eb68bc2dee8daa96`
- Recommended Skills: none
- Primary Domain Snapshot: hook-integration
- SSoT Sequence: 135

---

## Session Info

- Agent: Claude Opus 5.5
- Session: 2026-09-26T09:15:27Z (round 1) / 09:35:56Z (round 2) / 09:53:47Z (round 3)
- Platform: Antigravity (worktree `rem-codex-hook-isolation`)
- Guardrails loaded: skipped (quick-win) — per engineering_guardrails.md Reading Mode

---

## Task Description

Remediate a 2026-09-26 audit of the Codex/Claude status-file hook adapters (3 findings):
1. Codex helper (`office-status-codex.js`) and Claude hook (`office-status-hook.js`) wrote
   the identical `office-status-<slug>.json` filename with no provenance tag — a Codex
   write could clobber the Claude hook's RMW state, and `cleanupGhostAliases` could delete
   a live Codex file sharing a cwd-hash suffix. Slug slice/strip order also differed
   between the two mirrors (28-char boundary divergence).
2. `office-status-codex.js` `main()` blocked reading stdin to EOF before checking
   `argv[2]`, hanging the documented single-arg usage on a TTY/open pipe.
3. `normalizeCodexStatusPayload` under-sanitized `workflow`/`source`, and (found only in
   round-2 review) accepted a caller-supplied `_seq` — see Findings Disposition.

Root Cause: `office-status-codex.js` is a standalone CJS mirror of `office-status-hook.js`
(cannot `require` an `.mjs`), written with no shared namespace/provenance tag, so the two
writers silently competed for the same filename space.

## Findings Disposition (final, post round-2 correction)

- #1 namespace/cleanup/slug-order: FIXED. Codex writes `office-status-codex-<slug>.json`;
  `cleanupGhostAliases` requires `source === 'claude-cli'`; slug slice-then-strip order
  aligned to the Claude hook.
- #2 stdin hang: FIXED. Only reads stdin when no JSON arg given; skips on a bare TTY.
- #3 sanitization: FIXED, in two passes.
  - Round 1 fixed `workflow`/`source` type+length sanitization but wrongly left a
    caller-supplied `_seq` honored ("bounded by scanSessions staleness" — WRONG: `'codex-cli'`
    is a client `HOOK_ORIGIN` source sharing the client's own clock high-water mark
    (`src/inference/inferStatus.js` `isHookOrigin`); a caller-set future `_seq` (server
    allows up to 5 min ahead, `scanSessions.mjs` `FUTURE_MS`) poisons that mark and freezes
    the session's own next real write for the window — reviewer measured a 239989 ms
    freeze). Round 2 fix: `_seq` is always this process's own `nextSeq()`, never
    caller-honored; `coerceSeq` deleted.
  - Round 2 also pinned `source` to the constant `'codex-cli'` (was merely sanitized,
    still caller-settable — a caller-set `'claude-cli'` would re-enable
    `cleanupGhostAliases` deleting this file; `'multi-session'` would escape client
    stale-drop for that reserved value).
  - Round 3: round 2's regression test for `_seq` used a value in the PAST
    (`'1700000000000'`, Nov 2023) as its "future" case, so a mutant that honors only a
    genuinely-future caller `_seq` (the exact poisoning shape) survived. Added a case using
    `Date.now() + 240_000`; confirmed it kills that mutant (see Evidence).

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-09-26T09:15:27Z | quick-win, stayed within hook adapters |
| plan | done | 2026-09-26T09:15:27Z | inline within bootstrap session — no separate real-world artifact exists before the implement commit; see Drift Log |
| implement | done | 2026-09-26T09:26:09Z | round 1, commit 44319a2 |
| review | done | 2026-09-26T09:33:38Z | round 1 NOT READY |
| implement | done | 2026-09-26T09:40:27Z | round 2, commit 8395457 |
| review | done | 2026-09-26T09:51:51Z | round 2 NOT READY |
| implement | done | see Gate Evidence | round 3, this commit |
| review | done | 2026-09-26T10:02:41Z | round 3 PASS (orchestrator) |
| test | n/a | — | quick-win — evidence inline |
| handoff | n/a | — | quick-win exempt |
| ship | done | 2026-09-26T15:42:22Z | this pass — merged origin/main, re-verified |

---

## External References

- `docs/specs/codex-status-parity-and-done-count.md` [Shipped] — canonical addendum for
  this whole remediation (namespace, `_seq`/`source` pinning, multi-session tradeoff).
- `docs/specs/hook-runtime-contract.md` [Shipped] — addendum is now a one-line pointer to
  the canonical doc above (was circular as of round 2 — fixed round 3).
- `docs/specs/hook-status-write-lock.md` [Shipped] — no change; Claude-hook-only lock,
  Codex was never a participant (see Known Risk).
- `docs/INTEGRATIONS.md` — Codex filename line + multi-session tradeoff paragraph.

## Known Risk

- Codex still does not participate in the Claude hook's write-lock
  (`STATUS_LOCK_CONFIG`/`acquireStatusLock`) — namespace isolation removes the clobber
  vector without needing a shared lock. Two Codex invocations racing each other on the
  SAME file remain possible (pre-existing, unchanged) — out of scope (sibling worktree
  owns lock/rename/privacy in `office-status-hook.js`).
- Old-name Codex files from before this fix age out via `scanSessions.mjs`'s existing
  5-min staleness window — no migration needed.
- **Multi-session visibility tradeoff**: Claude + Codex active in the SAME checkout now
  render as two sessions to `scanSessions.mjs`'s multi-session merge, which shows only one
  representative (most-urgent) agent per session file — a real active role on either side
  can be hidden (reviewer probe: Claude's `qa` and Codex's `pm` both dropped in one merge).
  Strictly better than pre-fix silent clobber, not full multi-role parity across sources.
  Documented in `docs/INTEGRATIONS.md`.
- **Namespace is prefix-based, not fully disjoint** (advisory, no code change): a Claude
  branch literally named `codex/*`/`codex-*` would itself produce an `office-status-codex-
  ...` filename. Same-checkout collision is impossible (Codex's own slug becomes
  `codex-codex-...`); residual exposure (branch-switch ghosts, cross-checkout hash
  collision) is already covered by the source-gated cleanup. Accepted as-is.

## Conflict Resolution

none — no skill conflicts (quick-win skipped skill recommendation step).

## Skill Notes

none

## Phase Summary

- bootstrap: quick-win — 2 source files + spec/doc updates; no `scanSessions.mjs` change
  needed (glob already matches any `office-status-*` suffix).
- implement r1→review NOT READY (`_seq` rationale, undocumented tradeoff, timestamp) →
  implement r2 (fixed those) → review NOT READY (test/evidence mismatch, est. timestamp,
  circular addenda, size cap) → implement r3 (this pass, all fixed) — see Evidence.
- review r3: PASS (orchestrator) — ready for /ship; stop here for owner/Gemini spot-check.
- ship: PASS — merged origin/main (b348906), full suite green, validate fail=0, PR #247
  opened, SSoT Update Sequence 136→137, archived to
  `.agentcortex/context/archive/fix-codex-hook-isolation-20260926.md`. ⚡ ACX

## Drift Log

- 2026-09-26T09:33Z review: `## Review Feedback` section added by fresh reviewer (was
  missing); Checkpoint SHA refreshed c238a30→44319a2.
- 2026-09-26T09:51Z review r2: Work Log 18.1 KB > 12 KB cap — compaction deferred to
  round-3 implement (reviewer's write boundary is this file only, not archival).
- 2026-09-26T09:53Z round 3: compacted this file (was ~24 KB) — reviewer prose condensed,
  every verdict/finding/file:line preserved. Plan timestamp corrected: round 1 invented a
  round-number estimate (`09:20:00Z`); no independent artifact exists for an inline
  quick-win plan step, so it's now stamped identically to bootstrap (`09:15:27Z`, same real
  `date -u` call) with an inline/no-artifact note instead of a second invented value.
- 2026-09-26T16:38Z ship: `current_state.md` Ship History insertion + rotation, and the
  Update Sequence/Last Updated heartbeat, were written via a surgical anchored Edit (ship.md
  §State Update step 2's explicit alternative to `guard_context_write.py --mode replace`),
  not the guard tool — no guard receipt was produced (Stage 1: advisory only, per
  `guarded-context-writes.md`; confirmed by `validate.sh`'s pre-existing
  no-guard-receipt WARN, unrelated to this branch). Byte-verified after write: `Update
  Sequence: 137`, `Last Updated: 2026-09-27T00:38:59+08:00`, Ship History 10/10 and Spec
  Index 30/30 via `check_ssot_caps.py`.

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T09:15:27Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T09:15:27Z <!-- inline, no separate artifact; see Drift Log -->
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T09:26:09Z <!-- = commit 44319a2 author date -->
- Gate: review | Verdict: NOT READY | Classification: quick-win | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-26T09:33:38Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T09:40:27Z <!-- date -u at write time -->
- Gate: review | Verdict: NOT READY | Classification: quick-win | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-09-26T09:51:51Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T10:00:13Z <!-- date -u at write time, commit 60f6164 -->
- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-09-26T10:02:41Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-09-26T15:42:22Z

## Evidence

- Round 1 red baseline (`tests/codexHookIsolation.test.js`, new): 7 failed / 2 passed (9) —
  namespace-clobber, source-gate, slug-order, stdin-hang all reproduced (stdin repro
  required async `spawn` with stdin never `.end()`'d — `spawnSync` false-passed).
  Post-fix targeted run: 10 files / 475 tests green. Full suite (after `npm run build`,
  which the very first pre-build run needed): 134 files / 2529 tests green. `npm run
  smoke:pack`: 4/4 assertions PASS.
- Round 2: reverted `office-status-codex.js` to the round-1 commit via `git show HEAD:...`
  (git state untouched), confirmed `officeStatusCodex.test.js` → 2 failed / 8 passed
  (`_seq` not ignored, `source` not pinned), restored the round-2 fix, confirmed green.
  Full suite: 134 files / 2528 tests green (one fewer — two source-sanitization tests
  consolidated into one pinning test, no coverage lost). Build clean; smoke:pack 4/4 PASS.
- Round 3 (this pass): added the `Date.now()+240_000` near-future `_seq` case to
  `officeStatusCodex.test.js`. Confirmed it kills the exact R2-1 mutant
  (`_seq: (numeric && > Date.now()) ? body._seq : nextSeq()`, injected via a scripted
  patch, reverted immediately after — git state untouched throughout): mutant run → 1
  failed / 9 passed in that file; reverted → 10/10 green again.
- **Final full-suite re-run, taken AFTER this Work Log's content was finalized and after
  commit 60f6164** (per round-2 review R2-2 — the prior round's quoted count did not match
  HEAD): `npx vitest run` → `Test Files 134 passed (134)` / `Tests 2528 passed (2528)`,
  2026-09-26T10:00Z. Matches HEAD exactly (round 3 added assertions inside an existing
  `it()`, not a new one, so the count is unchanged from round 2).

### Ship-phase re-verification (2026-09-26T15:42Z, after `git merge origin/main`)

- Merged `origin/main` (which had already absorbed PR #246, `fix/server-hardening`) into
  this branch: clean auto-merge, no conflicts (`docs/INTEGRATIONS.md` auto-merged), merge
  commit `b348906`. `npm run build`: clean, 969ms.
- `npx vitest run` (full suite, post-merge): 2 files timed out at the default 5000ms
  (`tests/controlPanelPresenceRail.test.jsx`, `tests/noTitleStatusChannel.test.js`) —
  neither touched by this branch (`git diff --name-only c238a30..60f6164` lists only
  `public/hooks/office-status-{codex,hook}.js`, 2 spec docs, 3 test files, none of which
  are these two). Re-ran both alone: `Test Files 2 passed (2)` / `Tests 5 passed (5)` in
  2.24s — confirms load-induced timeout, not a regression from the merge. Combined:
  135/137 files green in the full run + the 2 isolated files green = all 137 files, 2565
  (full-run count) + the 2 re-run files' own passes accounted for (full-run already
  counted their non-timed-out tests; net: 0 real failures).
- `npm run smoke:pack`: install OK, all 4 assertions PASS (setup, idempotent re-setup,
  standalone hook exit 0, Quick-Start boot 200+HTML).
- `bash .agentcortex/bin/validate.sh`: `pass=114 warn=5 fail=0 skip=5`, exit 0. All 5 WARNs
  are pre-existing historical-archive advisories (empty Phase Summary / missing gates /
  malformed receipts in 2026-06/07/09 archived logs, plus the standing no-guard-receipt
  advisory) — none reference this branch's files.

### Rollback plan

Revert the branch tip commit(s) on `fix/codex-hook-isolation`. No data migration, no
schema change, no SSoT/backlog touch. Old-name Codex status files (if any) age out via
`scanSessions.mjs`'s existing 5-minute staleness window.

## Review Feedback (condensed — verdicts + file:line evidence preserved, repeated narrative trimmed)

### Round 1 — 2026-09-26T09:33Z, head `44319a2`
B-1..B-6,B-8 PROVEN (`office-status-codex.js:180,88,94,223-229,130,165-166`;
`office-status-hook.js:165,1076,1136,1161,1373`; consumer regex parity across
`scanSessions.mjs`/`server.mjs`/`vite.config.mjs`/`bin/cli.js`/`generic-llm-bridge.js`;
full suite 134/2529 green). B-7 UNPROVEN.
Findings → all resolved, detail in Findings Disposition above: R-1 MED/blocking (`_seq`),
R-2 MED (tradeoff undocumented), R-3 MED (timestamps), R-4 LOW (`source` settable),
R-5 LOW (circular addenda), R-6 LOW advisory (diff size). Security clean.

### Round 2 — 2026-09-26T09:51Z, head `8395457`
R1-1..R1-5,B-1..B-7 PROVEN (`_seq`/`source` fixes correct at `:136,173`/`:135,172`).
R1-6 PARTIAL (plan timestamp still estimated). B-9 UNPROVEN.
Findings → all resolved this round (round 3): R2-1 MED/blocking (test's "future" `_seq`
was actually past — mutant survived), R2-2 MED/blocking (Evidence test count 2529 ≠ HEAD's
2528), R2-3 LOW (plan timestamp), R2-4 LOW (circular pointer), R2-6 (size cap). R2-5 LOW
advisory (namespace prefix-collision edge case) accepted as-is, see Known Risk. Security
clean.

### Round 3 (orchestrator, 2026-09-26T10:02:41Z)

- PASS at `60f6164`: future-`_seq` mutant killed (1 failed/9 passed), restored clean; suite 134 files / 2528 tests.
