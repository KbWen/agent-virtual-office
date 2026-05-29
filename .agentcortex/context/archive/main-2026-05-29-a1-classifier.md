Branch: main
Classification: quick-win
Classified by: Claude Opus 4.7
Frozen: true
Created Date: 2026-05-29
Owner: KbWen
Guardrails Mode: Quick
Current Phase: shipped
Checkpoint SHA: 5289c6b
Recommended Skills: writing-plans (plan phase), executing-plans (implement phase), verification-before-completion (every claim of success backed by vitest output)
Primary Domain Snapshot: none
SSoT Sequence: 8

## Session Info
- Agent: Claude Opus 4.7 (claude-opus-4-7[1m])
- Session: 2026-05-29T11:00:00+08:00
- Platform: Claude Code CLI (Windows)

## Drift Log
- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO

## Task Description
- **#A1 (foundation of classifier proposal)**: Create `src/systems/classify.js` as a pure module with `classifyTask` / `classifyStatus` / `classifyMood` functions following the 4-tier waterfall agreed on in the panel discussion:
  Tier 0: built-in registry (Claude Code's canonical tools, all statuses, all moods)
  Tier 3: verb heuristic aligned with W3C Activity Streams 2.0 verbs (Read / Create / Update / Delete / Search / Execute / Authenticate / Dispatch / etc.)
  Tier 4: MCP namespace parsing (`mcp__<server>__<tool>` → external family with server as subFamily)
  Tier 5: unknown fallback (curiosity tier — raw passthrough + a stable family='unknown')
- Output shape `{ tier, family, subFamily, severity, visualLabel, a11yLabel, raw }` to support both visual and accessibility downstream.
- This is the FOUNDATION; #A2 (wire downstream) and #A3 (unknownLog dev tool) come next as separate quick-wins.

## Phase Sequence
- bootstrap
- plan
- implement
- shipped

## External References
- AGENTS.md
- .agent/workflows/bootstrap.md
- .agentcortex/context/current_state.md (SSoT seq=8)
- Reference standards: W3C Activity Streams 2.0 vocabulary, OpenTelemetry GenAI semantic conventions, MCP tool schema (referenced in panel discussion)
- src/systems/constants.js (existing VALID_STATUSES, VALID_MOODS, VALID_ROLES — must not regress)
- src/systems/store.js (STATUS_BEHAVIOR_MAP — informs Tier 0 task registry)

## Known Risk
- Verb heuristic catches false positives (e.g., 'redo' starts with 're' not 'read'). Use word-boundary regex or exact-verb prefix list.
- MCP namespace: `mcp__server__tool` format — server name can itself contain underscores theoretically (unlikely but pin behavior).
- Need to NOT regress current consumers — this PR adds new module; doesn't touch any caller. #A2 will do the wiring.
- Test coverage: must cover all 7 mood enum values, all 4 status values, real Claude Code tool names (Bash/Read/Edit/Write/Grep/Glob/Task/WebFetch/WebSearch/NotebookEdit/ExitPlanMode), and a sampling of MCP-namespaced tools.

## Conflict Resolution
- writing-plans + executing-plans + verification-before-completion: same compatible chain as prior tasks.

## Skill Notes
none

## Phase Summary
- bootstrap: classified as quick-win (1 new module + 1 new test file, zero existing files touched, zero behavioral change), foundation task for follow-up #A2/#A3.
- plan: Mode Normal; 5 steps; classifyTask + classifyStatus + classifyMood pure functions; W3C verb taxonomy chosen; output shape contract `{tier, family, subFamily?, severity, visualLabel, a11yLabel, raw}`.
- implement: classify.js with 4-tier waterfall + 90 unit tests; 2 verb-regex misses caught (write/put) and fixed during first vitest run; all green on second run.
- shipped: vitest 704/704, build 867ms unchanged-size, SSoT seq 8→9 via guard, classifier ready for #A2 wiring.

## Gate Evidence
- Gate: bootstrap | Verdict: pass | Classification: quick-win | At: 2026-05-29T11:00:00+08:00
- Gate: plan      | Verdict: pass | Classification: quick-win | At: 2026-05-29T11:05:00+08:00
- Gate: implement | Verdict: pass | Classification: quick-win | At: 2026-05-29T11:25:00+08:00
- Gate: ship      | Verdict: pass | Classification: quick-win | At: 2026-05-29T11:35:00+08:00

## Evidence
- Tests: vitest 704/704 passed (90 new in tests/classify.test.js — Tier 0 builtin, Tier 3 verb heuristic, Tier 4 MCP namespace, Tier 5 unknown, shape contract, FAMILIES export)
- Build: vite 867ms clean, bundle size unchanged (classify.js tree-shaken — not imported anywhere yet)
- Standards-aligned per panel discussion:
  - Verb taxonomy → W3C Activity Streams 2.0 (Read/Create/Update/Delete/Search/Execute/Auth/Communicate/Navigate/Dispatch/Memory)
  - Attribute naming → OpenTelemetry GenAI direction (forward-compatible)
  - MCP namespace → MCP spec format `mcp__<server>__<tool>`
- Edge cases pinned:
  - `redo` does NOT match `read*` (word-boundary regex)
  - `delegate` does NOT match `delete*`
  - MCP server names with dashes (e.g., `notion-eu`) ✅
  - MCP tool names with underscores (split on FIRST `__` only) ✅
  - non-string defensive: never throws (null/undefined/42/{}/[] → unknown)
- SSoT guard receipt: seq 8→9, expected_sha=fe232465, new_sha=b11d09dc
- Files added:
  - src/systems/classify.js (new, +270 lines)
  - tests/classify.test.js (new, +250 lines, 90 tests)
- Rollback: `git restore src/systems/classify.js tests/classify.test.js`
- Foundation only — downstream wiring is #A2 (next task).
