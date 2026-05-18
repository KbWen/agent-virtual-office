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

  it('grows deskItemCount on a fresh done event, keyed to the base role item', () => {
    // Growth system: a deduplicated fresh done event accumulates one desk item.
    // dev → 'coffee'. Reset the agent to a clean baseline first.
    const base = useOfficeStore.getState().agents
    useOfficeStore.setState({
      agents: {
        ...base,
        dev: { ...base.dev, status: 'idle', inGroupEvent: false, deskItemCount: { coffee: 0, sticky: 0, books: 0 } },
        arch: { ...base.arch, status: 'idle', inGroupEvent: false, deskItemCount: { coffee: 0, sticky: 0, books: 0 } },
      },
      externalStatus: {},
      dailyDoneLedger: { dayKey: '2026-04-08', counts: {}, seenEventKeys: [] },
    })
    const now = new Date('2026-04-08T12:00:00+08:00').getTime()

    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'dev', status: 'done', task: 'Edit', label: 'fix' }],
      { source: 'claude-cli', seq: 'g1', now },
    )
    expect(useOfficeStore.getState().agents.dev.deskItemCount.coffee).toBe(1)

    // arch → 'books'. A done for arch grows books, not coffee.
    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'arch', status: 'done', task: 'Edit', label: 'design' }],
      { source: 'claude-cli', seq: 'g2', now },
    )
    expect(useOfficeStore.getState().agents.arch.deskItemCount.books).toBe(1)
    expect(useOfficeStore.getState().agents.arch.deskItemCount.coffee).toBe(0)
  })

  it('does NOT grow deskItemCount on a replayed (already-seen) done event', () => {
    const base = useOfficeStore.getState().agents
    useOfficeStore.setState({
      agents: {
        ...base,
        dev: { ...base.dev, status: 'done', inGroupEvent: false, deskItemCount: { coffee: 5, sticky: 0, books: 0 } },
      },
      externalStatus: {
        dev: { status: 'done', task: 'Edit', label: 'fix', expiresAt: Date.now() + 10_000 },
      },
      dailyDoneLedger: { dayKey: '2026-04-08', counts: { dev: 5 }, seenEventKeys: ['claude-cli:seen:dev'] },
    })
    const now = new Date('2026-04-08T12:00:00+08:00').getTime()

    // Same eventKey as already-seen → shouldCount is false → no growth.
    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'dev', status: 'done', task: 'Edit', label: 'fix' }],
      { source: 'claude-cli', seq: 'seen', now },
    )
    expect(useOfficeStore.getState().agents.dev.deskItemCount.coffee).toBe(5)
  })

  it('grows deskItemCount for a dynamic worktree (composite) agent under its base role item', () => {
    useOfficeStore.setState({
      externalStatus: {},
      dailyDoneLedger: { dayKey: '2026-04-08', counts: {}, seenEventKeys: [] },
    })
    const now = new Date('2026-04-08T12:00:00+08:00').getTime()

    useOfficeStore.getState().applyExternalStatus(
      [{ agentId: 'feat-x~dev', status: 'done', task: 'Edit', label: 'fix', session: 'feat-x' }],
      { source: 'multi-session', seq: 'c1', now },
    )
    const dyn = useOfficeStore.getState().agents['feat-x~dev']
    expect(dyn).toBeTruthy()
    // baseRole 'dev' → 'coffee'.
    expect(dyn.deskItemCount.coffee).toBe(1)
    // Ledger counts are keyed by the FULL composite id (each worktree agent is distinct).
    expect(useOfficeStore.getState().dailyDoneLedger.counts['feat-x~dev']).toBe(1)
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
    const today = new Date()
    const dayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')
    const markup = await renderInspectorWithMocks({
      activityLog: [],
      dailyDoneLedger: {
        dayKey,
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
