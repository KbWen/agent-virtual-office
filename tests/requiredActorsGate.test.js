// rem-honest-office-events finding #1 — a phantom work-claim event.
//
// `fireWithCast`/`triggerInteractiveEvent` used to call `setActiveEvent(event)` (the global event
// mutex that drives the banner/confetti/eventFeed entry) BEFORE the handler checked whether its
// specific required actor actually made the cast. For "all"/array-participant events, a partially-
// filtered cast (missing exactly the actor the handler needs) is non-empty, so the pre-existing
// empty-cast guard (AVO-191) never caught it — the handler's own
// `if (!participants.includes('ops')) return` bailed only AFTER the phantom event was already live
// for its whole duration (activeEvent set, banner/eventFeed entry emitted, nobody performing it).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { triggerInteractiveEvent } from '../src/systems/officeLife.js'

// Fuller fake store: ops + arch + dev + qa — the four named actors the gated events need.
function makeStore({ externalStatus = {}, mood = 'normal' } = {}) {
  const state = {
    isPaused: false, activeEvent: null, mood,
    agents: {
      ops:  { id: 'ops',  inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 100, y: 100 } },
      arch: { id: 'arch', inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 200, y: 100 } },
      dev:  { id: 'dev',  inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 300, y: 100 } },
      qa:   { id: 'qa',   inGroupEvent: false, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 400, y: 100 } },
    },
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
  }
  return { getState: () => api }
}

describe('required-actor gate (finding #1) — refuse to fire when the cast is missing its actor', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-05T09:00:00')) })
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('deploy-success ("all" cast): ops busy but 2+ others idle — eligible gate passes (recent ops signal) yet the cast lacks ops — refuses to fire', () => {
    // eventEligible(deploy-success) reads recentSignal on ops' changedAt — make it fresh so the
    // ONLY thing stopping this event is the missing required actor, not the honesty gate.
    const store = makeStore({ externalStatus: { ops: { status: 'working', changedAt: Date.now() } } })
    const fired = triggerInteractiveEvent(store, 'deploy-success')
    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
    // No participant was locked into a phantom scene either.
    for (const id of ['ops', 'arch', 'dev', 'qa']) {
      expect(store.getState().agents[id].inGroupEvent).toBe(false)
    }
  })

  it('review-debate (array cast [dev, qa]): dev busy, qa idle — non-empty cast still lacks dev — refuses to fire', () => {
    // qa gets a fresh changedAt so eventEligible(review-debate) (recentSignal on qa/gate) is
    // already satisfied — isolates the assertion to the NEW required-actor check, not the
    // separate honesty gate (which would refuse for its own, unrelated reason if qa were bare).
    const store = makeStore({ externalStatus: { dev: { status: 'working' }, qa: { status: 'idle', changedAt: Date.now() } } })
    const fired = triggerInteractiveEvent(store, 'review-debate')
    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
    expect(store.getState().agents.qa.inGroupEvent).toBe(false)
  })

  it('dev-arch-disagree (array cast [dev, arch]): arch busy — refuses to fire', () => {
    const store = makeStore({ mood: 'frustrated', externalStatus: { arch: { status: 'blocked' } } })
    const fired = triggerInteractiveEvent(store, 'dev-arch-disagree')
    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
  })

  it('regression: deploy-success fires normally when ops IS in the cast', () => {
    const store = makeStore({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } })
    const fired = triggerInteractiveEvent(store, 'deploy-success')
    expect(fired).toBe(true)
    expect(store.getState().activeEvent?.id).toBe('deploy-success')
  })

  it('regression: review-debate fires normally when both dev and qa are available', () => {
    // review-debate is itself WORK_CLAIM-gated (needs a recent qa/gate signal) — give it one so
    // this test isolates the required-actor check, not the separate eventEligible gate.
    const store = makeStore({ externalStatus: { qa: { status: 'idle', changedAt: Date.now() } } })
    const fired = triggerInteractiveEvent(store, 'review-debate')
    expect(fired).toBe(true)
    expect(store.getState().activeEvent?.id).toBe('review-debate')
  })
})
