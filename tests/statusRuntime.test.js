import { describe, expect, it } from 'vitest'
import { buildExternalStatusEntry } from '../src/systems/statusRuntime.js'
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
