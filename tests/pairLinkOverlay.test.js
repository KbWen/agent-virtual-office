/**
 * AVO-106 (redesigned) — co-editing pair OVERLAY wiring (integration, real store + officeLife sub).
 * The overlay is a PURE "show-while-true" derived state: it sets store.pairLink, and CRUCIALLY it
 * must NOT relocate or lock the agents (the expert-panel honesty fix — a tracked working desk is
 * never modulated). It is NOT a fired event (no activeEvent, no mutex, no cooldown).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import eventsData from '../src/config/officeEvents.json'
import { useOfficeStore } from '../src/systems/store.js'
import { startOfficeLife } from '../src/systems/officeLife.js'

describe('pair-programming is not an event at all (overlay, never random)', () => {
  it('no daily/rare event has id "pair-programming"', () => {
    const all = [...(eventsData.daily || []), ...(eventsData.rare || [])]
    expect(all.some(e => e.id === 'pair-programming')).toBe(false)
  })
})

describe('co-editing pair overlay (integration)', () => {
  let teardown = null

  beforeEach(() => {
    vi.useFakeTimers()
    useOfficeStore.setState({
      externalStatus: {}, statusSource: 'organic', activeWorkflow: null, isPaused: false, activeEvent: null, pairLink: null,
    })
    const agents = { ...useOfficeStore.getState().agents }
    for (const id of Object.keys(agents)) agents[id] = { ...agents[id], inGroupEvent: false, groupTarget: null }
    useOfficeStore.setState({ agents })
    teardown = startOfficeLife(useOfficeStore)
  })

  afterEach(() => {
    if (teardown) teardown()
    teardown = null
    vi.clearAllTimers()
    vi.useRealTimers()
    useOfficeStore.setState({ externalStatus: {}, activeEvent: null, pairLink: null })
  })

  const coEdit = (file) => useOfficeStore.getState().applyExternalStatus([
    { agentId: 'dev', status: 'working', task: 'Edit', activeFile: file },
    { agentId: 'qa',  status: 'working', task: 'Edit', activeFile: file },
  ], { source: 'external', statusSource: 'external' })

  it('two agents editing the same file → pairLink set {a,b,file}', () => {
    coEdit('/r/src/store.js')
    const s = useOfficeStore.getState()
    expect(s.pairLink).toBeTruthy()
    expect([s.pairLink.a, s.pairLink.b].sort()).toEqual(['dev', 'qa'])
    expect(s.pairLink.file).toBe('store.js')
  })

  it('HONESTY: the overlay does NOT relocate or lock the agents (no inGroupEvent, no activeEvent)', () => {
    coEdit('/r/src/store.js')
    const s = useOfficeStore.getState()
    expect(s.agents.dev.inGroupEvent).toBe(false)
    expect(s.agents.qa.inGroupEvent).toBe(false)
    expect(s.agents.dev.groupTarget).toBeNull()
    expect(s.activeEvent).toBeNull()  // it is NOT a fired event — no mutex held
  })

  it('different files → no pairLink', () => {
    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/a.js' },
      { agentId: 'qa',  status: 'working', task: 'Edit', activeFile: '/r/b.js' },
    ], { source: 'external', statusSource: 'external' })
    expect(useOfficeStore.getState().pairLink).toBeNull()
  })

  it('explicit Read activeFile does not over-claim a co-editing pair', () => {
    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/src/store.js' },
      { agentId: 'qa',  status: 'working', task: 'Read', activeFile: '/r/src/store.js' },
    ], { source: 'external', statusSource: 'external' })
    expect(useOfficeStore.getState().pairLink).toBeNull()
  })

  it('clears pairLink when the shared file goes away (one agent moves off it)', () => {
    coEdit('/r/src/store.js')
    expect(useOfficeStore.getState().pairLink).toBeTruthy()
    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/other.js' },
      { agentId: 'qa',  status: 'working', task: 'Edit', activeFile: '/r/src/store.js' },
    ], { source: 'external', statusSource: 'external' })
    expect(useOfficeStore.getState().pairLink).toBeNull()
  })

  it('no-op setPairLink does not churn identity when the same pair re-confirms', () => {
    coEdit('/r/src/store.js')
    const link1 = useOfficeStore.getState().pairLink
    coEdit('/r/src/store.js')  // same pair, same file again
    expect(useOfficeStore.getState().pairLink).toBe(link1)  // identity preserved (no needless re-render)
  })
})
