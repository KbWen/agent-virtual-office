// rem-honest-office-events review round 2, finding #2 (MEDIUM, blocking) — releasing an agent
// (finding #3's store.js fix) can leave the event live over an EMPTY cast: the reviewer's own probe
// against the REAL store showed pm getting `working` at t=1s, and at t=13s `activeEvent` was still
// `pm-all-meeting` with nobody in group; same for `deploy-success` when ops is released. Uses the
// REAL zustand store (not a fake shim) so the officeLife.js `store.subscribe` auto-clear actually
// runs — this is the exact mechanism under test, and a fake store's subscribe would not exercise it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { startOfficeLife, triggerInteractiveEvent } from '../src/systems/officeLife.js'
import { useOfficeStore } from '../src/systems/store.js'

describe('activeEvent is cleared when its cast is abandoned mid-event (review round 2, finding #2)', () => {
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

  it('pm-all-meeting: pm released to a real "working" status clears activeEvent (reviewer\'s t=1s/t=13s probe)', () => {
    expect(triggerInteractiveEvent(useOfficeStore, 'pm-all-meeting')).toBe(true)
    expect(useOfficeStore.getState().activeEvent?.id).toBe('pm-all-meeting')
    expect(useOfficeStore.getState().agents.pm.inGroupEvent).toBe(true)

    vi.advanceTimersByTime(1000)   // t=1s: pm gets a real signal
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'pm', status: 'working' }])
    expect(useOfficeStore.getState().agents.pm.inGroupEvent).toBe(false)   // released (finding #3)
    // The scene is now empty (stage 2 hasn't locked anyone else yet) — must clear right away, not
    // ride out the rest of the 18000ms duration with a phantom banner.
    expect(useOfficeStore.getState().activeEvent).toBeNull()

    vi.advanceTimersByTime(12000)  // t=13s: reviewer's probe point — stage 2 (2500ms) already ran
    expect(useOfficeStore.getState().activeEvent).toBeNull()
    const anyInGroup = Object.values(useOfficeStore.getState().agents).some((a) => a.inGroupEvent)
    expect(anyInGroup).toBe(false)
  })

  it('deploy-success: ops released to a real "working" status clears activeEvent', () => {
    // A direct setState transition to ops.status='done' is itself a real-seed EDGE (living-office
    // Phase 4) and fires deploy-success immediately via startOfficeLife's own subscription — no
    // need to also call triggerInteractiveEvent (which would just be refused by the mutex).
    useOfficeStore.setState({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } })
    expect(useOfficeStore.getState().activeEvent?.id).toBe('deploy-success')
    expect(useOfficeStore.getState().agents.ops.inGroupEvent).toBe(true)

    vi.advanceTimersByTime(500)
    useOfficeStore.getState().applyExternalStatus([{ agentId: 'ops', status: 'working' }])
    expect(useOfficeStore.getState().agents.ops.inGroupEvent).toBe(false)
    expect(useOfficeStore.getState().activeEvent).toBeNull()

    vi.advanceTimersByTime(9000)  // well inside the original 10000ms duration
    expect(useOfficeStore.getState().activeEvent).toBeNull()
  })

  it('regression: a normally-running event (no release) is NOT cleared early', () => {
    expect(triggerInteractiveEvent(useOfficeStore, 'pm-all-meeting')).toBe(true)
    vi.advanceTimersByTime(3000)   // past stage 2 (2500ms) — pm never released
    expect(useOfficeStore.getState().activeEvent?.id).toBe('pm-all-meeting')
  })

  it('regression: an unrelated store tick before dog-visit\'s first staggered lock does not clear it prematurely', () => {
    // dog-visit locks its first participant via a setTimeout (even i=0 is async) — there is a real
    // window right after setActiveEvent where activeEvent is set but nobody is in-group yet. An
    // unrelated set() call landing in that window (e.g. a position/time tick) must not be mistaken
    // for "abandoned" (the trackedEventHadParticipant grace-window guard).
    expect(triggerInteractiveEvent(useOfficeStore, 'dog-visit')).toBe(true)
    expect(useOfficeStore.getState().activeEvent?.id).toBe('dog-visit')
    useOfficeStore.setState((s) => ({ hour: s.hour }))   // unrelated tick, touches neither field
    expect(useOfficeStore.getState().activeEvent?.id).toBe('dog-visit')   // NOT cleared
    vi.advanceTimersByTime(2500)   // past the staggered locks — runs normally
    expect(useOfficeStore.getState().activeEvent?.id).toBe('dog-visit')
    expect(Object.values(useOfficeStore.getState().agents).some((a) => a.inGroupEvent)).toBe(true)
  })
})
