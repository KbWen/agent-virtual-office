import { describe, expect, it } from 'vitest'
import { sanitizeObservedActivity } from '../src/utils/statusContract.mjs'

describe('sanitizeObservedActivity', () => {
  const now = 1_000_000

  it.each(['all-idle', 'not-idle', 'unknown'])('accepts a fresh exact %s summary', state => {
    expect(sanitizeObservedActivity({ state, expiresAt: now + 120_000 }, now))
      .toEqual({ state, expiresAt: now + 120_000 })
  })

  it.each([
    null,
    [],
    { state: 'done', expiresAt: now + 1 },
    { state: 'all-idle', expiresAt: now },
    { state: 'all-idle', expiresAt: now + 120_001 },
    { state: 'all-idle', expiresAt: Infinity },
    { state: 'all-idle', expiresAt: now + 1, sessionCount: 2 },
  ])('rejects malformed, stale, unbounded, or extra-key values', value => {
    expect(sanitizeObservedActivity(value, now)).toBeNull()
  })

  it('rejects a non-plain object shape', () => {
    const value = Object.assign(Object.create({ inherited: true }), {
      state: 'all-idle', expiresAt: now + 1,
    })
    expect(sanitizeObservedActivity(value, now)).toBeNull()
  })
})
