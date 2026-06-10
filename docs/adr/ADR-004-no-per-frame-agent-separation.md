# ADR-004: No Per-Frame Agent Separation (AVO-144 resolved by decision)

- **Status**: Accepted (2026-06-10)
- **Context**: AVO-144 proposed sustained inter-agent separation in free movement (agents pass
  through each other in transit). Ground-truth architecture audit + a 3-lens expert panel
  (game-feel/sim-fidelity · honesty/calm-tech · systems/feasibility) adjudicated the options.

## Decision

**Do NOT build per-frame (in-transit) separation.** Target-time deconfliction — the existing
`avoidOverlap` at every assignment chokepoint (gather events via `setAgentGroupEvent` /
`setMultipleAgentGroupEvents`, ambient destinations via `getTargetForBehavior`) — remains the
complete separation mechanism. Mid-transit ghost-through is an accepted limitation, consistent
with the industry standard at this scale (Gather.town tile reservation, Stardew schedule pauses,
crowd-sims exempting walkers).

## Why (panel verdicts, unanimous 3/3)

1. **Geometry**: door passages are 35–48 px wide vs `MIN_AGENT_DIST` 35 px and ~30–40 px sprites
   — mutual per-frame push in a doorway has nowhere to push; oscillation reads as a BUG, while a
   ~0.5 s ghost-through reads as a limitation (worse cure than disease).
2. **Architecture**: visual position is component-local (one RAF per `AgentCharacter`,
   `visualPosRef`); store positions update only at waypoint boundaries and do NOT drive sprites.
   Any arrival-time store nudge therefore either silently diverges store-from-screen
   (position=truth violation) or must relocate via the group-event machinery (R1-adjacent).
   A per-frame push needs a NEW shared mutable registry with async mutual-push convergence,
   unmount staleness, watchdog interplay, and no deterministic test path (jsdom has no RAF).
3. **Evidence standard unbuildable**: the project's own rule — never claim a visual change works
   from code alone — requires a deterministic in-transit separation measurement harness that does
   not exist here (`preview_screenshot` broken; vitest is layout-blind).

## Re-opening conditions (ALL required)

- A lock-step frame-simulation harness proving convergence (no oscillation) in the 35 px doorway
  case, runnable in CI;
- The game-feel parameter set: activation radius < 28 px, max nudge ≤ 2 px/frame, doorway
  exemption, idle-agent exclusion, perpendicular-crossing exemption;
- A URL-flag gate (`?perFrameSeparation=1`) and an owner-present visual tuning session before
  default-ON.

## Consequences

- AVO-144 closes as **Deferred-by-decision** in the backlog (not silently dropped).
- The optional cheap mitigation identified (widening `CORRIDOR_JITTER` ±8-12 → ±18-22 px to
  laterally offset same-corridor walkers) is an owner-call visual tuning knob, deliberately NOT
  changed autonomously (Protected Surface).
