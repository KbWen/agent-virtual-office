import { describe, expect, it } from 'vitest'
import { assembleIntegrationPatch, buildExternalStatusEntry } from '../src/systems/statusRuntime.js'
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
