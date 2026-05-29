---
title: Standards-aligned classifier foundation
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [fec8a53]
primary_files: [src/systems/classify.js]
test_file: tests/classify.test.js
---

# Standards-aligned classifier foundation (#A1)

## Problem

Prior art (Pixel Agents) admits "JSONL doesn't signal waiting/finished —
heuristics often misfire". Our hook event schema is richer but we had no
shared vocabulary: `STATUS_BEHAVIOR_MAP`, `moodToWeather`, and ad-hoc
`indexOf` checks all classified tasks/statuses/moods independently, and
MCP-namespaced tools (`mcp__<server>__<tool>`) had no parser at all.

## Solution

`src/systems/classify.js` is a pure 4-tier waterfall keyed off public
standards so the vocabulary survives future tool additions:

- **Tier 0** — Built-in registry of Claude Code canonical tools
  (Bash/Read/Edit/Write/Grep/Glob/Task/WebFetch/WebSearch/NotebookEdit/
  ExitPlanMode + TodoRead/TodoWrite).
- **Tier 3** — Verb heuristic from W3C Activity Streams 2.0 vocabulary
  with **word-boundary regex** so `redo`/`delegate`/`refresh` don't
  misroute into Read/Dispatch.
- **Tier 4** — MCP namespace parser: splits on the **first** `__` so
  server names with dashes and tool names with underscores both work.
- **Tier 5** — Unknown fallback; preserves raw, truncates UI label to
  16 chars, never throws (null/undefined/non-string defensive).

Every `classify*` call returns the same shape
`{ tier, family, subFamily?, severity, visualLabel, a11yLabel, raw }`
and the `FAMILIES` export is the frozen vocabulary used downstream.

## Files

- `src/systems/classify.js` — pure classifier module; exports
  `classifyTask`, `classifyStatus`, `classifyMood`, `FAMILIES`.
- `tests/classify.test.js` — 90 unit tests covering all 4 tiers,
  defensive inputs, severity, and label truncation.

## Key decisions

- **Standards over invention**: W3C Activity Streams 2.0 + MCP spec
  + OpenTelemetry GenAI cited in the module docstring. Pins future work
  (#B1 OT GenAI export) to the same taxonomy.
- **Word-boundary regex for Tier 3**: substring matching caused
  `redo → READ`, `delegate → DELETE`, `refresh → SEARCH` misroutes.
- **Tier 5 never throws**: classifier is in the hot path of every
  hook event; defensive return shape is mandatory.
- **No wiring in this PR**: foundation only — `classify.js` is
  tree-shaken until #A2 imports it. Keeps the diff reviewable and
  makes regression risk zero for #A1.

## Acceptance criteria (Done)

- [x] All 4 tiers implemented with documented vocabulary
- [x] `classifyTask` / `classifyStatus` / `classifyMood` exported
- [x] `classifyMood` mirrors `moodToWeather` (#14) shape — parity check
- [x] 90 unit tests, build clean, no behavior change in app

## Rollback

`git revert fec8a53` — module is unimported in #A1, so revert is a
no-op for runtime behavior. Removes the foundation #A2/#A2.1/#A3
depend on.

## References

- Commit: `fec8a53 feat(#A1): standards-aligned classifier foundation
  (W3C + OT GenAI + MCP)`
- CHANGELOG v1.1.0 → "#A1 Standards-aligned classifier foundation"
- Backlog row: `_shipped-log.md` (rotated 2026-05-29)
- Related: [[classifier-wiring]], [[classifier-unknown-log]],
  [[mcp-inner-verb-fix]]
