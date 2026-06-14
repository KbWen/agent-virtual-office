import { describe, it, expect, beforeEach } from 'vitest'
import { getNextBehavior } from '../src/systems/behaviorEngine.js'
import { useOfficeStore } from '../src/systems/store.js'
import { pushEventBatch, resetMood } from '../src/systems/moodEngine.js'

// L2 derived team-affect layer (spec docs/specs/living-office-events.md Phase 1).
// These cover the deterministic/statistical guarantees behind AC-1 (truth untouched),
// AC-4 (team reflects reality, untracked-only), AC-5 (no liveliness regression at pulse 0).

describe('behaviorEngine teamPulse lean-in', () => {
  // Category share over many samples (weightedRandom is random; large N + margin = stable).
  function workShare(teamPulse, n = 4000) {
    let work = 0, casual = 0
    for (let i = 0; i < n; i++) {
      // hour 10 = no hour modifier; idle status has the most headroom for the nudge to show
      const cat = getNextBehavior('dev', 'idle', 10, 'normal', teamPulse).category
      if (cat === 'work') work++
      if (cat === 'daily' || cat === 'social' || cat === 'away') casual++
    }
    return { work: work / n, casual: casual / n }
  }

  it('teamPulse=0 leaves the distribution at the un-nudged baseline (AC-5: no regression)', () => {
    // Calling with teamPulse 0 must be equivalent to not passing it (the nudge is guarded `>0`).
    const a = workShare(0)
    // Baseline idle work weight is 68/100 (calm-rhythm round 2, 2026-06-15) → ~0.68 work share;
    // sanity band only — confirms pulse-0 sits at baseline, NOT nudged up toward the hot ~0.9.
    expect(a.work).toBeGreaterThan(0.58)
    expect(a.work).toBeLessThan(0.78)
  })

  it('a hot session (teamPulse=1) raises work and lowers casual behaviors (AC-4)', () => {
    const calm = workShare(0)
    const hot = workShare(1)
    expect(hot.work).toBeGreaterThan(calm.work + 0.05)   // room leans in
    expect(hot.casual).toBeLessThan(calm.casual - 0.05)  // fewer coffee/wander/chat
  })

  it('does not suppress the frustrated category (blocked agents still vent)', () => {
    // blocked status carries frustrated=60; a high pulse must not zero it out.
    let frustrated = 0
    for (let i = 0; i < 2000; i++) {
      if (getNextBehavior('dev', 'blocked', 10, 'frustrated', 1).category === 'frustrated') frustrated++
    }
    expect(frustrated).toBeGreaterThan(0)
  })
})

describe('store L2 actions', () => {
  beforeEach(() => {
    useOfficeStore.setState({ teamPulse: 0, focusAnchor: null })
    useOfficeStore.setState((s) => ({
      agents: { ...s.agents, dev: { ...s.agents.dev, facing: 'down', isMoving: false, inGroupEvent: false, status: 'idle' } },
    }))
  })

  it('setTeamSignals writes both scalars', () => {
    useOfficeStore.getState().setTeamSignals({ teamPulse: 0.8, focusAnchor: 'dev' })
    expect(useOfficeStore.getState().teamPulse).toBe(0.8)
    expect(useOfficeStore.getState().focusAnchor).toBe('dev')
  })

  it('setAgentFacing rotates a stationary idle agent', () => {
    useOfficeStore.getState().setAgentFacing('dev', 'left')
    expect(useOfficeStore.getState().agents.dev.facing).toBe('left')
  })

  it('setAgentFacing is a no-op while moving or in a group event (never fights movement)', () => {
    useOfficeStore.setState((s) => ({ agents: { ...s.agents, dev: { ...s.agents.dev, facing: 'down', isMoving: true } } }))
    useOfficeStore.getState().setAgentFacing('dev', 'right')
    expect(useOfficeStore.getState().agents.dev.facing).toBe('down')

    useOfficeStore.setState((s) => ({ agents: { ...s.agents, dev: { ...s.agents.dev, facing: 'down', isMoving: false, inGroupEvent: true } } }))
    useOfficeStore.getState().setAgentFacing('dev', 'right')
    expect(useOfficeStore.getState().agents.dev.facing).toBe('down')
  })
})

describe('moodEngine derives team signals into the store', () => {
  beforeEach(() => {
    resetMood()
    useOfficeStore.setState({ teamPulse: 0, focusAnchor: null })
  })

  it('an active event sets teamPulse>0 and focusAnchor to the hot desk', () => {
    pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit' }])
    expect(useOfficeStore.getState().teamPulse).toBeGreaterThan(0)
    expect(useOfficeStore.getState().focusAnchor).toBe('dev')
  })

  it('a done/idle event is not chosen as the focus anchor', () => {
    pushEventBatch([{ role: 'ops', status: 'done' }])
    expect(useOfficeStore.getState().focusAnchor).toBeNull()
  })

  it('clearExternalStatus (office empties) resets the L2 scalars', () => {
    pushEventBatch([{ role: 'dev', status: 'working' }])
    useOfficeStore.setState({ teamPulse: 0.6, focusAnchor: 'dev', externalStatus: {} })
    useOfficeStore.getState().clearExternalStatus()
    expect(useOfficeStore.getState().teamPulse).toBe(0)
    expect(useOfficeStore.getState().focusAnchor).toBeNull()
  })
})

describe('L3 reluctant participant (pure overlay, R1-safe)', () => {
  const until = 9_999_999_999_999
  beforeEach(() => {
    useOfficeStore.setState({ reluctant: {}, externalStatus: {} })
    useOfficeStore.setState((s) => {
      const agents = {}
      for (const [id, a] of Object.entries(s.agents)) agents[id] = { ...a, inGroupEvent: false, status: 'idle', behavior: 'idle', bubble: null }
      return { agents }
    })
  })

  it('marks only a TRACKED working/blocked agent — not idle/done/untracked', () => {
    useOfficeStore.setState((s) => ({ externalStatus: { ...s.externalStatus, dev: { status: 'working' }, qa: { status: 'done' } } }))
    useOfficeStore.getState().setReluctant(['dev', 'qa', 'ops'], until) // ops has no ext entry
    const r = useOfficeStore.getState().reluctant
    expect(r.dev).toBe(until)   // working → marked
    expect(r.qa).toBeUndefined() // done → not torn
    expect(r.ops).toBeUndefined() // untracked → nothing to be torn from
  })

  it('does NOT mark an agent already in a group event', () => {
    useOfficeStore.setState((s) => ({
      externalStatus: { ...s.externalStatus, dev: { status: 'working' } },
      agents: { ...s.agents, dev: { ...s.agents.dev, inGroupEvent: true } },
    }))
    useOfficeStore.getState().setReluctant(['dev'], until)
    expect(useOfficeStore.getState().reluctant.dev).toBeUndefined()
  })

  it('NEVER touches the agent status/behavior/bubble/position (R1)', () => {
    useOfficeStore.setState((s) => ({ externalStatus: { ...s.externalStatus, dev: { status: 'working' } } }))
    const before = { ...useOfficeStore.getState().agents.dev }
    useOfficeStore.getState().setReluctant(['dev'], until)
    const after = useOfficeStore.getState().agents.dev
    expect(after.status).toBe(before.status)
    expect(after.behavior).toBe(before.behavior)
    expect(after.bubble).toBe(before.bubble)
    expect(after.position).toBe(before.position)
  })

  it('clearReluctant + clearExternalStatus both reset the map', () => {
    useOfficeStore.setState((s) => ({ externalStatus: { ...s.externalStatus, dev: { status: 'working' } } }))
    useOfficeStore.getState().setReluctant(['dev'], until)
    useOfficeStore.getState().clearReluctant()
    expect(Object.keys(useOfficeStore.getState().reluctant).length).toBe(0)

    useOfficeStore.getState().setReluctant(['dev'], until)
    useOfficeStore.setState({ externalStatus: {} })
    useOfficeStore.getState().clearExternalStatus()
    expect(Object.keys(useOfficeStore.getState().reluctant).length).toBe(0)
  })
})
