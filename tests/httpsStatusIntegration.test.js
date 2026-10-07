import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startStatusIntegration } from '../src/inference/inferStatus.js'

globalThis.localStorage = {
  _m: {},
  getItem(k) { return this._m[k] ?? null },
  setItem(k, v) { this._m[k] = String(v) },
  removeItem(k) { delete this._m[k] },
}

class FakeES {
  static all = []
  constructor(url) {
    this.url = url
    this.listeners = {}
    this.closed = false
    FakeES.all.push(this)
  }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  close() { this.closed = true }
}

function mkStore() {
  const probes = []
  const st = {
    statusSource: 'organic',
    activeWorkflow: null,
    externalStatus: {},
    agents: {},
    markIntegrationProbe: (p) => probes.push(Boolean(p.ok)),
    clearExternalStatus: () => {},
    pruneHelpers: () => {},
    setActiveWorkflow: () => {},
    applyExternalStatus: () => {},
  }
  return { store: { getState: () => st }, st, probes }
}

describe('HTTPS Status Integration (remote deployment & TLS)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeES.all = []
    globalThis.EventSource = FakeES
  })

  afterEach(() => {
    vi.useRealTimers()
    delete globalThis.window
    delete globalThis.EventSource
    delete globalThis.BroadcastChannel
  })

  it('starts both SSE and polling when hosted on https with a remote domain', async () => {
    const fetchedUrls = []
    globalThis.window = {
      location: { protocol: 'https:', hostname: 'office.example.com', hash: '', search: '' },
      addEventListener() {}, removeEventListener() {}, parent: null,
    }
    globalThis.fetch = vi.fn(async (url) => {
      fetchedUrls.push(url)
      return { status: 304, ok: true, headers: { get: () => null }, text: async () => 'null' }
    })

    const { store } = mkStore()
    const stop = startStatusIntegration(store)

    // Verify SSE connects with relative path to same HTTPS origin
    expect(FakeES.all.length).toBe(1)
    expect(FakeES.all[0].url).toBe('/api/status/stream')

    // Advance timers to trigger polling
    await vi.advanceTimersByTimeAsync(1100)
    expect(globalThis.fetch).toHaveBeenCalled()
    expect(fetchedUrls).toContain('/api/status')

    stop()
  })

  it('starts both SSE and polling when hosted on https with 127.0.0.1 or LAN IP', async () => {
    const fetchedUrls = []
    globalThis.window = {
      location: { protocol: 'https:', hostname: '127.0.0.1', hash: '', search: '' },
      addEventListener() {}, removeEventListener() {}, parent: null,
    }
    globalThis.fetch = vi.fn(async (url) => {
      fetchedUrls.push(url)
      return { status: 304, ok: true, headers: { get: () => null }, text: async () => 'null' }
    })

    const { store } = mkStore()
    const stop = startStatusIntegration(store)

    expect(FakeES.all.length).toBe(1)
    expect(FakeES.all[0].url).toBe('/api/status/stream')

    await vi.advanceTimersByTimeAsync(1100)
    expect(globalThis.fetch).toHaveBeenCalled()
    expect(fetchedUrls).toContain('/api/status')

    stop()
  })

  it('skips API polling and SSE on file:// protocol', async () => {
    globalThis.window = {
      location: { protocol: 'file:', hostname: '', hash: '', search: '' },
      addEventListener() {}, removeEventListener() {}, parent: null,
    }
    globalThis.fetch = vi.fn()

    const { store } = mkStore()
    const stop = startStatusIntegration(store)

    // No SSE initiated
    expect(FakeES.all.length).toBe(0)

    // Advance timers — no fetch called
    await vi.advanceTimersByTimeAsync(5000)
    expect(globalThis.fetch).not.toHaveBeenCalled()

    stop()
  })
})
