import { describe, expect, it } from 'vitest'
import { agentStatus, attentionItems, hasCurrentSignal, presenceRows } from '../src/systems/agentStatusModel.js'
import * as nodeSafeModel from '../src/systems/agentStatusModel.mjs'

describe('agentStatusModel', () => {
  it('prefers external status and falls back to local idle', () => {
    expect(agentStatus({ status: 'idle' }, { status: 'done' })).toBe('done')
    expect(agentStatus({ status: 'working' }, null)).toBe('working')
    expect(agentStatus(null, null)).toBe('idle')
  })

  it('treats task, label, and reasonCode as current signals', () => {
    expect(hasCurrentSignal({ task: 'Edit' })).toBe(true)
    expect(hasCurrentSignal({ label: 'waiting' })).toBe(true)
    expect(hasCurrentSignal({ reasonCode: 'test-run-failed' })).toBe(true)
    expect(hasCurrentSignal({ status: 'idle' })).toBe(false)
    expect(hasCurrentSignal(null)).toBe(false)
  })

  it('builds reusable presence rows without React or i18n', () => {
    const out = presenceRows({
      agents: {
        dev: { id: 'dev', status: 'idle' },
        qa: { id: 'qa', status: 'working' },
        ops: { id: 'ops', status: 'idle' },
      },
      externalStatus: {
        dev: { status: 'done', task: 'Edit' },
      },
    })
    expect(out.rows.map((row) => [row.agent.id, row.status])).toEqual([
      ['dev', 'done'],
      ['qa', 'working'],
    ])
    expect(out.quietCount).toBe(1)
  })

  it('returns only human-action attention items', () => {
    const out = attentionItems({
      agents: [
        { id: 'dev', status: 'working' },
        { id: 'qa', status: 'blocked' },
        { id: 'gate', status: 'idle' },
      ],
      externalStatus: {
        gate: { status: 'awaiting-approval' },
      },
      nameForId: (id) => ({ qa: 'QA', gate: 'Gate' }[id] || id),
    })
    expect(out).toEqual([
      { id: 'qa', status: 'blocked', name: 'QA' },
      { id: 'gate', status: 'awaiting-approval', name: 'Gate' },
    ])
  })

  it('keeps the node-safe mjs entry equivalent to the app entry', () => {
    const input = {
      agents: [{ id: 'dev', status: 'idle' }],
      externalStatus: { dev: { status: 'working', task: 'Bash' } },
    }
    expect(nodeSafeModel.presenceRows(input)).toEqual(presenceRows(input))
    expect(nodeSafeModel.agentStatus({ status: 'idle' }, { status: 'done' })).toBe(agentStatus({ status: 'idle' }, { status: 'done' }))
  })
})
