import { describe, it, expect } from 'vitest'
import {
  countAttentionBlockers,
  firstAttentionBlockerId,
  derivePetState,
  resolvePetMode,
  PET_MODES,
  BLOCKED_LIKE_STATUSES,
} from './petState.js'

// AVO-171 — the pet's hide-on-blocker honesty guarantee must include `awaiting-approval`
// (idle-gap-inferred from blocked+90s = an agent stuck at a permission prompt). Before the fix, the
// pet only counted `status === 'blocked'`, so after the 90s reclassification the pet un-hid and a
// concurrent deploy/eureka could fire CELEBRATE while an agent was genuinely stuck.
describe('AVO-171 pet hide-on-blocker includes awaiting-approval', () => {
  it('BLOCKED_LIKE_STATUSES covers blocked + awaiting-approval', () => {
    expect([...BLOCKED_LIKE_STATUSES].sort()).toEqual(['awaiting-approval', 'blocked'])
  })

  it('countAttentionBlockers counts blocked', () => {
    expect(countAttentionBlockers({ a: { status: 'blocked' } })).toBe(1)
  })

  it('countAttentionBlockers counts awaiting-approval (the gap this fix closes)', () => {
    expect(countAttentionBlockers({ a: { status: 'awaiting-approval' } })).toBe(1)
  })

  it('counts both blocked and awaiting-approval, ignores other/empty statuses', () => {
    const ext = {
      a: { status: 'blocked' },
      b: { status: 'awaiting-approval' },
      c: { status: 'working' },
      d: { status: 'idle' },
      e: null,
    }
    expect(countAttentionBlockers(ext)).toBe(2)
  })

  it('handles empty / nullish input', () => {
    expect(countAttentionBlockers({})).toBe(0)
    expect(countAttentionBlockers(null)).toBe(0)
    expect(countAttentionBlockers(undefined)).toBe(0)
  })

  it('firstAttentionBlockerId returns the first blocked/awaiting-approval id, else null', () => {
    expect(firstAttentionBlockerId({ a: { status: 'working' }, b: { status: 'awaiting-approval' } })).toBe('b')
    expect(firstAttentionBlockerId({ a: { status: 'blocked' } })).toBe('a')
    expect(firstAttentionBlockerId({ a: { status: 'idle' } })).toBeNull()
    expect(firstAttentionBlockerId(null)).toBeNull()
  })

  it('an awaiting-approval agent forces the pet to HIDE (derivePetState)', () => {
    const blockedCount = countAttentionBlockers({ a: { status: 'awaiting-approval' } })
    expect(derivePetState({ mood: 'smooth', blockedCount })).toBe(PET_MODES.HIDE)
  })

  it('REGRESSION: the pet does NOT celebrate while an agent is awaiting-approval', () => {
    const blockedCount = countAttentionBlockers({ stuck: { status: 'awaiting-approval' } })
    const base = derivePetState({ mood: 'smooth', blockedCount })
    const mode = resolvePetMode({ base, celebrate: true })
    expect(mode).toBe(PET_MODES.HIDE)
    expect(mode).not.toBe(PET_MODES.CELEBRATE)
  })
})
