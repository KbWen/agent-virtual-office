import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startOfficeLife, triggerInteractiveEvent } from '../src/systems/officeLife.js'
import { TIME_CHECK_INTERVAL } from '../src/systems/constants.js'

// Minimal fake store — officeLife only calls getState() and the actions it returns.
function makeFakeStore() {
  let updateTimeCalls = 0
  const state = {
    isPaused: false,
    activeEvent: null,
    agents: {
      dev: { id: 'dev', inGroupEvent: false, behavior: 'typing', expression: 'normal', position: { x: 100, y: 100 } },
      qa: { id: 'qa', inGroupEvent: false, behavior: 'typing', expression: 'normal', position: { x: 200, y: 200 } },
    },
    externalStatus: {},
    hour: 9,
  }
  const api = {
    ...state,
    updateTime: () => { updateTimeCalls++ },
    setActiveEvent: () => {},
    clearActiveEvent: () => {},
    setAgentBehavior: () => {},
    setAgentGroupEvent: () => {},
    setMultipleAgentGroupEvents: () => {},
    clearAgentGroupEvent: () => {},
    clearBubble: () => {},
  }
  return {
    getState: () => api,
    _updateTimeCalls: () => updateTimeCalls,
  }
}

describe('officeLife — lifecycle teardown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00')) // Monday, 09:00 — no time-linked event
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('cleanup stops the time interval — updateTime is not called after teardown', () => {
    const store = makeFakeStore()
    const cleanup = startOfficeLife(store)

    vi.advanceTimersByTime(TIME_CHECK_INTERVAL * 2)
    const callsBeforeCleanup = store._updateTimeCalls()
    expect(callsBeforeCleanup).toBeGreaterThanOrEqual(2)

    cleanup()
    vi.advanceTimersByTime(TIME_CHECK_INTERVAL * 5)
    // No further updateTime calls — the interval was cleared.
    expect(store._updateTimeCalls()).toBe(callsBeforeCleanup)
  })

  it('double-init without cleanup fully tears down the prior instance (no leaked time interval)', () => {
    const storeA = makeFakeStore()
    startOfficeLife(storeA) // intentionally NOT cleaned up — simulates HMR / missed cleanup

    vi.advanceTimersByTime(TIME_CHECK_INTERVAL)
    const aCallsAtReinit = storeA._updateTimeCalls()
    expect(aCallsAtReinit).toBeGreaterThanOrEqual(1)

    // Re-init: the guard must cancel storeA's intervals, not leak them alongside storeB's.
    const storeB = makeFakeStore()
    const cleanupB = startOfficeLife(storeB)

    vi.advanceTimersByTime(TIME_CHECK_INTERVAL * 3)
    // storeA's time interval must be dead — its updateTime count is frozen.
    expect(storeA._updateTimeCalls()).toBe(aCallsAtReinit)
    // storeB's interval is the only live one.
    expect(storeB._updateTimeCalls()).toBeGreaterThanOrEqual(3)

    cleanupB()
  })

  it('teardown cancels in-flight interactive events — deferred callbacks do not fire after cleanup', () => {
    const store = makeFakeStore()
    const cleanup = startOfficeLife(store)

    // Trigger a multi-stage interactive event (review-debate has 6s/12s deferred steps).
    const triggered = triggerInteractiveEvent(store, 'review-debate')
    expect(triggered).toBe(true)

    const setBehaviorSpy = vi.spyOn(store.getState(), 'setAgentBehavior')
    cleanup() // tears down before the 6s/12s callbacks fire

    // Advance past every deferred step — none should run against the torn-down store.
    vi.advanceTimersByTime(20000)
    expect(setBehaviorSpy).not.toHaveBeenCalled()
  })
})
