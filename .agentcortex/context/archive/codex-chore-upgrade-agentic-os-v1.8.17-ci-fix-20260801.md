# Work Log: PR #204 CI follow-up

## Header

- Branch: `codex/chore-upgrade-agentic-os-v1.8.17`
- Classification: `quick-win`
- Classified by: `Codex GPT-5`
- Frozen: `2026-07-31`
- Created Date: `2026-07-31`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Diff Base SHA: `31c804859f3bca9f8fe351443acf5a0fdee78c41`
- Checkpoint SHA: `cfabe93298867f5eb9f7fc4279522e7f29559f09`
- Recommended Skills: `systematic-debugging, verification-before-completion, github:gh-fix-ci`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `114`

## Session Info

- Agent: `Codex GPT-5`
- Session: `2026-07-31T04:40:00+08:00`
- Platform: `Codex App`
- Files Read: `8`
- Guardrails loaded: `session cache + shared phase contracts`
- Override: `none`

## Task Description

- Unblock PR #204's two observed GitHub Actions failures with the smallest reproducible config/lock correction.

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-07-31T04:39:03+08:00 | Quick-win; no product behavior change. |
| plan | done | 2026-07-31T04:39:03+08:00 | Two-file CI repair. |
| implement | done | 2026-07-31T04:39:03+08:00 | Two surgical data changes complete. |
| review | done | 2026-07-31T04:42:00+08:00 | Diff and official integrity provenance PASS. |
| test | done | 2026-07-31T04:43:00+08:00 | Audit, build, bundle gate, and 2295-test regression PASS. |
| ship | done | 2026-08-01T12:19:25+08:00 | GitHub CI/security green; archival and merge next. |

## Phase Summary

- bootstrap: PR #204 CI follow-up classified quick-win; failures are an intentional bundle-baseline delta and one patched transitive dependency. ⚡ ACX
- plan: update only `scripts/bundle-budget.json` and `package-lock.json`; no product source or dependency-range change. ⚡ ACX
- implement: measured bundle baseline and one transitive PostCSS lock entry updated; product/dependency ranges unchanged. ⚡ ACX
- review: PASS — exact CI values, official patched version/tarball integrity, JSON validity, scope, and rollback verified. ⚡ ACX
- test: PASS — PostCSS 8.5.18/0 vulnerabilities, production build, exact bundle budget, and 112 files/2295 tests all green. ⚡ ACX
- ship: PASS — CI repair `cfabe93` passed all CI/security jobs; archive `.agentcortex/context/archive/codex-chore-upgrade-agentic-os-v1.8.17-ci-fix-20260801.md`; closure: Merge now. ⚡ ACX

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-31T04:39:03+08:00
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-31T04:39:03+08:00
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-31T04:42:00+08:00
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-31T04:42:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-01T12:15:39+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-08-01T12:19:25+08:00

## External References

- PR: `https://github.com/KbWen/agent-virtual-office/pull/204`
- Spec: `docs/specs/avo-187-temporal-doorway-claim.md`
- Advisory: `GHSA-r28c-9q8g-f849` (PostCSS <=8.5.17; patched 8.5.18)

## Known Risk

- Bundle baseline could hide unrelated growth; set it to the measured single-bundle total only and retain the existing +10% future-growth gate.
- Lockfile-only PostCSS patch must preserve Vite's `^8.5.15` range and official registry SHA-512; rollback by reverting the CI-fix commit.

## Plan

1. Rebase bundle baseline to the verified `496504`-byte production output and date it.
2. Replace only the PostCSS lock entry with official 8.5.18 URL/integrity.
3. Verify local install shape, build, bundle gate, focused/full tests, validator, then push and wait for GitHub checks.

## Decisions

- D-1: Use a lockfile-only transitive patch; do not add a direct PostCSS dependency. → local

## Conflict Resolution

- CI logs and official advisory/package tarball are authoritative; no speculative dependency or budget refactor.

## Skill Notes

- `systematic-debugging`: observe exact failures, isolate two causes, change one bounded surface per cause, rerun both gates.
- `verification-before-completion`: scope, all checks, exact evidence, rollback, concise communication.
- Constraint: no product code, no `npm audit` project-metadata upload, no broad dependency update.

## Drift Log

- Prior AVO-187 ship log is archived at `.agentcortex/context/archive/codex-chore-upgrade-agentic-os-v1.8.17-20260731.md`; this is the required follow-up active log.
- GitHub CLI token was invalid; GitHub App connector supplied PR/job/log evidence.
- Automated policy rejected sending the project dependency graph to npm. Safer alternative downloaded only the public official PostCSS 8.5.18 tarball and computed its SHA-512 locally.
- Recovered stale Work Log lock on 2026-08-01T04:15:47.544510+00:00; prior_owner=KbWen; prior_session=2026-07-31T04:40:00+08:00; reason=stale-time; lock=codex-chore-upgrade-agentic-os-v1.8.17.lock.json

## Review Feedback

- No finding: `package-lock.json` changes only version/resolved/integrity for Vite's existing `^8.5.15` PostCSS dependency.
- No finding: bundle budget retains +10% gate and rebases only to the exact built byte count requested by CI.

## Red Team Findings

- GitHub Security Scanning identified GHSA-r28c-9q8g-f849 in transitive PostCSS 8.5.15; patch target 8.5.18 is confirmed by the GitHub Advisory Database.

## Security Findings

- RESOLVED HIGH: PostCSS lock entry pins patched 8.5.18 with verified official tarball SHA-512; GitHub Dependency Audit #360 passed.

## Resume

none

## Test Gate Results

- `npm ci` — 70 packages installed; 71 audited; 0 vulnerabilities.
- `npm ls postcss --all` — Vite resolves PostCSS 8.5.18.
- `npm run build && node scripts/bundle-budget.mjs` — 77 modules; 496504 bytes; baseline +0.00%; PASS.
- `npm test -- --maxWorkers=2` — 112 files, 2295 tests passed.

## Evidence

- CI bundle job: `496504` bytes vs `495075` limit; job explicitly requires a justified baseline rebase.
- CI dependency audit: PostCSS `<=8.5.17` HIGH; patched version `8.5.18`.
- Official tarball: `postcss-8.5.18.tgz`, 50,862 bytes, integrity `sha512-xdB1oSLHbz1vRWgCDalrCqEFTWzFlhqFC5tIHLMOSUIjhm3XXQ1qrFy8S/ESr1JYRRXqM3c1QFiMZUJdUTqyMQ==`.
- Fresh verification 2026-08-01: `npm ci` reported 0 vulnerabilities; PostCSS 8.5.18 resolved; build/bundle gate and 2295-test suite passed.
- CI fix commit: `cfabe93 fix(ci): clear PR 204 release gates`; exactly `package-lock.json` and `scripts/bundle-budget.json`.
- GitHub Actions: CI #451 passed `test (22)`, `test (24)`, `pack-smoke`, and `render-smoke`; Security #360 passed npm audit, Semgrep, and TruffleHog.
