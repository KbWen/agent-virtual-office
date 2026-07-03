import { describe, expect, it } from 'vitest'

import {
  agentLineToken,
  attentionStripState,
  blockedReasonPreview,
  buildActionStripViewModel,
  controlPanelPresenceRows,
  formatTokens,
} from '../src/systems/actionStripModel.mjs'
import {
  buildActionStripViewModel as buildActionStripViewModelFromCore,
} from '../src/systems/statusCore.mjs'

describe('actionStripModel — portable control panel semantics', () => {
  it('formats compact token counts without importing UI code', () => {
    expect(formatTokens(842)).toBe('842')
    expect(formatTokens(604937)).toBe('605k')
    expect(formatTokens(1_240_000)).toBe('1.2M')
    expect(formatTokens(-1)).toBe('0')
  })

  it('returns line tokens instead of localized UI strings', () => {
    expect(agentLineToken({ status: 'blocked', reasonCode: 'test-run-failed', task: 'Bash' })).toEqual({
      kind: 'blocked-reason',
      reason: 'test-run-failed',
      labelKey: 'blockedReason.test-run-failed.label',
      fallbackStatus: 'blocked',
    })
    expect(agentLineToken({ status: 'working', task: 'mcp__notion__create_page' })).toEqual({
      kind: 'task',
      task: 'mcp__notion__create_page',
    })
    expect(agentLineToken({ status: 'working' })).toEqual({
      kind: 'status',
      status: 'working',
      labelKey: 'statusLabels.working',
    })
    expect(agentLineToken(null)).toBeNull()
  })

  it('keeps raw blocked labels as decode-layer previews only', () => {
    expect(blockedReasonPreview({ status: 'blocked', label: 'x'.repeat(40) })).toBe(`${'x'.repeat(27)}...`)
    expect(blockedReasonPreview({ status: 'working', label: 'x'.repeat(40) })).toBeNull()
  })

  it('surfaces only human-action attention states', () => {
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

  it('builds one reusable strip view-model for health, attention, and presence rows', () => {
    const out = buildActionStripViewModel({
      agents: [
        { id: 'dev', status: 'working' },
        { id: 'qa', status: 'idle' },
      ],
      externalStatus: {
        qa: { status: 'blocked', task: 'Bash', reasonCode: 'api-rate-limit' },
      },
      statusSource: 'fallback',
      integrationHealth: { state: 'online' },
      nameForId: (id) => id.toUpperCase(),
    })

    expect(out.health).toMatchObject({ level: 'fallback', labelVal: 1 })
    expect(out.attention.names).toEqual(['QA'])
    expect(out.presence.rows.map((row) => [row.agent.id, row.status])).toEqual([
      ['dev', 'working'],
      ['qa', 'blocked'],
    ])
    expect(controlPanelPresenceRows({ agents: [], externalStatus: {} })).toEqual({ rows: [], quietCount: 0 })
  })

  it('is exported through the aggregate status-core path', () => {
    expect(buildActionStripViewModelFromCore({
      agents: [{ id: 'qa', status: 'blocked' }],
      externalStatus: {},
    }).attention.count).toBe(1)
  })
})
