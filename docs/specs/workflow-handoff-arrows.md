---
title: Workflow handoff arrows
status: shipped
date: 2026-05-29
shipped_in: v1.1.0
commits: [dde593f]
primary_files: [src/inference/workflowHandoff.js, src/components/PixelOffice.jsx, src/systems/store.js]
test_file: tests/workflowHandoff.test.js
---

# Workflow handoff arrows (AVO-105)

## Problem

The PM→Arch→Dev→QA→Gate→Ops workflow is the office's core narrative,
but `activeWorkflow` flipped silently between phases. Users had to
read the broadcast banner to know a handoff had happened; the spatial
choreography of "code passing between roles" was invisible.

## Solution

`startWorkflowHandoffs(store)` subscribes to the store, snapshots
`activeWorkflow` on each change, and looks up an explicit 7-row table
of `phase→phase` transitions mapped to role pairs (e.g.
`plan→implement → arch→dev`, `review→ship → gate→ops`). On a hit, it
calls `addHandoff(from, to, { subtle: true })` — reusing the
existing FlyingDocument arc infrastructure. The `subtle` flag is
persisted on the handoff entry; `FlyingDocument` renders the calm
variant (60° rotation, no scale pulse, no sparkle) for workflow
handoffs while keeping the flashy 360° + sparkle variant for organic
officeLife pass-document events. Boot safety: `null↔phase` transitions
never fire; identical workflows skip; unmapped pairs skip; lightweight
roster (planner/worker/checker) silently skips when named roles are
absent. **Re-entrancy bug-pin**: `prevWorkflow` MUST advance BEFORE
`addHandoff` — zustand fires listeners synchronously on every setState,
so a side effect that mutates state re-fires the watcher; without the
early advance, the closure observes the same `next` against the
unchanged `prev` and recurses to a stack overflow.

## Files

- `src/inference/workflowHandoff.js` — `HANDOFFS` table (7 transitions),
  `normalizeWorkflow`, `startWorkflowHandoffs` subscription, exported
  `WORKFLOW_HANDOFFS` for test iteration.
- `src/components/PixelOffice.jsx` — `startWorkflowHandoffs` lifecycle
  wire-up; `FlyingDocument` honors `handoff.subtle`.
- `src/systems/store.js` — `addHandoff(from, to, opts)` extended with
  `opts.subtle` boolean, persisted on the handoff entry.
- `tests/workflowHandoff.test.js` — 18 cases: each mapped row, subtle
  flag, null/boot safety, unmapped transitions, identical workflow,
  lightweight roster skip, BUG-PIN re-entrancy, full
  spec→plan→implement→test→review→ship narrative chain.

## Key decisions

- **Explicit table, not heuristics**: only 7 mapped pairs. Anything not
  listed produces no arrow. Keeps arrows meaningful signal, not noise.
- **`subtle` flag, not new component**: reusing FlyingDocument keeps
  visual language consistent; the flag toggles decoration only (same
  paper SVG, same 800ms, same arc).
- **Advance prev BEFORE side effect**: the re-entrancy bug only
  surfaces in live preview because tests usually drive `setState`
  through a wrapper. A BUG-PIN test simulates the synchronous re-entry
  so a regression can't slip through.
- **Boot-safety asymmetry**: `null → /plan` is the FIRST observation,
  not a transition — firing on it would spam a handoff every time the
  office starts.

## Acceptance criteria (Done)

- [x] 7 mapped transitions fire correct role-pair handoffs
- [x] Organic handoffs keep flashy variant; workflow handoffs are subtle
- [x] Boot, identical, unmapped, lightweight-roster cases all no-op
- [x] Re-entrancy BUG-PIN test in place
- [x] 18 unit tests; 943/943 vitest at ship; +0.9 KB raw / +0.3 KB gzip

## Rollback

`git revert dde593f` — removes the `workflowHandoff.js` module, the
`subtle` opt on `addHandoff`, and the PixelOffice subscription wire-up.
Existing organic handoffs continue to fire (flashy variant only).
Blast radius: workflow visualization layer; store-shape change is
additive (`opts.subtle` only).

## References

- Commit: `dde593f feat(AVO-105) workflow handoff arrows — subtle paper-arc
  on phase transitions`
- CHANGELOG v1.1.0 → AVO-105 entry (via backlog)
- Backlog row: `_product-backlog.md` AVO-105
- Related: [[classifier-wiring]] (workflow classification),
  [[tool-inventory-label]]
