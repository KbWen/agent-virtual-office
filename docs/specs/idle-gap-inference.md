---
title: Idle-gap inference for thinking and awaiting-approval
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [b5efc92]
primary_files: [src/inference/idleGapInfer.js, src/components/PixelOffice.jsx]
test_file: tests/idleGapInfer.test.js
---

# Idle-gap inference (#C)

## Problem

Claude Code's hooks emit `PreToolUse` / `PostToolUse` / `Stop`, but
extended-thinking sessions and unanswered permission prompts produce no
intermediate events — the agent visually freezes mid-`working` or
mid-`blocked` for minutes. Pixel Agents (the upstream inspiration)
publicly admits this heuristic gap as the limit of hook-only inference.
The office needs to bridge it without inventing fake activity.

## Solution

`startIdleGapInference(store)` runs a 10s polling loop and a zustand
subscription. The subscription stamps `lastUpdatedAt.set(id, now())`
whenever an agent's `(status, task)` signature changes — *not* on
position/behavior, which mutate every animation frame. Each tick
computes `elapsed = now - lastUpdatedAt[id]`. If an agent is `working`
and elapsed ≥45s, it is reclassified to `thinking`; if `blocked` and
elapsed ≥90s, it is reclassified to `awaiting-approval`. Updates are
routed through `applyExternalStatus(..., { source: 'idle-gap-infer',
hasWorkflow: false })` so they share the real-hook pipeline (behavior
selection, classifier mapping) but skip the mood engine — inferred
states must not bias rushing/frustrated/stuck patterns. Real hook
events naturally overwrite the inferred status, giving reversibility
by construction.

## Files

- `src/inference/idleGapInfer.js` — `computeSig()`, `parseSig()`,
  `subscribeAgentUpdates()`, `tick()`, `startIdleGapInference()`,
  `_resetIdleGapState()` test helper.
- `src/components/PixelOffice.jsx` — `useEffect` starts the inference
  loop alongside the desktop notifier; cleanup returns the stop fn.
- `tests/idleGapInfer.test.js` — threshold edges, signature diffing,
  thrash prevention via `INFERRED_STATUSES` short-circuit, real-hook
  override, jsdom safety.

## Key decisions

- **Conservative thresholds (45s / 90s)**: a normal Bash test can run
  30–60s with no hook traffic. 30s working would misfire on every test
  run; 45s catches genuine stalls. 90s for blocked is deliberately even
  more lenient — permission prompts often sit for minutes.
- **Skip mood-engine emit**: `classifyStatus('thinking')` belongs to
  the COGNITION family; counting it toward team mood would conflate
  *inferred* state with *measured* state. `hasWorkflow: false` blocks
  the emit cleanly.
- **`(status, task)` signature, not full agent**: position/behavior tick
  ~60 Hz from movementSystem; subscribing to the full object would
  reset the clock every frame and defeat the entire mechanism.
- **No marker on the inferred state**: real hook events flow through
  `applyExternalStatus` and overwrite status directly; nothing to clean
  up. Reversibility is free.
- **Re-stamp inferred agents after firing**: prevents the same tick
  immediately re-firing on the next interval.

## Acceptance criteria (Done)

- [x] working + 45s gap → `thinking`
- [x] blocked + 90s gap → `awaiting-approval`
- [x] Real hook event overwrites inferred status
- [x] Mood engine does not see inferred events
- [x] No thrashing once an agent is already inferred
- [x] Stop function clears interval + unsubscribes

## Rollback

`git revert b5efc92` — removes the inference module and the PixelOffice
useEffect. Agents stuck in extended thinking will visually freeze again
(pre-#C behavior). Blast radius: PixelOffice only.

## References

- Commit: `b5efc92 feat(#C): idle-gap inference — close Pixel Agents'
  admitted heuristic gap`
- CHANGELOG v1.1.0 → "#C Idle-gap inference"
- Pixel Agents project (upstream): publicly documented heuristic gap
- Related: [[desktop-notifications]] (sister inference module),
  [[classifier-foundation]] (status family taxonomy)
