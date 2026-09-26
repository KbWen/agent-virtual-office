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
import { startOfficeLife, triggerInteractiveEvent } from '../src/systems/officeLife.js'
import { useOfficeStore } from '../src/systems/store.js'

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
