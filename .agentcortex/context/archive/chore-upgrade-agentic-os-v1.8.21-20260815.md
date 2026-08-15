# Work Log: chore/upgrade-agentic-os-v1.8.21

## Header

- Branch: `chore/upgrade-agentic-os-v1.8.21`
- Classification: `hotfix`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-15`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Diff Base SHA: `4fd13ebef8b10ab2428499d2553b1e5ba2a5792c`
- Checkpoint SHA: `4fd13ebef8b10ab2428499d2553b1e5ba2a5792c`
- Recommended Skills: `verification-before-completion (auto), systematic-debugging (auto), red-team-adversarial (auto, Lite for hotfix), karpathy-principles (auto), doc-lookup (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-15 00:00 UTC`
- Platform: `claude-code`
- Files Read: `8`
- Guardrails loaded: `§Core Directives (AGENTS.md) + bootstrap.md + state_machine.md + skill_conflict_matrix.md`
- Override: `none` (no root `AGENTS.override.md`, no `~/.agentcortex/AGENTS.override.md`)
- Downstream-Capabilities: `.agentcortex/context/private/downstream-capabilities.yaml` (0 skills, subagent_policy=read-only [default], knowledge_sources: kb-main→OK)
- Context Read Receipt:
  - `current_state.md` → read; Last Verified `2026-08-03`, Update Sequence `116`
  - Work Log → created
  - Spec Scope → `none` (no product spec covers a governance-framework vendor upgrade; Spec Index consulted, no match)

---

## Task Description

Upgrade the vendored Agentic OS governance framework from **v1.8.17** (`102e19b`) to the latest
upstream release **v1.8.21** (`f5a161c`) from canonical `KbWen/agentic-os.git`, then act on the
technical-debt cleanup the upgrade surfaces.

Classified `hotfix` under the **Supply-Chain / Provenance Escalation** rule
(`state_machine.md §Classification Escalation Rules`; `bootstrap.md §0` row 1): the change replaces
framework code that this repo executes, resolved from a remote source. Hotfix requires REVIEWED +
TESTED gates; `/handoff` is exempt.

**Scope note (surfaced, not silently absorbed)**: the user's second ask — "優化技術債" — is
unscoped. It is NOT folded into this hotfix. A concrete candidate list is produced from the
upgrade delta + known repo state and classified separately before any tech-debt edit.

Phase chain (hotfix): `/research (optional) → /plan → /implement → /review → /test → /ship`.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-15 | classified `hotfix`; lock acquired; branch cut from `main` @ `4fd13eb` |
| plan | done | 2026-08-15 | 27-file delta sized by manifest-intersect; 9 steps; Confidence 90% |
| implement | pending | — | — |
| review | done | 2026-08-15 | PASS; BoP 6/6; F-1 corrected to known-upstream #173; F-3 new |
| test | done | 2026-08-15 | 2306/2306 + 9/9 tool smoke; 2 self-caught false-red assertions fixed |
| handoff | n/a | — | hotfix exempt (`engineering_guardrails.md §10.2`) |
| ship | done | 2026-08-15 | SSoT Ship History (11, newest-first verified); log archived; committed |

---

## Phase Summary

- bootstrap: classified `hotfix` (supply-chain escalation), 5 skills matched, SSoT + backlog +
  downstream-capabilities loaded, lock acquired, branch created. No code changes.
- plan: sized the true downstream delta by intersecting the upstream `v1.8.17..v1.8.21` tree diff
  (107 changed paths) with this repo's 204-entry `.agentcortex-manifest` → **27 real files**
  (26 modified + 1 new tool `check_worklog_references.py`); the other 80 are upstream's own repo
  state (its SSoT, work-log archives, backlog, `docs/reviews/`, `tests/ci/`) and are never
  deployed. 9 verifiable steps, deploy via the v1.8.21 source clone's own `deploy.sh --dry-run`
  first. Pre-deploy validator baseline captured. Mode Normal. | Confidence: 90% — same procedure
  succeeded for v1.8.11→v1.8.17 (Ship History); delta is small; the Windows bash-launcher failure
  mode was itself fixed upstream in v1.8.20 (#405). Residual 10%: new validator checks in
  v1.8.18–21 may FAIL on this repo's pre-existing state.
- implement: deployed v1.8.21 via the verified source clone's own `deploy.sh`
  (`202 updated / 2 skipped / 0 new / 0 removed`). The 2 SKIPs were the correct ones — live SSoT
  and `.claude/settings.json` (8 office hooks). Both `.acx-incoming` sidecars were generic
  framework templates that would have destroyed project content; inspected and deleted. All 5 ACs
  proven. Real change set = 30 tracked files, 0 product files.
- review: PASS. Burden of Proof 6/6 PROVEN. Security clean (`scan_credentials.py` exit 0; the
  241-insertion executable diff introduces **zero** new network / remote-exec surface —
  no curl/wget/Invoke-WebRequest/iex/eval/exec/subprocess/clone/pull added). `.gitignore` — the
  one file excluded from byte-parity because deploy *merges* it — hand-audited: purely additive
  (PR #408's `.claude/settings.local.json` entry), **zero pre-existing entries dropped**.
  External signal (required for trust-boundary work per review.md §Cross-vendor caveat): upstream
  CHANGELOG v1.8.18–21 cross-checked for adopter migration steps — none missed, and it corrected
  F-1 from "new finding" to "known upstream #173". Two review limitations stated, not hidden:
  (a) no fresh-context reviewer was dispatched (same-session author reviewed own work);
  (b) the 202 deployed files were NOT line-by-line audited for malicious content — the applied
  control is provenance (`git ls-remote` tag sha over HTTPS against the canonical repo) plus
  202/202 byte-parity, which is the appropriate control for vendored framework code.
- test: 2306/2306 product tests + build PASS + both validators fail=0 + 9/9 upgraded-tool
  functional smoke (the gap byte-parity cannot cover: do the deployed tools *execute* here, under
  Python 3.14.3 vs upstream's declared 3.9 floor). Proved `guard_context_write.py` still rejects a
  stale `--expected-sha`. Two false-RED assertions in my own first smoke run were self-caught and
  corrected — asserting blanket `exit == 0` on tools with semantic exit codes manufactures red.
- ship: PASS. Ship History entry inserted at the TOP via `guard_context_write --mode replace`
  (never `--mode append` — that is `O_APPEND` and would silently bury it at the oldest position);
  post-write verified per the known stale-receipt hazard: 11 entries, mine first, prior v1.6.5
  second, `Project Name` intact, diff = +12/-1. Spec Index collapse (47 vs 30) and Ship History
  rotation (11 vs 10) deliberately deferred to the technical-debt pass with the reason recorded in
  the SSoT entry itself — both are newly unblocked by upstream fixes but are scope creep inside a
  supply-chain hotfix.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-15T00:00:00+08:00
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-15T23:10:00+08:00
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-15T23:18:00+08:00
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-15T23:32:00+08:00
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-15T23:41:00+08:00
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-15T23:52:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Upstream | `https://github.com/KbWen/agentic-os.git` | canonical framework source; v1.8.21 = `f5a161c` |
| Ship History | `.agentcortex/context/current_state.md` §Ship-codex-chore-upgrade-agentic-os-v1.8.17-2026-07-30 | prior upgrade procedure + preserved-scaffold list |
| ADR | `docs/adr/ADR-001-vnext-self-managed-architecture.md` | vNext self-managed architecture (no `applies_to:`) |
| Issue | `KbWen/agentic-os#336` | `validate.sh` exit-141 SIGPIPE on Windows — use `validate.ps1` |

---

## Known Risk

- **R1 — downstream-owned scaffolds overwritten.** Deploy may clobber the live project SSoT,
  Claude office hooks, `.agent/` project extensions, or the gitignored
  `downstream-capabilities.yaml`. Mitigation: byte-diff every deployed path against upstream
  source; restore any downstream-authored file; verify `current_state.md` unchanged.
- **R2 — `.acx-incoming` template residue.** Prior upgrade generated staged templates that had to
  be inspected and removed. Mitigation: explicit post-deploy scan.
- **R3 — validator regression.** New framework version may add checks this repo fails. Mitigation:
  capture `validate.ps1` baseline BEFORE deploy, compare after; treat new FAILs as blocking.
- **R4 — `validate.sh` cannot complete on Windows** (exit-141 SIGPIPE on work logs >64 KB, then
  MSYS fork exhaustion). Use pwsh7 `validate.ps1`; capture output OUTSIDE the repo.
- **R5 — Spec Index rotation is a trap.** `ship.md:197` tells you to rotate; `validate.{sh,ps1}`
  regex-scrape stops at the next `##` header and knows nothing about `## Spec Index Archive` →
  hard FAIL. NEVER rotate the Spec Index.

---

## Decisions

none

---

## Conflict Resolution

none — the conflict matrix was read once; no recommended pair is marked `partial-conflict` or
`conflict`. (`karpathy-principles` × `verification-before-completion` is explicitly `compatible`.)

---

## Skill Notes

### karpathy-principles (loaded /plan, `load_policy: phase-entry`, `cost_risk: low`)

- Checklist: state assumptions explicitly, don't pick silently between interpretations; minimum
  change that solves the problem; touch only what the request traces to; define success criteria
  and loop until verified.
- Constraint: **Surgical Changes** — do NOT "improve" adjacent framework or product code during a
  vendor upgrade. Every changed line must trace to the deployer's output or to a named AC.
- Applied here: the deploy is machine-driven; any hand-edit outside the 27-file delta is scope
  creep and gets reverted, not rationalized. The unscoped "tech debt" ask is surfaced, not guessed.

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- ADR coverage: `check_adr_coverage.py` returned `no_covering_adr` for `.agentcortex/` + `.agent/`.
  Per `bootstrap.md §0a`, the `no_covering_adr` (Exit 1) branch is **feature / architecture-change
  only** — skipped for `hotfix`. `docs/adr/` is non-empty, so the Exit 2 new-project check passes.
  Auxiliary: 8 ADRs lack `applies_to:` frontmatter (retro-fit candidate — logged, not actioned).
- Scope: second user ask ("優化技術債") deliberately held OUT of this hotfix's frozen scope
  pending its own classification. Not a skip — a scope boundary.

---

## Review Feedback

none

---

## Red Team Findings

### F-1 (MEDIUM, upstream) — **already known upstream as #173** — phantom SKIPs for source-only tools

> **Correction (found at /review via the upstream CHANGELOG, after F-1 was first written):** this is
> NOT a new finding. The v1.8.21 CHANGELOG entry for PR #410 already records the general case —
> *"the deployed validators reference **19 tools, 7 are absent, at least 4 deliberately**, and **no
> allowlist separates intent from oversight**"* — filed as upstream **#173**. It also states the
> `check_worklog_references.py` source-only decision follows the **#137 precedent**. So the correct
> downstream action is to attach this measurement to #173, not to open a new issue. What this repo
> adds that #173 does not record is the *operator-visible* symptom: 3 bare `-- tool not present`
> SKIPs sitting next to 2 self-explaining `-- CI-only … (safe to ignore downstream)` SKIPs in the
> same output.

Original detail retained below.



Both deployed validators call `.agentcortex/tools/check_worklog_references.py` unconditionally
(`validate.ps1:799`, `validate.sh:665`), but `deploy.sh`'s `_runtime_tools` whitelist
(`deploy.sh:739`) deliberately omits it — upstream PR #391's title says `(WARN, source-only)`.
Downstream therefore takes the `[[ ! -f "$script" ]]` branch (`validate.sh:175-178`) and records
`SKIP … -- tool not present`.

**Not a deployment defect here** — the deploy is complete per the framework's own whitelist. The
defect is that the message is indistinguishable from a broken deploy. The same output carries two
SKIP idioms:

- `-- CI-only validator not deployed (safe to ignore downstream)` ← honest, actionable
- `-- tool not present` ← ambiguous; 3 checks use it (skill provenance, audit chain integrity
  (INDEX.jsonl), worklog external references)

Notable: upstream merged `afa0600 docs(ship): stop promising adopters a chain check they do not
receive (#410)` in this same v1.8.21 wave — the same bug class, fixed only on the docs surface
while the validator still emits the phantom SKIP for `audit chain integrity (INDEX.jsonl)`.

**Risk decision**: accept downstream. Advisory-tier check, always exits 0, zero effect on gate
outcomes. Reported to the owner for upstream routing; NOT patched locally (patching vendored
framework files would break byte-parity with the source, which is AC-2).

**Correction to this Work Log's own plan**: the plan predicted a 27-file delta "26 M + 1 A
(`check_worklog_references.py`)". That new tool never deploys. Real delta = 30 tracked files
(the extra 3 are upstream path remaps `docs/AGENT_MODEL_GUIDE{,_zh-TW}.md` →
`.agentcortex/docs/`, plus the deploy-merged `.gitignore`).

### F-3 (MEDIUM, upstream) — `validate.sh` and `validate.ps1` disagree on the same repo

Ran both on identical tree state at v1.8.21. `validate.sh` → `pass=112 warn=7 fail=0 skip=5`;
`validate.ps1` → `pass=113 warn=7 fail=0 skip=5`. Label diff of the PASS sets:

- **P1 (missing check)**: `all docs/specs/ files have valid status frontmatter` exists in
  `validate.ps1` only. Accounts for the 113 vs 112. Frontmatter parsing is pure text — not a
  platform limitation.
- **P2 (contradictory result)**: `backlog label vocabulary` — `.sh` reports `2 distinct labels`,
  `.ps1` reports `1 distinct labels`, same `_product-backlog.md`. Row-status scope appears to
  differ (`.ps1` looks Pending-only; `.sh` appears to include In Progress). One is wrong.
- **P3 (contradictory result)**: `archive size within threshold` — `.sh` measures `1108KB`,
  `.ps1` measures `878KB`, same tree. ~230KB gap ≈ the `archive/work/` subdir; the two appear to
  disagree on whether that subdir counts.
- **P4 (scope drift)**: `.sh` says `shipped feature/arch-change work logs have non-placeholder
  Evidence sections`; `.ps1` says `shipped feature/arch-change/quick-win work logs …`. The `.ps1`
  enforces the Evidence floor on one more classification.
- **P5 (cosmetic, Windows)**: `validate.ps1` emits mojibake for `§` and `—` on the Windows console
  (`ADR-007 ??1b`, `monolith-extraction-map.md ?X downstream user content`). `.sh` renders clean.

### F-4 (RESOLVED upstream — recorded so the stale claims get corrected)

Two long-standing local blockers are **fixed in v1.8.21** and both are still recorded as broken in
this repo's SSoT / operator knowledge:

- **`validate.sh` exit-141 SIGPIPE on Windows** (upstream issue #336, SSoT Ship-chore-ssot-rotation
  entry says "unfixed in v1.8.11"). Now completes: exit 0, `Agentic OS integrity check passed`.
  The trigger condition is still present (2 files >64KB, `ship-history-2026.md` = 136KB), so this
  is a real fix, not an absent trigger.
- **Spec Index rotation trap** (SSoT Ship-chore-ssot-rotation entry: rotating produces 13 hard
  FAILs because the validators' regex stops at the next `##` and knows nothing about
  `## Spec Index Archive`). v1.8.21 validators now reference `Spec Index Archive` (2 occurrences
  each) and `ship.md:184` documents the collapse with an over-fold guard. Fixed upstream by
  `b5d2e29` (#381). **Unlocks the Spec Index tech-debt item** (currently 43 entries vs cap 30).

### F-2 (LOW, local) — 8 of 10 ADRs lack `applies_to:` frontmatter

`check_adr_coverage.py` reported ADR-001/002/003/004/005/006/009/010 as missing `applies_to:`.
They cannot participate in coverage matching, so `/bootstrap`'s ADR gate is structurally blind to
them. Pre-existing, not caused by this upgrade. Routed to the tech-debt candidate list, not fixed
inside this hotfix (scope discipline).

---

## Design Reference

none

---

## Observability

none

---

## Resume

none

---

## Test Gate Results

Classification `hotfix`, **zero product code changed** — so no new product tests were written
(writing them would be scope creep per `karpathy-principles` §3 Surgical Changes). The test surface
is regression + framework self-validation, plus one gap byte-parity provably cannot cover.

| Layer | Command | Result |
|---|---|---|
| Product regression | `npm test -- --run` | **114/114 files, 2306/2306 tests** (re-run at final ship state) |
| Production build | `npm run build` | PASS, bundle 496.50 kB (identical to v1.6.5) |
| Framework self-check (pwsh) | `.agentcortex/bin/validate.ps1` | `pass=113 warn=7 fail=0 skip=5` |
| Framework self-check (bash) | `bash .agentcortex/bin/validate.sh` | `pass=112 warn=7 fail=0 skip=5`, exit 0 |
| Upgraded-tool functional smoke | 9 assertions, see below | **9/9** |
| Adversarial (Red Team Lite) | supply-chain surface probe on the 241-insertion executable diff | clean — 0 new network / remote-exec calls |

**Why the functional smoke exists**: AC-2 byte-parity proves the deployed files are correct *copies*.
It cannot prove they *execute* on this host — notably under Python 3.14.3 against upstream's
declared 3.9 CI floor (upstream's own #164 records a `write_text(newline=)` 3.10+ hazard). Mirrors
the verification upstream performs by simulation in the v1.8.21 CHANGELOG.

Assertions (9/9): `check_ssot_caps.py` runs · `check_lesson_chain.py` runs · `append_lesson.py`
loads · `guard_context_write.py snapshot` · **`guard_context_write.py` REJECTS a stale
`--expected-sha`** (optimistic lock still bites; SSoT verified intact at 252 lines afterward) ·
`recover_worklog_lock.py ensure` round-trips · `check_adr_coverage.py` → exit 1 on an uncovered
path and **exit 0 + `covered_by:ADR-007,ADR-008`** on `src/systems/behaviorEngine.js` ·
`validate_downstream_capabilities.py` → exit 0 on the real manifest.

**Self-caught test defect (recorded, not hidden)**: the first smoke run reported 2 FAILs. Both were
defects in *my assertions*, not the tools — `check_adr_coverage.py` returns exit 1 as the documented
`no_covering_adr` *semantic*, and `validate_downstream_capabilities.py` takes a required file
argument (exit 2 = usage). Asserting a blanket `exit == 0` on tools with semantic exit codes
manufactures false red. Re-asserted against expected exit codes → 9/9.

---

## Evidence

- Upstream tag survey: `git ls-remote --tags` → latest formal release `v1.8.21` (`f5a161c`);
  vendored baseline `v1.8.17` (`102e19b`). Delta = 4 releases (v1.8.18–v1.8.21).
- Lock: `recover_worklog_lock.py ensure` → `{"exit_code": 0, "reason": "missing", "status": "created"}`.
- **AC-1 manifest**: `.agentcortex-manifest` → `version: 1.8.21` / `source_commit: f5a161c` /
  `source_repo: https://github.com/KbWen/agentic-os.git`. Deploy summary:
  `202 updated / 2 skipped / 0 new / 0 removed`.
- **AC-2 byte-verify**: 202/202 manifest entries byte-match the v1.8.21 source after CRLF
  normalization. 0 mismatch. Excluded 4 by design: `.agentcortex-manifest` (target-generated),
  `current_state.md` + `.claude/settings.json` (downstream-owned, correctly SKIPped),
  `.gitignore` (deploy merges downstream entries — not a pure copy).
- **AC-3 scaffold survival**: SSoT 252 lines, `Project Name: Agent Virtual Office`, git diff = only
  the bootstrap `Last Verified` line. `.claude/settings.json` → 8 `office-status-hook.js` hooks,
  zero diff. `downstream-capabilities.yaml` present. Both `.acx-incoming` sidecars inspected
  (generic placeholder template / hookless framework settings) and deleted; residue = 0.
- **AC-4 validator**: `pass=113 warn=7 fail=0 skip=5` (baseline `113 / 6 / 0 / 4`). **fail=0, no new
  FAIL category.** Both deltas explained, neither an upgrade regression:
  - `skip 4→5` = `worklog external references … -- tool not present` (see Red Team Findings F-1).
  - `warn 6→7` = `work log lock owner/phase mismatches detected: 1` — self-inflicted: the lock had
    advanced to `implement` while this Work Log header still read `plan`. Header corrected.
    This is the shared-contracts.md §Phase-Entry Lock enforcement teeth firing correctly.
- **AC-5 product untouched**: `git diff HEAD -- src/ tests/ package.json package-lock.json public/
  scripts/` → **0 files**. Vitest **114/114 files, 2306/2306 tests** pass. Build PASS, bundle
  **496.50 kB** — byte-identical to the v1.6.5 ship record.
- Real change set (git ground truth): **30 tracked files**, all framework-managed. Dry-run's
  "~199 files / all [UPDATE]" is not hash-aware and must not be read as a change count.
