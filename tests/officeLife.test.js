import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startOfficeLife, triggerInteractiveEvent } from '../src/systems/officeLife.js'
import { TIME_CHECK_INTERVAL } from '../src/systems/constants.js'

// Minimal fake store — officeLife only calls getState() and the actions it returns.
// The agents map is mutated in place so group-event state changes are observable
// (mirrors how the real zustand store survives across an officeLife teardown/re-init).
function makeFakeStore() {
  let updateTimeCalls = 0
  const state = {
    isPaused: false,
    activeEvent: null,
    agents: {
      dev: { id: 'dev', inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 100, y: 100 } },
      qa: { id: 'qa', inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 200, y: 200 } },
    },
    externalStatus: {},
    hour: 9,
  }
  const api = {
    get agents() { return state.agents },
    get isPaused() { return state.isPaused },
    get activeEvent() { return state.activeEvent },
    get externalStatus() { return state.externalStatus },
    get hour() { return state.hour },
    updateTime: () => { updateTimeCalls++ },
    setActiveEvent: (e) => { state.activeEvent = e },
    clearActiveEvent: () => { state.activeEvent = null },
    setAgentBehavior: () => {},
    setAgentGroupEvent: (id, { behavior, expression, bubble, groupTarget } = {}) => {
      if (!state.agents[id]) return
      state.agents[id] = { ...state.agents[id], behavior, expression, bubble: bubble || null, inGroupEvent: true, groupTarget: groupTarget || null }
    },
    setMultipleAgentGroupEvents: (updates) => {
      for (const u of updates) api.setAgentGroupEvent(u.id, u)
    },
    clearAgentGroupEvent: (id) => {
      if (!state.agents[id]) return
      state.agents[id] = { ...state.agents[id], inGroupEvent: false, groupTarget: null }
    },
    clearBubble: (id) => {
      if (!state.agents[id]) return
      state.agents[id] = { ...state.agents[id], bubble: null }
    },
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

  it('teardown mid-event releases participants — no agent stranded inGroupEvent: true', () => {
    const store = makeFakeStore()
    const cleanup = startOfficeLife(store)

    // Start a group event that locks dev + qa into inGroupEvent: true.
    expect(triggerInteractiveEvent(store, 'review-debate')).toBe(true)
    expect(store.getState().agents.dev.inGroupEvent).toBe(true)
    expect(store.getState().agents.qa.inGroupEvent).toBe(true)

    // Tear down BEFORE the executeEvent cleanup timer (event.duration = 18000ms) fires.
    cleanup()

    // The cancelled cleanup timer early-returns and never releases the agents — teardown
    // itself must release them, otherwise doSchedule + watchdog both skip them forever.
    expect(store.getState().agents.dev.inGroupEvent).toBe(false)
    expect(store.getState().agents.qa.inGroupEvent).toBe(false)
    expect(store.getState().activeEvent).toBe(null)
  })

  it('double-init mid-event releases the prior instance participants', () => {
    const store = makeFakeStore()
    startOfficeLife(store) // intentionally NOT cleaned up — simulates HMR / missed cleanup

    expect(triggerInteractiveEvent(store, 'review-debate')).toBe(true)
    expect(store.getState().agents.dev.inGroupEvent).toBe(true)

    // Re-init without cleanup: the double-init guard must release the prior instance's
    // stranded group-event participants, not just cancel its timers.
    const cleanupB = startOfficeLife(store)
    expect(store.getState().agents.dev.inGroupEvent).toBe(false)
    expect(store.getState().agents.qa.inGroupEvent).toBe(false)

    cleanupB()
  })
})
