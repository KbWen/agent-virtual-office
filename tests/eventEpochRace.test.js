// rem-honest-office-events review round 3 (N1/N2) — the empty-cast auto-clear added in round 2
// (finding #2) introduced two races because EVENT_BY_ID's catalog objects are SHARED: two
// 'tea-break' fires reuse the SAME object, so `activeEvent` identity alone cannot tell an OLD,
// already-superseded fire's stale timers apart from a NEW one.
//
//   N1 — event A's own duration-cleanup timer fires unconditionally at A's full duration and
//        clobbers a LATER event B that has since taken over (A was cleared early, B fired,
//        A's stale timer still runs at A's original schedule and clears B's activeEvent + cast).
//   N2 — a staggered handler (dog-visit/group-stretch) whose first-locked participant is released
//        early (clearing the event via finding #2) keeps locking its REMAINING staggered
//        participants anyway, under a null activeEvent (no mutex, no banner).
//
// Fix: every fired event gets a unique epoch (beginEventEpoch/isStaleEpoch/endEventEpochIfLive).
// Every deferred handler step and the cleanup timer act only if their epoch is still live.
//
// Uses the REAL store (like tests/activeEventAbandonment.test.js) so store.subscribe's
// abandonment auto-clear (finding #2) actually runs and can create the race window.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startOfficeLife, triggerInteractiveEvent, fireWithCast } from '../src/systems/officeLife.js'
import { useOfficeStore } from '../src/systems/store.js'
import { TIME_CHECK_INTERVAL } from '../src/systems/constants.js'
import { __setRng, resetRng } from '../src/systems/rng.js'

const st = () => useOfficeStore.getState()
const inGroup = () => Object.entries(st().agents).filter(([, a]) => a.inGroupEvent).map(([id]) => id)

describe('event epoch guards against stale-timer races (round 3, N1/N2)', () => {
  let teardown
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00'))
    useOfficeStore.setState({ isPaused: false, activeEvent: null, externalStatus: {}, mood: 'normal' })
    teardown = startOfficeLife(useOfficeStore)
  })
  afterEach(() => {
    if (teardown) teardown()
    useOfficeStore.setState({ activeEvent: null, externalStatus: {} })
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('N1: a stale cleanup timer from an early-cleared event A does not clobber a later event B', () => {
    const ids = Object.keys(st().agents)
    expect(triggerInteractiveEvent(useOfficeStore, 'ac-broken')).toBe(true) // A: duration 15000ms, all agents
    vi.advanceTimersByTime(1000)

    // Every agent (including A's whole cast) goes genuinely busy -> finding #3 releases them all,
    // finding #2's abandonment auto-clear then clears A's activeEvent early.
    st().applyExternalStatus(ids.map((agentId) => ({ agentId, status: 'working' })))
    expect(st().activeEvent).toBeNull()
    expect(inGroup()).toEqual([])

    vi.advanceTimersByTime(1000) // t=2s
    st().applyExternalStatus([{ agentId: 'dev', status: 'done' }, { agentId: 'qa', status: 'done' }])
    expect(triggerInteractiveEvent(useOfficeStore, 'tea-break')).toBe(true) // B: duration 18000ms
    expect(st().activeEvent?.id).toBe('tea-break')
    const bCast = inGroup()
    expect(bCast.length).toBeGreaterThanOrEqual(2)

    // t=15.1s: A's ORIGINAL cleanup timer (scheduled for A's own 15000ms duration, fired ~t=0) is
    // due right about now. It must be a no-op — B is still well inside its own 18000ms duration.
    vi.advanceTimersByTime(13100)
    expect(st().activeEvent?.id).toBe('tea-break')
    expect(inGroup()).toEqual(bCast)
  })

  it('N2: an abandoned staggered event does not keep locking its remaining cast under a null activeEvent', () => {
    expect(triggerInteractiveEvent(useOfficeStore, 'dog-visit')).toBe(true)
    vi.advanceTimersByTime(1) // first staggered lock (i=0) fires
    const first = inGroup()
    expect(first.length).toBeGreaterThanOrEqual(1)

    vi.advanceTimersByTime(99) // t=100ms — still well before the 2nd staggered lock (800ms)
    st().applyExternalStatus(first.map((agentId) => ({ agentId, status: 'working' })))
    expect(st().activeEvent).toBeNull()  // released -> scene empty -> finding #2 auto-clears
    expect(inGroup()).toEqual([])

    vi.advanceTimersByTime(3000) // past every remaining staggered lock (800/1600/2400ms...)
    expect(st().activeEvent).toBeNull()
    expect(inGroup()).toEqual([])   // nobody gets locked into a dead event
  })
})

// rem-honest-office-events review round 4 — F1 (HIGH regression introduced by the round-3 epoch
// fix) and F2 (test-coverage gap for the same fix, group-stretch + lunch-nap).
describe('fireWithCast event mutex + epoch coverage (round 4, F1/F2)', () => {
  let teardown
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00'))
    useOfficeStore.setState({ isPaused: false, activeEvent: null, externalStatus: {}, mood: 'normal' })
    teardown = startOfficeLife(useOfficeStore)
  })
  afterEach(() => {
    if (teardown) teardown()
    useOfficeStore.setState({ activeEvent: null, externalStatus: {} })
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('G2 (review round 5): Friday 15:00 fires group-meeting, not tea-break — no stranded cast either way', () => {
    // Push the daily/rare schedulers' next random tick far out so they cannot interfere with
    // this deterministic hour-15 tick, and make the SOCIAL cast-selection deterministic too.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    vi.setSystemTime(new Date('2026-01-09T15:00:05')) // a Friday

    vi.advanceTimersByTime(TIME_CHECK_INTERVAL + 100) // fires the hour-15 time-linked tick
    // G2: tea-break and group-meeting now own MUTUALLY EXCLUSIVE day-branches for the 15:00 slot,
    // so group-meeting is the ONLY candidate that even attempts to fire on a Friday — this is no
    // longer a same-tick race the mutex needs to arbitrate (see the dedicated G1 test below for
    // the mutex itself). Confirms the fix this finding actually asked for: Friday's social boost
    // fires again instead of being permanently starved by tea-break winning every race.
    expect(st().activeEvent?.id).toBe('group-meeting')
    expect(inGroup().length).toBeGreaterThan(0)

    // Past the event's duration (20000ms) — nobody stranded, mutex fully released.
    vi.advanceTimersByTime(20100)
    expect(st().activeEvent).toBeNull()
    expect(inGroup()).toEqual([])
  })

  it('G2: Thursday 15:00 still fires tea-break (only Friday hands the slot to group-meeting)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    vi.setSystemTime(new Date('2026-01-08T15:00:05')) // a Thursday

    vi.advanceTimersByTime(TIME_CHECK_INTERVAL + 100)
    expect(st().activeEvent?.id).toBe('tea-break')
    expect(inGroup().length).toBeGreaterThan(0)

    vi.advanceTimersByTime(18100)
    expect(st().activeEvent).toBeNull()
    expect(inGroup()).toEqual([])
  })

  it('G1 (review round 5): fireWithCast refuses a second event while one is active, leaving the first epoch/cast intact', () => {
    // Direct, isolated test of fireWithCast's OWN mutex line — the round-4 test above no longer
    // discriminates it (G2 made the Friday slot mutually exclusive, so there is no natural
    // same-tick double-fire left to race). Two events with DISJOINT required casts (arch-only vs
    // dev+qa) make the outcome unambiguous: if the mutex is missing, the second call would
    // succeed and visibly change both activeEvent and the locked cast.
    const cancelled = { value: false }
    const eventA = { id: 'eureka', participants: ['arch'], duration: 8000 }
    const eventB = { id: 'review-debate', participants: ['dev', 'qa'], duration: 18000 }

    expect(fireWithCast(useOfficeStore, eventA, st(), cancelled)).toBe(true)
    expect(st().activeEvent?.id).toBe('eureka')
    const castA = inGroup()
    expect(castA).toEqual(['arch'])

    expect(fireWithCast(useOfficeStore, eventB, st(), cancelled)).toBe(false)
    expect(st().activeEvent?.id).toBe('eureka')   // still A -- B never touched the mutex
    expect(inGroup()).toEqual(castA)              // A's cast untouched; B never locked dev/qa
  })

  it('F2 (M3): an abandoned group-stretch does not keep locking its remaining cast under a null activeEvent', () => {
    expect(triggerInteractiveEvent(useOfficeStore, 'group-stretch')).toBe(true)
    vi.advanceTimersByTime(1) // first staggered lock (i=0) fires
    const first = inGroup()
    expect(first.length).toBeGreaterThanOrEqual(1)

    vi.advanceTimersByTime(99) // t=100ms — well before the 2nd staggered lock (300ms)
    st().applyExternalStatus(first.map((agentId) => ({ agentId, status: 'working' })))
    expect(st().activeEvent).toBeNull() // released -> scene empty -> finding #2 auto-clears

    vi.advanceTimersByTime(1000) // past every remaining staggered lock (300/600/900ms...)
    expect(st().activeEvent).toBeNull()
    expect(inGroup()).toEqual([]) // nobody gets locked into a dead event
  })

  it('F2 (M4): a superseded lunch-nap does not clobber the later event that took over', () => {
    // hour is derived from the REAL (faked) clock inside updateTime(), not a settable field —
    // set the system time to just before noon, like officeLife.test.js's Fix-1 lunch-nap test.
    vi.setSystemTime(new Date('2026-01-05T11:59:30'))
    vi.spyOn(Math, 'random').mockReturnValue(0) // every agent naps; deterministic cast selection
    vi.advanceTimersByTime(TIME_CHECK_INTERVAL + 100) // crosses into hour 12 -> lunch-nap fires
    expect(st().activeEvent?.id).toBe('lunch-nap')
    const nappers = inGroup()
    expect(nappers.length).toBeGreaterThan(0)

    // Pause the schedulers for the rest of this test — Math.random is pinned to 0, which would
    // otherwise make the daily scheduler's reschedule interval a flat, frequent 60000ms and risk
    // grabbing the mutex during the gaps below. `isPaused` blocks every NEW fire (scheduleDaily/
    // scheduleRare/time-linked) without affecting the already-scheduled cleanup timers under test.
    useOfficeStore.setState({ isPaused: true })

    // Release every napper via a real status -> scene empties -> finding #2 auto-clears the nap
    // early, well before its own 45000ms duration.
    vi.advanceTimersByTime(1000)
    st().applyExternalStatus(nappers.map((agentId) => ({ agentId, status: 'working' })))
    expect(st().activeEvent).toBeNull()
    st().applyExternalStatus(nappers.map((agentId) => ({ agentId, status: 'idle' })))

    // No catalog event lasts 45000ms, so keep SOMETHING alive continuously (re-firing tea-break
    // — 18000ms each — right as each instance naturally ends) until we're past the nap's ORIGINAL
    // 45000ms mark, rather than picking one long-lived "survivor" that doesn't exist.
    const fireTeaBreak = () => {
      useOfficeStore.setState({ isPaused: false })
      const fired = triggerInteractiveEvent(useOfficeStore, 'tea-break')
      useOfficeStore.setState({ isPaused: true })
      expect(fired).toBe(true)
      return inGroup()
    }
    fireTeaBreak()                     // elapsed-since-nap = 1000; ends at 19000
    vi.advanceTimersByTime(18000)
    fireTeaBreak()                     // elapsed-since-nap = 19000; ends at 37000
    vi.advanceTimersByTime(18000)
    const cCast = fireTeaBreak()       // elapsed-since-nap = 37000; still alive past 45000

    // The nap's ORIGINAL 45000ms cleanup (captured at its own epoch) falls due here, 8100ms into
    // this THIRD chained fire's 18000ms life. If it used the CURRENT live epoch instead of its
    // own captured one (M4), this check would trivially pass and clobber it.
    vi.advanceTimersByTime(8100) // elapsed-since-nap = 45100
    expect(st().activeEvent?.id).toBe('tea-break')
    expect(inGroup()).toEqual(cCast)
  })
})

// rem-honest-office-events review round 5, F3 follow-up (LOW) — bubble-identity comparison used
// TEXT alone, but `eventBubble` pools are not guaranteed disjoint (the reviewer noted a phrase
// like "finally..." can appear in more than one pool). Two crew-reaction instances on the SAME
// agent that happen to draw the IDENTICAL line must not let an EARLIER instance's stale clear
// timer wipe out a LATER, still-legitimate instance's bubble.
describe('crew reaction-bubble clear uses a per-paint token, not text alone (round 5, F3 follow-up)', () => {
  let teardown
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00'))
    useOfficeStore.setState({ isPaused: false, activeEvent: null, externalStatus: {}, mood: 'normal' })
    teardown = startOfficeLife(useOfficeStore)
  })
  afterEach(() => {
    if (teardown) teardown()
    useOfficeStore.setState({ activeEvent: null, externalStatus: {} })
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetRng()
  })

  it('a stale clear from an earlier reaction does not wipe a later, identical-text reaction on the same agent', () => {
    // eventBubble() draws through the seeded rng() seam (src/systems/rng.js), NOT Math.random
    // directly -- pin it to 0 so eventBubble('food-react') deterministically draws the SAME pool
    // entry every time, forcing the identical-text collision this test exists to survive,
    // regardless of what the actual pool contents happen to be today. Everything else in
    // officeLife.js (participant order, jitter, interval scheduling) still uses raw Math.random,
    // which is left alone here since 'all' participant order doesn't depend on it.
    __setRng(() => 0)

    expect(triggerInteractiveEvent(useOfficeStore, 'food-delivery')).toBe(true) // fire #1
    vi.advanceTimersByTime(2000) // crew reaction #1 painted
    const crewId = Object.keys(st().agents).find((id) => st().agents[id].behavior === 'eat-snack')
    expect(crewId).toBeTruthy()
    const bubble1 = st().agents[crewId].bubble
    expect(bubble1).toBeTruthy()

    // Free the mutex the way an abandonment would (release the bringer too, so fire #2 sees the
    // full roster again and picks the same crew ordering).
    const bringerId = Object.keys(st().agents).find((id) => st().agents[id].inGroupEvent)
    st().clearAgentGroupEvent(bringerId)
    useOfficeStore.setState({ activeEvent: null })

    expect(triggerInteractiveEvent(useOfficeStore, 'food-delivery')).toBe(true) // fire #2
    vi.advanceTimersByTime(2000) // crew reaction #2 painted on the SAME crewId
    const bubble2 = st().agents[crewId].bubble
    expect(bubble2).toBe(bubble1) // confirms the identical-text setup this test relies on

    // Fire #1's crew reaction was painted at its own t=2000, so its clear timer (4000ms later)
    // falls due here -- fire #2's own crew reaction was painted 2000ms later than fire #1's, so
    // its clear timer is NOT due yet. The bubble must survive: it belongs to fire #2 now.
    vi.advanceTimersByTime(2000)
    expect(st().agents[crewId].bubble).toBe(bubble2)

    // Fire #2's OWN clear timer falls due here and correctly clears its own bubble.
    vi.advanceTimersByTime(2000)
    expect(st().agents[crewId].bubble).toBeNull()
  })

  it('M5 regression: the crew-reaction clear does not depend on epoch liveness -- it still fires after the event is abandoned', () => {
    expect(triggerInteractiveEvent(useOfficeStore, 'food-delivery')).toBe(true)
    vi.advanceTimersByTime(2000) // crew reaction painted
    const crewId = Object.keys(st().agents).find((id) => st().agents[id].behavior === 'eat-snack')
    expect(crewId).toBeTruthy()
    expect(st().agents[crewId].bubble).toBeTruthy()

    // Abandon the event: release the bringer via a real status -> scene empties -> finding #2
    // auto-clears activeEvent AND invalidates the epoch (isStaleEpoch would now read true for it).
    const bringerId = Object.keys(st().agents).find((id) => st().agents[id].inGroupEvent)
    st().applyExternalStatus([{ agentId: bringerId, status: 'working' }])
    expect(st().activeEvent).toBeNull()

    // The reaction's OWN clear timer (4000ms from its paint, i.e. absolute t=6000) falls due
    // here. It must STILL fire -- clearing this crew bubble is gated on bubble identity
    // (text+token), never on the event still being "live". If a future edit re-added an
    // isStaleEpoch(epoch) check to this clear (the bug F3 originally fixed), the now-stale epoch
    // would make it a no-op and strand the bubble indefinitely.
    vi.advanceTimersByTime(4000)
    expect(st().agents[crewId].bubble).toBeNull()
  })

  it('a stale reaction clear must not wipe a REAL status bubble that has since replaced it', () => {
    expect(triggerInteractiveEvent(useOfficeStore, 'food-delivery')).toBe(true)
    vi.advanceTimersByTime(2000) // crew reaction painted
    const crewId = Object.keys(st().agents).find((id) => st().agents[id].behavior === 'eat-snack')
    expect(crewId).toBeTruthy()
    const reactionBubble = st().agents[crewId].bubble
    expect(reactionBubble).toBeTruthy()

    // The SAME agent now gets a REAL tracked status with a REAL bubble, before the reaction's own
    // clear timer fires. Nothing else touches `lastReactionToken` for this agent in between, so a
    // token-only check (with the text check removed) would wrongly still consider this "mine".
    st().applyExternalStatus([{ agentId: crewId, status: 'working', task: 'real task' }])
    const realBubble = st().agents[crewId].bubble
    expect(realBubble).toBeTruthy()
    expect(realBubble).not.toBe(reactionBubble)

    // The reaction's ORIGINAL clear timer (4000ms from its OWN paint, i.e. absolute t=6000) falls
    // due here. It must NOT wipe the real bubble -- the text no longer matches what this reaction
    // painted.
    vi.advanceTimersByTime(4000)
    expect(st().agents[crewId].bubble).toBe(realBubble)
  })
})
