import { describe, it, expect } from 'vitest'
import { charName } from '../src/i18n'

// AVO-182 — charName(charId) does `charId.includes('~')`, which throws on a null/non-string id.
// The guard makes it crash-safe (a stray null agentId in a feed/roster row must not take down the
// component). Valid role ids still resolve normally.
describe('AVO-182 charName null/non-string guard', () => {
  it('never throws on null / undefined / non-string', () => {
    expect(() => charName(null)).not.toThrow()
    expect(() => charName(undefined)).not.toThrow()
    expect(() => charName(123)).not.toThrow()
    expect(() => charName('')).not.toThrow()
    expect(typeof charName(null)).toBe('string')
  })

  it('still resolves a real role id and a session-prefixed id', () => {
    expect(charName('dev').length).toBeGreaterThan(0)
    expect(charName('feat-x~dev').length).toBeGreaterThan(0)
  })
})
