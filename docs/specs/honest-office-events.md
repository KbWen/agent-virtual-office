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

## Round 4 (2026-09-26 second follow-up review) additions

The round-3 epoch fix (above) itself introduced one HIGH regression, once a genuine same-tick
double-fire is possible: `fireWithCast` never actually verified an event wasn't ALREADY active —
every call SITE individually checked a (sometimes stale) `state.activeEvent` snapshot before
calling it, but the Friday-15:00 time-linked block calls `fireWithCast` TWICE in the SAME tick
(`tea-break` then `group-meeting`) off ONE stale snapshot, with no re-check between the two calls.

9. **F1 (HIGH)**: the second `fireWithCast` call silently superseded the first event's epoch via
   `beginEventEpoch()`. The first event's cast then had no release path left: its own
   duration-cleanup timer correctly (per round 3) no-ops as stale, and it was never part of the
   second event's cast either — it stayed `inGroupEvent: true` forever with `activeEvent: null`
   (`doSchedule`/the watchdog both skip in-group agents — permanently frozen), and it also
   permanently disabled the round-2 abandonment auto-clear (that check needs `anyInGroup` to
   become false at some point for the CURRENT epoch, but the stranded agents keep it true for
   every later epoch that never claimed them). Reproduced against the real store: 18/20 runs
   stranded on the round-3 HEAD; 0/20 on the round-1 and round-2 bases (neither had the epoch
   mechanism yet, so a stale cleanup still unconditionally released its own cast, even though the
   mutex/banner correctness was already imperfect there).
   **Fix**: `fireWithCast` now refuses (returns `false`, no side effects — no epoch consumed, no
   `setActiveEvent`) whenever `store.getState().activeEvent` is already set, read FRESH at call
   time rather than trusting the caller's snapshot. This is the single-choke event mutex the
   module's comments always assumed existed, and it also covers any other future same-tick double
   fire, not just this one Friday-afternoon case.
   **Correction (round 5, G2)**: this section originally claimed "cadence is unaffected... no
   change to which random ticks happen." That was FALSE and went unchecked — see Round 5 below:
   tea-break and group-meeting both use the `random-2-3` cast rule, and since tea-break's block is
   checked first in the same time-linked tick, it deterministically wins the mutex every Friday
   15:00, permanently starving group-meeting rather than merely losing one race. The fix for THAT
   is Round 5's G2, not this one.
10. **F2 (test-coverage gap)**: the round-3 tests exercised the epoch guard on `dog-visit`'s
    staggered lock and the general cleanup timer, but not `group-stretch`'s staggered lock (a
    structurally identical site) or `lunch-nap`'s cleanup specifically using ITS OWN captured
    epoch rather than whatever is currently live. Added one test per gap
    (`tests/eventEpochRace.test.js`), each hand mutation-verified.

**F3 (LOW)**: the `food-delivery`/`deploy-success` crew reaction-bubble clear timers were ALSO
epoch-gated (round 3) — meaning an abandoned event strands that fabricated reaction bubble
indefinitely (until `doSchedule` happens to overwrite it), since the clear itself never runs.
Fixed: gate the clear per-agent instead, on bubble IDENTITY (clear only if that agent's `bubble`
is still the exact value this reaction set) — an abandoned event now still cleans up its own
stray bubbles, and a real hook bubble or a newer event's bubble that has since replaced it is
never touched.

**F4 (Work Log hygiene, LOW)**: a fresh reviewer flagged that 3 of this Work Log's own validator
WARNs were mischaracterized as "pre-existing" in a prior Evidence entry. Corrected in the Work Log
directly (Session Info gained a truthful `Guardrails loaded:` receipt and the Drift Log gained an
ADR Coverage Check record, both stamped at the time they were actually written, not backdated; the
Evidence entry's phrasing was corrected, not the reviewer's own findings).

## Round 5 (2026-09-26 third follow-up review) additions

11. **G1 (MEDIUM, test-discrimination gap)**: the round-4 Friday-15:00 test used
    `Math.random`=0.999 for BOTH tea-break's and group-meeting's `random-2-3` cast selection,
    which picked the SAME cast for both — so whichever one's cleanup ran, the visible outcome
    (something fires, ends cleanly) looked identical whether `fireWithCast`'s mutex line was
    present or removed. The test passed against the actual round-3 bug AND against a mutant that
    deleted the mutex line entirely. **Fix**: `fireWithCast` is now exported (`isAgentAvailable`/
    `eventEligible`/`floorTickAllowed` already set this "exported for tests" precedent) and
    directly tested with two events that require DISJOINT casts (`eureka`→`arch` only,
    `review-debate`→`dev`+`qa`) — an unambiguous, isolated proof of the mutex line specifically,
    independent of which natural call sites happen to collide. Hand mutation-verified: removing
    the mutex line turns this new test red.
12. **G2 (MEDIUM, cadence regression from G1's own round-4 fix)**: `tea-break` and
    `group-meeting` both use the `random-2-3` cast rule, and the Friday-15:00 time-linked block
    checks tea-break's `hour===10||15` condition BEFORE group-meeting's `day===5&&hour===15`
    condition. Once `fireWithCast` had a working mutex (round 4), tea-break's check ran first
    every single Friday-15:00 tick, claimed the mutex, and group-meeting's `fireWithCast` call was
    then ALWAYS refused — permanently, not merely losing one race. Group-meeting's Friday social
    boost effectively stopped firing. **Fix (decided by the orchestrator)**: Friday 15:00 hands
    its slot to `group-meeting` instead of `tea-break` — tea-break's condition becomes
    `hour===10 || (hour===15 && !isFriday3pm)`, and a new `isFriday3pm` block fires
    `group-meeting` in tea-break's place. Tea-break unconditionally keeps 10:00 every day and
    15:00 on every OTHER day; the only change is which ONE event owns the Friday-15:00 slot.
    New tests assert Friday→`group-meeting`, Thursday→`tea-break`.
13. **F3 follow-up (LOW)**: the round-4 bubble-identity fix compared bubble TEXT — but
    `eventBubble`'s pools are not guaranteed disjoint (a phrase can legitimately repeat across
    pools, or the same pool can hand two different paints on the same agent the identical line),
    so a text-only check is not a true per-instance identity. **Fix**: added a per-paint monotonic
    token (module-level `Map<agentId, token>`), checked ALONGSIDE the text (not instead of it —
    the text check still guards against a fully external bubble overwrite the token map has no
    visibility into). New test forces an identical-text collision via the `rng()` seam
    (`src/systems/rng.js`, NOT `Math.random` — `eventBubble` routes through its own seeded seam)
    and proves the newer instance's bubble survives the older instance's stale clear.
14. **F4 follow-up (LOW)**: the Drift Log claimed ADR-010 was cited in `## External References`;
    it was not (the ADR IS a genuine covering ADR for `store.js` — the fact was right, the
    citation was simply missing). Added the row rather than removing the claim.

**Work Log compaction (governance, not a code finding)**: the active Work Log exceeded 12KB again.
Per `.agent/workflows/handoff.md §6`, older rounds' Review Feedback/Red Team Findings/Security
Findings (rounds 1-3, already resolved) were moved WHOLE — byte-identical, not reworded — to
`.agentcortex/context/archive/work/fix-honest-office-events-20260926-part1.md`, with a one-line
pointer left in the active log. This is the legitimate mechanism for what an earlier round did
improperly in place (see the active Work Log's Drift Log governance-correction entry).

## Acceptance Criteria

**Target Files** (the diff for AC-1..AC-17 below):
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
- AC-12: `fireWithCast` refuses to fire (returns `false`, no side effects) whenever an event is
  already active, even when the caller's own snapshot says otherwise (F1).
- AC-13: `group-stretch`'s staggered lock and `lunch-nap`'s duration-cleanup are covered by the
  same epoch-liveness guarantee as `dog-visit`'s (F2 — M3/M4 mutation-verified).
- AC-14: a crew reaction bubble (`food-delivery`/`deploy-success`) is cleared once its own timer
  elapses even when the event that set it has since been abandoned (F3).
- AC-15: `fireWithCast` refuses a second event while one is active — proven directly, via two
  events with disjoint required casts, independent of any specific natural call-site collision (G1).
- AC-16: Friday 15:00 fires `group-meeting`; every other day's 15:00 (and every day's 10:00) still
  fires `tea-break` (G2).
- AC-17: a crew reaction bubble survives a stale, earlier-instance clear even when its text
  coincidentally matches an older instance's — disambiguated by a per-paint token, not text alone
  (F3 follow-up).

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
  mode is "went busy since being cast," not "should now be re-shuffled." Similarly, the mid-event
  abandonment auto-clear (round 2, finding #4) lives in `startOfficeLife`'s existing
  `store.subscribe` callback (co-located with the other reactive/seeded checks) rather than as a
  new dedicated subscription, gated on the round-3 epoch state
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
  answer, and the catalog objects (`EVENT_BY_ID`) are intentionally reused across fires. A stale
  epoch makes `endEventEpochIfLive`/every deferred step a FULL no-op — it does not even release its
  own captured `participants` — because an agent released early from event A may since have been
  picked up by event B, and touching it would clobber B. (Round 5, G1) this same counter, plus
  `fireWithCast` itself, is now exported so the mutex is directly unit-testable rather than only
  provable by tracing every call site — matching the existing "exported for tests" precedent
  already set by `isAgentAvailable`/`eventEligible`/`floorTickAllowed`.
- [DECISION] (round 4, F1) the event mutex lives as a single fresh `store.getState().activeEvent`
  check inside `fireWithCast` itself, not as an extra check at each of its ~6 call sites — every
  call site already believed it had this guarantee (the module's own prior comments assumed it),
  so the bug was that the guarantee didn't actually exist yet, not that call sites were missing a
  check they should each own individually.
- [DECISION] (round 5, G2) Friday 15:00 hands its slot to `group-meeting` instead of firing both
  or dropping either — the orchestrator's call, not re-litigated here. Implemented as a mutually
  exclusive day-branch rather than a priority/ordering tweak inside one shared `if`, so the two
  events' conditions are independently readable and the exclusivity is structural, not incidental
  ordering that a future edit could quietly undo.
- [TRADEOFF] (round 5, F3) the crew-reaction bubble-clear check keeps comparing TEXT and adds a
  per-paint token alongside it, rather than switching to token-only or embedding a hidden marker
  in the rendered string — the text check is the only part of this mechanism with visibility into
  a fully external bubble overwrite (a real hook event, or a different call path), which a
  local-only token map cannot see; an embedded marker risks the bubble-width-fitting measurement
  code (canvas `measureText`) that a prior session hardened for exactly this class of string.

## Files

- `src/systems/officeLife.js` — `REQUIRED_ACTORS`, `hasRequiredActors`, `fireWithCast` (now
  exported, G1), `triggerInteractiveEvent`, `fireInteractionReaction`, every `EVENT_HANDLERS` entry
  with a deferred step, `executeEvent`, the `lunch-nap` time-linked block, and the
  mid-event-abandonment tracking in `startOfficeLife`'s `store.subscribe` callback — now all
  epoch-guarded (`beginEventEpoch`/`isStaleEpoch`/`endEventEpochIfLive`). The Friday-15:00
  time-linked block now fires `group-meeting` instead of `tea-break` (G2). `food-delivery`/
  `deploy-success`'s crew-reaction clear timers now also check a per-paint token
  (`lastReactionToken`, F3 follow-up).
- `src/inference/idleGapInfer.js` — `tick()` carry-forward.
- `src/systems/store.js` — `buildExtEntry` (isInferred param), `applyExternalStatus` (release-on-
  real-status).
- `tests/avo184-equivalence.test.js`, `tests/idleGapInfer.test.js`, `tests/interactiveEventGate.test.js`
  — updated red-first coverage for AC-1..AC-5 and AC-8.
- `tests/requiredActorsGate.test.js`, `tests/groupEventDeferredAvailability.test.js`,
  `tests/activeEventAbandonment.test.js`, `tests/fireWithCastRequiredActorsScheduler.test.js` — new,
  cover AC-1, AC-3/AC-4 (deferred-step recheck), AC-7, and AC-9 respectively.
- `tests/eventEpochRace.test.js` — covers AC-10 (N1), AC-11 (N2), AC-12 (F1, Friday-15:00
  double-fire), AC-13 (F2 — group-stretch M3 + lunch-nap M4). All 4 mutation cases hand-verified
  (N1/N2: `isStaleEpoch` forced `false`; M3: dropped the guard on `group-stretch`'s staggered
  lock; M4: `lunch-nap`'s cleanup passed the current live epoch instead of its own captured one —
  each turned its corresponding test red; restoring turned it green).
- `tests/multiAgentReactionPools.test.js` — pre-existing source-scanning test; unaffected by F3's
  behavior change but its 10-line fan-out lookback window required keeping the new code compact
  (no code/AC change here, just a comment-length constraint discovered while implementing F3).
- `tests/eventEpochRace.test.js` (round 5 additions) — the round-4 "F1" test was replaced by two
  G2 tests (AC-16: Friday→group-meeting, Thursday→tea-break) plus a new direct G1 test (AC-15,
  `fireWithCast` exported and called twice with disjoint casts) and a new F3-token test (AC-17,
  forces an identical-text collision via the `rng()` seam). All hand mutation-verified.

## Rollback

Revert this branch's commits, or `git reset` to the Diff Base SHA on this feature branch only. All
touched fields are transient runtime store state (not persisted, not migrated) — no data-shape
rollback needed.

## References

- ADR-007 (dialogue channel separation + honesty gate), ADR-008 (no fabricated need/ambient honesty)
- `docs/specs/living-office-events.md` (Phase 2/3/4 event decision framework)
- `docs/specs/idle-gap-inference.md` (#C)
- AVO-191 / AVO-194 (`docs/specs/_shipped-log.md`) — prior fixes of this exact defect class
