---
title: Tool inventory label
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [d1a68d5]
primary_files: [src/components/AgentCharacter.jsx]
test_file: tests/taskLabel.test.js
---

# Tool inventory label (AVO-103)

## Problem

The office classified incoming tool calls but didn't surface *which*
tool each agent was using right now. Hovering opened the inspector; a
glance across 7 agents told you only their status colors. Real Claude
Code sessions hit different tools rapidly (Bash → Read → Edit → MCP
calls), and that texture was invisible without opening the inspector.

## Solution

`TaskLabel` SVG component inside `AgentCharacter.jsx`: a 7px monospace
pill positioned at `y=-29` in the inverse-scaled name-tag group —
between name tag and head, visible but not blocking the face. Label
text is `classifyTask(task).visualLabel` so built-in tools render
concise names (`Bash`/`Read`/`Edit`) while MCP tools use the Tier 4
inner-verb bubble-up (`mcp__notion__create_page → notion::create`).
Unknown labels truncate to ≤16 chars with `…`. Returns `null` when
`task` is empty/null/undefined so idle agents stay clean. Per-agent
subscription is intentionally narrow:
`useOfficeStore((s) => s.externalStatus[id]?.task ?? null)` — re-renders
fire only when the tool itself changes, not on label/expiresAt/hint
ticks. Visual restraint per brief: no icons, no animation, no color
coding, fill `#E8E8E8` on `#1a1a1a` opacity 0.55.

## Files

- `src/components/AgentCharacter.jsx` — `TaskLabel` component, narrow
  per-agent task subscription, render slot in the name-tag group.
- `tests/taskLabel.test.js` — 17 cases: built-in routing, MCP
  server::tool routing, MCP no-verb fallback, verb-classified routing,
  long-name truncation, defensive null/undefined/empty inputs.

## Key decisions

- **Reuse `classifyTask().visualLabel`**: AVO-103 ships zero new
  vocabulary; the label string is already family-aware because the
  classifier (#A1) and MCP inner-verb fix shipped earlier.
- **Narrow subscription**: subscribing to the whole `externalStatus[id]`
  object would re-render on every poll tick. Selecting only `.task`
  means the pill updates on tool change only.
- **No animation, no color**: design brief was "畫面要清楚好懂、不過分花俏".
  At 7 agents × frequent tool changes, anything flashier would become
  visual noise.
- **`null` for idle**: idle agents have no task; returning null keeps
  the head area clean rather than rendering an empty pill.

## Acceptance criteria (Done)

- [x] Pill appears below name tag, above head, never covers the face
- [x] Built-in tool names render as concise labels
- [x] MCP tools collapse via Tier 4 bubble-up
- [x] Idle agents render no pill
- [x] 17 unit tests; 960/960 vitest at ship; +0.6 KB raw / +0.13 KB gzip

## Rollback

`git revert d1a68d5` — removes the `TaskLabel` component and its render
slot. AgentCharacter falls back to name-tag-only above-head chrome. No
store-shape change, no migration. Blast radius: visual only, single
component.

## References

- Commit: `d1a68d5 feat(AVO-103) tool inventory label above each agent`
- CHANGELOG v1.1.0 → AVO-103 entry (via backlog)
- Backlog row: `_product-backlog.md` AVO-103
- Related: [[classifier-foundation]], [[mcp-inner-verb-fix]]
