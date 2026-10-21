---
title: "ADR-011 — Signal-Driven Planning Location"
date: 2026-10-19
status: accepted
approved: 2026-10-19
applies_to:
  - "src/systems/planningPod.js"
  - "src/systems/store.js"
  - "src/systems/movementSystem.js"
  - "src/components/AgentCharacter.jsx"
lifecycle:
  owner: KbWen
  review_cadence: on-event
  review_trigger: "planning eligibility, seat ownership, return behavior, or real-signal location scope changes"
  supersedes: null
  superseded_by: null
---

# ADR-011 — Signal-Driven Planning Location
Status: Accepted by the owner on 2026-10-19 for the scoped AVO-200 design; actual movement acceptance remains required after implementation.

## Context
R1 protects real tracked work from ambient movement. Random solo meetings were deliberately removed because frequent invented trips overwhelmed the office. AVO-200 asks for a different source: an explicit, fresh planning status on one PM/Architect. This crosses signal truth, global seat ownership and component-local rendered journey state; it cannot be treated as a quick-win.

## Decision
Allow one narrowly scoped real-signal-driven location intent for a fresh, non-inferred planning PM/Architect. It acts on its own representative only, after stable eligibility; it cannot select peers or masquerade as an officeLife group event.

A single transient, epoch-fenced lease owns one existing meeting chair. Door routes still use ADR-010 atomic full-route FIFO claims; position remains rendered truth under ADR-004/005. Source changes/blockers cancel decorative intent immediately. No timeout may steal a live seat/door, no callback may release a newer epoch, and no dynamic actor returns to another session's home.

The exception applies only to AVO-200's qualified planning episode. All other tracked statuses and ambient actors retain R1. There is no per-frame push, user drag, workflow/prompt inference or return of random solo meetings.

## Alternatives Considered
- Stay at desk for every planning session: safest and kept as fallback, but loses the owner's requested visible planning-room use.
- Reuse group-event targets/cast: rejected because it borrows ambient authority over tracked workers and couples unrelated lifecycles.
- Re-add meeting to random behavior pools: rejected; it recreates the measured excessive-trip problem.
- New traffic manager or per-frame separation: rejected as unnecessary scope expansion and incompatible with accepted movement boundaries.

## Consequences
Positive: a real planning episode gains a quiet spatial cue, with deterministic one-seat admission and existing movement safety.
Costs: additional transient lease/cancellation tests, conservative fallback when occupancy/source state is uncertain, and explicit owner review of movement.
No persisted schema or transport migration. Feature defaults disabled; normal desk planning remains a valid fallback. Rollback disables feature intent and reconciles only its own fenced journey, preserving other claims and user state.

## References
- ../specs/avo-200-planning-pod-meeting-room.md
- ../design/office-experience-followups.md
- ADR-004-no-per-frame-agent-separation.md
- ADR-005-no-user-drag-to-move-agents.md
- ADR-010-atomic-door-route-claims.md
