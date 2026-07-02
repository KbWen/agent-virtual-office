import { describe, expect, it } from 'vitest'
import {
  assembleIntegrationPatch,
  buildAgentStatusSnapshot,
  buildExternalStatusEntry,
  comparePresence,
  feedEntries,
  normalizePost,
  presenceRows,
  teamStatus,
  VALID_STATUSES,
} from '../src/systems/statusCore.mjs'

describe('statusCore public headless API', () => {
  it('aggregates the reusable status transport, runtime, and view-model helpers', () => {
    expect(VALID_STATUSES).toContain('awaiting-approval')
    expect(normalizePost({ dev: 'working' }).agents[0]?.status).toBe('working')
    expect(buildExternalStatusEntry(null, { status: 'done' }, 1000).entry.expiresAt).toBe(11000)
    expect(assembleIntegrationPatch(
      { statusSource: 'organic', integrationSource: null },
      { statusSource: 'external' },
      {},
    )).toEqual({ statusSource: 'external' })
  })

  it('exports renderer-agnostic status and roster view-models from one path', () => {
    expect(presenceRows({
      agents: [{ id: 'dev', status: 'idle' }],
      externalStatus: { dev: { status: 'done', task: 'Edit' } },
    }).rows[0]?.status).toBe('done')

    const snapshot = buildAgentStatusSnapshot({
      agents: { dev: { id: 'dev', status: 'idle' } },
      externalStatus: { dev: { status: 'done', task: 'Edit' } },
    })
    expect(snapshot.agents[0]?.status).toBe('done')
    expect(snapshot.presence.rows[0]?.task).toBe('Edit')

    expect([{ id: 'b', status: 'working' }, { id: 'a', status: 'blocked' }].sort(comparePresence)[0]?.id).toBe('a')
    expect(teamStatus({ activeWorkflow: 'review', activeCount: 2 }).kind).toBe('workflow')
    expect(feedEntries([{ origin: 'organic' }, { origin: 'hook' }])).toHaveLength(1)
  })
})
