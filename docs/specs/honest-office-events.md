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
  make the gate almost never open). The reviewer agreed `status === 'done'` is unworkable. A
  **residual honesty window remains and is out of scope for this branch**: `recentSignal` only
  checks changedAt recency, not the CURRENT status, so an ops that goes `done` → (quickly) `idle` →
  starts new real work within `WORK_CLAIM_SIGNAL_WINDOW` can still read as eligible off the stale
  `done` edge. Follow-up candidate for a future ticket: stamp a dedicated `doneAt` (set only on the
  real transition INTO `done`, distinct from the general `changedAt`) and gate on `now - doneAt <
  WORK_CLAIM_SIGNAL_WINDOW` instead of the general-purpose `changedAt`. No code change here.
- No visual/layout change. This is a state-honesty fix: fewer dishonest transient poses/banners, not
  a new look.
- No new machine-side "BUSY" visual for the deploy button / whiteboard click (finding #5, round 2):
  evaluated reusing AVO-193's coffee-BUSY pattern; declined for THIS branch because it is a UI
  feature addition (new visual state, Design Gate territory per `engineering_guardrails.md §4.4`),
  not a state-honesty removal. Decision: prefer silence (no bubble) over a fabricated quip when the
  reactor is genuinely tracked-busy. Follow-up candidate: a dedicated BUSY glyph for
  `deploy-success`/`eureka` clicks, mirroring AVO-193.

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

## Round 2 (2026-09-26 fresh review) additions

A fresh `/review` returned NOT READY with 2 further blocking findings (same honesty class) and one
non-blocking decision request, all fixed on this branch:

4. **Abandoned mid-event, activeEvent stays live over an empty scene**: releasing the last locked
   participant (finding #3's fix) or a deferred stage abandoning before locking anyone (e.g.
   `pm-all-meeting` stage 2 when `pm` was already released) left `activeEvent` set — a live
   banner/confetti with nobody performing it, reproduced by the reviewer against the real store
   (`pm` → `working` at t=1s, `activeEvent` still `pm-all-meeting` at t=13s with nobody in-group;
   same for `deploy-success` when `ops` is released). Fixed: `startOfficeLife`'s existing
   `store.subscribe` callback now tracks whether the CURRENT `activeEvent` has ever actually locked
   a participant (`trackedEventHadParticipant`), and clears it the moment the scene goes empty
   after having been non-empty. The tracking guard specifically avoids a false-positive clear during
   the real async window some handlers (`dog-visit`, `group-stretch`) have between `setActiveEvent`
   and their first STAGGERED lock, where an unrelated store tick would otherwise read as "abandoned
   before it started."
5. **`fireInteractionReaction`'s R1 guard was inGroupEvent-only**: a click-reaction quip (e.g.
   "nothing to ship right now") could land on a genuinely tracked-busy reactor (working/blocked)
   that simply wasn't locked into any officeLife group event — overwriting a real hook-driven
   bubble with a fabricated one. Fixed: the guard now also checks `isAgentAvailable`. Decision on
   the alternative (a machine-side BUSY badge) is recorded in Non-goals.
6. Test coverage gap (non-code, AC-1/AC-4/AC-6 hardening): the required-actor check was only
   exercised via the interactive-click path, which has its own independent call to the same guard
   — deleting the equivalent call inside `fireWithCast` (the daily/rare-scheduler and real-seed
   path) still passed the full suite. Added `tests/fireWithCastRequiredActorsScheduler.test.js`,
   which mocks the event catalog down to one event so `pickEligibleEvent`'s random draw is
   deterministic, and manually verified (mutation: temporarily removed the `fireWithCast` guard)
   that this new test goes red and the rest of the suite does not catch it alone. Also fixed the
   `review-debate` negative test in `requiredActorsGate.test.js`, which had been silently isolating
   the pre-existing `eventEligible` gate instead of the new required-actor check (qa lacked a fresh
   `changedAt`), and added the missing `group-stretch` case to
   `tests/groupEventDeferredAvailability.test.js`.

## Round 3 (2026-09-26 follow-up review) additions

The round-2 abandonment auto-clear (finding #4 above) introduced two new races, both stemming from
one root cause: `EVENT_BY_ID`'s catalog objects are SHARED (two `tea-break` fires reuse the SAME
object), so `activeEvent` identity alone cannot tell an OLD, already-superseded fire's stale timers
apart from a NEW one.

7. **N1 — a stale cleanup timer clobbers a later event**: event A's own duration-cleanup timer
   (captured once, at `event.duration`) fires unconditionally and calls `clearActiveEvent()` +
   releases A's cast, even after A was cleared early (finding #4) and a LATER event B has since
   taken over — B's banner/cast gets clobbered mid-run. Reproduced against the real store:
   `ac-broken` (A) cleared early at t=1s; `tea-break` (B) fires at t=2s; at t=15.1s (A's original
   15000ms duration) A's stale timer cleared B's `activeEvent` and released B's cast 5s early.
8. **N2 — a staggered handler keeps locking under a dead event**: `dog-visit`/`group-stretch` lock
   participants via staggered `setTimeout`s. If the first-locked participant is released early
   (emptying the scene, triggering finding #4's auto-clear), the REMAINING staggered callbacks keep
   locking their participants anyway — under a `null activeEvent` (no mutex, no banner).

**Fix**: every fired event (including the ad-hoc `lunch-nap` time-linked event, which has the same
shape) is assigned a unique, monotonically-increasing epoch (`beginEventEpoch()`). Every deferred
handler step and the duration-cleanup timer (`endEventEpochIfLive()`) act ONLY if their captured
epoch is still the live one (`isStaleEpoch()`); a stale epoch is a full no-op that touches NOTHING
— it must never release/relock agents that may since belong to a newer event. The round-2
abandonment auto-clear (finding #4) now reads/writes this SAME epoch state instead of an
`activeEvent`-identity check, so a clear there immediately invalidates every later step's guard.

## Acceptance Criteria

**Target Files** (the diff for AC-1..AC-11 below):
`src/systems/officeLife.js`, `src/systems/store.js`, `src/inference/idleGapInfer.js`,
`docs/specs/idle-gap-inference.md`, `docs/specs/living-office-events.md`,
`tests/avo184-equivalence.test.js`, `tests/idleGapInfer.test.js`,
`tests/requiredActorsGate.test.js`, `tests/groupEventDeferredAvailability.test.js`,
`tests/activeEventAbandonment.test.js`, `tests/fireWithCastRequiredActorsScheduler.test.js`,
`tests/interactiveEventGate.test.js`, `tests/eventEpochRace.test.js`.

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
- AC-7: an `activeEvent` that has already locked at least one participant is cleared the moment
  every participant is released/never locked — never rides out its full duration over an empty
  scene. A NOT-YET-locked event (the async gap before a staggered handler's first lock) is never
  mistaken for an abandoned one.
- AC-8: a gated interactive click's neutral reaction never overwrites the bubble of a reactor that
  is genuinely tracked busy (working/blocked), whether or not it is locked in a group event.
- AC-9: `fireWithCast`'s required-actor refusal is covered independently of
  `triggerInteractiveEvent`'s (the daily-scheduler path), via a deterministic mocked-catalog test.
- AC-10: a superseded event's duration-cleanup timer never clears a later event's `activeEvent` or
  releases its cast (N1).
- AC-11: an abandoned staggered event never locks a remaining participant once its epoch is no
  longer live (N2).

## Domain Decisions

- [DECISION] `hasRequiredActors()` is a symmetric pre-fire refusal alongside the existing empty-cast
  refusal (AVO-191) rather than a change to `pickParticipants` itself — it targets exactly the
  "non-empty but missing a specific actor" gap without touching the participant-selection logic
  Protected Surfaces guard.
- [DECISION] `idleGapInfer.js` carries the agent's own prior `externalStatus` fields forward via a
  new `inferredUpdate()` helper rather than changing `buildExtEntry`'s general carry-field loop —
  the corruption is specific to the caller sending a partial payload, not to `buildExtEntry`'s
  contract.
- [DECISION] `store.js`'s `applyExternalStatus` releases `inGroupEvent`/`groupTarget` on ANY real
  busy status (working/blocked/awaiting-approval/thinking), not only the exact status the
  participant was picked for — becoming busy in a DIFFERENT way is just as dishonest to keep
  grouped.
- [TRADEOFF] Deferred handler steps that establish a first-time lock re-verify `isAgentAvailable`
  synchronously against the CURRENT store state when the deferred `setTimeout` fires, rather than
  re-running the original cast-selection algorithm — cheaper and sufficient, since the only failure
  mode is "went busy since being cast," not "should now be re-shuffled."
- [DECISION] the mid-event abandonment auto-clear (round 2, finding #4) lives in `startOfficeLife`'s
  existing `store.subscribe` callback (co-located with the other reactive/seeded checks) rather than
  as a new dedicated subscription, and is gated on the round-3 epoch state
  (`liveEventEpoch`/`liveEventHadParticipant`) to avoid a false-positive clear during a staggered
  handler's pre-first-lock window.
- [DECISION] evaluated tightening `deploy-success`/`ops-dev-deploy-check` eligibility to require live
  `status === 'done'`; declined — `done` is a 10s-transient status by design, so the change would
  make the gate almost never open, and conflicts with a currently-shipped test contract. See
  Non-goals for the residual window and the `doneAt` follow-up candidate.
- [TRADEOFF] `fireInteractionReaction`'s fix (finding #5) prefers silence over building a new
  machine-side BUSY badge — the badge is a UI feature addition (Design Gate), out of this
  state-honesty fix's scope. See Non-goals.
- [DECISION] (round 3, N1/N2) a shared, module-level monotonic epoch counter — not a per-event
  object clone or a WeakMap keyed on the catalog object — because `triggerInteractiveEvent` and
  `fireWithCast` are independent entry points that must agree on ONE "what's live right now"
  answer, and the catalog objects (`EVENT_BY_ID`) are intentionally reused across fires.
- [TRADEOFF] (round 3) a stale epoch makes `endEventEpochIfLive`/every deferred step a FULL no-op —
  it does not even release its own captured `participants` — because an agent released early from
  event A may since have been picked up by event B, and touching it would clobber B, not just leave
  A's bookkeeping incomplete.

## Files

- `src/systems/officeLife.js` — `REQUIRED_ACTORS`, `hasRequiredActors`, `fireWithCast`,
  `triggerInteractiveEvent`, `fireInteractionReaction`, every `EVENT_HANDLERS` entry with a
  deferred step, `executeEvent`, the `lunch-nap` time-linked block, and the mid-event-abandonment
  tracking in `startOfficeLife`'s `store.subscribe` callback — now all epoch-guarded
  (`beginEventEpoch`/`isStaleEpoch`/`endEventEpochIfLive`).
- `src/inference/idleGapInfer.js` — `tick()` carry-forward.
- `src/systems/store.js` — `buildExtEntry` (isInferred param), `applyExternalStatus` (release-on-
  real-status).
- `tests/avo184-equivalence.test.js`, `tests/idleGapInfer.test.js`, `tests/interactiveEventGate.test.js`
  — updated red-first coverage for AC-1..AC-5 and AC-8.
- `tests/requiredActorsGate.test.js`, `tests/groupEventDeferredAvailability.test.js`,
  `tests/activeEventAbandonment.test.js`, `tests/fireWithCastRequiredActorsScheduler.test.js` — new,
  cover AC-1, AC-3/AC-4 (deferred-step recheck), AC-7, and AC-9 respectively.
- `tests/eventEpochRace.test.js` — new, covers AC-10 (N1) and AC-11 (N2); both cases
  mutation-verified by hand (`isStaleEpoch` forced to always return `false` turned both red;
  restoring it turned both green).

## Rollback

Revert this branch's commits, or `git reset` to the Diff Base SHA on this feature branch only. All
touched fields are transient runtime store state (not persisted, not migrated) — no data-shape
rollback needed.

## References

- ADR-007 (dialogue channel separation + honesty gate), ADR-008 (no fabricated need/ambient honesty)
- `docs/specs/living-office-events.md` (Phase 2/3/4 event decision framework)
- `docs/specs/idle-gap-inference.md` (#C)
- AVO-191 / AVO-194 (`docs/specs/_shipped-log.md`) — prior fixes of this exact defect class
