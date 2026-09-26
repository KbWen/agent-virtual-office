---
kind: maintenance
status: frozen
primary_domain: frontend
parent_spec: docs/specs/living-office-events.md
created: 2026-09-26
signal_tier: none
---

# Spec: Honest office events — remediation of 3 audited defects

> Own-spec exemption (§4.2): frozen at creation because this branch implements it directly in the
> same session; no separate approval turn.

## Problem

A 2026-09-26 audit found 3 places where an officeLife set-piece can misrepresent real agent status,
the same class of defect AVO-191/AVO-194 previously closed for `pickParticipants` (see
`docs/specs/_shipped-log.md`):

1. **Phantom work-claim events**: `fireWithCast` calls `setActiveEvent(event)` — the global event
   mutex that drives the banner/confetti/eventFeed entry — *before* several handlers check whether
   their specific required actor actually made the cast (e.g. `deploy-success` needs `ops`,
   `review-debate` needs both `dev` and `qa`). When `pickParticipants` returns a non-empty cast that
   is still missing the handler's required actor (an `"all"`/array cast partially filtered by
   availability), the handler's own `if (!participants.includes(...)) return` bails — but only
   *after* the phantom event is already live for its full duration.
2. **Idle-gap inference corrupts the very entry it updates**: `idleGapInfer.js` sends
   `{agentId, status}` only. `store.js`'s `buildExtEntry` writes `u[f] || null` for every
   `AGENT_CARRY_FIELDS` entry, so `task`/`label`/`activeFile`/`reasonCode`/`skill`/`hint` are wiped
   to `null` on every inferred tick, and `changedAt` is bumped to "now" as if a fresh real signal
   arrived — which a work-claim gate (`recentSignal`) can later read as legitimate freshness.
3. **In-group participants never release on real work**: `resolveAgentVisual`'s `inGroup` guard
   (officeLife owns behavior/expression during a group event) has no exit condition — a real tracked
   status (working/blocked/awaiting-approval/thinking) arriving for a participant does not clear
   `inGroupEvent`, so the agent keeps performing the group's pose after it has genuinely started
   real work. Several deferred handler steps (`food-delivery`, `coffee-spill`, `deploy-success`
   celebrate, `dog-visit`, `group-stretch`, `pm-all-meeting` stage 2) additionally lock or relock
   participants without re-checking availability at the time the deferred step actually runs.

## Non-goals

- No change to event cadence, gather-spot coordinates, or which events exist (Protected Surfaces).
- No change to `WORK_CLAIM_GATES`' recency-based eligibility model (evaluated a status-based
  tightening for `deploy-success`/`ops-dev-deploy-check`; deferred — see Work Log `## Known Risk`;
  `done` is a 10s-transient status by design, so a literal `status === 'done'` requirement would
  make the gate almost never open).
- No visual/layout change. This is a state-honesty fix: fewer dishonest transient poses/banners, not
  a new look.

## Solution

1. Add a `REQUIRED_ACTORS` map (event id → actor ids the handler needs) and a
   `hasRequiredActors(event, participants)` predicate in `officeLife.js`. `fireWithCast` and
   `triggerInteractiveEvent` refuse to fire (no `setActiveEvent`, no feed entry) when the cast is
   missing a required actor — symmetric with the existing empty-cast refusal (AVO-191).
2. `idleGapInfer.js`'s `tick()` carries the agent's own prior `externalStatus` carry-fields forward
   into the inferred update (so nothing is wiped), and passes `meta.source` through so `store.js`'s
   `buildExtEntry` keeps `changedAt` unchanged (not a fresh signal) for `source: 'idle-gap-infer'`
   updates, and skips popping a new speech bubble for them (the status ring + behavior pose already
   carry the visualization; the idle-gap-inference spec never called for a bubble).
3. `store.js`'s `applyExternalStatus` releases `inGroupEvent`/`groupTarget` when a REAL tracked
   status (anything other than idle/done) arrives for a currently-grouped agent, letting the real
   status drive behavior/expression from that point on. `officeLife.js`'s deferred handler steps that
   establish a FIRST-TIME lock (rather than re-checking an existing one) now re-verify
   `isAgentAvailable` at the moment they run, not just at cast-selection time.

## Acceptance Criteria

- AC-1: A work-claim event whose cast is missing its required actor does not set `activeEvent`,
  does not produce an eventFeed entry, and returns `false`.
- AC-2: An idle-gap-inferred update preserves the agent's prior `task`/`label`/`activeFile`/
  `reasonCode`/`skill` in `externalStatus`.
- AC-3: An idle-gap-inferred update does not advance `changedAt` and does not pop a new bubble.
- AC-4: A participant in a group event whose real status transitions to working/blocked/
  awaiting-approval/thinking is released (`inGroupEvent: false`, `groupTarget: null`) and its
  behavior/expression reflect the real status from that update onward.
- AC-5: A participant in a group event whose real status is idle/done (still genuinely available)
  keeps its group-event pose (no regression to the existing "officeLife owns them" contract).
- AC-6: `tests/agentSeparationInvariants.test.js` and the AVO-191 invariant sweep
  (`tests/eventParticipantR1.test.js`) stay green — this remediation must not reopen either closed
  defect class.

## Files

- `src/systems/officeLife.js` — `REQUIRED_ACTORS`, `hasRequiredActors`, `fireWithCast`,
  `triggerInteractiveEvent`, and the deferred steps in `food-delivery`, `coffee-spill`,
  `deploy-success`, `dog-visit`, `group-stretch`, `pm-all-meeting`.
- `src/inference/idleGapInfer.js` — `tick()` carry-forward.
- `src/systems/store.js` — `buildExtEntry` (isInferred param), `applyExternalStatus` (release-on-
  real-status).
- `tests/officeLife.test.js`, `tests/avo184-equivalence.test.js`, `tests/idleGapInfer.test.js` —
  red-first coverage for AC-1..AC-5.

## Rollback

Revert this branch's commits, or `git reset` to the Diff Base SHA on this feature branch only. All
touched fields are transient runtime store state (not persisted, not migrated) — no data-shape
rollback needed.

## References

- ADR-007 (dialogue channel separation + honesty gate), ADR-008 (no fabricated need/ambient honesty)
- `docs/specs/living-office-events.md` (Phase 2/3/4 event decision framework)
- `docs/specs/idle-gap-inference.md` (#C)
- AVO-191 / AVO-194 (`docs/specs/_shipped-log.md`) — prior fixes of this exact defect class
