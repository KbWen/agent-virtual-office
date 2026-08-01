# Work Log: codex/chore-upgrade-agentic-os-v1.8.17 — AVO-188 follow-up

## Header

- Branch: `codex/chore-upgrade-agentic-os-v1.8.17`
- Classification: `quick-win`
- Classified by: `codex`
- Frozen: `2026-07-30`
- Created Date: `2026-07-30`
- Owner: `KbWen`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `ac07a4d`
- Diff Base SHA: `802cf52`
- Recommended Skills: `systematic-debugging (auto), karpathy-principles (auto), verification-before-completion (auto)`
- Primary Domain Snapshot: `data-path`
- SSoT Sequence: `112`

---

## Session Info

- Agent: `codex`
- Session: `codex-20260730-avo188`
- Platform: `codex-desktop`
- Guardrails loaded: `Quick Mode bootstrap contract + security_guardrails.md; shared-contracts.md at phase entry`
- Override: `none`
- Downstream-Capabilities: `kb-main present but not routed; local movement/store evidence is sufficient`
- Context Read Receipt: `current_state.md sequence 111; backlog AVO-188 Pending; prior branch log archived; owner explicitly continued same branch`

---

## Task Description

Fix AVO-188: force-unstick, behavior-watchdog, and true component removal can leave a stationary agent with `isMoving: true`, causing AgentInspector to anchor to an abandoned target.

MFR:
1. Start an agent walk so store state has `isMoving: true`, a future `targetPosition`, and a non-null `journeyTarget`.
2. Trigger an abort path before arrival.
3. Actual: local walking and journey claim stop but store motion truth stays stale. Expected: atomically stop at the last rendered position without teleporting.

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | complete | 2026-07-30 | Backlog-confirmed honesty bug classified quick-win. |
| plan | complete | 2026-07-30 | Frozen spec defines one atomic abort action and deferred removal seam. |
| implement | complete | 2026-07-30 | Atomic action wired to two abort paths and deferred true-removal cleanup. |
| review | complete | 2026-07-30 | PASS — scope, atomicity, teardown ordering, and alias safety reviewed. |
| test | complete | 2026-07-30 | PASS — focused, full regression, build, soak, and validator checks. |
| handoff | exempt | — | quick-win exempt. |
| ship | complete | 2026-07-30 | Commit `ac07a4d`; spec/backlog/SSoT updated; evidence archived. |

## Phase Summary

- bootstrap: PASS — one data-path transition plus its existing component consumers; no route or product-design change.
- plan: PASS — Confidence 96%; one store action prevents three abort paths from drifting while preserving the symmetric teardown contract.
- implement: PASS — focused tests prove original-position preservation, defensive copies, true-removal abort, and live teardown skip.
- review: PASS — no correctness, security, data-loss, governance, or out-of-scope findings.
- test: PASS — 111 test files / 2271 tests, build, forced-spawn soak, and validator all passed.
- ship: PASS — commit `ac07a4d`; AVO-188 marked Shipped; SSoT sequence 112; local branch retained without push/PR.
- Sentinel: ⚡ ACX

## Gate Evidence

- Gate: bootstrap | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-30T21:50:00+08:00 | Evidence: backlog AVO-188 and source inspection confirm two abort paths clear only local/journey state while `setAgentArrived` is the sole store action clearing motion.
- Gate: plan | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-30T21:52:00+08:00 | Evidence: active owner-matched Work Log, rollback base `802cf52`, and frozen plan artifact `docs/specs/avo-188-abort-movement-in-place.md`.
- Gate: implement | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-30T23:37:00+08:00 | Evidence: store/component changes plus focused regressions; 3 files and 67 tests passed.
- Gate: review | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-30T23:38:00+08:00 | Evidence: `git diff --check` clean; all changed lines trace to the frozen spec; stationary removal guarded; no actionable findings.
- Gate: test | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-30T23:41:00+08:00 | Evidence: focused 67/67; Vitest 111/111 files and 2271/2271 tests; build PASS; soak PASS; validator 113 PASS / 0 FAIL.
- Gate: ship | Verdict: PASS | Classification: quick-win | Timestamp: 2026-07-30T23:42:00+08:00 | Evidence: bootstrap, plan, implement, optional review/test receipts complete; commit `ac07a4d`; rollback and evidence recorded.

## External References

- Backlog: `docs/specs/_product-backlog.md` AVO-188.
- Audit snapshot: `docs/reviews/2026-07-23-optimization-handoff.md`.

## Known Risk

- The symmetric React effect also tears down live fibers; aborting synchronously in cleanup would recreate the July soak regression.
- Rollback: revert only AVO-188 spec/store/component/test changes after `802cf52`; preserve the existing `.gitignore` state and untracked audit handoff.

## Conflict Resolution

- Systematic debugging owns root-cause proof; Karpathy limits the patch to one action and its consumers; verification owns completion evidence.

## Security Findings

none

## Red Team Findings

none

## Skill Notes

#### plan/implement/review/test — systematic-debugging
- Checklist: pin stale store motion before changing code.
- Checklist: preserve live teardown restoration while handling true removal.
- Constraint: do not use `setAgentArrived`, because it teleports to the abandoned waypoint.

#### plan/implement/review — karpathy-principles
- Checklist: one named store action, two abort call sites, one deferred removal seam.
- Checklist: reuse existing focused test files.
- Constraint: no movement-system, pathfinding, Inspector, or broad component refactor.

#### implement/test/ship — verification-before-completion
- Checklist: scope, focused tests, full regression, build, evidence, rollback.
- Checklist: prove defensive copy, no teleport, live teardown skip, and true-removal abort.
- Constraint: no completion claim while a required check fails.

## Drift Log

- Recovered: prior same-branch AVO-190 log is archived; a fresh branch-key log is required for this work unit.
- Owner explicitly continued same-branch execution; no branch switch performed.
- Ship archive collision: earlier same-branch tasks already use the canonical branch/date names; archive this work unit as `codex-chore-upgrade-agentic-os-v1.8.17-avo188-20260730.md`.
- SSoT Spec Index remains above its advisory cap (45/30); prior ship evidence records that the documented archive subsection conflicts with completeness validation, so no unsafe rotation was attempted.

## Design Reference

none — store/component correctness only.

## Observability

none

## Resume

none

## Test Gate Results

- Focused Vitest: PASS — 3 files, 67 tests.
- Full Vitest: PASS — 111 files, 2271 tests.
- `npm run build`: PASS.
- `npm run soak:spawn -- --minutes 0.02`: PASS — 5 samples, 0 invariant violations.
- `.agentcortex/bin/validate.ps1`: PASS — 113 PASS, 7 WARN, 0 FAIL, 4 SKIP.

## Evidence

- Baseline: branch `codex/chore-upgrade-agentic-os-v1.8.17` at `802cf52`; pre-existing `.gitignore` status and untracked audit handoff remain out of scope.
- Root cause: `AgentCharacter.jsx` force-unstick and behavior-watchdog paths clear local refs and `journeyTarget` but never clear store `isMoving`; synchronous symmetric cleanup cannot safely abort because it also runs on live replaced fibers.
- Implementation: `abortAgentMovement` atomically copies the rendered position into store truth; two explicit aborts call it; true removal defers one microtask while live teardown reconnect cancels by clearing the unmounted ref.
- Focused evidence: `rafWatchdog`, `journeyDeconfliction`, and `agentInspector` suites PASS — 67/67.
- Ship evidence: implementation commit `ac07a4d`; AVO-188 backlog/spec shipped; SSoT sequence 111→112; Ship History kept at 10 entries with the oldest moved verbatim to the 2026 archive.

## Decisions

none
