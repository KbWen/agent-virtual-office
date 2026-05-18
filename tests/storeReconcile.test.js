import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// Reset the singleton store between tests so dynamic agents / externalStatus don't leak.
function resetStore() {
  const s = useOfficeStore.getState()
  // Remove any dynamic (session-carrying) agents from a previous test.
  const agents = {}
  for (const [id, a] of Object.entries(s.agents)) {
    if (!a.session) agents[id] = { ...a, status: 'idle', bubble: null, deskItemCount: { coffee: 0, sticky: 0, books: 0 } }
  }
  useOfficeStore.setState({
    agents,
    externalStatus: {},
    statusSource: 'organic',
    activeWorkflow: null,
    activityLog: [],
    dailyDoneLedger: { dayKey: 'reset', counts: {}, seenEventKeys: [] },
  })
}

describe('applyExternalStatus — multi-session ghost reconciliation (R63)', () => {
  beforeEach(resetStore)

  it('removes a dynamic worktree agent once its session stops appearing in the multi-session payload', () => {
    const { applyExternalStatus } = useOfficeStore.getState()

    // Tick 1: two worktree sessions active.
    applyExternalStatus(
      [
        { agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' },
        { agentId: 'feat-b~dev', status: 'working', task: null, label: null, session: 'feat-b' },
      ],
      { source: 'multi-session' },
    )
    let s = useOfficeStore.getState()
    expect(s.agents['feat-a~dev']).toBeTruthy()
    expect(s.agents['feat-b~dev']).toBeTruthy()
    expect(s.externalStatus['feat-a~dev']).toBeTruthy()
    expect(s.externalStatus['feat-b~dev']).toBeTruthy()

    // Tick 2: worktree B's session ended — payload now only carries feat-a.
    applyExternalStatus(
      [{ agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' }],
      { source: 'multi-session' },
    )
    s = useOfficeStore.getState()
    expect(s.agents['feat-a~dev']).toBeTruthy()
    expect(s.agents['feat-b~dev']).toBeUndefined()      // ghost removed
    expect(s.externalStatus['feat-b~dev']).toBeUndefined()
    expect(s.externalStatus['feat-a~dev']).toBeTruthy()
  })

  it('does NOT evict dynamic agents on a non-multi-session update (single agent deliveries)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()

    applyExternalStatus(
      [
        { agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' },
        { agentId: 'feat-b~qa', status: 'working', task: null, label: null, session: 'feat-b' },
      ],
      { source: 'multi-session' },
    )
    // A postMessage/hash update carrying a single agent must not wipe the others.
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'external' },
    )
    const s = useOfficeStore.getState()
    expect(s.agents['feat-a~dev']).toBeTruthy()
    expect(s.agents['feat-b~qa']).toBeTruthy()
  })

  it('never evicts static roster agents even on a multi-session update', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // dev gets a real external status, then a multi-session payload omits it.
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'external' },
    )
    applyExternalStatus(
      [{ agentId: 'feat-x~qa', status: 'working', task: null, label: null, session: 'feat-x' }],
      { source: 'multi-session' },
    )
    const s = useOfficeStore.getState()
    // Static 'dev' agent must still exist (it has no session field).
    expect(s.agents['dev']).toBeTruthy()
    expect(s.agents['feat-x~qa']).toBeTruthy()
  })
})

describe('addHandoff — unique ids (R65)', () => {
  beforeEach(() => useOfficeStore.setState({ handoffs: [] }))

  it('assigns a unique id to every handoff even when added in the same millisecond', () => {
    const { addHandoff } = useOfficeStore.getState()
    // Date.now() returns the same value for back-to-back synchronous calls — the
    // monotonic counter must still produce distinct ids.
    addHandoff('dev', 'qa')
    addHandoff('pm', 'arch')
    addHandoff('ops', 'res')
    const ids = useOfficeStore.getState().handoffs.map(h => h.id)
    expect(new Set(ids).size).toBe(3)  // all distinct — no React key collision
  })

  it('removeHandoff deletes ONLY the targeted handoff, not same-tick siblings', () => {
    const { addHandoff, removeHandoff } = useOfficeStore.getState()
    addHandoff('dev', 'qa')
    addHandoff('pm', 'arch')
    const [first, second] = useOfficeStore.getState().handoffs
    // Completing one animation must not collaterally kill the other.
    removeHandoff(first.id)
    const remaining = useOfficeStore.getState().handoffs
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(second.id)
  })
})
