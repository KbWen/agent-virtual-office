import { describe, it, expect, beforeEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// Reset the singleton store between tests so dynamic agents / externalStatus don't leak.
function resetStore() {
  const s = useOfficeStore.getState()
  // Remove any dynamic (session-carrying) agents from a previous test.
  const agents = {}
  for (const [id, a] of Object.entries(s.agents)) {
    if (!a.session) agents[id] = {
      ...a, status: 'idle', behavior: 'idle', expression: 'normal', bubble: null,
      inGroupEvent: false, groupTarget: null,
      deskItemCount: { coffee: 0, sticky: 0, books: 0 },
    }
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

describe('applyExternalStatus — overflow position assignment (R66)', () => {
  beforeEach(resetStore)

  it('places dynamic agents created across SEPARATE calls in distinct overflow slots', () => {
    const { applyExternalStatus } = useOfficeStore.getState()

    // Each call creates ONE null-session dynamic agent (the postMessage/hash path).
    // The entry snapshot of call N already contains the agents committed by calls 1..N-1,
    // so a count filtered against the snapshot would return 0 every time and stack them all.
    applyExternalStatus(
      [{ agentId: 'wt-a~dev', status: 'working', task: null, label: null }],
      { source: 'external' },
    )
    applyExternalStatus(
      [{ agentId: 'wt-b~dev', status: 'working', task: null, label: null }],
      { source: 'external' },
    )
    applyExternalStatus(
      [{ agentId: 'wt-c~dev', status: 'working', task: null, label: null }],
      { source: 'external' },
    )

    const s = useOfficeStore.getState()
    const positions = ['wt-a~dev', 'wt-b~dev', 'wt-c~dev'].map(id => {
      const p = s.agents[id].position
      return `${p.x},${p.y}`
    })
    // All three must land on distinct overflow coordinates — no stacking at slot 0.
    expect(new Set(positions).size).toBe(3)
  })

  it('places dynamic agents created WITHIN a single call in distinct overflow slots', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [
        { agentId: 'wt-x~dev', status: 'working', task: null, label: null, session: 'wt-x' },
        { agentId: 'wt-y~dev', status: 'working', task: null, label: null, session: 'wt-y' },
      ],
      { source: 'multi-session' },
    )
    const s = useOfficeStore.getState()
    const px = s.agents['wt-x~dev'].position
    const py = s.agents['wt-y~dev'].position
    expect(`${px.x},${px.y}`).not.toBe(`${py.x},${py.y}`)
  })

  it('reuses a freed overflow slot after a dynamic agent is reconciled away', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // Two dynamic agents occupy slots 0 and 1.
    applyExternalStatus(
      [
        { agentId: 'sess-1~dev', status: 'working', task: null, label: null, session: 'sess-1' },
        { agentId: 'sess-2~dev', status: 'working', task: null, label: null, session: 'sess-2' },
      ],
      { source: 'multi-session' },
    )
    // sess-1 ends — reconciliation drops it, freeing slot 0.
    applyExternalStatus(
      [{ agentId: 'sess-2~dev', status: 'working', task: null, label: null, session: 'sess-2' }],
      { source: 'multi-session' },
    )
    // A new dynamic agent arrives via a separate call. With one dynamic agent left,
    // the count is 1 → it takes slot 1's coordinates, not an off-the-end index.
    applyExternalStatus(
      [{ agentId: 'sess-3~dev', status: 'working', task: null, label: null }],
      { source: 'external' },
    )
    const s = useOfficeStore.getState()
    expect(s.agents['sess-3~dev']).toBeTruthy()
    // sess-2 and sess-3 are the only two dynamic agents — they must not collide.
    const p2 = s.agents['sess-2~dev'].position
    const p3 = s.agents['sess-3~dev'].position
    expect(`${p2.x},${p2.y}`).not.toBe(`${p3.x},${p3.y}`)
  })
})

describe('applyExternalStatus — setup-prompt dismissal contract (R67)', () => {
  beforeEach(() => {
    resetStore()
    useOfficeStore.setState({ hasEverReceivedStatus: false })
  })

  it('sets hasEverReceivedStatus when a real status arrives (skipHintDismiss falsy)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'claude-cli' },
    )
    // A genuine hook status dismisses the "run setup" prompt.
    expect(useOfficeStore.getState().hasEverReceivedStatus).toBe(true)
  })

  it('keeps hasEverReceivedStatus false when skipHintDismiss is set (hooks not installed)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'file-watcher', skipHintDismiss: true },
    )
    // file-watcher activity must NOT dismiss the setup prompt — hooks still absent.
    expect(useOfficeStore.getState().hasEverReceivedStatus).toBe(false)
  })

  it('keeps hasEverReceivedStatus false for a multi-session payload of only file-watcher data', () => {
    // R67: scanAndMerge tags an all-file-watcher merge with _hint:'no-hooks' and rewrites
    // source to 'multi-session'. applyMessage derives skipHintDismiss from _hint, so the
    // store must honour skipHintDismiss even when source !== 'file-watcher'.
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'wt~dev', status: 'working', task: null, label: null, session: 'wt' }],
      { source: 'multi-session', skipHintDismiss: true },
    )
    expect(useOfficeStore.getState().hasEverReceivedStatus).toBe(false)
  })

  it('does not re-clear hasEverReceivedStatus once a real status has dismissed it', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'claude-cli' },
    )
    // A later file-watcher tick must not resurrect the prompt.
    applyExternalStatus(
      [{ agentId: 'qa', status: 'working', task: null, label: null }],
      { source: 'file-watcher', skipHintDismiss: true },
    )
    expect(useOfficeStore.getState().hasEverReceivedStatus).toBe(true)
  })
})

describe('clearExternalStatus — behavior/group-event reset contract (R68)', () => {
  beforeEach(resetStore)

  it('resets behavior to idle so it stays consistent with the cleared status', () => {
    const { applyExternalStatus, clearExternalStatus } = useOfficeStore.getState()
    // A blocked external status drives behavior:'scratch-head' + expression:'confused'.
    applyExternalStatus(
      [{ agentId: 'dev', status: 'blocked', task: null, label: null }],
      { source: 'claude-cli' },
    )
    expect(useOfficeStore.getState().agents.dev.behavior).toBe('scratch-head')

    clearExternalStatus('dev')
    const dev = useOfficeStore.getState().agents.dev
    // Before R68: status went idle but behavior stayed frozen at 'scratch-head',
    // producing an inconsistent pair until the next organic tick.
    expect(dev.status).toBe('idle')
    expect(dev.behavior).toBe('idle')
    expect(dev.expression).toBe('normal')
    expect(dev.bubble).toBeNull()
  })

  it('does NOT clobber an in-progress group event when external status expires', () => {
    const { applyExternalStatus, setAgentGroupEvent, clearExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: 'Bash', label: null }],
      { source: 'claude-cli' },
    )
    // officeLife locks the agent into a meeting animation.
    setAgentGroupEvent('dev', { behavior: 'meeting', expression: 'happy', bubble: 'In a meeting' })

    // External status expires mid-meeting.
    clearExternalStatus('dev')
    const dev = useOfficeStore.getState().agents.dev
    // The meeting animation must survive — officeLife owns these fields during a group event.
    expect(dev.inGroupEvent).toBe(true)
    expect(dev.behavior).toBe('meeting')
    expect(dev.expression).toBe('happy')
    expect(dev.bubble).toBe('In a meeting')
    expect(dev.status).toBe('idle')
  })

  it('clear-all path also resets behavior and respects group events', () => {
    const { applyExternalStatus, setAgentGroupEvent, clearExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [
        { agentId: 'dev', status: 'working', task: 'Bash', label: null },
        { agentId: 'qa', status: 'done', task: 'Edit', label: null },
      ],
      { source: 'claude-cli' },
    )
    setAgentGroupEvent('qa', { behavior: 'meeting', expression: 'happy', bubble: 'Standup' })

    clearExternalStatus()  // clear-all (staleness sweep)
    const { dev, qa } = useOfficeStore.getState().agents
    expect(dev.behavior).toBe('idle')
    expect(dev.status).toBe('idle')
    // qa is mid group event — must keep its animation.
    expect(qa.behavior).toBe('meeting')
    expect(qa.bubble).toBe('Standup')
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
