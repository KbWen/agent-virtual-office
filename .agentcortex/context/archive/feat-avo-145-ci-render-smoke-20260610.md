# Work Log: feat/avo-145-ci-render-smoke

## Header

- Branch: `feat/avo-145-ci-render-smoke`
- Classification: `feature`
- Classified by: `claude-fable-5`
- Frozen: `2026-06-10`
- Created Date: `2026-06-10`
- Owner: `claude-fable-5 (luvseldom)`
- Guardrails Mode: `Full`
- Current Phase: `ship`
- Checkpoint SHA: `00ac003`
- Recommended Skills: `none`
- Primary Domain Snapshot: `ci-infra`
- SSoT Sequence: `50`

---

## Session Info

- Agent: `claude-fable-5` (implementation delegated to sonnet acx-implementer per owner "簡單的可以丟給sonnet")
- Session: `2026-06-10 11:00 UTC`
- Platform: `claude-code`

---

## Task Description

Hardening-wave H1 (AVO-145): a tracked headless-Playwright render-smoke harness + CI job so the
PR #71 failure class (app dead, CI green — no jsdom, nothing renders in CI) becomes a blocking
gate instead of a manual habit. Spec: `docs/specs/ci-render-smoke.md` (AC-1..AC-6).

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-10 | feature (new CI gate + tracked harness; touches ci.yml + package.json) |
| plan | done | 2026-06-10 | gate PASS in chat; spec written first (plan artifact rule) |
| implement | done | 2026-06-10 | sonnet acx-implementer; subagent died mid-report → ALL verification re-run first-hand by coordinator |
| review | done | 2026-06-10 | fresh acx-reviewer → PASS (independently reproduced both canary classes; 4 LOW advisories, none blocking) |
| test | done | 2026-06-10 | AC-6 canary exit 1 / clean exit 0; vitest 1462/1462; CI live run on PR = ship evidence |
| handoff | done | 2026-06-10 | Resume block below |
| ship | done | 2026-06-10 | SSoT seq 51; backlog AVO-145 Done; self-archived in same PR |

---

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: feature | Transition: NEW→CLASSIFIED | Timestamp: 2026-06-10T11:00:00Z
- Gate: plan | Verdict: PASS | Classification: feature | Transition: CLASSIFIED→PLANNED | Timestamp: 2026-06-10T11:05:00Z
- Gate: implement | Verdict: PASS | Classification: feature | Transition: PLANNED→IMPLEMENTING | Timestamp: 2026-06-10T11:40:00Z | AC-6 canary exit 1 + clean exit 0 coordinator-verified; 1462/1462
- Gate: review | Verdict: PASS | Classification: feature | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-06-10T12:10:00Z | fresh acx-reviewer; AC-1..6 all PROVEN (burden-of-proof table); ground-truthed server.mjs:119/132/555; both canary classes reproduced; 4 LOW only
- Gate: test | Verdict: PASS | Classification: feature | Transition: REVIEWED→TESTED | Timestamp: 2026-06-10T12:15:00Z | vitest 1462/1462; smoke exit 0/1 proven
- Gate: handoff | Verdict: PASS | Classification: feature | Transition: TESTED→HANDEDOFF | Timestamp: 2026-06-10T12:20:00Z
- Gate: ship | Verdict: PASS | Classification: feature | Transition: HANDEDOFF→SHIPPED | Timestamp: 2026-06-10T12:25:00Z | SSoT seq 51; PR for merge after CI (render-smoke job's first live run = part of ship evidence)

---

## Changes

Planned target files:
1. `docs/specs/ci-render-smoke.md` — spec (done, this commit).
2. `scripts/render-smoke.mjs` — tracked harness (NOT in npm `files`).
3. `.github/workflows/ci.yml` — `render-smoke` job.
4. `package.json` — `playwright` devDependency + `smoke` script.
5. `docs/specs/_product-backlog.md` — AVO-145 → Done at ship.

---

## Evidence

> Implementation by sonnet acx-implementer (agent a0d6d54d78f45c0de); the subagent terminated
> mid-report after its own AC-6 run, so ALL verification below was INDEPENDENTLY re-executed by
> the coordinator (fable-5) — evidence is first-hand, not relayed.

- Healthy build: `npm run build && npm run smoke` → `render-smoke PASS — svg rendered (2145 descendants), 0 pageerrors, 0 console errors`, exit 0.
- **AC-6 test-the-test** (coordinator-run): appended `throw new Error('smoke-test-canary')` to `ControlPanel.jsx` → build → smoke:
  `AC-1 FAIL: office <svg> did not appear within 15000ms` / `AC-2 FAIL: svg has only 0 descendants` / `pageerror: smoke-test-canary` → **exit 1**.
  `git checkout -- src/` → rebuild → smoke → `PASS (1839 descendants)`, **exit 0**. src/ verified clean after revert (git status).
- ErrorBoundary marker verified against `src/components/ErrorBoundary.jsx` (en fallback "Something went wrong"; boundary also emits console.error → double detection).
- Server choice documented in harness header: `node server.mjs` (real prod artifact, serves /api/* so polling can't 404-noise).

---

## Test Gate Results

- `npx vitest run` → **1462 passed / 68 files** (unchanged — zero src/tests modifications in final diff).
- `npm run smoke` healthy → exit 0; canary → exit 1 (AC-6, outputs above).
- CI job green on PR: pending (recorded at ship).

---

## Drift Log

- ADR Coverage Check: CI tooling addition, no runtime architecture boundary change; behavior
  contract lives in the spec → no ADR required.

---

## Resume

### Read Map
- docs/specs/ci-render-smoke.md (AC-1..6) · scripts/render-smoke.mjs · .github/workflows/ci.yml render-smoke job.
### Skip List
- Local `scripts/*-shot.mjs` stay gitignored conveniences — do NOT fold them into the harness (Non-Goal).
### Context Snapshot
- Gate is live in CI after PR merge. Review LOW advisories (acceptable, documented): unawaited
  browser.close; 500ms-settle means steady-state-poll-only crashes are out of scope (spec Non-Goal);
  fixed port 5199 fails loud not false-green; npm install (not ci) is correct for devDeps here.
  Next wave item: H2 (AVO-146 whitelist unification).

## Phase Summary

- bootstrap/plan: H1 classified feature; spec `ci-render-smoke.md` written with AC-6
  test-the-test as the honesty anchor (the gate must be PROVEN to catch the #71 class).
- implement→ship: harness + CI job landed (d0dbbfe); sonnet implementer's death mid-report handled
  by full first-hand re-verification; fresh review PASS with both canary classes independently
  reproduced; vitest 1462/1462; shipped with SSoT seq 51 + self-archival in the same PR. ⚡ ACX
