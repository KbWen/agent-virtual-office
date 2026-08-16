# Work Log: chore/adr-applies-to-backfill

## Header

- Branch: `chore/adr-applies-to-backfill`
- Classification: `quick-win`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-16`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `4fd13ebef8b10ab2428499d2553b1e5ba2a5792c`
- Checkpoint SHA: `4fd13ebef8b10ab2428499d2553b1e5ba2a5792c`
- Recommended Skills: `verification-before-completion (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-16 00:40 UTC`
- Platform: `claude-code`
- Guardrails loaded: `AGENTS.md §Core Directives (Quick mode)`
- Override: `none` · Downstream-Capabilities: carried (`kb-main→OK`, Read-Once)
- Owner asleep from this point — delegated queue execution. No blocking questions; anything
  genuinely ambiguous is deferred with a written reason rather than guessed.

---

## Task Description

Backfill `applies_to:` frontmatter on the project's ADRs. Found during the v1.8.21 upgrade session:
`check_adr_coverage.py` reported **8 of 10 ADRs missing `applies_to:`**, which makes `/bootstrap`'s
ADR coverage gate structurally blind to them — the gate can never fire for the files they govern.

Branched from `main` (`4fd13eb`), independent of the two other open branches.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-16 | quick-win; docs/adr only |
| plan | done | 2026-08-16 | derive surfaces from each ADR's own `review_trigger` + body |
| implement | done | 2026-08-16 | 6 ADRs declared, 2 documented as no-surface |
| review | done | 2026-08-16 | phantom-glob audit 47/47 clean |
| test | done | 2026-08-16 | coverage matrix + lifecycle checker + validator |
| ship | done | 2026-08-16 | — |

---

## Phase Summary

- implement/review/test: declared `applies_to:` on **6** ADRs (47 globs total) and deliberately did
  **not** declare it on **2**. | Confidence: 92% — each surface was derived from that ADR's own
  `review_trigger` prose plus its Decision section, then every glob was existence-checked.

**The judgement call that matters here**: a wrong `applies_to` is *worse than a missing one* — it
manufactures false coverage, so `/bootstrap` reports "covered" and silently skips the `/adr` prompt
for a decision that does not actually govern those files. So this was NOT a mechanical 8/8 backfill.

- **ADR-006** (AVO is not an observability/cost dashboard) and **ADR-009** (portable status-core
  stays out of this repo) govern **what must NOT be built**. Their subject matter is code that
  deliberately does not exist. Any glob would be speculative. They keep no `applies_to:` and instead
  carry a YAML comment stating why, so the next person does not "fix" the omission. (A `#`-prefixed
  comment cannot match the tool's `^applies_to\s*:` regex, so it is inert to the parser.)
- `src/systems/classify.js` remains **uncovered** by design — no ADR governs the classifier, and
  inventing one to close the gap would be the same false-coverage error.

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T00:40:00+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T00:44:00+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T00:52:00+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T00:55:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T00:58:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-16T01:02:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Tool | `.agentcortex/tools/check_adr_coverage.py` | `applies_to` is an fnmatch glob list; no sentinel exists for "this ADR has no file surface" |
| Prior | `.agentcortex/context/archive/chore-upgrade-agentic-os-v1.8.21-20260815.md` §Red Team F-2 | where this was first measured |

---

## Known Risk

- **R1 — a glob that is too broad silently suppresses a future `/adr` prompt.** Mitigation: surfaces
  derived per-ADR from its own `review_trigger`, never a directory wildcard. The broadest pattern
  used is a single named file; no `**` or bare-directory globs were written.
- **R2 — a glob matching nothing is a phantom** (looks declared, covers nothing). Mitigation: all
  47 globs existence-checked; 0 phantoms.

---

## Conflict Resolution

none

---

## Drift Log

- Skip Attempt: NO · Gate Fail Reason: N/A · Token Leak: NO
- Deviation from the stated T3 scope ("8 ADRs missing `applies_to`"): only 6 were declared. The
  other 2 were assessed as legitimately surface-less and documented rather than force-filled.
  Recorded here because the queue item said 8 and this ship delivers 6 + 2 documented.
- **Process violation by this session, self-reported.** No Work Log lock was ever acquired for this
  branch. `shared-contracts.md §Phase-Entry Lock` requires `recover_worklog_lock.py ensure` at every
  non-`tiny-fix` phase entry; the two preceding work units in this session did it at all six phases
  and this one did it at none. Caught only at ship, when `release` returned
  `{"reason": "missing", "status": "missing"}`. **No harm occurred** — single-writer, single session,
  no concurrent holder — but the safety property was unenforced for the whole unit, not merely
  unlogged. Cause: the branch was cut and work started directly from the queue without re-entering
  the bootstrap sequence that carries the lock step.

---

## Evidence

- Before: `check_adr_coverage.py` → `ADRs missing 'applies_to:' frontmatter:` **8 files**
  (ADR-001/002/003/004/005/006/009/010). `--paths .agentcortex/ .agent/` → `no_covering_adr`.
- After: missing list is **2** (ADR-006, ADR-009 — both intentional, documented in-file).
- **Phantom audit: 47 globs checked, 0 phantoms** (every declared pattern resolves to ≥1 real file).
  Caught one bad assumption during derivation: `statusContract.mjs` lives at `src/utils/`, not
  `src/systems/` as the SSoT Spec Index line implies — the glob was corrected before the write.
- Coverage matrix now resolves: `AGENTS.md` + `.agent/rules/state_machine.md` → ADR-001 ·
  `public/hooks/office-status-hook.js` → ADR-002 · `src/utils/statusContract.mjs` → ADR-003 ·
  `src/systems/store.js` → ADR-005 + ADR-010 · `src/components/PixelOffice.jsx` → ADR-005 ·
  `tests/doorClaims.test.js` → ADR-010 · `src/systems/classify.js` → uncovered (correct).
- `check_lifecycle_frontmatter.py` → `10 PASS, 2 WARN, 0 FAIL` (the 2 WARNs are pre-existing
  `docs/architecture/` files, unchanged by this task).
- `validate.ps1` → `pass=113 warn=6 fail=0 skip=4` — identical to the pre-change baseline.
- Diff: 8 files, **+43 lines, 0 deletions**, frontmatter only. No ADR body text altered.
