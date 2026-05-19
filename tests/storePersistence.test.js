import { describe, it, expect } from 'vitest'
import { createPersistedState, validatePersistedAgent, validatePersistedDailyDoneLedger } from '../src/systems/store.js'

describe('createPersistedState', () => {
  it('keeps only persistable agent fields', () => {
    const persisted = createPersistedState({
      agents: {
        dev: {
          behavior: 'typing',
          expression: 'focused',
          deskItemCount: { coffee: 2, sticky: 0, books: 1 },
          position: { x: 10, y: 20 },
          facing: 'left',
          status: 'working',
          bubble: 'hello',
        },
      },
      mood: 'rushing',
      externalStatus: { dev: { status: 'working' } },
      statusSource: 'external',
      activeWorkflow: 'Implement',
    })

    expect(persisted).toMatchObject({
      agents: {
        dev: {
          behavior: 'typing',
          expression: 'focused',
          deskItemCount: { coffee: 2, sticky: 0, books: 1 },
          position: { x: 10, y: 20 },
          facing: 'left',
        },
      },
    })
    expect(persisted.agents.dev.status).toBeUndefined()
    expect(persisted.agents.dev.bubble).toBeUndefined()
    expect(persisted.externalStatus).toBeUndefined()
    expect(persisted.activeWorkflow).toBeUndefined()
  })

  it('produces the same persisted payload when only transient state changes', () => {
    const stateA = {
      agents: {
        qa: {
          behavior: 'magnifier',
          expression: 'normal',
          deskItemCount: { coffee: 0, sticky: 0, books: 0 },
          position: { x: 30, y: 40 },
          facing: 'down',
          status: 'idle',
          bubble: null,
        },
      },
      mood: 'normal',
      activeWorkflow: null,
    }
    const stateB = {
      agents: {
        qa: {
          ...stateA.agents.qa,
          status: 'working',
          bubble: 'Checking tests',
        },
      },
      mood: 'intense',
      activeWorkflow: 'Review',
    }

    const persistedA = createPersistedState(stateA)
    const persistedB = createPersistedState(stateB)

    expect({ ...persistedA, _savedAt: 0 }).toEqual({ ...persistedB, _savedAt: 0 })
  })
})

describe('validatePersistedAgent — deskItemCount sanitization (R63)', () => {
  it('keeps a well-formed deskItemCount as-is', () => {
    const v = validatePersistedAgent({ deskItemCount: { coffee: 3, sticky: 1, books: 2 } })
    expect(v.deskItemCount).toEqual({ coffee: 3, sticky: 1, books: 2 })
  })

  it('strips unknown keys from a corrupted/tampered deskItemCount', () => {
    const v = validatePersistedAgent({ deskItemCount: { coffee: 2, sticky: 0, books: 1, evil: 999, plant: 7 } })
    expect(Object.keys(v.deskItemCount).sort()).toEqual(['books', 'coffee', 'sticky'])
    expect(v.deskItemCount.evil).toBeUndefined()
  })

  it('coerces non-integer / string values to 0 so growth math never string-concats', () => {
    // Before R63: count[item] = ("lots" || 0) + 1 → "lots1" rendered as a count.
    const v = validatePersistedAgent({ deskItemCount: { coffee: 'lots', sticky: NaN, books: Infinity } })
    expect(v.deskItemCount).toEqual({ coffee: 0, sticky: 0, books: 0 })
  })

  it('clamps negative values to 0 and floors fractional values', () => {
    const v = validatePersistedAgent({ deskItemCount: { coffee: -5, sticky: 2.9, books: 0 } })
    expect(v.deskItemCount).toEqual({ coffee: 0, sticky: 2, books: 0 })
  })

  it('rejects non-object deskItemCount (array, string) → undefined', () => {
    expect(validatePersistedAgent({ deskItemCount: [1, 2, 3] }).deskItemCount).toBeUndefined()
    expect(validatePersistedAgent({ deskItemCount: 'corrupt' }).deskItemCount).toBeUndefined()
  })
})

describe('validatePersistedDailyDoneLedger — stale-day reconciliation (R73)', () => {
  // Local day key for a fixed reference instant — built the same way the store does.
  function dayKeyFor(ts) {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // Noon today and noon yesterday — far from any midnight boundary so the test is stable.
  const noonToday = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime() })()
  const noonYesterday = noonToday - 24 * 60 * 60 * 1000

  it('keeps a same-day ledger intact (counts + seenEventKeys preserved)', () => {
    const v = validatePersistedDailyDoneLedger({
      dayKey: dayKeyFor(noonToday),
      counts: { dev: 3, qa: 1 },
      seenEventKeys: ['claude-cli:100:dev'],
    }, noonToday)
    expect(v.dayKey).toBe(dayKeyFor(noonToday))
    expect(v.counts).toEqual({ dev: 3, qa: 1 })
    expect(v.seenEventKeys).toEqual(['claude-cli:100:dev'])
  })

  it('discards a stale-day ledger and returns a fresh empty ledger for today', () => {
    // A ledger saved late yesterday, loaded early today (within the 4h staleness window):
    // it must NOT seed the store with yesterday's tally — that would show stale
    // "done today" counts until updateTime's next 60s rollover ran.
    const v = validatePersistedDailyDoneLedger({
      dayKey: dayKeyFor(noonYesterday),
      counts: { dev: 9, qa: 5 },
      seenEventKeys: ['claude-cli:1:dev'],
    }, noonToday)
    expect(v.dayKey).toBe(dayKeyFor(noonToday))
    expect(v.counts).toEqual({})
    expect(v.seenEventKeys).toEqual([])
  })

  it('rejects malformed ledgers (no dayKey / non-object) → null', () => {
    expect(validatePersistedDailyDoneLedger(null)).toBeNull()
    expect(validatePersistedDailyDoneLedger({ counts: { dev: 1 } })).toBeNull()
    expect(validatePersistedDailyDoneLedger('corrupt')).toBeNull()
  })

  it('drops non-finite / negative count values on a same-day ledger', () => {
    const v = validatePersistedDailyDoneLedger({
      dayKey: dayKeyFor(noonToday),
      counts: { dev: 2, qa: -1, ops: NaN, res: Infinity },
      seenEventKeys: [],
    }, noonToday)
    expect(v.counts).toEqual({ dev: 2 })
  })
})
