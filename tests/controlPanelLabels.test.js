import { describe, it, expect } from 'vitest'
import { formatTokens, blockedReasonLabel, agentLineLabel, taskChipLabel } from '../src/components/controlPanelLabels.js'

// These pure helpers were extracted out of ControlPanel.jsx (god-component cleanup) so they can be
// tested without importing the React module. `formatTokens`/`blockedReasonLabel`/`agentLineLabel`
// had no direct coverage before.

describe('formatTokens (AVO-108)', () => {
  it('formats by magnitude', () => {
    expect(formatTokens(842)).toBe('842')
    expect(formatTokens(604937)).toBe('605k')
    expect(formatTokens(1_240_000)).toBe('1.2M')
    expect(formatTokens(1_000_000)).toBe('1M') // strips the .0
  })
  it('guards non-numeric / negative → "0"', () => {
    expect(formatTokens(undefined)).toBe('0')
    expect(formatTokens(NaN)).toBe('0')
    expect(formatTokens(-5)).toBe('0')
    expect(formatTokens('5')).toBe('0')
  })
})

describe('blockedReasonLabel (AVO-110)', () => {
  it('surfaces the blocked agent\'s reason label, truncated at 28', () => {
    expect(blockedReasonLabel({ status: 'blocked', label: '❌ npm test failed' })).toBe('❌ npm test failed')
    const long = blockedReasonLabel({ status: 'blocked', label: 'x'.repeat(40) })
    expect(long).toHaveLength(28)
    expect(long.endsWith('…')).toBe(true)
  })
  it('returns null for non-blocked / label-less agents', () => {
    expect(blockedReasonLabel({ status: 'working', label: 'whatever' })).toBeNull()
    expect(blockedReasonLabel({ status: 'blocked' })).toBeNull()
    expect(blockedReasonLabel(null)).toBeNull()
  })
})

describe('agentLineLabel — AVO-110 reason token › tool chip › status word', () => {
  // i18n stub mapping the keys this label path requests; falls back to the fallback arg otherwise.
  const t = (key, fb) => ({
    'blockedReason.test-run-failed.label': 'Test run',
    'blockedReason.blocked-unknown.label': 'Blocked',
    'statusLabels.working': 'Working',
  }[key] ?? fb)
  it('blocked: label comes from the reasonCode TOKEN, not the raw ext.label', () => {
    expect(agentLineLabel({ status: 'blocked', label: '❌ failed', task: 'Bash', reasonCode: 'test-run-failed' }, t))
      .toBe('Test run')
  })
  it('NO-RENDER-SIDE-DERIVATION: misleading ext.label + unknown reasonCode → unknown label (never parsed from label)', () => {
    expect(agentLineLabel({ status: 'blocked', label: '❌ deploy failed', task: 'Bash', reasonCode: 'blocked-unknown' }, t))
      .toBe('Blocked')
  })
  it('blocked with absent reasonCode → blocked-unknown label', () => {
    expect(agentLineLabel({ status: 'blocked', label: 'x', task: 'Bash' }, t)).toBe('Blocked')
  })
  it('falls back to the tool chip, then the status word', () => {
    expect(agentLineLabel({ status: 'working', task: 'Bash' }, t)).toBe(taskChipLabel('Bash'))
    expect(agentLineLabel({ status: 'working', task: null }, t)).toBe('Working')
  })
  it('null ext → null', () => {
    expect(agentLineLabel(null, t)).toBeNull()
  })
})
