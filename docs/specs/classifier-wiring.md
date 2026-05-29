---
title: Classifier wiring (store + weather, role/workflow aware)
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [9086faf, caaa57a]
primary_files: [src/systems/classify.js, src/systems/store.js, src/components/TopDownFurniture.jsx]
test_file: tests/classifierWiring.test.js
---

# Classifier wiring (#A2 + #A2.1)

## Problem

#A1 shipped the classifier as a pure island; nothing in the app
consumed it yet. `store.applyExternalStatus` still fell through to a
flat `|| 'typing'` for any tool not in `STATUS_BEHAVIOR_MAP`, and
`moodToWeather` had a duplicated mood→family table. Additionally the
classifier was role-agnostic — user feedback "記得不要分類的太隨便" — so
`qa+Bash`, `ops+Bash`, and `dev+Bash` all produced the same animation
despite AgentCortex already encoding rich role/skill/workflow semantics.

## Solution

**#A2 (wiring)** replaces the two existing consumers with classifier
reads. `store.applyExternalStatus`'s `|| 'typing'` fallback becomes
`|| familyToBehavior(classifyTask(u.task).family)`; `moodToWeather`
becomes a single-line delegation to `classifyMood(mood).family`.
Built-in tools (Bash/Read/Grep/Glob) remain byte-identical via the
`bm.behavior[u.task]` hit-first path. Status overrides preserved:
`blocked → scratch-head`, `done → thumbs-up` regardless of task.

**#A2.1 (role-aware)** adds `classifyRole`, `classifyWorkflow`, and a
4-priority resolver `decideBehavior({task, role, status, workflow})`
where **status > workflow > role > family-default**. Role overrides
are rooted in AgentCortex skill associations (e.g. qa/checker has
TDD + verification-before-completion → magnifier; ops has finishing-a-
development-branch → deploy-button; gate has auth-security →
shield-verify). Workflow phase wins over role because phase context
is more specific than persona.

## Files

- `src/systems/classify.js` — adds `familyToBehavior` (#A2),
  `classifyRole` / `classifyWorkflow` / `decideBehavior` (#A2.1).
- `src/systems/store.js` — `applyExternalStatus` calls `decideBehavior`
  with role + workflow + status context.
- `src/components/TopDownFurniture.jsx` — `moodToWeather` delegates
  to `classifyMood`.
- `tests/classifierWiring.test.js` — 180+ lines covering MCP routing,
  status-override precedence, byte-identical built-in regression.
- `tests/classifierRoleContext.test.js` — role + workflow priority
  ladder, dev=zero-overrides invariant.

## Key decisions

- **status > workflow > role > family**: a `done` event must always
  thumbs-up regardless of role; phase context (`/ship`) beats persona
  (`pm`) because phase is what the agent is currently doing.
- **dev/worker has zero role overrides** — guarantees backward
  compatibility for all existing `agents.dev.behavior` assertions
  (grep-verified before merge).
- **EXTERNAL → typing** as conservative MCP default — see
  [[mcp-inner-verb-fix]] which later bubbles the inner verb up.
- **moodToWeather single-line delegation** instead of removing it,
  so the public name in TopDownFurniture stays stable for future
  weather-only consumers.

## Acceptance criteria (Done)

- [x] Built-in tools byte-identical to pre-#A2 (regression-tested)
- [x] MCP and verb-recognizable tools route to family-appropriate
  animations
- [x] `qa+Bash → magnifier`, `ops+Bash → deploy-button`,
  `gate+Bash → shield-verify`, `designer+Edit → whiteboard`
- [x] `/ship` workflow overrides role for EXECUTE tasks
- [x] 748 tests passing after #A2 (+44); 851 after #A2.1 (+103)

## Rollback

`git revert caaa57a 9086faf` (in that order — #A2.1 first since it
extends #A2). Reverting only #A2.1 returns to family-only behavior;
reverting #A2 too restores the flat `|| 'typing'` fallback. Blast
radius is animation selection only — no state-machine or persistence
change.

## References

- Commit: `9086faf feat(#A2): wire classifier into store.behavior +
  moodToWeather`
- Commit: `caaa57a feat(#A2.1): role-aware classifier — same tool,
  different role, different animation`
- CHANGELOG v1.1.0 → "#A2 Classifier wiring" + "#A2.1 Role-aware
  classifier"
- Memory: `feedback_classification_rigor.md` (don't default to W3C
  taxonomy when `.agent/skills/` + `.agent/workflows/` exist)
- Related: [[classifier-foundation]], [[mcp-inner-verb-fix]]
