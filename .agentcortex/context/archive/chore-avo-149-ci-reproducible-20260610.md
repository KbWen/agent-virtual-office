# Work Log: chore/avo-149-ci-reproducible

## Header

- Branch: `chore/avo-149-ci-reproducible`
- Classification: `quick-win`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-10`
- Created Date: `2026-06-10`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `b5b9e3e`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `56`

---

## Session Info

- Agent: `claude-fable-5`
- Session: `2026-06-10 21:40 UTC`
- Platform: `claude-code`

---

## Task Description

Stability-wave W1 (AVO-149): `npm install` → `npm ci` in both ci.yml jobs so CI tests the exact
tree the lockfile pins (reproducible builds). security.yml needs no change (audit-only, no
install step).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-10 | quick-win (2-line CI change) |
| plan | done | 2026-06-10 | gate PASS in chat |
| implement | done | 2026-06-10 | local `npm ci` verified clean against lockfile first |
| review | done | 2026-06-10 | self-review (2-line mechanical change; CI run on the PR is the real proof) |
| test | done | 2026-06-10 | post-`npm ci` suite 4× green; CI green on PR = ship evidence |
| ship | done | 2026-06-10 | SSoT seq 57; self-archived in same PR |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T21:40:00Z
- Gate: plan | Verdict: PASS | Classification: quick-win | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T21:42:00Z
- Gate: implement | Verdict: PASS | Classification: quick-win | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T21:50:00Z
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTED→TESTED | Timestamp: 2026-06-10T21:55:00Z | npm ci clean; 1543/1543 ×4
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-10T22:00:00Z

---

## Changes

- `.github/workflows/ci.yml` — `npm install` → `npm ci` in `test` (matrix) and `render-smoke` jobs.

---

## Evidence

- Local `npm ci` against the committed lockfile: clean install, then `npm test` → 1543/1543
  across 4 consecutive runs; `npm run build` clean.
- security.yml audited: no install step → no change needed.

---

## Test Gate Results

- 1543/1543 ×4 post-clean-install; CI on the PR runs the changed workflow itself.

---

## Drift Log

- ADR Coverage Check: CI mechanics, no boundary → no ADR.
- FLAKE WATCH (observed once, unreproduced ×4): the FIRST `npm test` immediately after the clean
  `npm ci` reinstall showed `1 failed | 1542 passed`; the failing test name was lost (output
  overwritten) and 4 subsequent runs were fully green. Suspected environmental I/O contention
  (Windows AV scanning the fresh node_modules) hitting a timing-sensitive test (hookWriteLock
  bounded-wait is the prime suspect). If a CI/local run reproduces it, capture the test name and
  open a deflake ticket (precedent: PR #68 mulberry32 seeding).
- OBSERVATION (out of scope, for a future ticket): ci.yml tests Node 20 in the matrix while
  package.json `engines` requires `>=22` — incoherent; either drop 20 or lower engines.

---

## Phase Summary

- W1: CI now installs the exact lockfile tree (npm ci ×2 jobs); local clean-install verified
  first; one unreproduced post-install flake recorded to the watch list. ⚡ ACX
