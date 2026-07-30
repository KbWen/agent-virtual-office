---
title: AVO-188 Abort Movement in Place
status: frozen
classification: quick-win
primary_domain: data-path
---

# AVO-188 Abort Movement in Place

## Problem

Movement abort paths stop local animation and release the journey claim without clearing the store's `isMoving`. AgentInspector then treats a standing agent as moving and anchors to an abandoned waypoint.

## Contract

- One named store action atomically stops an agent at its last rendered coordinates.
- The action copies those coordinates into both `position` and `targetPosition`, sets `isMoving: false`, and clears `journeyTarget`.
- Force-unstick and behavior-watchdog aborts use that action instead of clearing only the journey claim.
- True component removal aborts after passive-effect teardown; a same-flush live teardown/setup cancels that abort and restores the walk.
- `setAgentArrived` is not used for aborts because it snaps to the abandoned target.

## Acceptance Criteria

1. Abort preserves the last rendered coordinates without object aliasing or teleporting.
2. Store state ends with equal `position` and `targetPosition`, `isMoving: false`, and `journeyTarget: null`.
3. Live/StrictMode teardown does not abort and remains restorable.
4. True removal invokes the same abort-in-place transition.

## Domain Decisions

- [DECISION] Movement truth is corrected through one atomic data-path transition; component cleanup may defer invocation only to distinguish live React teardown from actual removal.

## Non-goals

- No pathfinding, arrival, Inspector, watchdog timing, or movement animation redesign.
- No changes to normal waypoint advancement or successful arrival.
