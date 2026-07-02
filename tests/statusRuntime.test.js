import { describe, expect, it } from 'vitest'
import {
  assembleIntegrationPatch,
  buildDynamicStatusAgent,
  buildExternalStatusEntry,
  isDynamicStatusAgent,
  reconcileMultiSessionAgents,
} from '../src/systems/statusRuntime.js'
import * as nodeSafeRuntime from '../src/systems/statusRuntime.mjs'

describe('buildExternalStatusEntry', () => {
  it('builds external status entries with expiry, carry fields, and changedAt', () => {
    const out = buildExternalStatusEntry(null, {
      agentId: 'dev',
      status: 'working',
      task: 'Edit',
      label: 'editing App.jsx',
      hint: 'src/App.jsx',
      reasonCode: 'test-run-failed',
      activeFile: 'src/App.jsx',
      skill: 'implement',
    }, 1000)

    expect(out.sigChanged).toBe(true)
    expect(out.entry).toEqual({
      status: 'working',
      task: 'Edit',
      label: 'editing App.jsx',
      hint: 'src/App.jsx',
      reasonCode: 'test-run-failed',
      skill: 'implement',
      activeFile: 'src/App.jsx',
      activeFileAt: 1000,
      expiresAt: 301000,
      changedAt: 1000,
    })
  })

  it('keeps changedAt and activeFileAt stable on a same-signature refresh', () => {
    const prev = {
      status: 'working',
      task: 'Edit',
      activeFile: 'src/App.jsx',
      activeFileAt: 500,
      changedAt: 400,
    }
    const out = buildExternalStatusEntry(prev, {
      agentId: 'dev',
      status: 'working',
      task: 'Edit',
      activeFile: 'src/App.jsx',
    }, 2000)

    expect(out.sigChanged).toBe(false)
    expect(out.entry.changedAt).toBe(400)
    expect(out.entry.activeFileAt).toBe(500)
    expect(out.entry.expiresAt).toBe(302000)
  })

  it('tracks active file changes independently from status/task signature changes', () => {
    const prev = {
      status: 'working',
      task: 'Edit',
      activeFile: 'src/App.jsx',
      activeFileAt: 500,
      changedAt: 400,
    }
    const out = buildExternalStatusEntry(prev, {
      agentId: 'dev',
      status: 'working',
      task: 'Edit',
      activeFile: 'src/main.jsx',
    }, 2000)

    expect(out.sigChanged).toBe(false)
    expect(out.entry.changedAt).toBe(400)
    expect(out.entry.activeFileAt).toBe(2000)
  })

  it('uses a short expiry for done states', () => {
    const out = buildExternalStatusEntry(null, { agentId: 'qa', status: 'done' }, 1000)
    expect(out.entry.expiresAt).toBe(11000)
  })

  it('keeps the node-safe mjs entry equivalent to the app entry', () => {
    const input = [{ status: 'working', task: 'Bash' }, { status: 'blocked', task: 'Bash' }, 3000]
    expect(nodeSafeRuntime.buildExternalStatusEntry(...input)).toEqual(buildExternalStatusEntry(...input))
  })
})

describe('assembleIntegrationPatch', () => {
  it('lands changed status source, integration source, and workflow fields', () => {
    expect(assembleIntegrationPatch(
      { statusSource: 'organic', integrationSource: null, activeWorkflow: null },
      { statusSource: 'external', integrationSource: 'claude-cli', hasWorkflow: true, workflow: 'Review' },
      { dev: { status: 'working' } },
    )).toEqual({
      statusSource: 'external',
      integrationSource: 'claude-cli',
      activeWorkflow: 'Review',
    })
  })

  it('omits unchanged fields to avoid subscriber churn', () => {
    expect(assembleIntegrationPatch(
      { statusSource: 'external', integrationSource: 'claude-cli', activeWorkflow: 'Review' },
      { statusSource: 'external', integrationSource: 'claude-cli', hasWorkflow: true, workflow: 'Review' },
      { dev: { status: 'working' } },
    )).toEqual({})
  })

  it('normalizes empty integrationSource meta to null', () => {
    expect(assembleIntegrationPatch(
      { statusSource: 'external', integrationSource: 'claude-cli', activeWorkflow: null },
      { integrationSource: '' },
      { dev: { status: 'working' } },
    )).toEqual({ integrationSource: null })
  })

  it('clearSourceIfEmpty reverts to organic and takes precedence over stale source meta', () => {
    expect(assembleIntegrationPatch(
      { statusSource: 'external', integrationSource: 'multi-session', activeWorkflow: null },
      { clearSourceIfEmpty: true, statusSource: 'external', integrationSource: 'multi-session' },
      {},
    )).toEqual({
      statusSource: 'organic',
      integrationSource: null,
    })
  })

  it('keeps the node-safe mjs integration patch equivalent to the app entry', () => {
    const input = [
      { statusSource: 'organic', integrationSource: null, activeWorkflow: null },
      { statusSource: 'external', hasWorkflow: true, workflow: 'Implement' },
      { dev: { status: 'working' } },
    ]
    expect(nodeSafeRuntime.assembleIntegrationPatch(...input)).toEqual(assembleIntegrationPatch(...input))
  })
})

describe('dynamic status lifecycle helpers', () => {
  it('classifies session agents and non-roster null-session agents as dynamic', () => {
    const staticRosterIds = new Set(['dev', 'qa'])
    expect(isDynamicStatusAgent('dev', { id: 'dev', session: null }, staticRosterIds)).toBe(false)
    expect(isDynamicStatusAgent('feat~dev', { id: 'feat~dev', session: 'feat' }, staticRosterIds)).toBe(true)
    expect(isDynamicStatusAgent('worker', { id: 'worker', session: null }, staticRosterIds)).toBe(true)
  })

  it('builds dynamic agents from an injected base agent and injected position policy result', () => {
    const deskItemCount = { coffee: 7, sticky: 2, books: 1 }
    const baseAgent = {
      id: 'dev',
      color: '#123',
      status: 'done',
      behavior: 'thumbs-up',
      expression: 'happy',
      deskItemCount,
      position: { x: 1, y: 2 },
      targetPosition: { x: 1, y: 2 },
    }
    const agent = buildDynamicStatusAgent(baseAgent, {
      agentId: 'feat~dev',
      session: 'feat',
      position: { x: 42, y: 84 },
    })

    expect(agent).toMatchObject({
      id: 'feat~dev',
      session: 'feat',
      status: 'idle',
      behavior: 'thumbs-up',
      expression: 'happy',
      position: { x: 42, y: 84 },
      targetPosition: { x: 42, y: 84 },
      isMoving: false,
      returnHomeOnIdle: false,
      bubble: null,
      inGroupEvent: false,
      groupTarget: null,
      deskItemCount: { coffee: 0, sticky: 0, books: 0 },
    })
    expect(agent.deskItemCount).not.toBe(deskItemCount)
  })

  it('reconciles missing session agents from a complete multi-session snapshot', () => {
    const agents = {
      dev: { id: 'dev' },
      'feat-a~dev': { id: 'feat-a~dev', session: 'feat-a' },
      'feat-b~qa': { id: 'feat-b~qa', session: 'feat-b' },
      worker: { id: 'worker', session: null },
    }
    const externalStatus = {
      dev: { status: 'working' },
      'feat-a~dev': { status: 'working' },
      'feat-b~qa': { status: 'blocked' },
      worker: { status: 'working' },
    }
    const out = reconcileMultiSessionAgents({
      agents,
      externalStatus,
      updates: [{ agentId: 'feat-a~dev', status: 'working' }],
      selectedAgent: 'feat-b~qa',
    })

    expect(out.changed).toBe(true)
    expect(out.evicted).toEqual(['feat-b~qa'])
    expect(out.evictedSelected).toBe(true)
    expect(out.agents['feat-b~qa']).toBeUndefined()
    expect(out.externalStatus['feat-b~qa']).toBeUndefined()
    expect(out.agents.dev).toBe(agents.dev)
    expect(out.agents.worker).toBe(agents.worker)
    expect(agents['feat-b~qa']).toBeTruthy()
    expect(externalStatus['feat-b~qa']).toBeTruthy()
  })

  it('keeps object identity when multi-session reconciliation evicts nothing', () => {
    const agents = { 'feat-a~dev': { id: 'feat-a~dev', session: 'feat-a' } }
    const externalStatus = { 'feat-a~dev': { status: 'working' } }
    const out = reconcileMultiSessionAgents({
      agents,
      externalStatus,
      updates: [{ agentId: 'feat-a~dev', status: 'working' }],
    })

    expect(out.changed).toBe(false)
    expect(out.evicted).toEqual([])
    expect(out.agents).toBe(agents)
    expect(out.externalStatus).toBe(externalStatus)
  })

  it('keeps the node-safe mjs dynamic helpers equivalent to the app entry', () => {
    const input = {
      agents: { 'feat~dev': { id: 'feat~dev', session: 'feat' } },
      externalStatus: { 'feat~dev': { status: 'working' } },
      updates: [],
      selectedAgent: 'feat~dev',
    }
    expect(nodeSafeRuntime.reconcileMultiSessionAgents(input)).toEqual(reconcileMultiSessionAgents(input))
    expect(nodeSafeRuntime.isDynamicStatusAgent('x', { id: 'x' }, ['dev'])).toBe(isDynamicStatusAgent('x', { id: 'x' }, ['dev']))
  })
})
