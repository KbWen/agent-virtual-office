// rem-honest-office-events finding #3 (second half) — deferred handler steps that establish a
// FIRST-TIME group-event lock (rather than re-checking an existing one) must re-verify
// isAgentAvailable at the moment the deferred step actually runs, not just at cast-selection
// time. `food-delivery`'s reaction crew, `coffee-spill`'s neighbour, `deploy-success`'s celebrate
// crew, `dog-visit`'s per-agent stagger, `group-stretch`'s per-agent stagger, and
// `pm-all-meeting`'s stage-2 crew are never locked inGroupEvent at cast time — only the "lead"
// actor (bringer/spiller/ops/pm) is. Without a recheck, an agent that starts real tracked work in
// the deferred window still gets painted into the reaction/lock.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { triggerInteractiveEvent } from '../src/systems/officeLife.js'

function makeStore(agentIds, externalStatus = {}) {
  const state = {
    isPaused: false, activeEvent: null, mood: 'normal',
    agents: Object.fromEntries(agentIds.map((id, i) => [id, {
      id, inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal',
      bubble: null, position: { x: 100 + i * 50, y: 100 },
    }])),
    externalStatus, hour: 9,
  }
  const api = {
    get agents() { return state.agents },
    get isPaused() { return state.isPaused },
    get activeEvent() { return state.activeEvent },
    get externalStatus() { return state.externalStatus },
    get mood() { return state.mood },
    get hour() { return state.hour },
    updateTime: () => {},
    setActiveEvent: (e) => { state.activeEvent = e },
    clearActiveEvent: () => { state.activeEvent = null },
    setAgentBehavior: (id, behavior, expression, bubble) => {
      if (!state.agents[id]) return
      state.agents[id] = { ...state.agents[id], behavior, expression: expression || state.agents[id].expression, bubble: bubble || null }
    },
    setAgentGroupEvent: (id, { behavior, expression, bubble, groupTarget } = {}) => {
      if (!state.agents[id]) return
      state.agents[id] = { ...state.agents[id], behavior, expression, bubble: bubble || null, inGroupEvent: true, groupTarget: groupTarget || null }
    },
    setMultipleAgentGroupEvents: (updates) => { for (const u of updates) api.setAgentGroupEvent(u.id, u) },
    clearAgentGroupEvent: (id) => { if (state.agents[id]) state.agents[id] = { ...state.agents[id], inGroupEvent: false, groupTarget: null } },
    clearBubble: (id) => { if (state.agents[id]) state.agents[id] = { ...state.agents[id], bubble: null } },
    clearReluctant: () => {},
    // Test-only helper: simulate a real hook status arriving mid-event (officeLife only reads
    // state.externalStatus — it does not care how it got there).
    _markBusy: (id, status = 'working') => { state.externalStatus = { ...state.externalStatus, [id]: { status } } },
  }
  return { getState: () => api }
}

describe('deferred handler steps re-check availability (finding #3)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-05T09:00:00')) })
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('food-delivery: a reaction-crew member that goes busy before the 2s reaction step is skipped', () => {
    const store = makeStore(['dev', 'qa', 'arch'])
    expect(triggerInteractiveEvent(store, 'food-delivery')).toBe(true)
    // qa/arch were never locked at t0 (only the bringer, dev, is) — mark qa busy before the reaction fires.
    store.getState()._markBusy('qa')
    vi.advanceTimersByTime(2100)
    expect(store.getState().agents.qa.bubble).toBeNull()
    // arch stayed available the whole time — it still gets the reaction.
    expect(store.getState().agents.arch.bubble).toBeTruthy()
  })

  it('coffee-spill: a neighbour that goes busy before the 1.5s help step is skipped', () => {
    // Force idx=0 so pickParticipants('random-1-neighbor') deterministically picks
    // [dev (spiller), qa (neighbour)] instead of a 50% chance of a single-participant draw.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const store = makeStore(['dev', 'qa'])
    expect(triggerInteractiveEvent(store, 'coffee-spill')).toBe(true)
    store.getState()._markBusy('qa')
    vi.advanceTimersByTime(1600)
    // The neighbour (qa) must not be locked into a "helping" pose once it's genuinely busy.
    expect(store.getState().agents.qa.inGroupEvent).toBe(false)
  })

  it('deploy-success: a celebrate-crew member that goes busy before the 2s celebration is skipped', () => {
    const store = makeStore(['ops', 'dev', 'qa'], { ops: { status: 'done', changedAt: Date.now() } })
    expect(triggerInteractiveEvent(store, 'deploy-success')).toBe(true)
    store.getState()._markBusy('dev')
    vi.advanceTimersByTime(2100)
    expect(store.getState().agents.dev.bubble).toBeNull()
    expect(store.getState().agents.qa.bubble).toBeTruthy()
  })

  it('dog-visit: an agent that goes busy before its staggered turn is skipped', () => {
    const store = makeStore(['dev', 'qa', 'arch'])
    expect(triggerInteractiveEvent(store, 'dog-visit')).toBe(true)
    // Mark the last-staggered agent busy before its i*800ms turn comes up.
    store.getState()._markBusy('arch')
    vi.advanceTimersByTime(3000)
    expect(store.getState().agents.arch.inGroupEvent).toBe(false)
  })

  it('pm-all-meeting: stage-2 crew members that go busy before the 2.5s meeting-room step are skipped', () => {
    const store = makeStore(['pm', 'dev', 'qa'])
    expect(triggerInteractiveEvent(store, 'pm-all-meeting')).toBe(true)
    store.getState()._markBusy('dev')
    vi.advanceTimersByTime(2600)
    expect(store.getState().agents.dev.inGroupEvent).toBe(false)
    expect(store.getState().agents.qa.inGroupEvent).toBe(true)
    expect(store.getState().agents.pm.inGroupEvent).toBe(true)
  })

  it('pm-all-meeting: pm itself released mid-event (real status) cancels the stage-2 gather entirely', () => {
    const store = makeStore(['pm', 'dev', 'qa'])
    expect(triggerInteractiveEvent(store, 'pm-all-meeting')).toBe(true)
    // Simulate the store-level release (finding #3 first half): a real status clears pm's lock.
    store.getState().clearAgentGroupEvent('pm')
    vi.advanceTimersByTime(2600)
    expect(store.getState().agents.dev.inGroupEvent).toBe(false)
    expect(store.getState().agents.qa.inGroupEvent).toBe(false)
  })
})
