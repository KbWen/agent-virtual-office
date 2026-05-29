import { describe, it, expect, beforeEach } from 'vitest'
import {
  useOfficeStore,
  validatePersistedDailyBlockedLedger,
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
