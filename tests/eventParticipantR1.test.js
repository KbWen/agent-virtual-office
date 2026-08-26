// AVO-191 — an office event must never seize a genuinely-working agent.
//
// `pickParticipants` excluded busy agents and then, if fewer than 2 survived, fell back to
// `agentIds` — the full roster — so on a busy office an event picked working/blocked agents and
// relocated them. `store.js` documented the opposite ("R1-safe: pickParticipants never selects
// tracked working/blocked agents"), so the guarantee existed only as a comment.
//
// The fallback only ever fired when agents were genuinely tracked-busy: an agent with NO
// externalStatus entry is already "available", so a fresh/demo office was never affected. That is
// what makes removing the fallback safe — and what made it wrong.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { triggerInteractiveEvent } from '../src/systems/officeLife.js'

function makeStore({ externalStatus = {}, mood = 'smooth' } = {}) {
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

const seized = (store, ids) => ids.filter((id) => store.getState().agents[id].inGroupEvent)
const busy3 = { ops: { status: 'working' }, arch: { status: 'working' }, dev: { status: 'blocked' } }

describe('AVO-191 — office events never seize a genuinely-working agent', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-05T09:00:00')) })
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('random-2-3 with only 1 idle agent: no working/blocked agent is taken, no event fires', () => {
    const store = makeStore({ externalStatus: busy3 })   // qa is the only available agent
    const fired = triggerInteractiveEvent(store, 'tea-break')

    expect(seized(store, ['ops', 'arch', 'dev'])).toEqual([])
    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
  })

  it('all-participant event with only 1 idle agent: same guarantee', () => {
    const store = makeStore({ externalStatus: busy3 })
    triggerInteractiveEvent(store, 'group-stretch')

    expect(seized(store, ['ops', 'arch', 'dev'])).toEqual([])
    expect(store.getState().activeEvent).toBeNull()
  })

  // The three pickers are randomised, so a single draw can miss the defect by luck. Each of these
  // repeats until every branch of the shuffle has had a turn — the assertion is the invariant, not
  // one lucky sample.
  it('random-1-neighbor with 1 idle agent: never picks a working one, across 50 draws', () => {
    for (let i = 0; i < 50; i++) {
      const store = makeStore({ externalStatus: busy3 })
      triggerInteractiveEvent(store, 'coffee-spill')
      expect(seized(store, ['ops', 'arch', 'dev'])).toEqual([])
    }
  })

  it('random-2-3 with 1 idle agent: never picks a working one, across 50 draws', () => {
    for (let i = 0; i < 50; i++) {
      const store = makeStore({ externalStatus: busy3 })
      triggerInteractiveEvent(store, 'tea-break')
      expect(seized(store, ['ops', 'arch', 'dev'])).toEqual([])
    }
  })

  it('every busy agent keeps its own position — an event cannot relocate it', () => {
    const store = makeStore({ externalStatus: busy3 })
    triggerInteractiveEvent(store, 'tea-break')

    for (const id of ['ops', 'arch', 'dev']) {
      expect(store.getState().agents[id].groupTarget).toBeNull()
    }
  })

  it('a named-participant event whose whole cast is busy leaves no phantom activeEvent', () => {
    // Pre-existing hole, independent of the fallback: array participants were already filtered by
    // availability, so an all-busy cast produced [] — and the caller still set activeEvent, which
    // is the global event mutex. A phantom one blocks every later event for its duration.
    // `eureka` is cast ['arch'] and its honesty gate is mood === 'smooth', which makeStore sets —
    // so the event is genuinely ELIGIBLE here and only the empty cast can stop it. Using a
    // gated-out event instead would pass for the wrong reason.
    const store = makeStore({ mood: 'smooth', externalStatus: { arch: { status: 'working' } } })
    const fired = triggerInteractiveEvent(store, 'eureka')

    expect(fired).toBe(false)
    expect(store.getState().activeEvent).toBeNull()
    expect(store.getState().agents.arch.inGroupEvent).toBe(false)
  })

  it('regression — an untracked (demo / fresh) office still fires with a full cast', () => {
    const store = makeStore({ externalStatus: {} })      // no externalStatus => everyone available
    const fired = triggerInteractiveEvent(store, 'tea-break')

    expect(fired).toBe(true)
    expect(store.getState().activeEvent?.id).toBe('tea-break')
    expect(seized(store, ['ops', 'arch', 'dev', 'qa']).length).toBeGreaterThanOrEqual(2)
  })

  it('regression — with enough idle agents the event fires and picks only idle ones', () => {
    const store = makeStore({ externalStatus: { ops: { status: 'working' }, arch: { status: 'working' } } })
    const fired = triggerInteractiveEvent(store, 'tea-break')

    expect(fired).toBe(true)
    expect(seized(store, ['ops', 'arch'])).toEqual([])
    expect(seized(store, ['dev', 'qa']).length).toBeGreaterThanOrEqual(2)
  })
})

// Property sweep: the invariant is "no tracked-busy agent ever ends up in an event", and it has to
// hold for EVERY ungated event under EVERY busy mask -- not just the three shapes hand-written
// above. Only the SOCIAL/WORLD events are swept: the work-claim ones carry their own eventEligible
// gate, so a refusal there would prove the gate, not this guarantee.
describe('AVO-191 -- invariant sweep over every ungated event and busy mask', () => {
  const UNGATED = [
    'tea-break', 'standup', 'food-delivery', 'coffee-spill', 'group-meeting',
    'pm-all-meeting', 'dog-visit', 'ac-broken', 'boss-visit', 'group-stretch',
  ]
  const IDS = ['ops', 'arch', 'dev', 'qa']
  const BUSY = ['working', 'blocked']

  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-05T09:00:00')) })
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('no agent reporting working or blocked is ever placed in an event', () => {
    let masksCovered = 0
    for (const eventId of UNGATED) {
      // All 16 subsets of the 4 agents, so the <2-available cases are covered exhaustively
      // rather than sampled -- including the all-busy one, which is where the old fallback fired.
      for (let mask = 0; mask < 16; mask++) {
        const externalStatus = {}
        IDS.forEach((id, i) => {
          if (mask & (1 << i)) externalStatus[id] = { status: BUSY[i % 2] }
        })
        const store = makeStore({ mood: 'smooth', externalStatus })
        triggerInteractiveEvent(store, eventId)

        const busyIds = Object.keys(externalStatus)
        expect(seized(store, busyIds)).toEqual([])
        for (const id of busyIds) {
          expect(store.getState().agents[id].groupTarget).toBeNull()
        }
        masksCovered++
      }
    }
    expect(masksCovered).toBe(UNGATED.length * 16)
  })
})
