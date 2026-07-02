import { describe, expect, it } from 'vitest'
import {
  BLOCKED_REASON_TABLE_CODES,
  BLOCKED_REASONS,
  blockedReasonState,
  classifyBlockedReason,
} from '../src/systems/blockedReasonModel.mjs'

describe('blockedReasonModel', () => {
  it('keeps presentation metadata aligned with the transport reason-code contract', () => {
    expect(BLOCKED_REASON_TABLE_CODES).toEqual([...BLOCKED_REASONS])
  })

  it('returns renderer-ready metadata for known blocked reasons', () => {
    expect(blockedReasonState('api-rate-limit')).toEqual({
      family: 'blocked',
      reason: 'api-rate-limit',
      iconId: 'hourglass',
      hue: '#5b7fa6',
      a11yKey: 'blockedReason.api-rate-limit.a11y',
    })
  })

  it('falls back to neutral unknown metadata for unsafe or absent reason codes', () => {
    expect(blockedReasonState('not-real')).toMatchObject({
      family: 'blocked',
      reason: 'blocked-unknown',
      iconId: 'q-neutral',
    })
    expect(blockedReasonState(null).reason).toBe('blocked-unknown')
  })

  it('keeps the legacy classifyBlockedReason alias byte-compatible for existing importers', () => {
    expect(classifyBlockedReason('permission-denied')).toEqual(blockedReasonState('permission-denied'))
  })
})
