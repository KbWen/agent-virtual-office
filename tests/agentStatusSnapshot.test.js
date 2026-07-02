import { describe, expect, it } from 'vitest'
import { buildAgentStatusSnapshot } from '../src/systems/agentStatusSnapshot.js'
import * as nodeSafeSnapshot from '../src/systems/agentStatusSnapshot.mjs'

const state = {
  agents: {
    dev: { id: 'dev', status: 'idle', session: null },
    qa: { id: 'qa', status: 'working' },
    ops: { id: 'ops', status: 'idle' },
  },
  externalStatus: {
    dev: {
      status: 'done',
      task: 'Edit',
      label: 'changed src/App.jsx',
      activeFile: 'src/App.jsx',
      changedAt: 100,
      expiresAt: 200,
    },
    ops: { status: 'awaiting-approval', reasonCode: 'permission-denied' },
  },
  statusSource: 'external',
  integrationSource: 'multi-session',
  integrationHealth: { state: 'online' },
  activeWorkflow: 'Review',
  tokens: { ctx: 1000, out: 50, model: 'test' },
  effort: 'medium',
  mood: 'smooth',
}

describe('buildAgentStatusSnapshot', () => {
  it('builds renderer-agnostic agent status data from plain store state', () => {
    const snapshot = buildAgentStatusSnapshot(state, {
      nameForId: (id) => ({ dev: 'Developer', qa: 'QA', ops: 'Ops' }[id]),
    })

    expect(snapshot.agents.map((agent) => [agent.id, agent.name, agent.status, agent.localStatus])).toEqual([
      ['dev', 'Developer', 'done', 'idle'],
      ['qa', 'QA', 'working', 'working'],
      ['ops', 'Ops', 'awaiting-approval', 'idle'],
    ])
    expect(snapshot.agents[0]).toMatchObject({
      hasExternalStatus: true,
      visual: {
        status: 'done',
        color: '#5CB88A',
        tone: 'done',
        known: true,
      },
      character: {
        tagFill: '#5CB88A',
        glowColor: '#5CB88A',
        showName: true,
        ring: { kind: 'done', animate: 'flash' },
      },
      task: 'Edit',
      label: 'changed src/App.jsx',
      activeFile: 'src/App.jsx',
      changedAt: 100,
      expiresAt: 200,
    })
    expect(snapshot.statusSource).toBe('external')
    expect(snapshot.integrationSource).toBe('multi-session')
    expect(snapshot.integration).toEqual({
      source: 'external',
      integrationSource: 'multi-session',
      externalCount: 2,
      health: {
        level: 'live',
        trouble: false,
        tone: 'emerald',
        pulse: true,
        labelKey: 'ui.live',
        labelVal: null,
      },
    })
    expect(snapshot.activeWorkflow).toBe('Review')
    expect(snapshot.tokens).toEqual({ ctx: 1000, out: 50, model: 'test' })
  })

  it('derives fallback/offline integration health inside the reusable snapshot', () => {
    const snapshot = buildAgentStatusSnapshot({
      agents: [{ id: 'dev', status: 'idle' }],
      externalStatus: { dev: { status: 'working' } },
      statusSource: 'fallback',
      integrationSource: 'poll',
      integrationHealth: { state: 'offline' },
    })

    expect(snapshot.integration).toMatchObject({
      source: 'fallback',
      integrationSource: 'poll',
      externalCount: 1,
      health: {
        level: 'offline',
        trouble: true,
        tone: 'red',
        pulse: false,
        labelKey: 'status.apiOffline',
        labelVal: null,
      },
    })
  })

  it('separates all agents, attention items, and current presence rows', () => {
    const snapshot = buildAgentStatusSnapshot(state)

    expect(snapshot.attention).toEqual({
      count: 1,
      items: [{ id: 'ops', status: 'awaiting-approval', name: 'ops' }],
    })
    expect(snapshot.presence.rows.map((agent) => [agent.id, agent.status])).toEqual([
      ['dev', 'done'],
      ['qa', 'working'],
      ['ops', 'awaiting-approval'],
    ])
    expect(snapshot.presence.rows.map((agent) => agent.visual.color)).toEqual(['#5CB88A', '#EF9F27', '#1E9FD4'])
    expect(snapshot.presence.quietCount).toBe(0)
    expect(snapshot.activeCount).toBe(3)
  })

  it('includes compact character chrome tokens without embedding sprite grids', () => {
    const snapshot = buildAgentStatusSnapshot({
      agents: {
        dev: { id: 'dev', status: 'working', color: '#123456' },
      },
      externalStatus: {},
      helpers: [{ id: 'helper-1', parentRole: 'dev' }],
      effort: 'max',
    })

    expect(snapshot.agents[0].character).toMatchObject({
      tagFill: '#EF9F27',
      glowColor: '#EF9F27',
      showName: true,
      ring: { kind: 'supervising', animate: 'slow-breathe' },
    })
    expect(snapshot.agents[0].character).not.toHaveProperty('grid')
  })

  it('keeps the node-safe mjs entry equivalent to the app entry', () => {
    expect(nodeSafeSnapshot.buildAgentStatusSnapshot(state)).toEqual(buildAgentStatusSnapshot(state))
  })

  it('handles missing state as an empty organic snapshot', () => {
    expect(buildAgentStatusSnapshot()).toEqual({
      agents: [],
      attention: { count: 0, items: [] },
      presence: { rows: [], quietCount: 0 },
      statusSource: 'organic',
      integrationSource: null,
      integrationHealth: null,
      integration: {
        source: 'organic',
        integrationSource: null,
        externalCount: 0,
        health: {
          level: 'idle',
          trouble: false,
          tone: 'gray',
          pulse: false,
          labelKey: 'status.local',
          labelVal: null,
        },
      },
      activeWorkflow: null,
      activeCount: 0,
      tokens: null,
      effort: null,
      mood: null,
    })
  })
})
