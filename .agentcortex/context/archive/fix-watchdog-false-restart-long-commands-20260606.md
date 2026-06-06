# Work Log: fix-watchdog-false-restart-long-commands

## Header

- Branch: `fix/watchdog-false-restart-long-commands`
- Classification: `quick-win`
- Classified by: `claude`
- Created Date: `2026-06-06`
- Owner: `claude`
- Guardrails Mode: `Quick`
- Current Phase: `ship`
- Checkpoint SHA: `221c45d`
- Recommended Skills: `systematic-debugging, code-review`
- Primary Domain Snapshot: `office-runtime`
- SSoT Sequence: `33`

---

## Session Info

- Agent: `claude`
- Session: `2026-06-06 PR #56 review + finish`
- Platform: `claude-code`
- Files Read: AgentCharacter.jsx, idleGapInfer.js, constants.js, store.js, idleGapInfer.test.js, package.json, review.md, security_guardrails.md, shared-contracts.md
- Guardrails loaded: `AGENTS.md, security_guardrails.md, shared-contracts.md, review.md`

---

## Task Description

PR #56 (external fork, `duongynhi000005-oss`) fixes #50: during a long-running bash
command (no state update >90s) the **behavior watchdog** misreads the unchanged
behavior value as a dead scheduling chain and force-restarts it, resetting the
agent's visual posture. Original PR: skip the restart when status is active
(working/thinking/blocked/awaiting-approval); plus dead-code removal in idleGapInfer.

Maintainer follow-up (this session): extract the skip decision to a pure testable
helper, add `planning`, clean up the orphaned `INFERRED_STATUSES` constant + stale
docstring, add unit tests, document the lockfile regeneration.

---

## Phase Sequence

| Phase | Status | Entered | Notes |
|---|---|---|---|
| bootstrap | done | 2026-06-06 | quick-win; SSoT + (missing) worklog recovered. |
| implement | done | 2026-06-06 | Follow-up commit `221c45d` on the fork branch. |
| review | done | 2026-06-06 | 5-axis + security clean; 1 MEDIUM advisory, 1 LOW accepted. |
| test | done | 2026-06-06 | 1289/1289 pass (54 files); +13 watchdog cases; adversarial skipped (quick-win). |
| ship | done | 2026-06-06 | SSoT Ship History + heartbeat (seq 33→34) via guard; squash-merged; #50 closed. |

---

## Phase Summary

- review: PASS — quick-win behavioral burden-of-proof all PROVEN; security clean (no new deps, lockfile regen only); 1 MEDIUM advisory (two-watchdog scope clarification — fix targets the behavior watchdog, not the walk/RAF watchdog that emits the console warning), 1 LOW accepted (behavior watchdog suppressed for full active-session lifetime; mitigated by doSchedule always rescheduling + stuck-walk retry + ambient-status test coverage).
- test: PASS — `npx vitest run` 1289/1289 (54 files); +13 `behaviorWatchdog.test.js` cases (active-session skip, ambient not-skipped, group-event, defensive); adversarial skipped (quick-win); build clean. Next: `/ship` (after owner merge decision).
- ship: PASS — SSoT Ship History entry + heartbeat (seq 33→34, Last Updated 2026-06-06) via `guard_context_write.py` (receipts recorded); branch synced with `origin/main` (merged Tailwind `src/index.css`); squash-merged PR #56 to main; issue #50 closed; worklog archived.

---

## Gate Evidence

- Gate: review | Verdict: PASS | Classification: quick-win | Transition: IMPLEMENTING→REVIEWED | Timestamp: 2026-06-06T14:35:00+08:00
- Gate: test | Verdict: PASS | Classification: quick-win | Transition: REVIEWED→TESTED | Timestamp: 2026-06-06T14:40:00+08:00
- Gate: ship | Verdict: PASS | Classification: quick-win | Transition: TESTED→SHIPPED | Timestamp: 2026-06-06T14:50:00+08:00

---

## Burden of Proof

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| B1 | Long-running command no longer force-restarts the behavior chain | ✅ PROVEN | `constants.js:22` `shouldSkipBehaviorWatchdog` returns true for working/thinking/blocked/awaiting-approval/planning; `AgentCharacter.jsx:1049` early-returns on it; `behaviorWatchdog.test.js` active-session cases (5) pass |
| B2 | Watchdog still recovers a GENUINELY dead chain (idle/ambient) | ✅ PROVEN | `behaviorWatchdog.test.js` asserts idle/done/unknown → false (not skipped); regression guard against over-suppression |
| B3 | Group-event skip behavior unchanged after consolidation | ✅ PROVEN | helper ORs `inGroupEvent`; test covers inGroupEvent×{idle,done} → true and false→ambient |
| B4 | idleGapInfer dead-code removal is behavior-preserving | ✅ PROVEN | guard was provably unreachable (outer cond restricts status); `idleGapInfer.test.js` (unchanged) 100% pass; grep confirms `INFERRED_STATUSES` had no other caller |
| B5 | No supply-chain risk from lockfile diff | ✅ PROVEN | diff = only `"dev":true` removals + version 1.1.0→1.2.1 + engines; 0 new pkgs, 0 integrity/resolved changes (all registry.npmjs.org); fixes pre-existing `npm ci` drift on main |

---

## Security Findings

OWASP A01–A10 + secret scan on changed files: **clean**.
- A02 secrets: none in src/ changes.
- A06 dependencies: `package-lock.json` regenerated — NO new dependency, NO version/integrity/registry change (pure `"dev":true` flag move + header). Manifest `package.json` unchanged. Not a supply-chain vector; corrects a pre-existing lockfile/package.json drift that breaks `npm ci`.
- A03/A04: pure front-end predicate over a status string; no injection/trust-boundary surface.

---

## Review Feedback

- **MEDIUM (advisory, not blocking)** `AgentCharacter.jsx` — there are TWO watchdogs. The fix targets the **behavior watchdog** (`:1043`, 90s, resets posture) which matches issue #50's "no updates >90s → wrong posture". The **walk/RAF watchdog** (`:791`, 1.5s on dropped frames while walking) is the one that emits `recordWatchdogRestart()` + the `[watchdog] restarted...` console warning that #50 also paraphrases. That second symptom is a different trigger (frame drops, not 90s idle) and is reasonably out of scope — flagged so closure is a conscious decision. Recommend confirming on the PR.
- **LOW (accepted)** The behavior watchdog is now suppressed for the agent's entire active-session lifetime. If `doSchedule` truly died mid-work, no auto-recovery. Real risk low: `doSchedule` always reschedules (`AgentCharacter.jsx:1006`), stuck-walk has `BEHAVIOR_STUCK_RETRIES`, and ambient statuses keep the watchdog armed. A heartbeat-based watchdog (tick counter in doSchedule) would be the robust long-term design — noted in PR body, deferred.

---

## Self-Check

- Scope: 4 files (AgentCharacter.jsx, idleGapInfer.js, constants.js, +tests/behaviorWatchdog.test.js) + package-lock.json. No out-of-scope source files. (Two stray untracked files accidentally staged then removed pre-push — see Drift Log.)
- Regression: `shouldSkipBehaviorWatchdog` new export — caller: AgentCharacter only, non-breaking. `INFERRED_STATUSES` removed — 0 other callers (grep). Breaking change: no.
- Perf note: helper's Set is module-level (created once) vs the original PR allocating `new Set(...)` inside the 10s interval per agent — minor improvement.

---

## Drift Log

- Re-read: none.
- Process slip (self): first `git add -A` swept 2 unrelated untracked files (`deploy_brain.*`, `.gitkeep.md`) into the commit; caught in self-check, removed via `git rm --cached` + amend before final push. Lesson candidate: scope `git add` to known paths on shared/fork branches.
- Commit-message slip: PowerShell here-string syntax used in a bash shell mangled the message (leading/trailing `@`); fixed via `git commit --amend -F`.

---

## Evidence

- Full suite: `npm test` => `Test Files 54 passed (54); Tests 1289 passed (1289)` (1276 prior + 13 new watchdog cases).
- Build: `npm run build` => `built in 1.41s`, JS 414.82 kB / CSS 31.05 kB; only the pre-existing cosmetic `file:line` Tailwind warning.
- Lockfile verification: `git show main:package-lock.json` = 1.1.0/devDeps vs `main:package.json` = 1.2.1/deps → drift confirmed; PR regen corrects it.
- Push: fork branch `fix/watchdog-false-restart-long-commands` @ `221c45d` (force-with-lease over own prior push).

---

## Resume

Review PASS. Next: `/test` evidence gate (quick-win → TESTED→SHIPPED), post polite PR comment to contributor, then `/ship` (SSoT Ship History + worklog archive) — pending owner go-ahead on merge.
