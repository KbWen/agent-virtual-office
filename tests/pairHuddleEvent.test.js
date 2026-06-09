/**
 * AVO-106 — pair huddle event wiring (integration, real store + officeLife subscription).
 *  - the 'pair-programming' event is NEVER in the random daily/rare pool (honesty: only a real
 *    shared-file signal can fire it).
 *  - a real shared-file pair fires the huddle: activeEvent set + both agents gathered.
 *  - cooldown: a lingering pair does not re-trigger.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import eventsData from '../src/config/officeEvents.json'
import { useOfficeStore } from '../src/systems/store.js'
import { startOfficeLife } from '../src/systems/officeLife.js'

describe('pair-programming is never in the random pool (AC-5)', () => {
  it('no daily/rare event has id "pair-programming"', () => {
    const all = [...(eventsData.daily || []), ...(eventsData.rare || [])]
    expect(all.some(e => e.id === 'pair-programming')).toBe(false)
  })
})

describe('shared-file pair fires the huddle (integration)', () => {
  let teardown = null

  beforeEach(() => {
    vi.useFakeTimers()
    useOfficeStore.setState({
      externalStatus: {}, statusSource: 'organic', activeWorkflow: null, isPaused: false, activeEvent: null,
    })
    // Clear group-event flags on the static roster.
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
    useOfficeStore.setState({ externalStatus: {}, activeEvent: null })
  })

  const putOnFile = (file) => useOfficeStore.getState().applyExternalStatus([
    { agentId: 'dev', status: 'working', task: 'Edit', activeFile: file },
    { agentId: 'qa',  status: 'working', task: 'Read', activeFile: file },
  ], { source: 'external', statusSource: 'external' })

  it('AC-1: two distinct agents on the same file → pair-programming huddle fires + both gather', () => {
    putOnFile('/r/src/store.js')
    const s = useOfficeStore.getState()
    expect(s.activeEvent?.id).toBe('pair-programming')
    expect(s.agents.dev.inGroupEvent).toBe(true)
    expect(s.agents.qa.inGroupEvent).toBe(true)
    // gather targets are deconflicted (chokepoint) → both non-null and distinct
    expect(s.agents.dev.groupTarget).toBeTruthy()
    expect(s.agents.qa.groupTarget).toBeTruthy()
  })

  it('AC-2: two agents on different files → NO huddle', () => {
    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'working', task: 'Edit', activeFile: '/r/a.js' },
      { agentId: 'qa',  status: 'working', task: 'Edit', activeFile: '/r/b.js' },
    ], { source: 'external', statusSource: 'external' })
    expect(useOfficeStore.getState().activeEvent).toBeNull()
  })

  it('AC-7: cooldown — a lingering pair does not re-trigger after the event clears', () => {
    putOnFile('/r/src/store.js')
    expect(useOfficeStore.getState().activeEvent?.id).toBe('pair-programming')
    // simulate the event ending, then the same pair re-appears on the next poll
    useOfficeStore.getState().clearActiveEvent()
    useOfficeStore.getState().clearAgentGroupEvent('dev')
    useOfficeStore.getState().clearAgentGroupEvent('qa')
    putOnFile('/r/src/store.js')
    expect(useOfficeStore.getState().activeEvent).toBeNull()  // global + per-pair cooldown blocks it
  })
})
