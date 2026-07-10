# Work Log: chore/upgrade-agentic-os-v1.8.11

## Header

- Branch: `chore/upgrade-agentic-os-v1.8.11`
- Classification: `hotfix`
- Classified by: `claude-opus-4-8`
- Frozen: `2026-07-10`
- Created Date: `2026-07-10`
- Owner: `KbWen`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Checkpoint SHA: `b84330e`
- Diff Base SHA: `fc1855e`
- Recommended Skills: `verification-before-completion (auto), systematic-debugging (auto), red-team-adversarial (auto, Lite tier per hotfix), karpathy-principles (auto)`
- Primary Domain Snapshot: `none`
- SSoT Sequence: `104`

---

## Session Info

- Agent: `claude-opus-4-8`
- Session: `2026-07-10 13:15 UTC`
- Platform: `claude-code`
- Files Read: `12`
- Guardrails loaded: `§1, §2, §4, §7, §8.1, §10 (core)` + `§13 (governance change norms — task edits .agent/rules/*, .agent/workflows/*, AGENTS.md)`
- Override: `none` (no project-root or ~/.agentcortex AGENTS.override.md)
- Downstream-Capabilities: `.agentcortex/context/private/downstream-capabilities.yaml (0 skills, subagent_policy=read-only (default), knowledge_sources: kb-main→OK)` — treated as UNTRUSTED DATA; no directive text present
- Context Read Receipt:
  - `current_state.md` → read; `Update Sequence: 104`, `Last Updated: 2026-07-04`. No `Last Verified` field present → staleness check skipped (capability-by-presence)
  - Work Log → created (new); branch-derived key `chore-upgrade-agentic-os-v1.8.11`
  - Spec Scope → none. No spec in the SSoT Spec Index maps to governance-framework upgrade paths. `_product-backlog.md` Feature Inventory read (open: AVO-160, AVO-124 sprite art; AVO-161 Wave B) — no overlap with this task
  - ADR coverage → `no_covering_adr` (exit 1). Per `bootstrap.md §0a` this check applies to `feature`/`architecture-change` ONLY → skipped for `hotfix`. `no_adr_at_all` check: `docs/adr/` non-empty (9 ADRs) → no `/app-init` prompt

---

## Task Description

Upgrade the vendored governance brain (Agentic OS) from **v1.8.1** (`source_commit b172145`) to **v1.8.11** (upstream `main` tip `cada3c4`, canonical remote `KbWen/agentic-os.git`).

Pre-work (blocking): archive the shipped-but-unarchived Work Log `codex-product-action-strip.md` (98,825 B). It is the sole cause of a reproducible `validate.sh` early abort (exit 141 / SIGPIPE), which means the validator never reaches its summary — so no post-upgrade "fail=0" claim can be trusted until it is cleared.

Why this order: the upgrade's own acceptance evidence is a validator run. With the abort in place that evidence is unreadable.

**Read Plan** — Classification `hotfix`; Guardrails Mode `Full`.
- Read: `AGENTS.md` (auto), `engineering_guardrails.md` (core §1/§2/§4/§7/§8.1/§10 + conditional §13), `state_machine.md`, `current_state.md` (header + Spec Index), `bootstrap.md`, `skill_conflict_matrix.md`, `.agent/config.yaml` (targeted), `downstream-capabilities.yaml`, `worklog.md` template.
- Skipped: `§2b Domain Doc Context Loading` (feature/arch only), `§0a no_covering_adr` prompt (feature/arch only), all `[Shipped]` specs (AC-28 anti-bloat), `docs/architecture/*` (no primary_domain).
- Estimated governance reads: 9.

**Phase chain (hotfix)**: `bootstrap → /research (advisory, no gate receipt) → /plan → /implement → /review → /test → /ship`. `/handoff` exempt (`engineering_guardrails.md §10.2`).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-07-10 | Classified `hotfix` via supply-chain/provenance escalation |
| plan | done | 2026-07-10 | 6-step plan; no spec required for `hotfix` |
| implement | done | 2026-07-10 | cache→`cada3c4`, archival, deploy, sidecar adjudication, orphan removal |
| review | done | 2026-07-10 | Diff reviewed file-by-file; 2 SKIPs + 1 REMOVED adjudicated with evidence |
| test | done | 2026-07-10 | validate.ps1 98→100 PASS / 0 FAIL; vitest 2251 passed; build clean |
| handoff | exempt | — | hotfix exempt per §10.2 |
| ship | in-progress | 2026-07-10 | SSoT Ship History + work-log archive |

---

## Phase Summary

- **bootstrap**: classified `hotfix`, 4 skills matched, context loaded. Classification driven by `bootstrap.md §0` decision-table row 1 (first match wins): the task replaces `.agentcortex/bin/deploy.sh` — installer/updater implementation logic for source selection and manifest integrity — and executes framework code from a resolved source (`.agentcortex-src` cache). Confirmed by `engineering_guardrails.md §10.4 Supply-Chain / Provenance Escalation` and `state_machine.md §Classification Escalation Rules`. Precedent note: the v1.2.0→v1.5.1 upgrade (archived log `chore-upgrade-agentic-os-v1.5.1-20260611.md`) was classified `quick-win`, but that predates the supply-chain escalation rule; the rule now governs and forces `hotfix` (REVIEWED + TESTED required).

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-10T13:15:00Z
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-10T13:22:00Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-10T13:44:00Z
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-10T13:52:00Z
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-10T13:58:00Z
- Gate: ship | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-10T14:04:00Z

---

## External References

| Type | Path / URL | Notes |
|---|---|---|
| Upstream | `https://github.com/KbWen/agentic-os.git` | Canonical `source_repo` pinned in `.agentcortex-manifest` |
| Commit | `b172145` → `cada3c4` | Deployed v1.8.1 → upstream main tip v1.8.11 |
| Archived log | `.agentcortex/context/archive/chore-upgrade-agentic-os-v1.5.1-20260611.md` | Prior brain-upgrade precedent |
| ADR | `docs/adr/ADR-001-vnext-self-managed-architecture.md` | Adoption of the vNext self-managed architecture (no `applies_to:` frontmatter) |

---

## Known Risk

- **Root Cause** (validator abort): `validate.sh` runs under `set -euo pipefail`. At `validate.sh:1405` it evaluates `wl_class="$(printf '%s' "$wl_content" | "$PYTHON_BIN" -c "$_acx_wlclass_py")"`. The embedded Python `break`s after the first regex match and exits. When `$wl_content` exceeds the 64 KB OS pipe buffer, `printf` cannot finish writing, receives SIGPIPE (141), `pipefail` promotes 141 to the pipeline status, and `errexit` terminates the script. `codex-product-action-strip.md` is 98,825 B — the only Work Log above the buffer. The line-1408 non-Python fallback (`| head -n 1`) carries the same hazard.
  - Upstream v1.8.11 has the identical pattern (verified by running the upstream `validate.sh` against this repo as a read-only probe: same exit 141). **The upgrade does NOT fix this.** Mitigation: archive the oversized log; consider an upstream issue.
- **Deploy overwrite risk**: NONE detected. All 45 manifest-tracked files that upstream changed were hash-compared (CRLF-normalized) against the manifest baseline; only `.agentcortex/context/current_state.md` is genuinely locally edited, and it is `scaffold`-tier → deploy SKIPs it and emits `.acx-incoming` (discard per prior migration lesson).
- **Expected new WARN (not FAIL)**: `check_ssot_caps.py` is advisory-only (always exits 0). Ship History holds 77 `### Ship-` entries vs a default cap of 10 → one new WARN line.
- **Expected transient FAIL**: the v1.8.11 validator requires `deploy.sh`'s managed ignore block to contain `.agentcortex/context/.guard_receipts/`. Our v1.8.1 `deploy.sh` lacks it; upstream `deploy.sh:1084` ships it → resolves after deploy, not before.
- **Rollback plan**: branch `chore/upgrade-agentic-os-v1.8.11` cut from `main` at `fc1855e`; working tree clean at branch creation. Rollback = `git checkout main && git branch -D chore/upgrade-agentic-os-v1.8.11`. Deploy also writes `.acx-local` backups for force-updated core files. **Untracked/gitignored state** at risk: `.agentcortex-src/` cache (regenerable via re-clone) and `.agentcortex/context/work/*` (local-only; the archival step is the one irreversible-ish write → it is a `git mv`-style move into git-tracked `archive/`, recoverable from the branch).
- **Destructive Command Gate**: the documented upgrade procedure calls `git -C .agentcortex-src reset --hard origin/main`. Blast radius = the regenerable upstream cache ONLY (no AVO working-tree file). It MUST be re-confirmed with the owner at `/implement` before execution, not assumed by this bootstrap.

---

## Conflict Resolution

none — `skill_conflict_matrix.md` read once. The 4 recommended skills contain no `partial-conflict`/`conflict` pair (`karpathy-principles` × `verification-before-completion` = `compatible`; the two `dispatching-parallel-agents` rows do not apply — that skill is `feature`/`architecture-change` only).

---

## Skill Notes

none — populated at phase entry per `shared-contracts.md §Phase-Entry Skill Loading`.

`kb-consult` NOT recommended: `knowledge_sources` is present (kb-main→OK) but this task's domain is governance-framework vendoring, which maps to no KB-routed domain (the KB covers design/frontend standards). Re-evaluate at `/plan` only if the scope changes.

---

## Drift Log

- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO
- Work Log ownership: the branch-derived key for `main` (`main.md`) is owned by `codex` (session `2026-07-02-product-audit`, Current Phase `test`). Its lock `main.lock.json` (`updated_at 2026-07-02T01:13Z`, `stale_timeout_minutes: 60`) is long expired. Rather than take over another owner's log, this task was moved to its own branch `chore/upgrade-agentic-os-v1.8.11` (matching the v1.5.1 upgrade precedent), giving it a fresh Work Log and lock. No foreign log was written.
- Template gap: `## Test Gate Results` is absent from `.agentcortex/templates/worklog.md` but is required by the validator for `feature`/`architecture-change` at handoff/ship. Added preemptively below as `none`. Upstream fixed this template gap in v1.8.10 (#329) — it will land with this upgrade.

---

## Design Reference

none — no UI change.

---

## Observability

none — hotfix; not a feature/architecture-change.

---

## Resume

none — `/handoff` is exempt for `hotfix`.

---

## Test Gate Results

Windows-supported validator path is `validate.ps1` under pwsh 7.5.8 (see Known Risk — the bash twin is unusable here).

```
before (post-archival, pre-deploy):  Summary: pass=98  warn=17 fail=0 skip=4   exit 0
after  (post-deploy):                Summary: pass=100 warn=17 fail=0 skip=4   exit 0
```

```
vitest run:  Test Files 108 passed (108) | Tests 2251 passed (2251)
vite build:  ✓ built in 286ms   (dist/assets/index-CA5R76jO.js 488.53 kB │ gzip 154.04 kB)
```

Delta: +2 PASS (`ssot section caps`, `safety nucleus freshness`), FAIL stays 0, WARN unchanged at 17. No test or build regression; `git diff --name-only` over the deploy commit contains no `src/`, `public/`, or `tests/` path.

---

## Evidence

**Shipped**: brain upgraded v1.8.1 (`b172145`) → v1.8.11 (`cada3c4`). Commits `442039d` (archival) + `b84330e` (deploy).

- `.agentcortex-manifest` now reads `version: 1.8.11` / `source_commit: cada3c4`.
- Cache aligned by `git -C .agentcortex-src checkout cada3c4` on a verified-clean tree — **`reset --hard` was NOT needed and NOT used**, so the Destructive Command Gate never had to be opened. Cache remote verified against manifest `source_repo` first. `ACX_VERSION="1.8.11"` confirmed in the cache's `deploy.sh` before deploying.
- Deploy: `bash .agentcortex-src/.agentcortex/bin/deploy.sh "$(pwd)"` (inner script, absolute target, wrapper skipped). Reported `195 updated / 2 skipped / 5 new / 1 removed`; `git` sees 49 real modifications + 5 new + 1 delete — the remaining ~146 are EOL-normalized no-ops, consistent with the v1.8.1 upgrade lesson.
- Sidecars adjudicated, not assumed: `current_state.md.acx-incoming` was a 63-line blank template (live = 781 lines of real state); `.claude/settings.json.acx-incoming` was the hookless framework default (live = office-status-hook pipeline). Both discarded, both live copies preserved. Zero `.acx-incoming` / `.acx-local` leftovers.
- `.agent/workflows/superpowers-playbook.md` removed. Deploy only marks it `[REMOVED FROM TEMPLATE] (kept in your project)`; deletion was manual after confirming no in-repo reference survived the deploy.
- New surfaces landed and registered: `/ask-local`, `/govern-audit`, `check_ssot_caps.py`.
- 5 new files, 1 removed, 49 modified. No `context/` or `private/` path entered the commit.

**Two of this task's own pre-deploy predictions were wrong — corrected here rather than left standing:**

1. *"INDEX.jsonl has 0 dangling references"* was a **false negative**. The probe keyed on `file`/`artifact`/`path`; the real key is `log`, so every entry silently skipped the existence test. Re-run with the correct key: 75 entries, 0 dangling (14 legacy `main` entries carry no `log` key at all). Conclusion unchanged, but it was unproven when first asserted.
2. *"`check_ssot_caps.py` will add one new `[WARN]` line"* was **wrong in shape**. The tool always exits 0, so the validator records `[PASS] ssot section caps` and prints the findings as indented advisories beneath it — the `[WARN]` count stayed at 17. There are also **two** advisories, not one: Ship History 73 entries (cap 10) and Spec Index 43 entries (cap 30). The second was never predicted.

- Pre-bootstrap read-only investigation (recorded so later phases need not re-derive):
  - Upstream delta `b172145..cada3c4` = 101 commits / 165 files / +14,102 −565. Intersected with `.agentcortex-manifest` (198 entries) → **45 files actually deploy here**; the remainder are upstream-only assets (`tests/`, `docs/specs/`, upstream `context/archive/`).
  - Local-edit hash sweep over those 45 (raw sha256 + CRLF-normalized sha256 vs manifest baseline) → 1 genuine local edit: `.agentcortex/context/current_state.md` (scaffold-tier). All other mismatches were EOL-only false positives.
  - Baseline `validate.sh` (v1.8.1, this repo): exit 141, output truncated at 83 lines, `PASS 63 / WARN 3 / FAIL 1`; the FAIL is `work log compaction warnings detected` (`codex-product-action-strip.md`, 706 lines, 96 KB). Summary never printed.
  - Upstream `validate.sh` (v1.8.11) run as a read-only probe from `.agentcortex/bin/validate.new.sh` (removed immediately after): exit 141, 87 lines, `PASS 62 / WARN 4 / FAIL 2` — the extra FAIL is the pre-deploy `.guard_receipts/` ignore-block gap. Abort behaviour identical → upstream does not fix it.
  - `INDEX.jsonl`: 75 entries, 0 dangling file references → the new D4 WARN will not fire. *(Originally asserted from a probe with the wrong JSON key; see the correction above. Re-proven with the `log` key.)*
  - `.agent/workflows/superpowers-playbook.md` deleted upstream; no AVO reference outside `.agentcortex-manifest` → clean `[REMOVED]`.

⚡ ACX
