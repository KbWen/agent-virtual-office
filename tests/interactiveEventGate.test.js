// Honesty gate for clickable work-claim objects (panel-decided 2026-06-15).
//
// A user click on the deploy button (deploy-success) or whiteboard (eureka) must NOT manufacture
// a work OUTCOME (claim bubble + confetti + pet-celebrate) without a real signal — the same
// eventEligible gate the autonomous (pickEligibleEvent) and seed (fireSeed) paths enforce.
// When gated out, the click fires a NON-conclusive in-place reaction instead (Poke-style, R1-safe).
// SOCIAL clicks (tea-break) are never gated.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { triggerInteractiveEvent } from '../src/systems/officeLife.js'
import en from '../src/locales/en.json'

// Fuller fake store: ops + arch (the two work-claim reactors) + dev/qa, with the actions
// triggerInteractiveEvent/executeEvent use (mirrors officeLife.test.js's make3AgentStore).
function makeStore({ externalStatus = {}, mood = 'normal', opsInGroup = false } = {}) {
  const state = {
    isPaused: false, activeEvent: null, mood,
    agents: {
      ops:  { id: 'ops',  inGroupEvent: opsInGroup, groupTarget: null, behavior: 'typing', expression: 'normal', bubble: null, position: { x: 100, y: 100 } },
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

describe('triggerInteractiveEvent — honesty gate + neutral reaction', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-05T09:00:00')) })
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('deploy button with NO real ops signal: gated out — no fake celebration, honest neutral bubble on ops', () => {
    const store = makeStore({ externalStatus: {} })
    const fired = triggerInteractiveEvent(store, 'deploy-success')
    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()                  // no set-piece → no confetti / pet-celebrate
    const opsBubble = store.getState().agents.ops.bubble
    expect(opsBubble).toBeTruthy()
    expect(opsBubble).not.toBe(en.eventBubbles['deploy-success'])    // NOT the "Deploy Success! 🚀" claim
    expect(en.eventBubbles['deploy-idle']).toContain(opsBubble)      // a non-conclusive intent line
  })

  it('deploy button WITH a fresh real ops signal: fires the real celebration', () => {
    const store = makeStore({ externalStatus: { ops: { status: 'done', changedAt: Date.now() } } })
    const fired = triggerInteractiveEvent(store, 'deploy-success')
    expect(fired).toBe(true)
    expect(store.getState().activeEvent?.id).toBe('deploy-success')
  })

  it('whiteboard with NO smooth mood: gated out — honest neutral bubble on arch, never "got it!"', () => {
    const store = makeStore({ mood: 'normal' })
    const fired = triggerInteractiveEvent(store, 'eureka')
    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
    const archBubble = store.getState().agents.arch.bubble
    expect(archBubble).toBeTruthy()
    expect(archBubble).not.toBe(en.eventBubbles['eureka'])
    expect(en.eventBubbles['eureka-idle']).toContain(archBubble)
  })

  it('whiteboard WITH smooth mood (real momentum): fires the real eureka', () => {
    const store = makeStore({ mood: 'smooth' })
    const fired = triggerInteractiveEvent(store, 'eureka')
    expect(fired).toBe(true)
    expect(store.getState().activeEvent?.id).toBe('eureka')
  })

  it('R1-safe: a gated click never overrides an agent locked in a real group event', () => {
    const store = makeStore({ externalStatus: {}, opsInGroup: true })
    triggerInteractiveEvent(store, 'deploy-success')
    expect(store.getState().agents.ops.bubble).toBeNull()           // untouched — real work is sacrosanct
  })

  it('social click (tea-break) is never gated — always reacts', () => {
    const store = makeStore({ externalStatus: {} })
    expect(triggerInteractiveEvent(store, 'tea-break')).toBe(true)
  })
})
