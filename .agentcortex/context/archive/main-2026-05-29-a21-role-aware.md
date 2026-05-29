Branch: main
Classification: quick-win
Classified by: Claude Opus 4.7
Frozen: true
Created Date: 2026-05-29
Owner: KbWen
Guardrails Mode: Quick
Current Phase: shipped
Checkpoint SHA: 002336f
Recommended Skills: writing-plans, executing-plans, verification-before-completion
Primary Domain Snapshot: none
SSoT Sequence: 10

## Session Info
- Agent: Claude Opus 4.7 (claude-opus-4-7[1m])
- Session: 2026-05-29T12:00:00+08:00
- Platform: Claude Code CLI (Windows)

## Drift Log
- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO

## Task Description
- **#A2.1 role-aware classifier** — extend classify.js with `classifyRole(roleId)` + `classifyWorkflow(workflow)` + `decideBehavior({task, role, status, workflow})` 4-priority resolver. Wire `store.applyExternalStatus` to use `decideBehavior` so the SAME tool produces different animations based on which role uses it and which workflow phase is active.
- User feedback drove this: "記得不要分類的太隨便" — the prior #A1/#A2 classifier was role-agnostic which is the wrong abstraction for an AI agent office viz.
- AgentCortex taxonomy reference: 17 skills + 33 workflows already documented; role profiles in `characters.json` already define visual identity.

## Phase Sequence
- bootstrap
- plan
- implement
- shipped

## External References
- AGENTS.md
- .agent/workflows/bootstrap.md
- .agent/skills/ (17 entries — workflow-skill mapping for role profiles)
- .agent/workflows/*.md (33 entries — for classifyWorkflow)
- .agentcortex/context/current_state.md (SSoT seq=10)
- src/systems/classify.js (target for new exports)
- src/systems/store.js (applyExternalStatus integration)
- src/config/characters.json (roster reference)
- src/components/AgentCharacter.jsx (animation case list — every behavior must exist)
- ~/.claude/projects/.../memory/feedback_classification_rigor.md (saved feedback)

## Known Risk
- Role overrides may break existing tests that use non-`dev` agents (qa/ops/gate/...). Specifically `tests/classifierWiring.test.js` uses 'dev' so it should be safe; tests using 'qa'/'ops' need audit.
- Animation case names must exist in AgentCharacter.jsx — same risk class as #A2.
- Workflow names should match the canonical `/workflow` slash-command form (with leading slash). Need to confirm what's actually stored in `s.activeWorkflow` field.

## Conflict Resolution
- writing/executing-plans + verification-before-completion compatible as prior.

## Skill Notes
none

## Phase Summary
- bootstrap: classified as quick-win (1 module extended + 1 module wired + tests; conservative — dev role has zero overrides so prior tests stay green by construction).
- plan: Mode Normal; 4 steps; role + workflow override matrices derived from AgentCortex skill associations; 4-priority resolver (status > workflow > role > family-default); audited that all existing behavior assertions target `agents.dev` (zero overrides) so no regression possible.
- implement: classify.js gained classifyRole/classifyWorkflow/decideBehavior plus ROLE/WORKFLOW override tables; store.applyExternalStatus swapped to decideBehavior; 103 new tests all green first run.
- shipped: vitest 851/851, build 892ms +1.4 KB bundle, SSoT seq 10→11 via guard, memory feedback saved for future classifier work.

## Gate Evidence
- Gate: bootstrap | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:00:00+08:00
- Gate: plan      | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:05:00+08:00
- Gate: implement | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:15:00+08:00
- Gate: ship      | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:20:00+08:00

## Evidence
- Tests: vitest 851/851 passed (was 748, +67 unit tests for classifyRole/Workflow/decideBehavior + 36 integration tests for role × workflow matrix)
- Build: vite 892ms clean, 379.17 KB raw / 118.45 KB gzip (+1.4 KB raw / +0.3 KB gzip vs #A2)
- Same tool / different role:
  - dev + Bash → typing (baseline)
  - qa + Bash → magnifier (TDD + red-team)
  - ops + Bash → deploy-button (finishing-a-development-branch)
  - gate + Bash → shield-verify (auth-security)
  - designer + Edit → whiteboard (frontend-patterns)
  - pm + Write → gantt-chart (writing-plans)
  - arch + Write → gantt-chart (writing-plans)
- Workflow phase overrides role:
  - dev + Bash + /test → magnifier (workflow promotes)
  - dev + Bash + /ship → deploy-button
  - arch + Read + /research → research
  - dev + Write + /plan → gantt-chart
  - qa + Bash + /ship → deploy-button (workflow beats role)
- Status overrides win:
  - qa + Bash + blocked → scratch-head (status > workflow > role)
  - ops + Bash + done + /ship → thumbs-up
- Lightweight roster works through dynamic agents:
  - feat-x~checker + Bash → magnifier (treated as qa)
  - feat-y~planner + Write → gantt-chart (treated as pm)
  - feat-z~worker + Bash → typing (treated as dev)
- dev role baseline unchanged from #A2: Bash/Read/Edit/Write/Task/xyzzy all preserved
- SSoT guard receipt: seq 10→11, expected_sha=9a75e1a6, new_sha=5b001a76
- Files changed:
  - src/systems/classify.js (+~140 lines, 3 new exports + 2 override tables)
  - src/systems/store.js (1-line wiring swap from familyToBehavior to decideBehavior)
  - tests/classify.test.js (+~150 lines, 67 unit tests)
  - tests/classifierRoleContext.test.js (new, +220 lines, 36 integration tests)
- Memory: feedback_classification_rigor.md saved (don't classify too casually; check .agent/skills/ and .agent/workflows/ first)
- Rollback: `git restore src/systems/classify.js src/systems/store.js tests/classify.test.js tests/classifierRoleContext.test.js`
