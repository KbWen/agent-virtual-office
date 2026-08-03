# Work Log: main release audit

## Header

- Branch: `main`
- Classification: `hotfix`
- Classified by: `codex`
- Frozen: `2026-07-16`
- Created Date: `2026-07-16`
- Owner: `codex-release-audit`
- Guardrails Mode: `Full`
- Current Phase: `test`
- Diff Base SHA: `d7911e0eb6a8df9ed5b43d36c9606e74dc72c917`
- Checkpoint SHA: `c840e86d0c9d8d09499dc8ee7db283cf3413ac1f`
- Recommended Skills: `systematic-debugging, test-driven-development, verification-before-completion, red-team-adversarial`
- Primary Domain Snapshot: `movement-simulation`
- SSoT Sequence: `90`

---

## Session Info

- Agent: `codex`
- Session: `2026-07-16-release-audit`
- Platform: `codex`
- Files Read: `24+ targeted files and remote CI evidence`
- Guardrails loaded: §1, §2, §4, §5, §7, §8.1, §10 (core + review/testing)
- Override: none

---

## Task Description

Review current `main` for correctness, security, and release readiness. Audit the committed range `v1.6.4..HEAD`, current public release state, and active CI signals; do not modify product code or publish a release without a separate user decision.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-07-16 | Synced `origin/main`; recovered existing branch context through a session-specific Work Log variant. |
| plan | complete | 2026-07-16 | Scope: `v1.6.4..HEAD`, full local gates, public release state, nightly soak history. |
| implement | complete | 2026-07-16 | Added bounded sample-coverage policy, report-before-fail ordering, and focused regression tests. |
| review | complete | 2026-07-16 | PASS: bounded coverage and report-before-fail behavior are focused, tested, and movement-neutral. |
| test | complete | 2026-07-16 | PASS: focused, integration, full regression, diff, and governance checks pass. |
| handoff | exempt | — | Hotfix classification. |
| ship | pending | — | Not authorized; fresh scheduled 10-minute soak still required for a release decision. |

---

## Phase Summary

- bootstrap: hotfix classification because the post-tag range includes supply-chain/provenance governance tooling; current `main` equals `origin/main`.
- plan: release burden of proof defined as packaged delta, full local gates, long-run reliability, and distribution consistency.
- implement: no implementation performed; review-only request.
- review: NOT READY — packaged app checks pass, but 32 consecutive scheduled soak failures leave long-run reliability unproven and include a recent six-stack-violation report; routed back to implement.
- implement: added `soakCoverage.mjs`, integrated coverage/reporting into `sim-soak.mjs`, and added three boundary tests; movement logic untouched.
- review: PASS — the remediation accepts bounded timer jitter, rejects material under-sampling, writes diagnostics before failing coverage, and does not alter movement evaluation.
- test: PASS — 15 focused tests, short integration soak, 2254-test regression suite, diff check, and governance validator all pass.
- ⚡ ACX

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-16T03:12:00Z
- Gate: plan | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-16T03:13:00Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-16T03:14:00Z
- Gate: review | Verdict: NOT READY | Classification: hotfix | Transition: REVIEWED→IMPLEMENTING | Timestamp: 2026-07-16T03:15:00Z
- Gate: implement | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-16T03:20:00Z
- Gate: review | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-16T03:23:49Z
- Gate: test | Verdict: PASS | Classification: hotfix | Timestamp: 2026-07-16T03:25:42Z

---

## External References

- Base: tag `v1.6.4` (`d7911e0`); movement contract: `docs/adr/ADR-004-no-per-frame-agent-separation.md`.
- CI: runs `29446997725` (latest false-red), `28475274296` (six-stack artifact), `27477847094` (last success).
- Distribution: GitHub Releases latest is v1.6.0 although tags reach v1.6.4.

---

## Known Risk

- The soak evaluator can find real stationary overlaps, but the runner's near-perfect sample-count gate now exits before evaluation and report writing. This creates both false-red noise and blind spots.
- `README.md`, `README.zh-TW.md`, and `docs/INTEGRATIONS.md` still contain `npx agent-virtual-office` commands although ADR-009 states npm publication is deliberately disabled; users receive npm E404.
- Windows validation selects an unusable Microsoft Store `python3.exe` alias before a working `python.exe`; full validation needs a PATH workaround on affected hosts.

---

## Conflict Resolution

- Systematic debugging governed diagnosis; Lite red-team stayed within changed trust boundaries.

---

## Skill Notes

- Checklist: reproduce first; isolate HOME/cache; verify boundary tests and changed trust surfaces.
- Constraint: no movement patch or release while long-run reliability remains blocked.

---

## Drift Log

- Existing `.agentcortex/context/work/main.md` belongs to an older session and is at `test`; used owner-specific `codex-release-audit-main.md` rather than overwrite prior evidence.
- 2026-07-16 implement authorization: user requested a quick, budget-conscious fix. Scope frozen to soak sample coverage/reporting only; protected movement logic and release operations excluded.
- MFR: (1) run the scheduled 10-minute soak, (2) ordinary timer jitter yields 2393–2397 samples, (3) runner exits before invariant evaluation/reporting because minimum is 2398. Expected: bounded jitter accepted and diagnostics always written; actual: false-red and missing artifact.
- Default test run touched restricted user-home paths; reran with isolated workspace HOME to distinguish environment failures from code failures.
- Default pack smoke touched restricted npm cache; reran with isolated cache and approved network access.
- Backlog registration deferred to `/spec-intake` because this review produced multiple candidate fixes and user selection is required before modifying `docs/specs/_product-backlog.md`.

---

## Review Feedback

### Burden of Proof

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| B-1 | Post-v1.6.4 packaged product delta | ✅ PROVEN | `git diff --name-only v1.6.4..HEAD`: zero paths covered by `package.json.files`; only governance/SSoT maintenance. |
| B-2 | Current build/test/package health | ✅ PROVEN | 2251/2251 Vitest; Vite build; 4-viewport render smoke; tarball install/setup/idempotency/hook/boot smoke all pass. |
| B-3 | Long-run movement reliability | ✗ RELEASE BLOCKER | 32 consecutive scheduled soak failures since 2026-06-14; 2026-06-30 artifact has 6 `sustainedStack` violations. A fresh scheduled 10-minute run is required. |
| B-4 | Public release consistency | ⚠️ PARTIAL | Git tag/changelog/package version are v1.6.4, but GitHub Releases still reports v1.6.0 latest; npm package is intentionally absent. |

### Findings

- HIGH (resolved) — `sim-soak.mjs`: two-miss coverage threshold caused false-reds and suppressed reports; use bounded jitter and report-before-fail.
- HIGH (open) — `soakInvariants.mjs`: six historical sustained stacks require a fresh 10-minute run before movement or release action.
- MEDIUM — Releases lags tags (v1.6.0 vs v1.6.4); publish v1.6.4 rather than inventing v1.6.5.
- MEDIUM — README/integration `npx` commands target the deliberately unpublished npm package; use the GitHub specifier.
- MEDIUM — `validate.ps1` selects an unusable Windows Store `python3` alias before working `python`.
- LOW — hook tests touch real HOME; isolate it. `v1.6.4..HEAD` also has two trailing-whitespace paths.
- LOW — `git diff --check v1.6.4..HEAD`: trailing blank lines in `.gitignore` and `.agentcortex/context/current_state.md`.

### Remediation Review

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| R-1 | Ordinary scheduled-run jitter is accepted | ✅ PROVEN | Unit boundary accepts 2393/2400 samples; required minimum is 2388. |
| R-2 | Material under-sampling remains fail-closed | ✅ PROVEN | Unit boundary rejects 2387/2400 samples; short-run boundary rejects 234/240. |
| R-3 | Failure diagnostics survive the coverage gate | ✅ PROVEN | `evaluateSoak` and report writing now precede the coverage exception; reproduced failure report contained both coverage and invariant totals. |
| R-4 | Protected movement behavior is unchanged | ✅ PROVEN | Diff is limited to the soak runner, a pure coverage helper, and focused tests; `soakInvariants.mjs` is untouched. |
| R-5 | Regression safety | ✅ PROVEN | 15 focused tests, 0.25-minute integration soak, and all 2254 tests pass. |

- Remediation findings: none. The unresolved historical sustained-stack signal remains a release-readiness risk and requires a fresh scheduled 10-minute soak; it is not hidden or weakened by this runner fix.

---

## Security Findings

- 2026-07-16 /review: 0 findings. Secret/conflict scan clean; no packaged dependency manifests changed after v1.6.4; pack install audited 43 packages with 0 vulnerabilities.
- 2026-07-16 remediation /review: 0 findings. No dependency, command-execution, credential, external-input, or packaged-runtime surface was added.

---

## Red Team Findings

- 2026-07-16 /review: 0 security findings in Lite mode. The deploy change strengthens preserved-file provenance baselines and fails closed when the downstream SSoT template is absent; no new remote execution path or credential surface found.
- 2026-07-16 remediation /review: 0 findings in Lite mode. The fixed allowance is bounded at five samples for short runs and 0.5% for long runs; explicit reject-boundary tests prevent silent tolerance expansion.

---

## Design Reference
none
## Observability
none
## Resume
none
## Test Gate Results

| Gate | Verdict | Evidence |
|---|---|---|
| Scope | PASS | Exactly `scripts/sim-soak.mjs`, `scripts/soakCoverage.mjs`, and `tests/soakCoverage.test.js`; no movement evaluator or package manifest changes. |
| Quality | PASS | 15 focused tests; 59/60-sample integration soak; all 2254 regression tests; `git diff --check`; validator fail=0. |
| Evidence | PASS | Reproducible commands and results are recorded below. |
| Risk | PASS | Release remains on hold pending a scheduled 10-minute soak. Rollback: revert the three scoped files. |
| Communication | PASS | Report fix separately from release readiness; do not claim or publish a release. |

---

## Evidence

- `git fetch origin --prune`; `git rev-list --left-right --count main...origin/main` → `0 0`; HEAD `c840e86`.
- Isolated HOME `npm test` → 108 files passed, 2251 tests passed; `npm run build` → PASS; `npm run smoke` → 4 viewports, 0 page/console errors.
- Isolated cache `npm run smoke:pack` → all four assertions passed; 43 packages audited, 0 vulnerabilities.
- PATH workaround `pwsh ... validate.ps1` → pass=110, warn=6, fail=0, skip=4; default PATH reproduces unusable `python3.exe` alias crash.
- GitHub Actions: main CI + Security Scanning PASS at `c840e86`; sim-soak has 32 consecutive failures, last success 2026-06-13.
- Latest available soak artifact (2026-06-30): 2394 samples, 6 sustained-stack violations, 0 teleport/frozen-walker/off-floor violations.
- TDD Red: `npx vitest run tests/soakCoverage.test.js` failed on missing helper, then on the short-run boundary before the fixed allowance was implemented.
- Focused Green: `npx vitest run tests/soakCoverage.test.js tests/soakInvariants.test.js` → 2 files, 15 tests passed.
- Integration: 0.25-minute spawned soak → 59/60 samples, coverage sufficient, 0 invariant violations, report written with coverage diagnostics.
- Regression: isolated-HOME `npm test` → 109 files, 2254 tests passed.
- Final test gate: focused suite → 2 files, 15 tests passed; `git diff --check` → no errors; governance validator → pass=109, warn=7, fail=0, skip=4.
