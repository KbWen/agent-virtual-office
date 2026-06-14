---
title: "ADR-005 — No User Drag-to-Move Agents (AVO-142 rejected by decision)"
date: 2026-06-14
status: accepted
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "any proposal to let users physically reposition/drag agents, or a change to the position=state honesty contract"
  supersedes: null
  superseded_by: null
---

# ADR-005: No User Drag-to-Move Agents (AVO-142 rejected by decision)

- **Status**: Accepted (2026-06-14)
- **Context**: AVO-142 proposed letting users grab/drag/reposition a character for "realer
  interaction". The owner's actual goal was *let users interact with the characters* (noting
  agents are already clickable for an inspector). A 4-lens game-design panel (cozy life-sim ·
  honesty/data-viz integrity · interaction-UX/input · management-sim agency) adjudicated.

## Decision

**Do NOT let users drag/reposition agents.** A character's position is a *load-bearing honest
signal* (desk = working, walking to gate = real review handoff, lounge = idle), driven by
`movementSystem.js` from the real agent's live status. User repositioning would write a fake
position the renderer cannot distinguish from a state-driven one — the viz would assert false
state. This reaffirms rule **R1** (set-pieces/events must not relocate a genuinely-working
agent) and a prior informal rejection of "draggable agents".

The interaction desire is **valid** and is redirected to an honest mechanism (below).

## Why (panel verdicts — unanimous 4/4 "Don't")

1. **Cozy life-sim**: you are a *guest* in the world, not a furniture-placement tool —
   life-sims never let you move NPCs; you interact and they react.
2. **Honesty / data-viz integrity**: position = state. Dragging a working agent to the coffee
   corner makes the screen say "on a break". Snap-back is *intermittent* lying (status updates
   are sparse, seconds–minutes apart); a single `agent.position` field carries no
   user-vs-truth discriminator.
3. **Interaction-UX**: drag collides with the existing click-to-inspect (~4 px click/drag
   threshold → accidental repositions), fights the auto-move system (dropped sprite is
   overwritten next tick = feels broken), is undiscoverable at pixel-art scale, and degrades on
   touch/small viewports — for a hollow payoff (snap-back or frozen).
4. **Management-sim agency**: drag = command; but the user has **no causal control** over where
   a real autonomous agent works. A drag is a *fake command channel* — the correction loop
   reads as a bug, not a feature ("a lying toy").

## Redirect — the honest interaction (new backlog item)

All four lenses independently converged on the same replacement: a **"Poke / acknowledge"
micro-interaction** — click-and-hold a character → it reacts **in place** (gentle bounce /
turns toward camera / blink) and shows a short bubble whose text is drawn from its **real
state** ("Deep in thought…", "Waiting on review…"), then returns to work. **Zero position
write, zero state change** → fully honest, cozy, cheap, REDUCE-safe. Filed as a new backlog
item (Poke acknowledgment). The "make it mine" identity desire (nickname / emoji badge) folds
into **AVO-124** (agent appearance customization), not a position mechanic.

## Re-opening conditions (ALL required)

- The agents become genuinely user-commandable (a real control channel exists), so a moved
  position would reflect a true instruction rather than fiction; AND
- A design that keeps `position == truth` (e.g. a separate user-intent layer that never
  overwrites the status-driven coordinate and never implies a state the agent isn't in); AND
- An owner-present visual session confirming the moved-vs-real distinction is legible.

## Consequences

- AVO-142 closes as **Rejected-by-decision** in the backlog (not silently dropped).
- A new **Poke acknowledgment** backlog item carries the interaction goal honestly.
- Identity/ownership agency is routed to AVO-124 (cosmetic), never to position/task.
- Click-to-inspect remains the primary "interact with a character" affordance (observation =
  honest; control = off-limits).
