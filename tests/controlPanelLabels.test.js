import { describe, it, expect } from 'vitest'
import { formatTokens, blockedReasonLabel, agentLineLabel, taskChipLabel, attentionStripState, controlPanelPresenceRows, healthDotState } from '../src/components/controlPanelLabels.js'

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

describe('attentionStripState', () => {
  it('surfaces only blocked and awaiting-approval agents as human-action items', () => {
    const out = attentionStripState({
      agents: [
        { id: 'pm', status: 'planning' },
        { id: 'qa', status: 'blocked' },
        { id: 'gate', status: 'idle' },
        { id: 'dev', status: 'working' },
      ],
      externalStatus: {
        gate: { status: 'awaiting-approval' },
        dev: { status: 'done' },
      },
      nameForId: (id) => ({ qa: 'QA', gate: 'Gate' }[id] || id),
    })
    expect(out.count).toBe(2)
    expect(out.names).toEqual(['QA', 'Gate'])
    expect(out.items.map((item) => [item.id, item.status])).toEqual([
      ['qa', 'blocked'],
      ['gate', 'awaiting-approval'],
    ])
  })

  it('returns an empty state for non-actionable, missing, or malformed input', () => {
    expect(attentionStripState().count).toBe(0)
    expect(attentionStripState({ agents: [{ id: 'dev', status: 'working' }] })).toEqual({
      count: 0,
      items: [],
      names: [],
    })
  })
})

describe('controlPanelPresenceRows', () => {
  it('shows only agents with real current signals and folds idle agents into quietCount', () => {
    const out = controlPanelPresenceRows({
      agents: [
        { id: 'pm', status: 'idle' },
        { id: 'dev', status: 'working' },
        { id: 'qa', status: 'idle' },
        { id: 'ops', status: 'idle' },
      ],
      externalStatus: {
        qa: { status: 'done', task: 'Edit' },
      },
    })
    expect(out.rows.map((row) => row.agent.id)).toEqual(['dev', 'qa'])
    expect(out.rows.map((row) => [row.agent.id, row.status])).toEqual([
      ['dev', 'working'],
      ['qa', 'done'],
    ])
    expect(out.quietCount).toBe(2)
  })

  it('keeps an idle agent visible when an external label carries useful signal', () => {
    const out = controlPanelPresenceRows({
      agents: [{ id: 'gate', status: 'idle' }],
      externalStatus: { gate: { status: 'idle', label: 'waiting for hook' } },
    })
    expect(out.rows.map((row) => row.agent.id)).toEqual(['gate'])
    expect(out.quietCount).toBe(0)
  })

  it('handles missing and malformed input as an empty calm rail', () => {
    expect(controlPanelPresenceRows()).toEqual({ rows: [], quietCount: 0 })
    expect(controlPanelPresenceRows({ agents: [null, { status: 'idle' }] })).toEqual({ rows: [], quietCount: 0 })
  })
})

describe('healthDotState (AVO-130)', () => {
  const ok = { state: 'online' }
  it('severity precedence: offline > degraded > fallback > live > idle', () => {
    // offline wins even when an external feed is live
    expect(healthDotState({ statusSource: 'external', integrationHealth: { state: 'offline' } }).level).toBe('offline')
    // degraded wins over a live external feed
    expect(healthDotState({ statusSource: 'external', integrationHealth: { state: 'degraded' } }).level).toBe('degraded')
    // fallback when integration is fine but source is the fallback feed
    expect(healthDotState({ statusSource: 'fallback', integrationHealth: ok }).level).toBe('fallback')
    // live when external + healthy integration
    expect(healthDotState({ statusSource: 'external', integrationHealth: ok }).level).toBe('live')
    // idle when no external source and healthy (demo/local)
    expect(healthDotState({ statusSource: 'local', integrationHealth: ok }).level).toBe('idle')
  })
  it('marks offline/degraded/fallback as trouble (auto-show inline label), live/idle as calm', () => {
    expect(healthDotState({ integrationHealth: { state: 'offline' } }).trouble).toBe(true)
    expect(healthDotState({ integrationHealth: { state: 'degraded' } }).trouble).toBe(true)
    expect(healthDotState({ statusSource: 'fallback' }).trouble).toBe(true)
    expect(healthDotState({ statusSource: 'external' }).trouble).toBe(false)
    expect(healthDotState({ statusSource: 'local' }).trouble).toBe(false)
  })
  it('carries the fallback agent count into labelVal, null otherwise', () => {
    expect(healthDotState({ statusSource: 'fallback', externalCount: 3 }).labelVal).toBe(3)
    expect(healthDotState({ statusSource: 'external', externalCount: 3 }).labelVal).toBeNull()
  })
  it('reuses the existing i18n keys per level', () => {
    expect(healthDotState({ integrationHealth: { state: 'offline' } }).labelKey).toBe('status.apiOffline')
    expect(healthDotState({ integrationHealth: { state: 'degraded' } }).labelKey).toBe('status.apiRetrying')
    expect(healthDotState({ statusSource: 'fallback' }).labelKey).toBe('ui.fallbackAgents')
    expect(healthDotState({ statusSource: 'external' }).labelKey).toBe('ui.live')
    expect(healthDotState({ statusSource: 'local' }).labelKey).toBe('status.local')
  })
  it('defaults to idle on empty / missing input', () => {
    expect(healthDotState().level).toBe('idle')
    expect(healthDotState({}).level).toBe('idle')
  })
})
