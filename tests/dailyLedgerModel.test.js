import { describe, expect, it } from 'vitest'

import {
  buildDoneEventKey,
  createDailyBlockedLedger,
  createDailyDoneLedger,
  ensureCurrentDailyBlockedLedger,
  ensureCurrentDailyDoneLedger,
  localDayKey,
  validatePersistedDailyBlockedLedger,
  validatePersistedDailyDoneLedger,
} from '../src/systems/dailyLedgerModel.mjs'
import {
  validatePersistedDailyBlockedLedger as validateBlockedFromStore,
  validatePersistedDailyDoneLedger as validateDoneFromStore,
} from '../src/systems/store.js'

describe('dailyLedgerModel — portable daily status counters', () => {
  const now = new Date(2026, 3, 8, 12, 0, 0).getTime()
  const yesterday = new Date(2026, 3, 7, 12, 0, 0).getTime()

  it('builds local day keys and fresh ledgers with cloned seed data', () => {
    const seed = { counts: { dev: 2 }, seenEventKeys: ['codex:1:dev'] }
    const done = createDailyDoneLedger(now, seed)
    const blocked = createDailyBlockedLedger(now, { counts: { qa: 1 } })

    expect(localDayKey(now)).toBe('2026-04-08')
    expect(done).toEqual({
      dayKey: '2026-04-08',
      counts: { dev: 2 },
      seenEventKeys: ['codex:1:dev'],
    })
    expect(blocked).toEqual({ dayKey: '2026-04-08', counts: { qa: 1 } })
    expect(done.counts).not.toBe(seed.counts)
    expect(done.seenEventKeys).not.toBe(seed.seenEventKeys)
  })

  it('rolls stale ledgers to an empty current day and clones same-day ledgers', () => {
    const sameDayDone = { dayKey: '2026-04-08', counts: { dev: 3 }, seenEventKeys: ['x'] }
    const sameDayBlocked = { dayKey: '2026-04-08', counts: { qa: 2 } }

    expect(ensureCurrentDailyDoneLedger(sameDayDone, now)).toEqual(sameDayDone)
    expect(ensureCurrentDailyDoneLedger(sameDayDone, now)).not.toBe(sameDayDone)
    expect(ensureCurrentDailyDoneLedger({ ...sameDayDone, dayKey: '2026-04-07' }, now)).toEqual({
      dayKey: '2026-04-08',
      counts: {},
      seenEventKeys: [],
    })

    expect(ensureCurrentDailyBlockedLedger(sameDayBlocked, now)).toEqual(sameDayBlocked)
    expect(ensureCurrentDailyBlockedLedger({ ...sameDayBlocked, dayKey: '2026-04-07' }, now)).toEqual({
      dayKey: '2026-04-08',
      counts: {},
    })
  })

  it('builds stable done event keys from explicit eventKey before source/seq', () => {
    expect(buildDoneEventKey({ agentId: 'dev' }, { eventKey: 'tool-9', source: 'codex', seq: '1' })).toBe('tool-9:dev')
    expect(buildDoneEventKey({ agentId: 'dev' }, { source: 'codex', seq: '1' })).toBe('codex:1:dev')
    expect(buildDoneEventKey({ agentId: 'dev' }, {})).toBeNull()
    expect(buildDoneEventKey({}, { source: 'codex', seq: '1' })).toBeNull()
  })

  it('sanitizes persisted done ledgers and caps seen event keys', () => {
    const saved = {
      dayKey: '2026-04-08',
      counts: { dev: 2, qa: -1, ops: Number.NaN, pm: 1.5 },
      seenEventKeys: ['keep', 42, ...Array.from({ length: 505 }, (_, i) => `event-${i}`)],
    }

    const out = validatePersistedDailyDoneLedger(saved, now)

    expect(out.counts).toEqual({ dev: 2, pm: 1.5 })
    expect(out.seenEventKeys).toHaveLength(500)
    expect(out.seenEventKeys[0]).toBe('event-5')
  })

  it('sanitizes blocked ledgers and resets stale persisted days', () => {
    expect(validatePersistedDailyBlockedLedger({
      dayKey: '2026-04-08',
      counts: { dev: 2, qa: 'bad', ops: -1 },
    }, now)).toEqual({
      dayKey: '2026-04-08',
      counts: { dev: 2 },
    })

    expect(validatePersistedDailyDoneLedger({
      dayKey: '2026-04-07',
      counts: { dev: 9 },
      seenEventKeys: ['old'],
    }, now)).toEqual(createDailyDoneLedger(now))

    expect(validatePersistedDailyBlockedLedger({
      dayKey: '2026-04-07',
      counts: { dev: 9 },
    }, now)).toEqual(createDailyBlockedLedger(now))
  })

  it('keeps the legacy store validation exports equivalent to the node-safe model', () => {
    const doneSaved = { dayKey: localDayKey(now), counts: { dev: 1 }, seenEventKeys: ['x'] }
    const blockedSaved = { dayKey: localDayKey(now), counts: { qa: 3 } }

    expect(validateDoneFromStore(doneSaved, now)).toEqual(validatePersistedDailyDoneLedger(doneSaved, now))
    expect(validateBlockedFromStore(blockedSaved, now)).toEqual(validatePersistedDailyBlockedLedger(blockedSaved, now))
    expect(validateDoneFromStore({ ...doneSaved, dayKey: localDayKey(yesterday) }, now))
      .toEqual(validatePersistedDailyDoneLedger({ ...doneSaved, dayKey: localDayKey(yesterday) }, now))
  })
})
