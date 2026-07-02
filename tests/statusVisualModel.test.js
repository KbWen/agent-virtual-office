import { describe, expect, it } from 'vitest'
import { STATUS_COLORS, statusColor, statusVisualState } from '../src/systems/statusVisualModel.mjs'
import { STATUS_COLORS as LEGACY_STATUS_COLORS } from '../src/systems/constants.js'

describe('statusVisualModel', () => {
  it('keeps the legacy STATUS_COLORS import path byte-equivalent', () => {
    expect(STATUS_COLORS).toEqual(LEGACY_STATUS_COLORS)
  })

  it('returns renderer-ready visual tokens for known statuses', () => {
    expect(statusVisualState('awaiting-approval')).toEqual({
      status: 'awaiting-approval',
      color: '#1E9FD4',
      tone: 'awaiting-approval',
      known: true,
    })
  })

  it('falls back defensively for unknown or missing statuses', () => {
    expect(statusVisualState('future-status', { fallbackColor: '#abc' })).toEqual({
      status: 'future-status',
      color: '#abc',
      tone: 'unknown',
      known: false,
    })
    expect(statusColor('nope', '#123')).toBe('#123')
    expect(statusVisualState(null).status).toBe('idle')
  })
})
