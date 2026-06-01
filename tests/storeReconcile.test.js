import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'

// Pristine agentcortex roster captured at module load — used to fully restore the
// singleton store after a suite that swaps the roster (e.g. the lightweight-mode tests).
// resetStore() only FILTERS s.agents, it never re-adds; without this snapshot a roster
// swap would leave later suites without their static agents.
const PRISTINE_MODE = useOfficeStore.getState().mode
const PRISTINE_AGENTS = JSON.parse(JSON.stringify(useOfficeStore.getState().agents))

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
    selectedAgent: null,
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

  it('evicts ALL dynamic agents on an empty multi-session payload (all sessions finished)', () => {
    // Contract relied on by inferStatus.applyMessage's empty-multi-session branch:
    // when every worktree session's agents are all 'done', scanAndMerge produces a
    // merged payload with agents:[]. applyExternalStatus([], {source:'multi-session'})
    // must still reconcile — evicting every phantom 'slug~role' worker — rather than
    // leaving them lingering with stale 'working' status until their 5-min expiry.
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [
        { agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' },
        { agentId: 'feat-b~qa', status: 'working', task: null, label: null, session: 'feat-b' },
      ],
      { source: 'multi-session' },
    )
    let s = useOfficeStore.getState()
    expect(s.agents['feat-a~dev']).toBeTruthy()
    expect(s.agents['feat-b~qa']).toBeTruthy()

    // Empty payload — both sessions done. ALL dynamic agents must be reconciled away.
    applyExternalStatus([], { source: 'multi-session' })
    s = useOfficeStore.getState()
    expect(s.agents['feat-a~dev']).toBeUndefined()
    expect(s.agents['feat-b~qa']).toBeUndefined()
    expect(s.externalStatus['feat-a~dev']).toBeUndefined()
    expect(s.externalStatus['feat-b~qa']).toBeUndefined()
    // Static roster agents are untouched.
    expect(s.agents['dev']).toBeTruthy()
    // R78 Fix G precondition: the eviction leaves externalStatus completely empty.
    // applyMessage's empty-multi-session branch keys on exactly this to decide whether to
    // transition statusSource back to 'organic' immediately (instead of waiting out the
    // 2-min staleness timer with a misleading green "live" dot over an empty office).
    expect(Object.keys(s.externalStatus)).toHaveLength(0)
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
    expect(dev.returnHomeOnIdle).toBe(true)
  })

  it('clearReturnHomeIntent consumes the return-home flag without changing idle state', () => {
    const { applyExternalStatus, clearExternalStatus, clearReturnHomeIntent } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: 'Bash', label: null }],
      { source: 'claude-cli' },
    )

    clearExternalStatus('dev')
    expect(useOfficeStore.getState().agents.dev.returnHomeOnIdle).toBe(true)

    clearReturnHomeIntent('dev')
    const dev = useOfficeStore.getState().agents.dev
    expect(dev.returnHomeOnIdle).toBe(false)
    expect(dev.status).toBe('idle')
    expect(dev.behavior).toBe('idle')
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
    expect(dev.returnHomeOnIdle).toBe(true)
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

  it('multi-task clear-all marks every static active role to return home', () => {
    const { applyExternalStatus, clearExternalStatus } = useOfficeStore.getState()
    const activeRoles = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
    applyExternalStatus(
      activeRoles.map((role, i) => ({
        agentId: role,
        status: i === 2 ? 'blocked' : 'working',
        task: ['Write', 'Read', 'Bash', 'Bash', 'Bash', 'WebSearch', 'authenticate', 'Edit'][i],
        label: `multi-task-${role}`,
      })),
      { source: 'simulation', statusSource: 'external', integrationSource: 'simulation' },
    )

    clearExternalStatus()

    const agents = useOfficeStore.getState().agents
    for (const role of activeRoles) {
      expect(agents[role], `${role} still exists`).toBeTruthy()
      expect(agents[role].status, `${role}.status`).toBe('idle')
      expect(agents[role].returnHomeOnIdle, `${role}.returnHomeOnIdle`).toBe(true)
    }
  })
})

describe('updateTime — daily-done ledger rollover (R71)', () => {
  beforeEach(resetStore)

  it('rolls the ledger over and resets desk items when the local day changes', () => {
    // Seed a ledger whose dayKey is NOT today — simulates state surviving past midnight.
    useOfficeStore.setState({
      dailyDoneLedger: { dayKey: '1999-01-01', counts: { dev: 7, qa: 3 }, seenEventKeys: ['x'] },
      agents: {
        ...useOfficeStore.getState().agents,
        dev: { ...useOfficeStore.getState().agents.dev, deskItemCount: { coffee: 5, sticky: 2, books: 1 } },
      },
    })

    // updateTime runs every minute via officeLife's timeInterval — the rollover must be
    // traffic-independent (not gated on an applyExternalStatus call).
    useOfficeStore.getState().updateTime()

    const s = useOfficeStore.getState()
    expect(s.dailyDoneLedger.dayKey).not.toBe('1999-01-01')  // rolled to today
    expect(s.dailyDoneLedger.counts).toEqual({})              // stale counts cleared
    expect(s.dailyDoneLedger.seenEventKeys).toEqual([])
    expect(s.agents.dev.deskItemCount).toEqual({ coffee: 0, sticky: 0, books: 0 })
  })

  it('leaves the ledger untouched when the day has not changed', () => {
    const todayLedger = useOfficeStore.getState().dailyDoneLedger
    // resetStore seeds dayKey:'reset' — replace with a genuine current-day ledger first.
    useOfficeStore.getState().updateTime()
    const afterFirst = useOfficeStore.getState().dailyDoneLedger
    useOfficeStore.setState({
      dailyDoneLedger: { ...afterFirst, counts: { dev: 4 } },
    })
    // A second same-day updateTime must NOT wipe the in-day counts.
    useOfficeStore.getState().updateTime()
    expect(useOfficeStore.getState().dailyDoneLedger.counts).toEqual({ dev: 4 })
    void todayLedger
  })
})

describe('selectedAgent — eviction when a selected dynamic agent disappears (R71)', () => {
  beforeEach(resetStore)

  it('clears selectedAgent when a multi-session reconcile removes the selected dynamic agent', () => {
    const { applyExternalStatus, setSelectedAgent } = useOfficeStore.getState()
    applyExternalStatus(
      [
        { agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' },
        { agentId: 'feat-b~dev', status: 'working', task: null, label: null, session: 'feat-b' },
      ],
      { source: 'multi-session' },
    )
    setSelectedAgent('feat-b~dev')
    expect(useOfficeStore.getState().selectedAgent).toBe('feat-b~dev')

    // feat-b's session ends — reconciliation deletes the dynamic agent.
    applyExternalStatus(
      [{ agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' }],
      { source: 'multi-session' },
    )
    // The dangling selection must be dropped, not left pointing at a gone id.
    expect(useOfficeStore.getState().selectedAgent).toBeNull()
  })

  it('keeps selectedAgent when the selected agent is NOT the one evicted', () => {
    const { applyExternalStatus, setSelectedAgent } = useOfficeStore.getState()
    applyExternalStatus(
      [
        { agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' },
        { agentId: 'feat-b~dev', status: 'working', task: null, label: null, session: 'feat-b' },
      ],
      { source: 'multi-session' },
    )
    setSelectedAgent('feat-a~dev')
    applyExternalStatus(
      [{ agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' }],
      { source: 'multi-session' },
    )
    expect(useOfficeStore.getState().selectedAgent).toBe('feat-a~dev')
  })

  it('clears selectedAgent when clearExternalStatus(id) deletes the selected dynamic agent', () => {
    const { applyExternalStatus, clearExternalStatus, setSelectedAgent } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'wt~qa', status: 'working', task: null, label: null, session: 'wt' }],
      { source: 'multi-session' },
    )
    setSelectedAgent('wt~qa')
    clearExternalStatus('wt~qa')  // dynamic agent expiry
    expect(useOfficeStore.getState().agents['wt~qa']).toBeUndefined()
    expect(useOfficeStore.getState().selectedAgent).toBeNull()
  })

  it('clears selectedAgent on a clear-all sweep that removes the selected dynamic agent', () => {
    const { applyExternalStatus, clearExternalStatus, setSelectedAgent } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'wt~ops', status: 'working', task: null, label: null, session: 'wt' }],
      { source: 'multi-session' },
    )
    setSelectedAgent('wt~ops')
    clearExternalStatus()  // staleness sweep, clear-all
    expect(useOfficeStore.getState().selectedAgent).toBeNull()
  })

  it('does NOT clear selectedAgent when a selected STATIC agent has its external status cleared', () => {
    const { applyExternalStatus, clearExternalStatus, setSelectedAgent } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'claude-cli' },
    )
    setSelectedAgent('dev')
    clearExternalStatus('dev')  // static agent goes idle, NOT deleted
    // The static agent still exists — the inspector selection must survive.
    expect(useOfficeStore.getState().agents.dev).toBeTruthy()
    expect(useOfficeStore.getState().selectedAgent).toBe('dev')
  })
})

describe('applyExternalStatus — non-agentcortex roster fallback (R78 Fix E)', () => {
  // The 'lightweight' mode roster is planner/worker/checker — none of the VALID_ROLES
  // ids (dev/qa/pm/…). A fallback-count or hash message routes to VALID_ROLES ids, so
  // applyExternalStatus's dynamic-agent branch finds neither s.agents[baseRole] nor
  // s.agents['dev']. Before Fix E, baseAgent was undefined → `continue` silently dropped
  // the agent, so a '#count=N' hash did nothing in lightweight mode.
  function lightweightAgent(id) {
    return {
      id, name: id, color: '#888', behavior: 'idle', expression: 'normal',
      bubble: null, status: 'idle', deskItemCount: { coffee: 0, sticky: 0, books: 0 },
      position: { x: 200, y: 200 }, targetPosition: { x: 200, y: 200 },
      isMoving: false, facing: 'down', inGroupEvent: false, groupTarget: null,
    }
  }

  beforeEach(() => {
    useOfficeStore.setState({
      mode: 'lightweight',
      agents: {
        planner: lightweightAgent('planner'),
        worker: lightweightAgent('worker'),
        checker: lightweightAgent('checker'),
      },
      externalStatus: {},
      statusSource: 'organic',
      activeWorkflow: null,
      activityLog: [],
      selectedAgent: null,
      dailyDoneLedger: { dayKey: 'reset', counts: {}, seenEventKeys: [] },
    })
  })

  // Fully restore the pristine agentcortex roster + mode so later suites that depend on
  // static agents (dev/qa/…) are not left with the lightweight roster.
  afterEach(() => {
    useOfficeStore.setState({
      mode: PRISTINE_MODE,
      agents: JSON.parse(JSON.stringify(PRISTINE_AGENTS)),
      externalStatus: {},
      statusSource: 'organic',
      activeWorkflow: null,
      activityLog: [],
      selectedAgent: null,
      dailyDoneLedger: { dayKey: 'reset', counts: {}, seenEventKeys: [] },
    })
  })

  it('creates a count-fallback agent in lightweight mode instead of silently dropping it', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // distributeFallbackCount(2) → ['dev','qa']; neither exists in the lightweight roster.
    applyExternalStatus(
      [
        { agentId: 'dev', status: 'working', task: null, label: null },
        { agentId: 'qa', status: 'working', task: null, label: null },
      ],
      { source: 'hash-bridge' },
    )
    const s = useOfficeStore.getState()
    // Both must be spawned as dynamic overflow agents (cloning a lightweight visual style).
    expect(s.agents['dev']).toBeTruthy()
    expect(s.agents['qa']).toBeTruthy()
    expect(s.externalStatus['dev']?.status).toBe('working')
    expect(s.externalStatus['qa']?.status).toBe('working')
  })

  it('clearExternalStatus DELETES a non-roster count-fallback agent (no phantom leak)', () => {
    const { applyExternalStatus, clearExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'hash-bridge' },
    )
    expect(useOfficeStore.getState().agents['dev']).toBeTruthy()
    // 'dev' is NOT in the lightweight roster — clearing must DELETE it, not idle it.
    // A `.session`-only discriminator would wrongly keep it (session is null), leaving a
    // phantom overflow character on screen forever.
    clearExternalStatus('dev')
    expect(useOfficeStore.getState().agents['dev']).toBeUndefined()
  })

  it('clearExternalStatus clear-all path also deletes non-roster fallback agents', () => {
    const { applyExternalStatus, clearExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [
        { agentId: 'dev', status: 'working', task: null, label: null },
        { agentId: 'qa', status: 'working', task: null, label: null },
      ],
      { source: 'hash-bridge' },
    )
    clearExternalStatus()  // staleness sweep
    const s = useOfficeStore.getState()
    expect(s.agents['dev']).toBeUndefined()
    expect(s.agents['qa']).toBeUndefined()
    // The real lightweight roster agents survive.
    expect(s.agents['planner']).toBeTruthy()
    expect(s.agents['worker']).toBeTruthy()
    expect(s.agents['checker']).toBeTruthy()
  })
})

describe('clearExternalStatus — static agents are idled, not deleted (R78 Fix E regression guard)', () => {
  beforeEach(resetStore)

  it('a static roster agent (agentcortex mode) is reset to idle, never deleted', () => {
    const { applyExternalStatus, clearExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: 'Bash', label: null }],
      { source: 'claude-cli' },
    )
    clearExternalStatus('dev')
    const dev = useOfficeStore.getState().agents.dev
    // 'dev' IS in the agentcortex roster — must survive as an idle static agent.
    expect(dev).toBeTruthy()
    expect(dev.status).toBe('idle')
  })
})

describe('applyExternalStatus — clearSourceIfEmpty flag (R78 Fix G)', () => {
  beforeEach(resetStore)

  it('reverts statusSource to organic and integrationSource to null when empty multi-session eviction leaves ext empty', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // Establish two dynamic agents with an external source.
    applyExternalStatus(
      [
        { agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' },
        { agentId: 'feat-b~qa',  status: 'working', task: null, label: null, session: 'feat-b' },
      ],
      { source: 'multi-session', statusSource: 'external', integrationSource: 'multi-session' },
    )
    expect(useOfficeStore.getState().statusSource).toBe('external')
    expect(useOfficeStore.getState().integrationSource).toBe('multi-session')

    // Empty multi-session payload with clearSourceIfEmpty: all dynamic agents are evicted,
    // ext becomes empty → statusSource must flip back to 'organic' in the SAME set().
    applyExternalStatus([], { source: 'multi-session', clearSourceIfEmpty: true })
    const s = useOfficeStore.getState()
    expect(Object.keys(s.externalStatus)).toHaveLength(0)
    expect(s.statusSource).toBe('organic')
    expect(s.integrationSource).toBeNull()
  })

  it('does NOT revert to organic when a static agent still has external status after eviction', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // Static 'dev' gets an external status.
    applyExternalStatus(
      [{ agentId: 'dev', status: 'working', task: null, label: null }],
      { source: 'claude-cli', statusSource: 'external', integrationSource: 'claude-cli' },
    )
    // Also add a dynamic agent from the same multi-session update.
    applyExternalStatus(
      [{ agentId: 'feat-a~dev', status: 'working', task: null, label: null, session: 'feat-a' }],
      { source: 'multi-session' },
    )
    expect(useOfficeStore.getState().statusSource).toBe('external')

    // Empty multi-session payload evicts only the dynamic agent; static 'dev' stays in ext.
    applyExternalStatus([], { source: 'multi-session', clearSourceIfEmpty: true })
    const s = useOfficeStore.getState()
    // ext still holds 'dev' → must NOT revert to organic.
    expect(s.externalStatus['dev']).toBeTruthy()
    expect(s.statusSource).toBe('external')
  })

  it('clearSourceIfEmpty without the flag does not revert source', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'feat-x~dev', status: 'working', task: null, label: null, session: 'feat-x' }],
      { source: 'multi-session', statusSource: 'external', integrationSource: 'multi-session' },
    )
    // Same eviction without the clearSourceIfEmpty flag: source stays as-is.
    applyExternalStatus([], { source: 'multi-session' })
    const s = useOfficeStore.getState()
    // Dynamic agent evicted but source was not asked to revert.
    expect(s.agents['feat-x~dev']).toBeUndefined()
    expect(s.statusSource).toBe('external')
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
