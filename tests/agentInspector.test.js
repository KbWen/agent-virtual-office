import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { countAgentDoneToday } = await import('../src/components/agentInspectorModel.js')
const { useOfficeStore } = await import('../src/systems/store.js')

async function renderInspectorWithMocks(overrides = {}) {
  vi.resetModules()
  vi.doMock('../src/utils/formatTime', () => ({
    formatTimeAgo: () => '1m',
  }))

  vi.doMock('../src/systems/store.js', () => {
    const mockState = {
      selectedAgent: 'dev',
      agents: {
        dev: {
          id: 'dev',
          color: '#ff66aa',
          status: 'working',
          behavior: 'typing',
          isMoving: false,
          position: { x: 120, y: 180 },
          targetPosition: { x: 120, y: 180 },
        },
      },
      externalStatus: {},
      statusSource: 'organic',
      integrationSource: null,
      activityLog: [],
      dailyDoneLedger: {
        dayKey: '2026-04-08',
        counts: {},
        seenEventKeys: [],
      },
      mood: 'smooth',
      activeWorkflow: 'Review',
      clearSelectedAgent: () => {},
      ...overrides,
    }

    return {
      STATUS_COLORS: {
        idle: '#999',
        working: '#00f',
        done: '#0a0',
        blocked: '#f00',
      },
      useOfficeStore: (selector) => selector(mockState),
    }
  })

  vi.doMock('../src/i18n.js', () => ({
    charName: () => 'Developer',
    behaviorLabel: () => 'Typing',
    useLocale: () => 'en',
    t: (path, fallback) => {
      const labels = {
        'statusLabels.working': 'Working',
        'moodLabels.smooth': 'Smooth',
        'inspector.doneToday': 'Done today',
        'inspector.mood': 'Mood',
        'inspector.activeWorkflow': 'Workflow',
      }
      return labels[path] ?? fallback ?? path
    },
  }))

  const { renderToStaticMarkup } = await import('react-dom/server')
  const { default: AgentInspector } = await import('../src/components/AgentInspector.jsx')

  return renderToStaticMarkup(
    React.createElement(
      'svg',
      null,
      React.createElement(AgentInspector),
    ),
  )
}

describe('AgentInspector', () => {
  beforeEach(() => {
    const state = useOfficeStore.getState()
    useOfficeStore.setState({
      selectedAgent: 'dev',
      mood: 'smooth',
      activeWorkflow: 'Review',
      externalStatus: {},
      statusSource: 'organic',
      integrationSource: null,
      activityLog: [],
      dailyDoneLedger: {
        dayKey: '2026-04-08',
        counts: {},
        seenEventKeys: [],
      },
      agents: {
        ...state.agents,
        dev: {
          ...state.agents.dev,
          status: 'working',
          behavior: 'typing',
          isMoving: false,
          position: { x: 120, y: 180 },
          targetPosition: { x: 120, y: 180 },
        },
      },
    })
  })

  it('counts only same-day done events for the selected agent', () => {
    const now = new Date('2026-04-08T18:00:00+08:00').getTime()

    expect(countAgentDoneToday([
      { agentId: 'dev', type: 'status', status: 'done', timestamp: now - 1_000, message: 'Finished step' },
      { agentId: 'dev', type: 'status', status: 'done', timestamp: now - 3_600_000, message: 'Another done' },
      { agentId: 'dev', type: 'status', status: 'working', timestamp: now - 2_000, message: 'Still working' },
      { agentId: 'qa', type: 'status', status: 'done', timestamp: now - 2_000, message: 'Other agent' },
      { agentId: 'dev', type: 'status', status: 'done', timestamp: new Date('2026-04-07T23:00:00+08:00').getTime(), message: 'Yesterday' },
    ], 'dev', now)).toBe(2)
  })

  it('reads same-day done counts from the durable ledger when available', () => {
    const now = new Date('2026-04-08T18:00:00+08:00').getTime()

    expect(countAgentDoneToday({
      dayKey: '2026-04-08',
      counts: { dev: 3, qa: 1 },
      seenEventKeys: ['claude-cli:101:dev'],
    }, 'dev', now)).toBe(3)
  })

  it('records status metadata on activity log entries created from external status updates', () => {
    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'done', label: 'Finished step', task: 'Edit' },
    ])

    expect(useOfficeStore.getState().activityLog[0]).toMatchObject({
      agentId: 'dev',
      type: 'status',
      status: 'done',
      message: 'Finished step',
    })
  })

  it('dedupes replayed done events when counting durable same-day completions', () => {
    useOfficeStore.setState({
      externalStatus: {
        dev: { status: 'done', task: 'Edit', label: 'Finished step', expiresAt: Date.now() + 10_000 },
      },
      dailyDoneLedger: {
        dayKey: '2026-04-08',
        counts: { dev: 1 },
        seenEventKeys: ['claude-cli:9001:dev'],
      },
    })

    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'done', label: 'Finished step', task: 'Edit' },
    ], {
      source: 'claude-cli',
      seq: '9001',
      now: new Date('2026-04-08T18:00:00+08:00').getTime(),
    })

    expect(useOfficeStore.getState().dailyDoneLedger).toMatchObject({
      dayKey: '2026-04-08',
      counts: { dev: 1 },
    })

    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'done', label: 'Still done', task: 'Edit' },
    ], {
      source: 'claude-cli',
      seq: '9002',
      now: new Date('2026-04-08T18:05:00+08:00').getTime(),
    })

    expect(useOfficeStore.getState().dailyDoneLedger).toMatchObject({
      dayKey: '2026-04-08',
      counts: { dev: 1 },
    })

    useOfficeStore.setState({
      externalStatus: {
        dev: { status: 'working', task: 'Edit', label: 'Back to work', expiresAt: Date.now() + 10_000 },
      },
    })

    useOfficeStore.getState().applyExternalStatus([
      { agentId: 'dev', status: 'done', label: 'Merged fix', task: 'Edit' },
    ], {
      source: 'claude-cli',
      seq: '9002',
      now: new Date('2026-04-08T18:10:00+08:00').getTime(),
    })

    expect(useOfficeStore.getState().dailyDoneLedger).toMatchObject({
      dayKey: '2026-04-08',
      counts: { dev: 2 },
    })
  })

  it('clears integration source metadata when the last external agent is removed', () => {
    useOfficeStore.setState({
      externalStatus: {
        dev: { status: 'working', task: 'Edit', label: 'Back to work', expiresAt: Date.now() + 10_000 },
      },
      statusSource: 'external',
      integrationSource: 'codex-app',
      activeWorkflow: 'Codex App Bridge',
    })

    useOfficeStore.getState().clearExternalStatus('dev')

    expect(useOfficeStore.getState()).toMatchObject({
      externalStatus: {},
      statusSource: 'organic',
      integrationSource: null,
      activeWorkflow: null,
    })
  })

  it('renders today-done, mood, and active workflow details when present', async () => {
    const markup = await renderInspectorWithMocks({
      activityLog: [],
      dailyDoneLedger: {
        dayKey: '2026-04-08',
        counts: { dev: 2 },
        seenEventKeys: ['claude-cli:1:dev', 'claude-cli:2:dev'],
      },
    })

    expect(markup).toContain('Done today')
    expect(markup).toContain('>2</text>')
    expect(markup).toContain('Mood')
    expect(markup).toContain('Smooth')
    expect(markup).toContain('Workflow')
    expect(markup).toContain('Review')
  })

  it('hides the workflow row when no active workflow is set', async () => {
    const markup = await renderInspectorWithMocks({ activeWorkflow: null })

    expect(markup).not.toContain('Workflow')
  })
})
