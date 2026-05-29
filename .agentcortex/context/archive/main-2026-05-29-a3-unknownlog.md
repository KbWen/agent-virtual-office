Branch: main
Classification: quick-win
Classified by: Claude Opus 4.7
Frozen: true
Created Date: 2026-05-29
Owner: KbWen
Guardrails Mode: Quick
Current Phase: shipped
Checkpoint SHA: 3dfce0d
Recommended Skills: writing-plans, executing-plans, verification-before-completion
Primary Domain Snapshot: none
SSoT Sequence: 11

## Session Info
- Agent: Claude Opus 4.7 (claude-opus-4-7[1m])
- Session: 2026-05-29T12:25:00+08:00
- Platform: Claude Code CLI (Windows)

## Drift Log
- Skip Attempt: NO
- Gate Fail Reason: N/A
- Token Leak: NO

## Task Description
- **#A3 unknownLog** (LangSmith-style self-improving classifier): when classifyTask/classifyStatus/classifyMood/classifyRole/classifyWorkflow returns tier 5 (unknown fallback), accumulate the raw input under a dev-mode global so we can surface "tools seen this session that we don't have specific mappings for". Used to find what to add to Tier 0 over time.
- Critical constraint: **zero production overhead** — gated by `import.meta.env.DEV` or equivalent so production bundles tree-shake the entire log.
- API: a thin module `src/systems/unknownLog.js` exporting `recordUnknown(kind, raw)` + `getUnknownReport()` + `clearUnknownLog()`. Recording is no-op outside dev mode.
- Wire into classify.js's 5 classifiers — but ONLY for tier 5 returns, NOT for known-with-overrides cases.

## Phase Sequence
- bootstrap
- plan
- implement
- shipped

## External References
- AGENTS.md
- .agent/workflows/bootstrap.md
- .agentcortex/context/current_state.md (SSoT seq=11)
- src/systems/classify.js (target — 5 classifiers need recordUnknown call on tier 5)
- panel-discussion observability pattern (LangSmith auto-clustering inspired)

## Known Risk
- Memory leak if log unbounded — must cap to N entries (e.g., last 200 per kind).
- Test isolation — vitest reset must clear the log between tests so cross-test pollution doesn't appear.
- Vite dev mode detection — `import.meta.env.DEV` works in vite, falsy in vitest? Need to verify; might need separate test harness override.

## Conflict Resolution
- writing/executing-plans + verification-before-completion compatible as prior.

## Skill Notes
none

## Phase Summary
- bootstrap: classified as quick-win (1 new tiny module + 5 classify.js call sites + tests; dev-mode only so production is zero-cost).
- plan: Mode Normal; 4 steps; module API (recordUnknown/getUnknownReport/clearUnknownLog/isDevMode) + 5 tier-5 wiring points + window globals for DevTools; risk-mitigated by cap=200 and explicit dev gate.
- implement: unknownLog.js with Map-based buckets + sorted report + production gate; 5 tier-5 recordUnknown calls in classify.js; 24 tests covering basic record/sort/cap/defensive/dev-gate/integration; all green first run.
- shipped: vitest 875/875, build 946ms +1KB bundle, live preview confirmed window.__office_unknownLog populates correctly and __office_logUnknowns is callable, SSoT seq 11→12 via guard.

## Gate Evidence
- Gate: bootstrap | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:25:00+08:00
- Gate: plan      | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:30:00+08:00
- Gate: implement | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:40:00+08:00
- Gate: ship      | Verdict: pass | Classification: quick-win | At: 2026-05-29T12:45:00+08:00

## Evidence
- Tests: vitest 875/875 passed (was 851, +24 unknownLog tests)
- Build: vite 946ms clean, 380.17 KB raw / 118.90 KB gzip (+1 KB raw / +0.45 KB gzip vs #A2.1)
- Module surface:
  - `recordUnknown(kind, raw)` — no-op outside dev mode
  - `getUnknownReport()` — top-20 per kind, sorted by count desc
  - `clearUnknownLog()` — resets all buckets
  - `isDevMode()` — gate function (respects `__OFFICE_FORCE_UNKNOWN_LOG__` + `import.meta.env.PROD`)
  - `window.__office_unknownLog` — raw Maps (browser only)
  - `window.__office_logUnknowns()` — sorted console report (browser only)
- Integration verified:
  - classifyTask Tier 5 → records `task` bucket
  - classifyStatus Tier 5 → records `status` bucket
  - classifyMood Tier 5 → records `mood` bucket
  - classifyRole Tier 5 → records `role` bucket (BASE role for composites)
  - classifyWorkflow Tier 5 → records `workflow` bucket (normalized key, no leading slash)
  - Tier 0/3/4 hits do NOT record (correctness invariant)
- Defensive paths:
  - non-string raw silently dropped
  - unknown `kind` silently dropped
  - cap=200/kind enforced (oldest evicted, Map insertion order)
- Production safety:
  - `isDevMode()` returns false when `import.meta.env.PROD === true`
  - `recordUnknown` is no-op when gate is OFF
  - Bucket additions skipped entirely → minimal CPU cost in prod
- Live preview probe:
  - mysteryMcpClient counted ×2 ✅
  - Mixed inputs land in correct buckets ✅
  - `window.__office_unknownLog` + `__office_logUnknowns` exposed ✅
- SSoT guard receipt: seq 11→12, expected_sha=5b001a76, new_sha=4acc96c1
- Files added/changed:
  - src/systems/unknownLog.js (new, +130 lines)
  - src/systems/classify.js (5 tier-5 branches +1 line each + import)
  - tests/unknownLog.test.js (new, +200 lines, 24 tests)
- Rollback: `git restore src/systems/unknownLog.js src/systems/classify.js tests/unknownLog.test.js`
