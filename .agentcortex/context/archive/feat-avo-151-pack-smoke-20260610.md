# Work Log: feat/avo-151-pack-smoke

## Header

- Branch: `feat/avo-151-pack-smoke`
- Classification: `feature`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-10`
- Created Date: `2026-06-10`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Full`
- Current Phase: `review`
- Checkpoint SHA: `d75a12b`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `57`

---

## Session Info

- Agent: `claude-fable-5` (implementation delegated to sonnet acx-implementer)
- Session: `2026-06-10 23:00 UTC`
- Platform: `claude-code`

---

## Task Description

Stability-wave W3 (AVO-151): npm-pack install smoke — the npx-published tarball is a DIFFERENT
artifact than the git checkout (files whitelist, bin entrypoint, hook-inside-node_modules) and
no gate exercises it. Spec: `docs/specs/npm-pack-install-smoke.md` (AC-1..AC-5).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-10 | feature (new CI gate + tracked harness) |
| plan | done | 2026-06-10 | gate PASS in chat; spec written |
| implement | done | 2026-06-10 | delegated to sonnet |
| review | done | 2026-06-10 | PASS — 2 MED/LOW findings, no blockers |
| test | pending | — | AC-4 test-the-test is load-bearing |
| handoff | pending | — | — |
| ship | pending | — | — |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T23:00:00Z
- Gate: plan | Verdict: PASS | Classification: feature | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T23:05:00Z
- Gate: implement | Verdict: PASS | Classification: feature | Transition: PLANNED→IMPLEMENTED | Timestamp: 2026-06-10T14:50:00Z
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T23:40:00Z | fresh reviewer: AC-1..5 PROVEN; 1 MED (job timeout) + 3 LOW — all applied (timeout-minutes 15, sync-contract comment, spec 7→8 typo); POSIX grandchild-orphan LOW accepted (CI teardown covers)
- Gate: test | Verdict: PASS | Classification: feature | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T23:45:00Z | coordinator first-hand smoke:pack exit 0; suite 1543/1543
- Gate: handoff | Verdict: PASS | Classification: feature | Transition: TESTED→HANDEDOFF | Timestamp: 2026-06-10T23:50:00Z
- Gate: ship | Verdict: PASS | Classification: feature | Transition: HANDEDOFF→SHIPPED | Timestamp: 2026-06-10T23:55:00Z | SSoT seq 58; pack-smoke job first live run on this PR
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTED→REVIEWED | Timestamp: 2026-06-10T16:00:00Z

---

## Changes

- `scripts/pack-smoke.mjs` — new harness (AC-1): npm pack → temp install → assert 1-4
- `package.json` — add `"smoke:pack": "node scripts/pack-smoke.mjs"` only (AC-3/AC-5)
- `.github/workflows/ci.yml` — new `pack-smoke` job (ubuntu, node 22) (AC-2)

---

## Evidence

### Green path (Windows, 2026-06-10)
```
[pack-smoke] Assertion 1: PASS   — 8 events registered, hook file exists
[pack-smoke] Assertion 2: PASS   — no duplicates after second setup
[pack-smoke] Assertion 3: PASS   — hook exited 0, no non-benign stderr
[pack-smoke] Assertion 4: PASS   — dev server responded with HTML containing app mount
[pack-smoke] ALL ASSERTIONS PASSED
```

### AC-4 test-the-test (public/ removed from files whitelist)
```
FAIL [install-check]
  Hook source not found at: …\node_modules\agent-virtual-office\public\hooks\office-status-hook.js
  Check package.json "files" whitelist includes public/
EXIT CODE: 1
```
Harness exits non-zero as required; package.json restored immediately after.

### npm test
1543/1543 passed (72 test files). No test files touched.

### git diff --stat
 .github/workflows/ci.yml | 11 +++++++++++ 
 package.json             |  3 ++-
 2 files changed, 13 insertions(+), 1 deletion(-)

---

## Test Gate Results

- `npm test` → 1543/1543 PASS (pre-existing suite, no new tests added to suite)
- `npm run smoke:pack` → exit 0, all 4 assertions PASS

---

## Drift Log

- ADR Coverage Check: CI tooling, no runtime boundary → no ADR.
- Process fix landed separately this session: branch-protection required checks were EMPTY
  (red PR #89 merged); now test (20)/test (22)/render-smoke are required on main.

---

## Phase Summary

- bootstrap/plan: W3 spec'd — pack → temp install → setup idempotence + standalone hook + dev-mode
  boot + /api/health + AC-4 test-the-test. ⚡ ACX
- implement: scripts/pack-smoke.mjs + smoke:pack script + ci.yml pack-smoke job; 1543 tests green;
  AC-4 test-the-test confirmed non-zero exit on files omission. Confidence: 95% — high. ⚡ ACX
- review: PASS — AC-1..AC-5 all PROVEN; 2 non-blocking findings (MED: no timeout-minutes in CI job; LOW: HOOK_EVENTS ADD-drift gap); no false-green in DROP direction; security clean. ⚡ ACX
