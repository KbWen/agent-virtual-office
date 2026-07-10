# Work Log: chore/ssot-rotation-and-worklog-hygiene

## Header

- Branch: `chore/ssot-rotation-and-worklog-hygiene`
- Classification: `quick-win`
- Classified by: `claude-opus-4-8`
- Frozen: `2026-07-10`
- Created Date: `2026-07-10`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `884a0ac`
- Recommended Skills: `verification-before-completion (auto), karpathy-principles (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `105`

---

## Session Info

- Agent: `claude-opus-4-8`
- Session: `2026-07-10 14:30 UTC`
- Platform: `claude-code`
- Guardrails loaded: `skipped (quick-win)` — core sections were already loaded earlier this session for the v1.8.11 upgrade (Read-Once Discipline); no re-read performed
- Override: `none`
- Downstream-Capabilities: `.agentcortex/context/private/downstream-capabilities.yaml (0 skills, knowledge_sources: kb-main→OK)` — not consulted; governance-chore domain is not KB-routed
- Context Read Receipt:
  - `current_state.md` → `Update Sequence: 105`, `Last Updated: 2026-07-10`
  - Work Log → created (new)
  - Spec Scope → none. No Spec Index entry covers SSoT rotation or work-log hygiene.

---

## Task Description

Close the three follow-ups left open by the Agentic OS v1.8.11 upgrade (PR #199, squash `884a0ac`):

1. **SSoT rotation** — the new `check_ssot_caps.py` advisory reports Ship History at 74 entries (cap 10) and Spec Index at 43 entries (cap 30). Rotate per `ship.md §State Update` (lines 197, 208).
2. **Work-log hygiene** — 9 active logs vs a hygiene threshold of 8.
3. **Upstream bug report** — the `validate.sh` exit-141 SIGPIPE abort, unfixed in v1.8.11.

Deliberately **out of scope**: `.agentcortex/context/work/main.md`. It belongs to `codex` on the live `main` branch. Reported, not touched.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-07-10 | quick-win; no spec, no handoff |
| plan | done | 2026-07-10 | 4 items: ship-history rotation, spec-index rotation, worklog hygiene, upstream report |
| implement | done | 2026-07-10 | ship-history rotated; spec-index rotation attempted then reverted; 6 logs removed, 2 archived |
| ship | done | 2026-07-10 | SSoT entry + work-log archive + INDEX chain |

---

## Phase Summary

- **bootstrap**: classified `quick-win`. No `§0` decision-table row escalates: the task touches no installer/provenance logic, no `docs/specs/`, no `AGENTS.md` / `.agent/rules/*` / `.agent/config.yaml`, no templates, no `validate.*`. It edits `current_state.md` (SSoT, via `/ship` + `guard_context_write.py`), creates one archive file, and removes redundant gitignored local state. Semantic but contained → `quick-win`, per `engineering_guardrails.md §10.1` (1–2 modules, clear scope).

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-10T14:30:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-10T14:34:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-10T15:02:00Z
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-10T15:12:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| PR | https://github.com/KbWen/agent-virtual-office/pull/199 | The v1.8.11 brain upgrade that surfaced these follow-ups |
| Procedure | `.agent/workflows/ship.md:197` | Spec Index cap → `## Spec Index Archive` |
| Procedure | `.agent/workflows/ship.md:208` | Ship History cap → `archive/ship-history-YYYY.md` |
| Tool | `.agentcortex/tools/check_ssot_caps.py` | Advisory-only source of both cap findings |

---

## Known Risk

- **Do not archive an incomplete work log into git.** The validator parses archived logs' gate chains; promoting a log that never reached a ship receipt could manufacture new FAILs. Only the two logs whose chains end at `Gate: ship | Verdict: PASS` are archived here.
- **Relative-link depth hazard** (`ship.md:209`): `current_state.md` sits at depth 2, `archive/` at depth 3. Any `../`-rooted link copied into `archive/ship-history-2026.md` resolves one level too shallow and is flagged by validator M8. Rotated content must be checked for such links.
- **Never edit or reorder surviving Ship History entries** (`ship.md:207`). Rotation moves the oldest entries out verbatim; the newest 10 stay byte-identical.
- **Rollback plan**: branch `chore/ssot-rotation-and-worklog-hygiene` cut from `main` at `884a0ac`. Rollback = `git checkout main && git branch -D chore/ssot-rotation-and-worklog-hygiene`. The only irreversible-ish step is deleting 5 gitignored live work logs — each was `cmp`-proven byte-identical to its committed archive copy first, so the content survives in git.

---

## Conflict Resolution

none

---

## Skill Notes

none

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- `engineering_guardrails.md` was NOT re-read for this quick-win (it was loaded earlier this session for the v1.8.11 hotfix). Per AGENTS.md Read-Once Discipline this is correct, and per `bootstrap.md §0` TOKEN LEAK BLOCK a quick-win must not read it.

---

## Design Reference

none — no UI change.

---

## Observability

none — quick-win.

---

## Resume

none — `/handoff` exempt for `quick-win`.

---

## Test Gate Results

```
main after PR #199 :  Summary: pass=100 warn=17 fail=0 skip=4   exit 0
mid-work (both rotations applied):  pass=107 warn=7  fail=2 skip=4   exit 1
  [FAIL] SSoT Spec Index completeness: 13 shipped/living spec(s) not in index
  [FAIL] feature/arch-change/quick-win shipped work logs with bootstrap-placeholder ## Evidence: 1
post-revert (work log evidence written):  pass=109 warn=8  fail=0 skip=4   exit 0
post-archival, standalone re-run:        pass=110 warn=6  fail=0 skip=4   exit 0
```

Both FAILs were self-inflicted and both were cleared, one per cause: the first by reverting the `ship.md:197` Spec Index rotation (the validator cannot see a `## Spec Index Archive` section), the second by replacing this log's own `Pending: bootstrap only` Evidence placeholder with real evidence.

`check_ssot_caps.py`: `ship history 10/10` OK; `spec index 43 (cap 30)` → advisory WARN, exit 0 (never a gate failure).

WARN dropped 17 → 6: the six deleted redundant work logs and two archivals removed a batch of active-work-log hygiene warnings.

One more self-inflicted FAIL surfaced on the standalone post-archival run: `[FAIL] text integrity check -> chore-ssot-rotation-and-worklog-hygiene-20260710.md: mixed-eol`. This log had been written by three tools with different newline conventions (Write, Python `write_text` on Windows -> CRLF, and a bash `printf >>` -> LF). Normalized to LF; `check_text_integrity.py` then passes. `ship-history-2026.md` was normalized for the same reason (it was CRLF-only, so not \mixed\, but inconsistent with every other archive file).

No product code was touched (`git diff --name-only` contains no `src/`, `public/`, or `tests/` path), so vitest/build were not re-run on this branch; the PR #199 baseline (2251 tests passing, build clean) still holds.

---

## Evidence

**Ship History rotation — done.** 74 → 10 entries in `current_state.md`; 64 moved verbatim into a new `.agentcortex/context/archive/ship-history-2026.md`, then this task's own ship entry pushed one more down (archive now holds 65; 10 + 65 = 74 + 1). The surviving 10 were `diff`-proven byte-identical to the original top 10 — no entry edited or reordered (`ship.md:207`). One `](../../docs/specs/_ship-history-archive.md)` link inside the moved content was flattened to a plain path; `validate.ps1` confirms `[PASS] archived markdown files: no broken relative links detected` (the depth hazard at `ship.md:209`).

**Spec Index rotation — attempted, REVERTED. The documented procedure and the validator contradict each other.**

- `ship.md:197` instructs: once the index exceeds `spec_index_max_entries` (30), move the oldest `[Shipped]` entries into a `## Spec Index Archive` section.
- Doing exactly that produced `[FAIL] SSoT Spec Index completeness: 13 shipped/living spec(s) not in index`.
- Root cause: `validate.ps1:1999` scrapes the index with a regex whose lookahead terminates at the next `##` header (`(?=\n-\s*\*\*|\n##|\z)`), and `grep -c "Spec Index Archive"` over **both** `validate.ps1` and `validate.sh` returns **0**. Neither validator has any concept of the section `ship.md` tells you to create.
- Decision: reverted. `check_ssot_caps.py` is advisory-only and **always exits 0**; its finding can never fail a gate. Executing the documented remedy converts that harmless advisory into a hard FAIL. Trading a never-failing advisory for a hard failure is a bad trade. The index stays at 43 entries and the advisory stands. Restored from `git show HEAD:` rather than hand-rebuilt.

**Work-log hygiene — 9 active → 2.**

- Deleted 6 live copies after `cmp` proved each byte-identical to its committed archive twin: `feat-avo-104-skill-activation-badge`, `feat-avo-107-review-gate-queue`, `feat-avo-123-theme-selector`, `feat-avo-130-control-bar-reduction`, `feat-avo-136-event-juice`, `refactor-avo-146-statuscontract-single-source`. Zero content loss — the bytes live in git.
- Archived 2 shipped-but-unarchived logs, each with a complete gate chain ending at `Gate: ship | Verdict: PASS`, plus hash-chained `INDEX.jsonl` entries: `codex-strengthen-panel-feature-verifier-20260701.md` (`prev_sha 435350c0`), `quickwin-office-layout-enrichment-20260627.md` (`prev_sha 2071c156`).
- Released `main.lock.json` — owner `codex`, `updated_at 2026-07-02T01:13Z`, `stale_timeout_minutes 60`, i.e. 8 days past expiry.
- **Left alone**: `work/main.md` (codex, live `main` branch, phase `test`, no ship receipt). Archiving an incomplete gate chain into git risks manufacturing validator FAILs, and it is not this task's log to close.

**Upstream report.** `KbWen/agentic-os` issue #336 — the `validate.sh` exit-141 SIGPIPE abort, with root cause (`set -euo pipefail` + a Python matcher that `break`s early + a work log over the 64 KB pipe buffer), a self-contained reproduction, a `bash -x` trace, three candidate fixes, and the secondary MSYS fork-exhaustion finding.

⚡ ACX
