import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startStatusIntegration } from '../src/inference/inferStatus.js'
import { useOfficeStore } from '../src/systems/store.js'

class FakeEventSource {
  static instances = []
  constructor() { this.listeners = {}; FakeEventSource.instances.push(this) }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback) }
  close() {}
  emitStatus(payload) {
    for (const callback of this.listeners.status || []) callback({ data: JSON.stringify(payload) })
  }
}

function apiPayload(source, agents, seq, extra = {}) {
  return { type: 'office-status', source, agents, activeCount: agents.filter(agent => agent.status !== 'idle').length, _seq: String(seq), ...extra }
}

async function deliver(eventSource, payload) {
  eventSource.emitStatus(payload)
  await vi.advanceTimersByTimeAsync(151)
}

describe('API transport representation changes', () => {
  let stop
  let seq

  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    globalThis.EventSource = FakeEventSource
    globalThis.BroadcastChannel = undefined
    globalThis.window = {
      location: { protocol: 'http:', hostname: 'localhost', hash: '', search: '' },
      parent: {},
      listeners: {},
      addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback) },
      removeEventListener() {},
    }
    globalThis.fetch = vi.fn(async () => ({ status: 304, ok: true, headers: { get: () => null } }))
    useOfficeStore.setState({ externalStatus: {}, statusSource: 'organic', integrationSource: null, activeWorkflow: null })
    seq = Date.now()
    stop = startStatusIntegration(useOfficeStore)
  })

  afterEach(() => {
    stop?.()
    useOfficeStore.setState({ externalStatus: {}, statusSource: 'organic', integrationSource: null, activeWorkflow: null })
    vi.useRealTimers()
    delete globalThis.window
    delete globalThis.EventSource
    delete globalThis.BroadcastChannel
  })

  it('retires API-owned roles across single, multi-session, single, and empty snapshots', async () => {
    const es = FakeEventSource.instances[0]
    await deliver(es, apiPayload('codex-cli', [{ role: 'dev', status: 'working' }], ++seq))
    expect(useOfficeStore.getState().externalStatus.dev.status).toBe('working')

    await deliver(es, apiPayload('multi-session', [
      { role: 'codex-hook-a~dev', session: 'codex-hook-a', status: 'working' },
      { role: 'claude-main~ops', session: 'claude-main', status: 'working' },
    ], ++seq, { sessionCount: 2, workflow: 'Cross-source run', helpers: [{ id: 'claude-helper', parentRole: 'ops', label: 'Claude helper' }] }))
    let state = useOfficeStore.getState()
    expect(state.externalStatus.dev).toBeUndefined()
    expect(state.agents.dev.status).toBe('idle')
    expect(state.externalStatus['codex-hook-a~dev'].status).toBe('working')
    expect(state.externalStatus['claude-main~ops'].status).toBe('working')
    expect(state.activeWorkflow).toBe('Cross-source run')
    expect(state.helpers.map(helper => helper.id)).toContain('claude-helper')

    await deliver(es, apiPayload('claude-cli', [{ role: 'ops', status: 'working' }], ++seq, {
      workflow: 'Cross-source run', helpers: [{ id: 'claude-helper', parentRole: 'ops', label: 'Claude helper' }],
    }))
    state = useOfficeStore.getState()
    expect(state.externalStatus['codex-hook-a~dev']).toBeUndefined()
    expect(state.externalStatus['claude-main~ops']).toBeUndefined()
    expect(state.agents['codex-hook-a~dev']).toBeUndefined()
    expect(state.agents['claude-main~ops']).toBeUndefined()
    expect(state.externalStatus.ops.status).toBe('working')
    expect(state.activeWorkflow).toBe('Cross-source run')
    expect(state.helpers.map(helper => helper.id)).toContain('claude-helper')

    await deliver(es, apiPayload('multi-session', [], ++seq, { sessionCount: 2 }))
    state = useOfficeStore.getState()
    expect(state.externalStatus.ops).toBeUndefined()
    expect(state.agents.ops.status).toBe('idle')
    expect(Object.values(state.agents).some(agent => agent.session)).toBe(false)
  })

  it('does not clear an agent subsequently owned by an independent manual channel', async () => {
    const es = FakeEventSource.instances[0]
    await deliver(es, apiPayload('codex-cli', [{ role: 'dev', status: 'working' }], ++seq))

    const manual = {
      origin: 'https://office.test', source: globalThis.window.parent,
      data: { type: 'office-status', source: 'manual', agents: [{ role: 'dev', status: 'working', label: 'manual status' }] },
    }
    for (const callback of globalThis.window.listeners.message || []) callback(manual)
    await vi.advanceTimersByTimeAsync(151)
    expect(useOfficeStore.getState().externalStatus.dev.label).toBe('manual status')

    await deliver(es, apiPayload('multi-session', [
      { role: 'codex-hook-a~dev', session: 'codex-hook-a', status: 'working' },
      { role: 'claude-main~ops', session: 'claude-main', status: 'working' },
    ], ++seq, { sessionCount: 2 }))

    expect(useOfficeStore.getState().externalStatus.dev.label).toBe('manual status')
  })

  it('keeps incremental API roles when a later payload names another role', async () => {
    const es = FakeEventSource.instances[0]
    await deliver(es, apiPayload('api', [{ role: 'dev', status: 'working' }], ++seq))
    await deliver(es, apiPayload('api', [{ role: 'ops', status: 'working' }], ++seq))

    expect(useOfficeStore.getState().externalStatus.dev.status).toBe('working')
    expect(useOfficeStore.getState().externalStatus.ops.status).toBe('working')
  })
})
