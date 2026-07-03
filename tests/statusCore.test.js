import { describe, expect, it } from 'vitest'
import {
  assembleIntegrationPatch,
  agentLineToken,
  blockedReasonState,
  buildBubbleVisibilityViewModel,
  buildActionStripViewModel,
  buildActivityFeedViewModel,
  buildPresenceRailViewModel,
  buildHelperHuddleViewModel,
  buildPairLinkViewModel,
  buildAgentStatusSnapshot,
  buildDynamicStatusAgent,
  buildExternalStatusEntry,
  buildDoneEventKey,
  buildEventGateViewModel,
  buildEventJuiceViewModel,
  buildPokeReactionViewModel,
  behaviorIndicatorState,
  characterStatusVisual,
  computeBubbleLayout,
  comparePresence,
  buildContextBubblePlan,
  createDailyDoneLedger,
  contextBubbleCandidateKeys,
  eventEligible,
  feedEntries,
  floorTickAllowed,
  gateWaiting,
  healthDotState,
  inspectorPanelLayout,
  isDynamicStatusAgent,
  isPairHuddleWriteTask,
  findSharedFilePair,
  pokePoolKeyForStatus,
  normalizeAgentStatusUpdates,
  normalizePost,
  presenceRows,
  reconcileMultiSessionAgents,
  sanitizeAgentId,
  shouldShakeDesk,
  statusVisualState,
  teamStatus,
  truncateText,
  validatePersistedDailyDoneLedger,
  VALID_STATUSES,
} from '../src/systems/statusCore.mjs'

describe('statusCore public headless API', () => {
  it('aggregates the reusable status transport, runtime, and view-model helpers', () => {
    expect(VALID_STATUSES).toContain('awaiting-approval')
    expect(normalizePost({ dev: 'working' }).agents[0]?.status).toBe('working')
    expect(buildExternalStatusEntry(null, { status: 'done' }, 1000).entry.expiresAt).toBe(11000)
    expect(buildDynamicStatusAgent({ id: 'dev' }, { agentId: 'wt~dev', position: { x: 1, y: 2 } }).session).toBeNull()
    expect(isDynamicStatusAgent('wt~dev', { session: 'wt' }, ['dev'])).toBe(true)
    expect(reconcileMultiSessionAgents({
      agents: { 'wt~dev': { session: 'wt' } },
      externalStatus: { 'wt~dev': { status: 'working' } },
      updates: [],
    }).evicted).toEqual(['wt~dev'])
    expect(assembleIntegrationPatch(
      { statusSource: 'organic', integrationSource: null },
      { statusSource: 'external' },
      {},
    )).toEqual({ statusSource: 'external' })
    expect(buildDoneEventKey({ agentId: 'dev' }, { source: 'codex', seq: '7' })).toBe('codex:7:dev')
    expect(createDailyDoneLedger(1000).seenEventKeys).toEqual([])
    expect(validatePersistedDailyDoneLedger({ dayKey: createDailyDoneLedger(1000).dayKey, counts: { dev: 2 } }, 1000).counts.dev).toBe(2)
    expect(computeBubbleLayout('abcdefghijklmnopq').displayMsg).toBe('abcdefghijklmnop…')
    expect(buildHelperHuddleViewModel({
      helpers: [{ parentRole: 'dev' }],
      agents: { dev: { position: { x: 10, y: 20 } } },
    }).rows[0]?.role).toBe('dev')
    expect(findSharedFilePair({
      dev: { status: 'working', activeFile: '/r/src/app.js', activeFileAt: 1000 },
      qa: { status: 'working', activeFile: '/r/src/app.js', activeFileAt: 900 },
    }, 1000, 90_000)).toEqual(['dev', 'qa'])
    expect(buildPairLinkViewModel({
      now: 1000,
      externalStatus: {
        dev: { status: 'working', activeFile: '/r/src/app.js', activeFileAt: 1000 },
        qa: { status: 'working', activeFile: '/r/src/app.js', activeFileAt: 900 },
      },
    }).link.file).toBe('app.js')
    expect(isPairHuddleWriteTask('Read')).toBe(false)
    expect(buildPairLinkViewModel({
      now: 1000,
      externalStatus: {
        dev: { status: 'working', task: 'Edit', activeFile: '/r/src/app.js', activeFileAt: 1000 },
        qa: { status: 'working', task: 'Read', activeFile: '/r/src/app.js', activeFileAt: 900 },
      },
    }).visible).toBe(false)
    expect(buildContextBubblePlan('feat-x~dev', {
      status: 'blocked',
      label: 'Edit App.jsx',
    })).toMatchObject({
      kind: 'error',
      baseRole: 'dev',
      keys: ['contextBubbles.dev-error', 'contextBubbles.any-error'],
    })
    expect(contextBubbleCandidateKeys('dev', { status: 'working', task: 'Edit' })).toEqual([
      'contextBubbles.dev-edit',
      'contextBubbles.dev-working',
    ])
    expect(buildBubbleVisibilityViewModel({
      agents: { qa: { status: 'blocked', bubble: 'stuck' }, dev: { status: 'working', bubble: 'typing' } },
      externalStatus: { qa: { status: 'blocked', changedAt: 1 }, dev: { status: 'working', changedAt: 99 } },
      cap: 1,
    }).visibleIds).toEqual(['qa'])
    expect(pokePoolKeyForStatus('awaiting-approval')).toBe('blocked')
    expect(buildPokeReactionViewModel({
      status: 'done',
      history: [100, 200, 300, 400],
      now: 500,
      poolLength: 3,
    })).toMatchObject({
      poolKey: 'done',
      intensity: 'turnaway',
      quipIndex: 1,
      timing: {
        quipMs: 1200,
        bobClearMs: 720,
        motion: { dur: '0.5s' },
      },
    })
    expect(buildEventJuiceViewModel('eureka')).toMatchObject({
      visible: true,
      juice: { kind: 'sparkle', animationName: 'office-sparkle', semanticState: false },
      semanticState: false,
    })
    expect(buildEventJuiceViewModel('eureka', { reducedMotion: true }).visible).toBe(false)
    expect(shouldShakeDesk('desk-slam', false)).toBe(true)
    expect(eventEligible({ id: 'review-debate' }, {
      externalStatus: { qa: { changedAt: 1000 } },
      mood: 'normal',
    }, 2000)).toBe(true)
    expect(buildEventGateViewModel({ id: 'deploy-success' }, {
      externalStatus: {},
      mood: 'normal',
    }, { now: 2000 })).toMatchObject({ workClaim: true, eligible: false })
    expect(floorTickAllowed({ statusSource: 'external', teamPulse: 0.9 }, { random: () => 0.99 })).toBe(false)
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
    expect(snapshot.agents[0]?.visual.color).toBe('#5CB88A')
    expect(snapshot.presence.rows[0]?.task).toBe('Edit')
    expect(snapshot.integration.health.level).toBe('idle')
    expect(statusVisualState('blocked')).toMatchObject({ color: '#E24B4A', known: true })
    expect(agentLineToken({ status: 'blocked', reasonCode: 'api-rate-limit' })).toMatchObject({
      kind: 'blocked-reason',
      reason: 'api-rate-limit',
    })
    expect(buildActionStripViewModel({
      agents: [{ id: 'qa', status: 'blocked' }],
      statusSource: 'external',
    }).health.level).toBe('live')
    expect(characterStatusVisual({ status: 'working', color: '#abc' })).toMatchObject({
      tagFill: '#EF9F27',
      ring: { kind: 'active' },
    })
    expect(behaviorIndicatorState('goto-coffee-machine')).toMatchObject({
      iconKey: 'coffee',
      variant: 'steam',
      known: true,
    })
    expect(inspectorPanelLayout({ activityCount: 4, sceneScale: 0, position: { x: 400, y: 300 } })).toMatchObject({
      activityRows: 3,
      scale: 1.6,
    })
    expect(truncateText('修好🧪流程', 3)).toBe('修好🧪…')

    expect([{ id: 'b', status: 'working' }, { id: 'a', status: 'blocked' }].sort(comparePresence)[0]?.id).toBe('a')
    expect(teamStatus({ activeWorkflow: 'review', activeCount: 2 }).kind).toBe('workflow')
    expect(feedEntries([{ origin: 'organic' }, { origin: 'hook' }])).toHaveLength(1)
    expect(buildActivityFeedViewModel([{ id: 1, type: 'status', status: 'done', timestamp: 1 }], { now: 2 }).unreadCount).toBe(1)
    expect(buildPresenceRailViewModel({
      agents: { dev: { id: 'dev', status: 'idle' } },
      externalStatus: { dev: { status: 'blocked' } },
    }).renderRows[0]?.dimmed).toBe(false)
    expect(blockedReasonState('api-auth-failed')).toMatchObject({
      reason: 'api-auth-failed',
      iconId: 'key-broken',
    })
    expect(healthDotState({ statusSource: 'fallback', externalCount: 2 })).toMatchObject({
      level: 'fallback',
      labelVal: 2,
    })
    expect(gateWaiting({ qa: { status: 'awaiting-approval' } }, '/review')).toMatchObject({
      count: 1,
      phaseGlyph: 'review',
    })
  })

  it('normalizes generic agent ids into status-runtime update shape', () => {
    const out = normalizeAgentStatusUpdates({
      type: 'office-status',
      agents: [
        { agentId: 'frontend', status: 'working', task: 'Build UI', activeFile: 'src/App.jsx' },
        { id: 'reviewer-2', status: 'blocked', reasonCode: 'permission-denied' },
        { role: 'worker.alpha', status: 'done' },
      ],
      workflow: 'Review',
      source: 'other-ui',
    })

    expect(out).toMatchObject({
      type: 'agent-status-updates',
      activeCount: 2,
      workflow: 'Review',
      source: 'other-ui',
    })
    expect(out.updates.map((u) => [u.agentId, u.status, u.task, u.reasonCode])).toEqual([
      ['frontend', 'working', 'Build UI', null],
      ['reviewer-2', 'blocked', null, 'permission-denied'],
      ['worker.alpha', 'done', null, null],
    ])
    expect(out.updates[0].activeFile).toBe('src/App.jsx')
  })

  it('keeps legacy normalizePost role-strict while generic normalization keeps safe unknown ids', () => {
    const body = { type: 'office-status', agents: [{ role: 'frontend', status: 'working' }] }

    expect(normalizePost(body).agents).toEqual([])
    expect(normalizeAgentStatusUpdates(body).updates).toMatchObject([
      { agentId: 'frontend', status: 'working' },
    ])
  })

  it('filters unsafe ids and supports an optional allowed-agent allowlist', () => {
    expect(sanitizeAgentId(' reviewer-2 ')).toBe('reviewer-2')
    expect(sanitizeAgentId('__proto__')).toBeNull()
    expect(sanitizeAgentId('../bad')).toBeNull()

    const out = normalizeAgentStatusUpdates({
      frontend: 'working',
      qa: 'blocked',
      '__proto__': 'done',
      activeFile: 'src/App.jsx',
    }, { allowedAgentIds: ['frontend'] })

    expect(out.updates).toEqual([{
      agentId: 'frontend',
      task: null,
      status: 'working',
      label: null,
      hint: null,
      reasonCode: null,
      skill: null,
      activeFile: 'src/App.jsx',
    }])
  })
})
