# Work Log: chore/upgrade-agentic-os-v1.8.24

## Header

- Branch: `chore/upgrade-agentic-os-v1.8.24`
- Classification: `hotfix`
- Classified by: `claude-opus-5`
- Frozen: `true`
- Created Date: `2026-08-25`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Diff Base SHA: `381c7a1d74aeef0a5b3fd7c1f71137d67492695d`
- Checkpoint SHA: `95a8b69fbb3f45725236aa053c53628e0580b1c2`
- Recommended Skills: `verification-before-completion (auto), red-team-adversarial (auto, Lite for hotfix), karpathy-principles (auto), systematic-debugging (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `116`

---

## Session Info

- Agent: `claude-opus-5`
- Session: `2026-08-25 claude-code`
- Platform: `claude-code`
- Files Read: `12`
- Guardrails loaded: `AGENTS.md §Core Directives + engineering_guardrails.md §10 + shared-contracts.md + repo-gotchas.md`
- Context Read Receipt:
  - `current_state.md` -> read; Last Verified `2026-08-15`, Update Sequence `116`
  - Work Log -> created
  - Spec Scope -> `none` (no product spec covers a governance-framework vendor upgrade)

---

## Task Description

Upgrade the vendored Agentic OS governance framework from **v1.8.21** (`f5a161c`) to the latest
upstream release **v1.8.24** (`a6b04a2`) from canonical `KbWen/agentic-os.git`. Classified
`hotfix` under the **Supply-Chain / Provenance Escalation** rule
(`engineering_guardrails.md §10.4`): the change replaces framework code this repo executes,
resolved from a remote source.

Second user ask ("find something to do to validate the new brain") is a SEPARATE task, classified
on its own after this hotfix ships. It is NOT folded into this frozen scope.

Phase chain (hotfix): `bootstrap -> plan -> implement -> review -> test -> ship`. `/handoff` exempt.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-08-25 | classified `hotfix`; branch cut from `main` @ `381c7a1` |
| plan | done | 2026-08-25 | delta sized by manifest-intersect: 14 modified + 1 new; 5 steps |
| implement | done | 2026-08-25 | deploy 202 updated / 2 skipped / 1 new / 0 removed; audit-chain migrated |
| review | done | 2026-08-25 | PASS; 203/205 byte-parity; 2 SKIPs verified correct |
| test | done | 2026-08-25 | vitest 2309/2309; both validators fail=1 (documented transient) |
| handoff | n/a | — | hotfix exempt (`engineering_guardrails.md §10.2`) |
| ship | done | 2026-08-25 | SSoT entry at top (10/10 cap held); oldest rotated; log archived |

---

## Phase Summary

- bootstrap: classified `hotfix` (supply-chain escalation). Upstream tag resolved and verified by
  `git ls-remote` (`v1.8.24^{}` = `a6b04a2436edf88a193bbe43217e3efbbd7a9ba9`), shallow clone HEAD
  byte-matches. Pre-deploy validator baseline captured OUTSIDE the repo. No code changes.

- plan: sized the true downstream delta by intersecting the upstream `v1.8.21..v1.8.24` tree diff
  (**46 changed paths**) with this repo's 204-entry `.agentcortex-manifest`, including the
  `.agentcortex/docs/` <- upstream-root remap -> **14 modified deployed files**. The other 32 are
  upstream's own repo state (its SSoT, work-log archives, `tests/ci/`, `.github/`, `.test_durations`)
  and never deploy. Separately diffed the deploy whitelist itself (`deploy.sh` `runtime_tools` +
  `deploy_manifest_golden.txt`) because a manifest-intersect is blind to files that become newly
  deployable -> **exactly 1 new file, `check_audit_chain.py`** (204 -> 205 entries). Ran the new
  tool against live state BEFORE deploying, which is what turned R3 from a hypothesis into a
  measurement. `--dry-run` was run and its output deliberately NOT used for sizing: it is not
  hash-aware and labelled all 101 enumerated files `[UPDATE]`. Mode Normal. | Confidence: 92%.
- implement: deployed v1.8.24 via the provenance-verified source clone's own `deploy.sh`
  (`202 updated / 2 skipped / 1 new / 0 removed`). Resulting tracked change set = **17 paths**,
  exactly the predicted 14 + manifest + `.gitignore` + the 1 new tool; **zero product files**.
  The 2 SKIPs were the correct ones and were inspected, not assumed: the SSoT sidecar was the blank
  `[Describe your project in one line]` template and the `.claude/settings.json` sidecar carried
  **0 hooks** against this project's **8** `office-status-hook.js` entries — both would have
  destroyed project content. Sidecars deleted. `.gitignore` is merged rather than copied by deploy,
  so it was hand-audited: `git diff` is **empty** (EOL-only churn), so it was restored rather than
  committed as a no-op. Then ran the documented v1.8.22 upgrade migration for the audit chain.

- review: PASS. Burden of Proof 5/5 PROVEN. **Provenance** — `git ls-remote` resolved
  `v1.8.24^{}` = `a6b04a2436...` over HTTPS against the canonical repo before any fetch; the clone
  HEAD is that sha. **Byte-parity** — 203/205 manifest entries match the source after CRLF
  normalization; the 2 that do not are exactly the 2 deliberate SKIPs. `.agentcortex/docs/README.md`
  initially showed as unresolved and was chased rather than waved through: `deploy.sh:989` sources it
  from the upstream **root** `README.md`, and it hashes identical there. **Security** — the entire
  241-line executable diff introduces zero new network or remote-exec surface (the one `exec` match
  is `find -exec ls` for portable file sizing); the new `check_audit_chain.py` has no network,
  subprocess, or eval surface at all; `scan_credentials.py` exit 0. The `git fetch --depth=1` in the
  witness check is **pre-existing**, not added by this upgrade — checked against the added lines
  rather than assumed. **Governance surfaces read, not just deployed** — `AGENTS.md` (1 line: Write
  Isolation now legalizes the `Pending -> In Progress` backlog advance that `bootstrap.md §1` step 5
  already mandates) and `ship.md` (2 lines: `check_audit_chain.py` is now deployed downstream, so the
  prose promising adopters a check they never received is corrected). Both match the upstream
  CHANGELOG rationale.
  Review limitations, stated rather than hidden: (a) no fresh-context reviewer was dispatched — the
  same session that ran the deploy reviewed it; (b) the 202 deployed files were NOT line-by-line
  audited for malicious content. The applied control is provenance plus 203/205 byte-parity, which
  is the appropriate control for vendored framework code, not a substitute for reading it.
- test: vitest **115/115 files, 2309/2309 tests**, zero product files touched. Both validators run
  post-deploy: `validate.ps1 pass=113 warn=6 fail=1 skip=5`, `validate.sh pass=112 warn=7 fail=1
  skip=5` (baselines 113/6/0/5 and 112/7/0/5). The single FAIL is identical in both twins and is the
  documented transient append-only witness. It was **proved to clear, not asserted to**: a scratch
  clone with `origin/main` advanced to this commit runs the deployed `validate.sh` end-to-end and
  returns `[PASS] INDEX.jsonl append-only witness -- baseline is a prefix of local` with
  `fail=0`. Limitation of that proof, stated: the sim clone has no gitignored work logs, so its
  overall tally (95/6/0/6) is not comparable — it proves the witness line, nothing else.
  Also measured, as the actual downstream benefit rather than a version-number bump:
  `audit chain integrity` went `SKIP -- tool not present` -> `PASS`; the three bare
  `-- tool not present` SKIPs now carry their own reason; and the permanent
  `token lifecycle baseline absent ... seed with update_lifecycle_baseline.py --init` WARN, which
  named a tool this tree does not contain, is gone. The first two are upstream's fix for finding
  **F-1 that this repo itself filed during the v1.8.21 upgrade**.

- ship: PASS. Ship History entry inserted at the **top** via `guard_context_write --mode replace`
  (never `--mode append` — that is `O_APPEND` and would bury it at the oldest position), then
  post-write re-read and diff-verified per the known stale-receipt hazard: 10 entries, mine first,
  `Project Name` intact, sequence 116 -> 117, diff +13/-8. The section was already at its 10/10 cap,
  so the oldest entry (`Ship-avo-187-...-2026-07-31`) was rotated verbatim into
  `archive/ship-history-2026.md`, newest-first, with its own rotation note; it carries no relative
  links, so the depth hazard does not apply. Commit `95a8b69`.
  One process slip worth recording because it is a repeat-shaped trap: the Bash tool's cwd persists
  across calls, and a `cd` into the gitignored `.agentcortex-src` cache left a later **relative**
  verification path reading the *upstream* `ship-history-2026.md` instead of this project's. The
  write itself used absolute paths and was correct; only the check was aimed at the wrong tree. It
  was caught because the content read back was visibly upstream's (`v1.8.19 release`, `PRs #387-#393`)
  rather than this repo's. Verify-after-write is what caught it; the durable form is **absolute
  paths for verification reads in any session that cd's into a nested repo**.

⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-25T00:00:00+08:00
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-25T14:40:00+08:00
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-25T15:10:00+08:00
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-25T15:25:00+08:00
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-25T15:35:00+08:00
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-08-25T15:50:00+08:00

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Upstream | `https://github.com/KbWen/agentic-os.git` | canonical framework source; v1.8.24 = `a6b04a2` |
| Ship History | `.agentcortex/context/current_state.md` §Ship-chore-upgrade-agentic-os-v1.8.21 | prior upgrade procedure |
| Archive | `.agentcortex/context/archive/chore-upgrade-agentic-os-v1.8.21-20260815.md` | prior upgrade Work Log |

---

## Known Risk

- **R1 — downstream-owned scaffolds overwritten.** Deploy may clobber the live project SSoT, the 8
  `office-status-hook.js` entries in `.claude/settings.json`, or `.agent/` project extensions.
  Mitigation: byte-diff every deployed path against upstream source; verify the 2 known SKIPs; scan
  for `.acx-incoming` residue.
- **R2 — `.acx-incoming` template residue.** Both prior upgrades staged sidecars that would have
  destroyed project content. Mitigation: explicit post-deploy scan + inspect before delete.
- **R3 — validator regression (CONFIRMED PRE-DEPLOY, not hypothetical).** v1.8.22 newly deploys
  `check_audit_chain.py` and both validators invoke it. Measured against this repo's live
  `INDEX.jsonl` BEFORE deploying: **exit 1, 16 errors** — lines 1-16 (2026-04..2026-06, pre-chain
  era) carry no `prev_sha`; lines 17-93 are correctly chained. This is upstream's documented
  *recoverable* upgrade case, not a broken chain. Mitigation: run the documented
  `append_chain_entry.py migrate`, verify lines 17-93 are byte-unchanged, commit.
- **R4 — new `.gitignore` SSoT-artifact probe (v1.8.24).** Pre-checked: all four protected probes
  (`archive/*.md`, `docs/specs/`, `docs/adr/`, `current_state.md`) return not-ignored, and
  `rev-parse --show-prefix` is empty (no outer-repo case). Expected PASS, verified after deploy.
- **R5 — Spec Index rotation trap is DEAD as of v1.8.21** (upstream `b5d2e29`/#381); both
  validators know `## Spec Index Archive`. Not re-litigated here; no rotation performed in this
  hotfix regardless.

---

## Decisions

none

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
- Verification aimed at the wrong tree once: a persistent-cwd `cd` into the gitignored
  `.agentcortex-src` cache made a relative-path read return the upstream repo's
  `ship-history-2026.md`. Caught by reading the content, not by trusting the path. Write was
  absolute and unaffected. Remedy applied: absolute paths for verification reads.
- Scope: the user's second ask ("find something to do to validate the new brain") is deliberately
  held OUT of this hotfix's frozen scope and classified separately. Not a skip — a scope boundary.

---

## Review Feedback

none

---

## Red Team Findings

none

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

none

---

## Evidence

- **Deploy**: `202 updated / 2 skipped / 1 new / 0 removed`; manifest `version: 1.8.24` /
  `source_commit: a6b04a2`; 205 entries (was 204).
- **Byte-parity**: 203/205 match source after CRLF normalization; 2 mismatches = the 2 SKIPs.
- **Audit-chain migration**: `append_chain_entry.py migrate` -> `{"status": "ok", "migrated": 16}`;
  `check_audit_chain.py` -> `audit chain intact`, exit 0. Structural diff: 93 entries, 16 changed,
  only `prev_sha` added, lines 17-93 byte-identical.
- **Product tests**: `npx vitest run` -> `Test Files 115 passed (115) / Tests 2309 passed (2309)`.
- **Validators post-deploy**: `validate.ps1 pass=113 warn=6 fail=1 skip=5`;
  `validate.sh pass=112 warn=7 fail=1 skip=5`; single identical FAIL = append-only witness.
- **Post-merge simulation** (scratch clone, `origin/main` -> this commit): deployed `validate.sh`
  exit 0, `[PASS] INDEX.jsonl append-only witness -- baseline is a prefix of local`, `fail=0`.
- **Security**: `scan_credentials.py` exit 0; zero new network/remote-exec surface in the
  241-line executable diff.
- **Provenance**: `git ls-remote --tags https://github.com/KbWen/agentic-os.git` ->
  `v1.8.24^{} = a6b04a2436edf88a193bbe43217e3efbbd7a9ba9`; clone HEAD `a6b04a2` identical.
- **Pre-deploy validator baseline**: `validate.ps1` -> `pass=113 warn=6 fail=0 skip=5`.
- **Pre-deploy audit-chain probe**: `check_audit_chain.py --path .agentcortex/context/archive/INDEX.jsonl`
  -> exit 1, `audit chain BROKEN ... (16 error(s))`, all `missing 'prev_sha'` on lines 1-16 of 93.
