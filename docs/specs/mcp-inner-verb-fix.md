---
title: MCP Tier 4 inner-verb bubble-up fix
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [fb011a8]
primary_files: [src/systems/classify.js]
test_file: tests/classify.test.js
---

# MCP Tier 4 inner-verb bubble-up fix

## Problem

`classifyTask` Tier 4 hard-coded `family: FAMILIES.EXTERNAL` even when
`classifyVerb(mcp.tool)` had already extracted the inner verb's
family. `decideBehavior()` reads only `family`, so MCP
create/delete/search/read all collapsed to `behavior='typing'` —
visually identical despite semantically different operations.

## Solution

When the inner verb matches, return `family: inner.family` directly
(option B from the spawn prompt — cleaner than a parallel
`effectiveFamily` field). The MCP server is preserved in `subFamily`
for hover / debug. When no verb matches (e.g.
`mcp__notion__weirdtool`), keep the `EXTERNAL` fallback so the tool
still has a category.

Behavior changes (semantic improvements, not regressions):

| Task | Before | After |
| --- | --- | --- |
| `mcp__notion__create_page` | EXTERNAL→typing | CREATE→writing-notes |
| `mcp__notion__delete_page` | EXTERNAL→typing | DELETE→typing (high severity) |
| `mcp__notion__read_database` | EXTERNAL→typing | READ→reading-screen |
| `mcp__atlassian__search_*` | EXTERNAL→typing | SEARCH→research |
| `mcp__notion__weirdtool` | EXTERNAL→typing | EXTERNAL→typing (unchanged) |

## Files

- `src/systems/classify.js` — Tier 4 branch returns `inner.family`
  when present; `subFamily` carries the MCP server.
- `tests/classify.test.js` — MCP Tier 4 describe block asserts
  bubbled families; explicit cases for delete (severity), read, and
  weirdtool (no-verb fallback). MCP-namespaced `familyToBehavior`
  test split into 4 cases.
- `tests/classifierWiring.test.js` — MCP wiring test asserts
  `writing-notes`; +2 new tests for `search→research` and
  `weirdtool→typing`.

## Key decisions

- **Bubble inner family up directly** (option B) instead of adding an
  `effectiveFamily` parallel field — one less invariant for downstream
  to know about; `decideBehavior` already reads `family`.
- **Preserve MCP server in `subFamily`** — debug/hover surface stays
  intact even though `family` no longer carries it.
- **Keep EXTERNAL when inner verb is unknown** — conservative default
  for the `mcp__notion__weirdtool` shape; `unknownLog` (#A3) will
  surface these for future Tier 0 promotion.

## Acceptance criteria (Done)

- [x] MCP create/update/read/delete/search route to verb-family
  animations
- [x] `mcp__server__tool` with unrecognized verb still falls back to
  EXTERNAL → typing
- [x] DELETE severity propagates through MCP Tier 4
- [x] 925 tests passing (+8 new MCP cases); build clean; bundle
  unchanged (~385 KB raw / ~120.5 KB gzip)

## Rollback

`git revert fb011a8` — restores the flat
`family: FAMILIES.EXTERNAL` for all Tier 4 hits. Blast radius is
animation selection for MCP-namespaced tasks only; no state or
persistence change. Re-collapses 4 distinct operations into one
`typing` animation.

## References

- Commit: `fb011a8 fix(classify): MCP Tier 4 bubbles inner verb
  family up instead of flat EXTERNAL`
- CHANGELOG v1.1.0 → "Fixed → MCP Tier 4 inner-verb bubble-up"
- Related: [[classifier-foundation]], [[classifier-wiring]],
  [[classifier-unknown-log]]
