import { describe, it, expect, beforeEach } from 'vitest'
import {
  useOfficeStore,
  validatePersistedDailyBlockedLedger,
  createPersistedState,
} from '../src/systems/store.js'

// Pristine snapshot so tests don't leak into one another.
const PRISTINE_AGENTS = JSON.parse(JSON.stringify(useOfficeStore.getState().agents))

function resetStore() {
  const agents = {}
  for (const [id, a] of Object.entries(PRISTINE_AGENTS)) {
    agents[id] = {
      ...a,
      status: 'idle',
      behavior: 'idle',
      expression: 'normal',
      bubble: null,
      inGroupEvent: false,
      groupTarget: null,
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
    dailyBlockedLedger: { dayKey: 'reset', counts: {} },
  })
}

describe('dailyBlockedLedger — transition counter (#6 perf metrics)', () => {
  beforeEach(resetStore)

  it('counts the first blocked transition for an agent', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    const ledger = useOfficeStore.getState().dailyBlockedLedger
    expect(ledger.counts.dev).toBe(1)
  })

  it('does NOT double-count consecutive blocked updates (same status repeats)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts.dev).toBe(1)
  })

  it('counts each fresh blocked transition (blocked → working → blocked = 2)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts.dev).toBe(3)
  })

  it('done events do NOT affect blocked counter', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    applyExternalStatus([{ agentId: 'dev', status: 'done' }])
    applyExternalStatus([{ agentId: 'dev', status: 'done' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts).toEqual({})
  })

  it('counts independently per agent', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([
      { agentId: 'dev', status: 'blocked' },
      { agentId: 'qa', status: 'blocked' },
    ])
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    const counts = useOfficeStore.getState().dailyBlockedLedger.counts
    expect(counts.dev).toBe(2)
    expect(counts.qa).toBe(1)
  })

  it('preserves ledger object identity when no blocked transition fires (perf)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // First call settles today's dayKey (resetStore seeds 'reset' which forces a roll
    // on the first applyExternalStatus). Snapshot identity AFTER that settle.
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    const before = useOfficeStore.getState().dailyBlockedLedger
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    applyExternalStatus([{ agentId: 'dev', status: 'done' }])
    const after = useOfficeStore.getState().dailyBlockedLedger
    // No blocked transition occurred → ledger reference should not have changed.
    expect(after).toBe(before)
  })

  it('clones ledger on first blocked transition (clone-on-write)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // Settle today's dayKey first so the next call's blocked transition is the only
    // identity-changing event we measure.
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    const before = useOfficeStore.getState().dailyBlockedLedger
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    const after = useOfficeStore.getState().dailyBlockedLedger
    expect(after).not.toBe(before)
    expect(before.counts).toEqual({}) // original untouched
    expect(after.counts.dev).toBe(1)
  })

  it('updateTime day rollover resets BOTH ledgers atomically', () => {
    const { applyExternalStatus, updateTime } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'qa', status: 'done' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts.dev).toBe(1)
    expect(useOfficeStore.getState().dailyDoneLedger.counts.qa).toBe(1)

    // Simulate a day rollover by stamping yesterday's dayKey directly.
    useOfficeStore.setState((s) => ({
      dailyDoneLedger: { ...s.dailyDoneLedger, dayKey: '1999-12-31' },
      dailyBlockedLedger: { ...s.dailyBlockedLedger, dayKey: '1999-12-31' },
    }))
    updateTime()
    expect(useOfficeStore.getState().dailyBlockedLedger.counts).toEqual({})
    expect(useOfficeStore.getState().dailyDoneLedger.counts).toEqual({})
  })
})

describe('dailyBlockedLedger — additional scenarios (code review pass)', () => {
  beforeEach(resetStore)

  it('idle → blocked counts (default initial status is idle)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // All agents start with status='idle' from initAgents. First blocked tick should count.
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts.dev).toBe(1)
  })

  it('blocked → done → blocked counts as 2 (done is a fresh transition out of blocked)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'dev', status: 'done' }])
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts.dev).toBe(2)
  })

  it('multi-agent batch update: ONE clone for N blocked transitions in same applyExternalStatus call', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    // Settle today's dayKey first
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    const before = useOfficeStore.getState().dailyBlockedLedger

    // Single call with 4 blocked transitions
    applyExternalStatus([
      { agentId: 'dev', status: 'blocked' },
      { agentId: 'qa', status: 'blocked' },
      { agentId: 'ops', status: 'blocked' },
      { agentId: 'gate', status: 'blocked' },
    ])
    const after = useOfficeStore.getState().dailyBlockedLedger

    expect(after).not.toBe(before)
    expect(after.counts).toEqual({ dev: 1, qa: 1, ops: 1, gate: 1 })
    // Original ledger must remain untouched (clone-on-write contract)
    expect(before.counts).toEqual({})
  })

  it('mixed-status batch update increments correct counters', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([
      { agentId: 'dev', status: 'blocked' },
      { agentId: 'qa', status: 'done' },
      { agentId: 'ops', status: 'working' },
      { agentId: 'gate', status: 'blocked' },
    ])
    const state = useOfficeStore.getState()
    expect(state.dailyBlockedLedger.counts).toEqual({ dev: 1, gate: 1 })
    expect(state.dailyDoneLedger.counts).toEqual({ qa: 1 })
  })

  it('empty updates array does not crash and preserves ledger identity', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working' }]) // settle dayKey
    const before = useOfficeStore.getState().dailyBlockedLedger
    expect(() => applyExternalStatus([])).not.toThrow()
    const after = useOfficeStore.getState().dailyBlockedLedger
    // Empty payload should not allocate a new ledger
    expect(after).toBe(before)
  })

  it('dynamic worktree agent id (slug~role) counts independently', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus(
      [{ agentId: 'feat-foo~dev', status: 'blocked', session: 'feat-foo' }],
      { source: 'multi-session' }
    )
    applyExternalStatus(
      [
        { agentId: 'feat-foo~dev', status: 'working', session: 'feat-foo' },
        { agentId: 'feat-bar~dev', status: 'blocked', session: 'feat-bar' },
      ],
      { source: 'multi-session' }
    )
    applyExternalStatus(
      [{ agentId: 'feat-foo~dev', status: 'blocked', session: 'feat-foo' }],
      { source: 'multi-session' }
    )
    const counts = useOfficeStore.getState().dailyBlockedLedger.counts
    expect(counts['feat-foo~dev']).toBe(2)
    expect(counts['feat-bar~dev']).toBe(1)
  })

  it('persistence round-trip: createPersistedState includes dailyBlockedLedger', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    applyExternalStatus([{ agentId: 'qa', status: 'done' }])

    const persisted = createPersistedState(useOfficeStore.getState())
    expect(persisted.dailyBlockedLedger).toBeDefined()
    expect(persisted.dailyBlockedLedger.counts.dev).toBe(1)
    expect(persisted.dailyDoneLedger.counts.qa).toBe(1)
  })

  it('persistence round-trip: validate restores counts when dayKey is today', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    const persisted = createPersistedState(useOfficeStore.getState())

    // Simulate reload: validate the persisted shape
    const restored = validatePersistedDailyBlockedLedger(persisted.dailyBlockedLedger)
    expect(restored.counts.dev).toBe(1)
    expect(restored.dayKey).toBe(persisted.dailyBlockedLedger.dayKey)
  })

  it('dayKey drift defense: blocked ledger stuck on yesterday must not accept new counts onto stale day', () => {
    const { applyExternalStatus } = useOfficeStore.getState()

    // Settle done ledger to today, then force-drift blocked ledger to yesterday.
    applyExternalStatus([{ agentId: 'dev', status: 'working' }])
    const todayKey = useOfficeStore.getState().dailyDoneLedger.dayKey

    useOfficeStore.setState((s) => ({
      dailyBlockedLedger: { dayKey: '1999-12-31', counts: { dev: 99 } },
    }))

    // Now record a blocked event. Done ledger is fresh → dayChanged=false.
    // BUG if: blocked counter increments on the stale yesterday ledger (99 → 100).
    // CORRECT: blocked ledger rolls to today, drops 99, starts fresh.
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])

    const blocked = useOfficeStore.getState().dailyBlockedLedger
    expect(blocked.dayKey).toBe(todayKey)
    // The stale 99 must be discarded — only the new transition counts
    expect(blocked.counts).toEqual({ dev: 1 })
  })

  it('multiple consecutive applyExternalStatus calls without transitions preserve ledger identity', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'working' }]) // settle
    const ref = useOfficeStore.getState().dailyBlockedLedger
    applyExternalStatus([{ agentId: 'qa', status: 'working' }])
    applyExternalStatus([{ agentId: 'ops', status: 'done' }])
    applyExternalStatus([{ agentId: 'gate', status: 'working' }])
    expect(useOfficeStore.getState().dailyBlockedLedger).toBe(ref)
  })

  it('ledger updates correctly when day rolls via applyExternalStatus (not just updateTime)', () => {
    const { applyExternalStatus } = useOfficeStore.getState()
    applyExternalStatus([{ agentId: 'dev', status: 'blocked' }])
    expect(useOfficeStore.getState().dailyBlockedLedger.counts.dev).toBe(1)

    // Stamp both ledgers with yesterday's dayKey to simulate cross-midnight applyExternalStatus
    useOfficeStore.setState((s) => ({
      dailyDoneLedger: { ...s.dailyDoneLedger, dayKey: '1999-12-31' },
      dailyBlockedLedger: { ...s.dailyBlockedLedger, dayKey: '1999-12-31' },
    }))

    applyExternalStatus([{ agentId: 'qa', status: 'blocked' }])
    const blocked = useOfficeStore.getState().dailyBlockedLedger
    expect(blocked.dayKey).not.toBe('1999-12-31')
    expect(blocked.counts).toEqual({ qa: 1 }) // dev:1 from yesterday gone
  })
})

describe('validatePersistedDailyBlockedLedger', () => {
  it('returns null for non-object input', () => {
    expect(validatePersistedDailyBlockedLedger(null)).toBeNull()
    expect(validatePersistedDailyBlockedLedger('string')).toBeNull()
    expect(validatePersistedDailyBlockedLedger(42)).toBeNull()
  })

  it('returns null when dayKey is missing or not a string', () => {
    expect(validatePersistedDailyBlockedLedger({ counts: {} })).toBeNull()
    expect(validatePersistedDailyBlockedLedger({ dayKey: 42, counts: {} })).toBeNull()
  })

  it('returns a fresh empty ledger when dayKey is not today', () => {
    const stale = { dayKey: '1999-12-31', counts: { dev: 99 } }
    const validated = validatePersistedDailyBlockedLedger(stale)
    expect(validated.counts).toEqual({})
    expect(validated.dayKey).not.toBe('1999-12-31')
  })

  it('sanitizes counts: drops non-finite and negative values', () => {
    const today = new Date()
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const saved = {
      dayKey,
      counts: { dev: 5, qa: 'bad', ops: -3, gate: NaN, designer: Infinity, pm: 2.5 },
    }
    const validated = validatePersistedDailyBlockedLedger(saved)
    expect(validated.counts.dev).toBe(5)
    expect(validated.counts.pm).toBe(2.5)
    expect(validated.counts).not.toHaveProperty('qa')
    expect(validated.counts).not.toHaveProperty('ops')
    expect(validated.counts).not.toHaveProperty('gate')
    expect(validated.counts).not.toHaveProperty('designer')
  })
})
