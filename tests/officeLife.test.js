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
    setAgentBehavior: (id, behavior, expression, bubble) => {
      if (!state.agents[id]) return
      // Mirror the real store: behavior/expression/bubble update, inGroupEvent untouched.
      state.agents[id] = {
        ...state.agents[id],
        behavior,
        expression: expression || state.agents[id].expression,
        bubble: bubble || null,
      }
    },
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
    _setHour: (h) => { state.hour = h },
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

// ─── Rare-event ("participants": "all") full lifecycle — R69 fix coverage ───
// Before R69, rare events had no `participants` field so pickParticipants returned
// pool.slice(0,3); R69 added "all". These tests exercise the COMPLETE lifecycle of a
// rare event (mark inGroupEvent → run → release on duration) end-to-end, which had
// zero coverage — the prior officeLife tests only exercise teardown/cancel paths.
describe('officeLife — rare event (participants: all) lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00'))
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  // Every rare event id with its duration, from src/config/officeEvents.json.
  const RARE = [
    { id: 'dog-visit', duration: 20000 },
    { id: 'ac-broken', duration: 15000 },
    { id: 'boss-visit', duration: 10000 },
    { id: 'group-stretch', duration: 8000 },
  ]

  for (const { id, duration } of RARE) {
    it(`${id}: all participants are marked inGroupEvent then released on duration`, () => {
      const store = makeFakeStore()
      const cleanup = startOfficeLife(store)

      expect(triggerInteractiveEvent(store, id)).toBe(true)
      expect(store.getState().activeEvent?.id).toBe(id)

      // Advance past staggered setAgentGroupEvent callbacks (dog-visit: i*800, group-stretch: i*300).
      vi.advanceTimersByTime(6000)
      // dev has a HOME_POSITIONS entry — boss-visit (home-filtered) and the others all
      // mark a static roster agent into the group event.
      expect(store.getState().agents.dev.inGroupEvent).toBe(true)

      // After the event duration elapses, executeEvent's cleanup releases everyone.
      vi.advanceTimersByTime(duration + 1000)
      expect(store.getState().agents.dev.inGroupEvent).toBe(false)
      expect(store.getState().agents.qa.inGroupEvent).toBe(false)
      expect(store.getState().agents.dev.groupTarget).toBe(null)
      expect(store.getState().activeEvent).toBe(null)

      cleanup()
    })
  }

  it('rare event releases participants even when a dynamic worktree agent is present', () => {
    // pickParticipants("all") returns Object.keys(agents) — including a composite
    // worktree id. group-stretch sets EVERY participant inGroupEvent; the cleanup
    // must release the dynamic agent too, not strand it inGroupEvent: true.
    const store = makeFakeStore()
    // Add a dynamic worktree agent.
    store.getState().agents['feat-x~dev'] = {
      id: 'feat-x~dev', session: 'feat-x', inGroupEvent: false, groupTarget: null,
      behavior: 'typing', expression: 'normal', bubble: null, position: { x: 200, y: 80 },
    }
    const cleanup = startOfficeLife(store)

    expect(triggerInteractiveEvent(store, 'group-stretch')).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(store.getState().agents['feat-x~dev'].inGroupEvent).toBe(true)

    vi.advanceTimersByTime(9000) // past duration 8000
    expect(store.getState().agents['feat-x~dev'].inGroupEvent).toBe(false)
    expect(store.getState().agents['feat-x~dev'].groupTarget).toBe(null)

    cleanup()
  })

  it('a second event cannot start while a rare event is active', () => {
    const store = makeFakeStore()
    const cleanup = startOfficeLife(store)

    expect(triggerInteractiveEvent(store, 'boss-visit')).toBe(true)
    // activeEvent is set — a concurrent trigger must be refused.
    expect(triggerInteractiveEvent(store, 'dog-visit')).toBe(false)
    expect(store.getState().activeEvent?.id).toBe('boss-visit')

    vi.advanceTimersByTime(11000)
    expect(store.getState().activeEvent).toBe(null)
    // Once cleared, a new event can start again.
    expect(triggerInteractiveEvent(store, 'dog-visit')).toBe(true)

    cleanup()
  })
})

// ─── R72: hour-14 post-lunch drowsiness must not corrupt group events ───
// The 14:00 drowsiness time-event applies a 'tired' expression via setAgentBehavior,
// which does NOT honour inGroupEvent. Before R72 it overwrote the behavior/
// expression/bubble of agents mid-group-event (a standup straddling 14:00) and the
// 30s release reverted ANY 'tired' agent — including an organic 'tired'. The fix
// snapshots the precise drowsy set and skips in-group agents in both loops.
describe('officeLife — hour-14 drowsiness respects group events (R72)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Monday so no Friday group-meeting fires alongside the hour-14 branch.
    vi.setSystemTime(new Date('2026-01-05T13:59:30'))
    // Pin Math.random so the random daily/rare event schedulers in startOfficeLife
    // arm their timers at the FAR end of their ranges (DAILY 180000ms, RARE 600000ms) —
    // far beyond these tests' ~90s advance window. Without this, a daily event could
    // fire mid-test, pick 'dev' as a participant, and clobber the group-event state the
    // test asserts on (stochastic — fails only when the random interval lands in-window).
    // These tests exercise the hour-14 drowsiness branch ONLY; random events are noise.
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does NOT overwrite an agent that is locked in a group event', () => {
    const store = makeFakeStore()
    store._setHour(14)
    const cleanup = startOfficeLife(store)

    // dev is mid group event (e.g. a standup straddling the 14:00 boundary).
    store.getState().setAgentGroupEvent('dev', {
      behavior: 'meeting', expression: 'focused', bubble: 'Standup', groupTarget: null,
    })

    // First time-event interval tick fires the hour-14 drowsiness branch.
    vi.advanceTimersByTime(TIME_CHECK_INTERVAL + 100)

    const dev = store.getState().agents.dev
    // The group event's fields must survive — officeLife owns them during a group event.
    expect(dev.inGroupEvent).toBe(true)
    expect(dev.behavior).toBe('meeting')
    expect(dev.expression).toBe('focused')
    expect(dev.bubble).toBe('Standup')

    // A non-group agent IS made drowsy.
    expect(store.getState().agents.qa.expression).toBe('tired')

    cleanup()
  })

  it('the 30s release reverts only the agents it made drowsy, skipping group events', () => {
    const store = makeFakeStore()
    store._setHour(14)
    const cleanup = startOfficeLife(store)

    // qa is free → becomes drowsy. dev is free at apply time too.
    vi.advanceTimersByTime(TIME_CHECK_INTERVAL + 100)
    expect(store.getState().agents.qa.expression).toBe('tired')
    expect(store.getState().agents.dev.expression).toBe('tired')

    // dev joins a group event AFTER being made drowsy — the 30s release must not
    // clobber the group event even though dev's expression was 'tired'.
    store.getState().setAgentGroupEvent('dev', {
      behavior: 'meeting', expression: 'happy', bubble: 'Meeting', groupTarget: null,
    })

    // 30s release fires.
    vi.advanceTimersByTime(30000)

    // qa reverted to normal; dev's in-progress group event untouched.
    expect(store.getState().agents.qa.expression).toBe('normal')
    expect(store.getState().agents.dev.inGroupEvent).toBe(true)
    expect(store.getState().agents.dev.expression).toBe('happy')
    expect(store.getState().agents.dev.behavior).toBe('meeting')

    cleanup()
  })
})

// ─── pickParticipants filtering behaviour ────────────────────────────
// pickParticipants is private — tested via triggerInteractiveEvent.
// Key invariant: array-participant events exclude externally-busy agents;
// 'all' events fall back to the full roster when <2 agents are available.
describe('officeLife — pickParticipants filtering', () => {
  // 3-agent fake store so we can block one and still have ≥2 available.
  function make3AgentStore(externalStatus = {}) {
    const state = {
      isPaused: false, activeEvent: null,
      agents: {
        dev:  { id: 'dev',  inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 100, y: 100 } },
        qa:   { id: 'qa',   inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 200, y: 200 } },
        arch: { id: 'arch', inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 300, y: 200 } },
      },
      externalStatus,
      hour: 9,
    }
    const api = {
      get agents()         { return state.agents },
      get isPaused()       { return state.isPaused },
      get activeEvent()    { return state.activeEvent },
      get externalStatus() { return state.externalStatus },
      get hour()           { return state.hour },
      updateTime: () => {},
      setActiveEvent:   (e) => { state.activeEvent = e },
      clearActiveEvent: ()  => { state.activeEvent = null },
      setAgentBehavior: (id, behavior, expression, bubble) => {
        if (!state.agents[id]) return
        state.agents[id] = { ...state.agents[id], behavior, expression: expression || state.agents[id].expression, bubble: bubble || null }
      },
      setAgentGroupEvent: (id, { behavior, expression, bubble, groupTarget } = {}) => {
        if (!state.agents[id]) return
        state.agents[id] = { ...state.agents[id], behavior, expression, bubble: bubble || null, inGroupEvent: true, groupTarget: groupTarget || null }
      },
      setMultipleAgentGroupEvents: (updates) => { for (const u of updates) api.setAgentGroupEvent(u.id, u) },
      clearAgentGroupEvent: (id) => {
        if (!state.agents[id]) return
        state.agents[id] = { ...state.agents[id], inGroupEvent: false, groupTarget: null }
      },
      clearBubble: (id) => {
        if (!state.agents[id]) return
        state.agents[id] = { ...state.agents[id], bubble: null }
      },
    }
    return { getState: () => api }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00'))
    // Pin random so scheduled daily/rare events arm far beyond the test window.
    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  })
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('array participants: both dev+qa free → review-debate locks both', () => {
    const store = make3AgentStore({})
    const cleanup = startOfficeLife(store)

    expect(triggerInteractiveEvent(store, 'review-debate')).toBe(true)
    expect(store.getState().agents.dev.inGroupEvent).toBe(true)
    expect(store.getState().agents.qa.inGroupEvent).toBe(true)
    expect(store.getState().agents.arch.inGroupEvent).toBe(false)

    cleanup()
  })

  it('array participants: dev is working externally → excluded → review-debate handler early-returns (no one locked)', () => {
    const store = make3AgentStore({
      dev: { status: 'working', expiresAt: Date.now() + 300000 },
    })
    const cleanup = startOfficeLife(store)

    // pickParticipants(['dev','qa']) returns ['qa'] only.
    // review-debate handler: if (!participants.includes('dev') || ...) return → no group event
    triggerInteractiveEvent(store, 'review-debate')

    expect(store.getState().agents.dev.inGroupEvent).toBe(false)
    expect(store.getState().agents.qa.inGroupEvent).toBe(false)

    cleanup()
  })

  it('all participants: with ≥2 available, blocked agent is excluded', () => {
    // dev is working → available = [qa, arch] (≥2) → group-stretch uses [qa, arch]
    const store = make3AgentStore({
      dev: { status: 'working', expiresAt: Date.now() + 300000 },
    })
    const cleanup = startOfficeLife(store)

    expect(triggerInteractiveEvent(store, 'group-stretch')).toBe(true)
    vi.advanceTimersByTime(4000) // staggered setAgentGroupEvent callbacks

    expect(store.getState().agents.dev.inGroupEvent).toBe(false)  // excluded (working)
    expect(store.getState().agents.qa.inGroupEvent).toBe(true)
    expect(store.getState().agents.arch.inGroupEvent).toBe(true)

    cleanup()
  })

  it('random-1-neighbor (coffee-spill): always produces 1-2 participants', () => {
    const store = make3AgentStore({})
    const cleanup = startOfficeLife(store)

    expect(triggerInteractiveEvent(store, 'coffee-spill')).toBe(true)
    vi.advanceTimersByTime(3000) // inner 1500ms setTimeout fires

    const locked = Object.values(store.getState().agents).filter((a) => a.inGroupEvent)
    expect(locked.length).toBeGreaterThanOrEqual(1)
    expect(locked.length).toBeLessThanOrEqual(2)

    cleanup()
  })

  it('done/idle external status is treated as available — not excluded', () => {
    const store = make3AgentStore({
      dev: { status: 'done', expiresAt: Date.now() + 10000 },
    })
    const cleanup = startOfficeLife(store)

    // dev is 'done' → isAvailable → included in review-debate
    triggerInteractiveEvent(store, 'review-debate')
    expect(store.getState().agents.dev.inGroupEvent).toBe(true)
    expect(store.getState().agents.qa.inGroupEvent).toBe(true)

    cleanup()
  })
})

// ─── triggerInteractiveEvent guard conditions ─────────────────────────
describe('triggerInteractiveEvent — guards (isPaused, unknown event)', () => {
  // Minimal inline store — triggerInteractiveEvent only reads isPaused and activeEvent
  // on the fast-return path, so we don't need the full officeLife fake store here.
  function makeGuardStore({ isPaused = false, activeEvent = null } = {}) {
    const state = { isPaused, activeEvent, agents: {}, externalStatus: {}, hour: 9 }
    return {
      getState: () => ({
        get isPaused()    { return state.isPaused },
        get activeEvent() { return state.activeEvent },
        agents: state.agents,
        externalStatus: state.externalStatus,
        hour: state.hour,
        updateTime:              () => {},
        setActiveEvent:          (e) => { state.activeEvent = e },
        clearActiveEvent:        () => { state.activeEvent = null },
        setAgentBehavior:        () => {},
        setAgentGroupEvent:      () => {},
        setMultipleAgentGroupEvents: () => {},
        clearAgentGroupEvent:    () => {},
        clearBubble:             () => {},
      }),
    }
  }

  it('returns false and fires no event when isPaused is true', () => {
    const store = makeGuardStore({ isPaused: true })
    const result = triggerInteractiveEvent(store, 'review-debate')
    expect(result).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
  })

  it('returns false and fires no event when an event is already active', () => {
    const store = makeGuardStore({ activeEvent: { id: 'standup' } })
    const result = triggerInteractiveEvent(store, 'dog-visit')
    expect(result).toBe(false)
    // activeEvent stays as the original (not overwritten).
    expect(store.getState().activeEvent?.id).toBe('standup')
  })

  it('returns false for an unknown event id with no side-effects', () => {
    const store = makeGuardStore()
    const result = triggerInteractiveEvent(store, 'totally-made-up-event-id')
    expect(result).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
  })

  it('returns true for a known event id when nothing blocks it', () => {
    // Smoke check: all guards pass, EVENT_BY_ID lookup succeeds.
    const store = makeGuardStore()
    const result = triggerInteractiveEvent(store, 'boss-visit')
    // EVENT_BY_ID['boss-visit'] exists → should return true.
    expect(result).toBe(true)
  })
})
