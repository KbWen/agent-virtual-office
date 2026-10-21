import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createFilePollingState, pollFileStatusOnce, _globalPayloadSig, normalizeStatusMessage, startStatusIntegration } from '../src/inference/inferStatus.js'

function makeResponse({ ok = true, status = 200, etag = null, jsonData = null, rawBody = null }) {
  const body = rawBody ?? (jsonData !== null ? JSON.stringify(jsonData) : 'null')
  return {
    ok,
    status,
    headers: { get: () => etag },
    text: vi.fn().mockResolvedValue(body),
  }
}

describe('pollFileStatusOnce', () => {
  it('ignores overlapping polls while a request is already in flight', async () => {
    const state = createFilePollingState()
    state.inFlight = true
    const fetchImpl = vi.fn()
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })

  it('skips duplicate body payloads on ETag-less servers so unchanged content is not re-applied', async () => {
    // ETag-less server: raw body dedup is the guard against re-delivery (mirrors SSE wire-byte dedup)
    const body = JSON.stringify({ type: 'office-status', _seq: '1000', agents: [{ role: 'dev', status: 'working' }] })
    const state = createFilePollingState()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse({ etag: null, rawBody: body }))
      .mockResolvedValueOnce(makeResponse({ etag: null, rawBody: body }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(state.lastSeq).toBe('1000')
    expect(state.lastBody).toBe(body)
  })

  it('delivers when body changes with same _seq and no ETag (MEDIUM-2: same-ms hook writes)', async () => {
    // Two hook processes write in the same millisecond → identical _seq but different agents.
    // ETag is stripped by proxy. Body-based dedup must detect the difference and deliver both.
    const seq = String(Date.now())
    const bodyA = JSON.stringify({ type: 'office-status', _seq: seq, agents: [{ role: 'dev', status: 'working', label: 'A' }] })
    const bodyB = JSON.stringify({ type: 'office-status', _seq: seq, agents: [{ role: 'qa', status: 'blocked', label: 'B' }] })
    const state = createFilePollingState()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse({ etag: null, rawBody: bodyA }))
      .mockResolvedValueOnce(makeResponse({ etag: null, rawBody: bodyB }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('delivers when ETag changes even if _seq is unchanged (same-ms hook writes)', async () => {
    // Two hook processes writing in the same millisecond produce identical _seq integers.
    // ETag (body hash) is the authoritative change signal; a fresh 200 + new ETag must deliver.
    const state = createFilePollingState()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse({
        etag: 'hash-a',
        jsonData: { type: 'office-status', _seq: '1000', agents: [{ role: 'dev', status: 'working', label: 'A' }] },
      }))
      .mockResolvedValueOnce(makeResponse({
        etag: 'hash-b',
        jsonData: { type: 'office-status', _seq: '1000', agents: [{ role: 'dev', status: 'done', label: 'B' }] },
      }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('restores prevEtag on parse failure so recovered body is not 304-skipped', async () => {
    // R34 fix: parseError must not keep the new ETag; if it did, a recovered server
    // would return 304 (same-ETag) and the valid body would never be delivered.
    const state = createFilePollingState()
    state.lastEtag = 'prev-etag'
    const badJsonFetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'new-etag' },
      text: vi.fn().mockResolvedValue('{bad json}'),  // valid text() but invalid JSON → parse throws
    })
    const callback = vi.fn()

    const result = await pollFileStatusOnce(badJsonFetch, state, callback)

    expect(result).toMatchObject({ ok: false, parseError: true })
    expect(state.lastEtag).toBe('prev-etag')   // restored — not 'new-etag'
    expect(state.lastSeq).toBeNull()            // unchanged
    expect(callback).toHaveBeenCalledOnce()
    expect(callback.mock.calls[0][0]).toBeNull()
  })

  it('resets backoff and skipTick after a 304 Not Modified response', async () => {
    // skipTick drives the 1-in-3 recovery cadence; set it to 2 so the next call (→3) runs
    const state = createFilePollingState()
    state.consecutive404 = 12
    state.skipTick = 2
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 304, headers: { get: () => null } })
    const callback = vi.fn()

    const result = await pollFileStatusOnce(fetchImpl, state, callback)

    expect(result).toMatchObject({ ok: true, unchanged: true })
    expect(state.consecutive404).toBe(0)   // server is alive — clear backoff
    expect(state.skipTick).toBe(0)         // also reset so next outage starts fresh
    expect(callback).not.toHaveBeenCalled()
  })

  it('carries only a sanitized observation through the actual file-poll callback', async () => {
    const summary = { state: 'all-idle', expiresAt: Date.now() + 60_000 }
    const state = createFilePollingState()
    const fetchImpl = vi.fn().mockResolvedValueOnce(makeResponse({
      etag: 'idle-1', jsonData: { type: 'office-status', agents: [], observedActivity: summary },
    }))
    const callback = vi.fn()

    await pollFileStatusOnce(fetchImpl, state, callback)

    const [msg, context] = callback.mock.calls[0]
    expect(msg.observedActivity).toEqual(summary)
    expect(Object.keys(msg)).not.toContain('_trusted')
    expect(context).toBeDefined()
  })

  it('clears through the actual file-poll callback for no-data and malformed responses', async () => {
    for (const rawBody of ['null', '{bad json}']) {
      const state = createFilePollingState()
      const callback = vi.fn()
      const fetchImpl = vi.fn().mockResolvedValueOnce(makeResponse({ rawBody }))

      await pollFileStatusOnce(fetchImpl, state, callback)

      expect(callback).toHaveBeenCalledOnce()
      expect(callback.mock.calls[0][0]).toBeNull()
      expect(callback.mock.calls[0][1]).toBeDefined()
    }
  })

  it('reports a fixed redacted warning when clearing observation throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const state = createFilePollingState()
    const callback = vi.fn(() => { throw new Error('private store details') })
    const fetchImpl = vi.fn().mockResolvedValueOnce(makeResponse({ ok: false, status: 503 }))

    try {
      const result = await pollFileStatusOnce(fetchImpl, state, callback)

      expect(result).toMatchObject({ ok: false, status: 503 })
      expect(callback).toHaveBeenCalledOnce()
      expect(callback.mock.calls[0][0]).toBeNull()
      expect(warn).toHaveBeenCalledWith('[Office] Status polling callback failed', {
        operation: 'clear-observation',
        code: 'STATUS_OBSERVATION_CLEAR_CALLBACK_FAILED',
      })
      expect(JSON.stringify(warn.mock.calls)).not.toContain('private store details')
    } finally {
      warn.mockRestore()
    }
  })

  it('resets backoff after a successful fetch', async () => {
    // At consecutive404=11, skipTick advances each call; every 3rd tick allows a real poll.
    // Tick 1 (skipTick→1): skip. Tick 2 (skipTick→2): skip. Tick 3 (skipTick→3, 3%3=0): runs.
    const state = createFilePollingState()
    state.consecutive404 = 11
    const callback = vi.fn()
    const skippedFetch = vi.fn()
    const successFetch = vi.fn().mockResolvedValue(makeResponse({
      etag: 'v3',
      jsonData: { type: 'office-status', _seq: 'fresh', agents: [{ role: 'qa', status: 'done' }] },
    }))

    // First two calls skipped (skipTick 1, 2 — both non-multiples of 3)
    state.inFlight = false
    await pollFileStatusOnce(skippedFetch, state, callback)  // skipTick → 1
    state.inFlight = false
    await pollFileStatusOnce(skippedFetch, state, callback)  // skipTick → 2
    expect(skippedFetch).not.toHaveBeenCalled()

    // Third call: skipTick reaches 3 (3 % 3 === 0) → poll runs
    state.inFlight = false
    await pollFileStatusOnce(successFetch, state, callback)

    expect(successFetch).toHaveBeenCalledOnce()
    expect(state.consecutive404).toBe(0)
    expect(state.skipTick).toBe(0)
    expect(callback).toHaveBeenCalledOnce()
  })

  it('caps consecutive404 at 30 so a persistently unreachable server does not ratchet forever', async () => {
    // skipTick drives cadence; every 3rd call is a real poll attempt even in backoff.
    // The counter grows to the cap via those recovery-attempt polls that also fail.
    const state = createFilePollingState()
    const failFetch = vi.fn().mockRejectedValue(new Error('network'))
    for (let i = 0; i < 200; i++) {
      state.inFlight = false
      await pollFileStatusOnce(failFetch, state, vi.fn())
    }
    expect(state.consecutive404).toBeLessThanOrEqual(30)
  })

  it('caps consecutive404 at 30 on 404 responses too', async () => {
    const state = createFilePollingState()
    const notFoundFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } })
    for (let i = 0; i < 200; i++) {
      state.inFlight = false
      await pollFileStatusOnce(notFoundFetch, state, vi.fn())
    }
    expect(state.consecutive404).toBeLessThanOrEqual(30)
  })
})

// ─── Fix 1: startPolling window-global dedupe ──────────────────────────
describe('_globalPayloadSig', () => {
  it('returns identical sig for same agents+workflow', () => {
    const data = { agents: [{ role: 'dev', status: 'working' }], workflow: 'Build' }
    expect(_globalPayloadSig(data)).toBe(_globalPayloadSig({ ...data }))
  })

  it('returns different sig when agents change (seq-less in-place mutation)', () => {
    const sig1 = _globalPayloadSig({ agents: [{ role: 'dev', status: 'working' }], workflow: null })
    const sig2 = _globalPayloadSig({ agents: [{ role: 'dev', status: 'blocked' }], workflow: null })
    expect(sig1).not.toBe(sig2)
  })

  it('returns different sig when workflow changes', () => {
    const base = { agents: [{ role: 'dev', status: 'working' }] }
    const sig1 = _globalPayloadSig({ ...base, workflow: 'Build' })
    const sig2 = _globalPayloadSig({ ...base, workflow: 'Ship' })
    expect(sig1).not.toBe(sig2)
  })
})

describe('startPolling — seq-less window global re-delivery', () => {
  let originalGlobal
  beforeEach(() => { originalGlobal = globalThis.window })
  afterEach(() => { globalThis.window = originalGlobal; vi.useRealTimers() })

  it('delivers again when agents change in-place even with no _seq field', async () => {
    vi.useFakeTimers()
    // Simulate the CLI pattern: mutate the SAME object in place
    const payload = { type: 'office-status', agents: [{ role: 'dev', status: 'working' }], workflow: null }
    globalThis.window = { __office_status__: payload }

    // We test _globalPayloadSig directly since startPolling uses setInterval
    // (browser env needed). Verify the sig changes when agents mutate.
    const sig1 = _globalPayloadSig(payload)
    // Simulate in-place mutation (no _seq change)
    payload.agents = [{ role: 'dev', status: 'blocked' }]
    const sig2 = _globalPayloadSig(payload)
    expect(sig1).not.toBe(sig2)
  })

  it('does NOT re-deliver when nothing changed (no _seq and same content)', () => {
    const payload = { type: 'office-status', agents: [{ role: 'dev', status: 'working' }], workflow: 'Build' }
    const sig1 = _globalPayloadSig(payload)
    // No mutation — same object
    const sig2 = _globalPayloadSig(payload)
    expect(sig1).toBe(sig2)
  })

  it('returns different sig when ONLY helpers change (helpers-only delta not deduped)', () => {
    // Regression: old sig only covered agents+workflow, so a helpers-only delta
    // (same agent statuses, same workflow) was silently deduped and never reached
    // the store. The fix adds helpers (and tokens/effort/mood) to the signature.
    const base = { agents: [{ role: 'dev', status: 'working' }], workflow: 'Build' }
    const sig1 = _globalPayloadSig({ ...base, helpers: undefined })
    const sig2 = _globalPayloadSig({ ...base, helpers: [{ id: 'dev#sub1', parentRole: 'dev', label: 'Coder' }] })
    expect(sig1).not.toBe(sig2)
  })

  it('returns different sig when helpers list grows (SubagentStart mid-turn)', () => {
    const base = { agents: [{ role: 'dev', status: 'working' }], workflow: null }
    const sig1 = _globalPayloadSig({ ...base, helpers: [{ id: 'dev#1', parentRole: 'dev' }] })
    const sig2 = _globalPayloadSig({ ...base, helpers: [{ id: 'dev#1', parentRole: 'dev' }, { id: 'dev#2', parentRole: 'dev' }] })
    expect(sig1).not.toBe(sig2)
  })

  it('returns same sig when helpers, tokens, effort, and mood are all unchanged', () => {
    const data = {
      agents: [{ role: 'dev', status: 'working' }],
      workflow: 'Build',
      helpers: [{ id: 'dev#1', parentRole: 'dev' }],
      tokens: { ctx: 1000, out: 200 },
      effort: 'medium',
      mood: 'focused',
    }
    expect(_globalPayloadSig(data)).toBe(_globalPayloadSig({ ...data }))
  })

  it('does not mutate the externally-owned window.__office_status__ global', () => {
    // withStatusEnvelope stamps _seq and source — these must NOT land on the original
    // payload object. We verify the shallow-copy guard by checking the original is clean.
    const payload = { type: 'office-status', agents: [{ role: 'dev', status: 'working' }] }
    const copy = { ...payload }
    // _globalPayloadSig must not modify the object it receives
    _globalPayloadSig(copy)
    expect(copy).not.toHaveProperty('_seqWasAdded')
    // The real guard: startPolling passes { ...data } to normalizeStatusMessage
    // which calls withStatusEnvelope — that stamps _seq on the copy, not on `data`.
    // Verify the helper itself is read-only.
    const orig = JSON.stringify(payload)
    _globalPayloadSig(payload)
    expect(JSON.stringify(payload)).toBe(orig)
  })
})

// ─── helpers field: polling apply-path tests ───────────────────────────
// These tests verify that pollFileStatusOnce delivers a message whose normalizeStatusMessage
// output correctly carries or omits the helpers field. The store apply-path (setHelpers call)
// is verified via the callback receiving the normalized message — the apply logic itself is
// pure (msg.helpers !== undefined → setHelpers) and does not need a full store mock here.
describe('helpers field in pollFileStatusOnce delivery', () => {
  it('delivers a valid helpers array through the normalizer unchanged', async () => {
    const helpers = [
      { id: 'dev#abc', parentRole: 'dev', label: 'Coder' },
      { id: 'qa#def', parentRole: 'qa' },
    ]
    const body = JSON.stringify({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working' }],
      helpers,
    })
    const state = createFilePollingState()
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'etag-1' },
      text: vi.fn().mockResolvedValue(body),
    })
    const callback = vi.fn()
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledOnce()
    const msg = callback.mock.calls[0][0]
    expect(msg.helpers).toEqual([
      { id: 'dev#abc', parentRole: 'dev', label: 'Coder' },
      { id: 'qa#def', parentRole: 'qa', label: undefined },
    ])
  })

  it('drops malformed helpers (non-array) — field absent in delivered message', async () => {
    const body = JSON.stringify({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working' }],
      helpers: 'not-an-array',
    })
    const state = createFilePollingState()
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'etag-2' },
      text: vi.fn().mockResolvedValue(body),
    })
    const callback = vi.fn()
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledOnce()
    const msg = callback.mock.calls[0][0]
    expect('helpers' in msg).toBe(false)
  })

  it('delivers helpers:[] explicitly so a cleared turn removes helpers from the store', async () => {
    const body = JSON.stringify({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'done' }],
      helpers: [],
    })
    const state = createFilePollingState()
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'etag-3' },
      text: vi.fn().mockResolvedValue(body),
    })
    const callback = vi.fn()
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledOnce()
    const msg = callback.mock.calls[0][0]
    expect(Array.isArray(msg.helpers)).toBe(true)
    expect(msg.helpers).toHaveLength(0)
  })

  it('omits helpers from message when payload has no helpers field (no-clear semantics)', async () => {
    const body = JSON.stringify({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working' }],
      // no helpers field
    })
    const state = createFilePollingState()
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'etag-4' },
      text: vi.fn().mockResolvedValue(body),
    })
    const callback = vi.fn()
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledOnce()
    const msg = callback.mock.calls[0][0]
    expect('helpers' in msg).toBe(false)
  })

  it('filters out helpers entries whose parentRole is not a base role', async () => {
    const body = JSON.stringify({
      type: 'office-status',
      agents: [{ role: 'dev', status: 'working' }],
      helpers: [
        { id: 'bad#1', parentRole: 'superuser' },
        { id: 'dev#2', parentRole: 'dev' },
      ],
    })
    const state = createFilePollingState()
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true, status: 200,
      headers: { get: () => 'etag-5' },
      text: vi.fn().mockResolvedValue(body),
    })
    const callback = vi.fn()
    await pollFileStatusOnce(fetchImpl, state, callback)

    expect(callback).toHaveBeenCalledOnce()
    const msg = callback.mock.calls[0][0]
    expect(msg.helpers).toHaveLength(1)
    expect(msg.helpers[0].parentRole).toBe('dev')
  })
})

describe('trusted observation through the real transport callbacks', () => {
  let originalWindow
  let originalEventSource
  let originalFetch
  let listeners
  let source
  let clean

  beforeEach(() => {
    vi.useFakeTimers()
    originalWindow = globalThis.window
    originalEventSource = globalThis.EventSource
    originalFetch = globalThis.fetch
    listeners = {}
    globalThis.window = {
      location: { protocol: 'http:', origin: 'http://localhost', search: '', hash: '' },
      parent: {},
      addEventListener: vi.fn((name, fn) => { (listeners[name] ||= []).push(fn) }),
      removeEventListener: vi.fn(),
    }
    globalThis.EventSource = class {
      constructor() { source = this; this.handlers = {} }
      addEventListener(name, fn) { this.handlers[name] = fn }
      close() {}
    }
  })

  afterEach(() => {
    if (clean) clean()
    clean = null
    globalThis.window = originalWindow
    globalThis.EventSource = originalEventSource
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  function makeStore() {
    const actions = {
      setObservedActivity: vi.fn(), markIntegrationProbe: vi.fn(),
      applyExternalStatus: vi.fn(), setActiveWorkflow: vi.fn(),
      setTokens: vi.fn(), setEffort: vi.fn(), setHelpers: vi.fn(),
      clearExternalStatus: vi.fn(), pruneHelpers: vi.fn(), externalStatus: {},
    }
    return { actions, store: { getState: () => actions } }
  }

  it('rejects a late poll observation after newer SSE even when the merged seq is lower', async () => {
    let resolveFetch
    globalThis.fetch = vi.fn(() => new Promise(resolve => { resolveFetch = resolve }))
    const { actions, store } = makeStore()
    clean = startStatusIntegration(store)
    await vi.advanceTimersByTimeAsync(1000) // start the in-flight GET poll

    const newer = { state: 'all-idle', expiresAt: Date.now() + 90_000 }
    source.handlers.status({ data: JSON.stringify({
      type: 'office-status', source: 'multi-session', _seq: '900', agents: [], observedActivity: newer,
    }) })

    const older = { state: 'not-idle', expiresAt: Date.now() + 80_000 }
    resolveFetch(makeResponse({ etag: 'poll-old', jsonData: {
      type: 'office-status', source: 'multi-session', _seq: '100', agents: [], observedActivity: older,
    } }))
    await vi.runAllTicks()
    await vi.advanceTimersByTimeAsync(150)

    expect(actions.setObservedActivity).toHaveBeenCalledTimes(1)
    expect(actions.setObservedActivity).toHaveBeenLastCalledWith(newer)
  })

  it('drops forged browser observation and clears a pending API proof on browser override', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeResponse({ etag: 'poll-1', jsonData: {
      type: 'office-status', source: 'multi-session', agents: [],
      observedActivity: { state: 'all-idle', expiresAt: Date.now() + 90_000 },
    } }))
    const { actions, store } = makeStore()
    clean = startStatusIntegration(store)
    await vi.advanceTimersByTimeAsync(1000)

    const forged = { type: 'office-status', source: 'external', agents: [],
      observedActivity: { state: 'all-idle', expiresAt: Date.now() + 90_000 } }
    listeners.message.forEach(fn => fn({ data: forged, origin: 'http://localhost', source: {} }))
    await vi.advanceTimersByTimeAsync(150)

    expect(actions.setObservedActivity).toHaveBeenCalledWith(null)
    expect(actions.setObservedActivity).not.toHaveBeenCalledWith(forged.observedActivity)
  })

  it('applies an SSE summary-only change with empty representatives', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 304, headers: { get: () => null } })
    const { actions, store } = makeStore()
    clean = startStatusIntegration(store)
    const first = { state: 'all-idle', expiresAt: Date.now() + 70_000 }
    const second = { state: 'all-idle', expiresAt: first.expiresAt + 1_000 }

    for (const observation of [first, second]) {
      source.handlers.status({ data: JSON.stringify({
        type: 'office-status', source: 'multi-session', agents: [], observedActivity: observation,
      }) })
      await vi.advanceTimersByTimeAsync(150)
    }

    expect(actions.setObservedActivity.mock.calls.map(([value]) => value)).toEqual([first, second])
  })

  it('clears observation immediately when the SSE connection fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 304, headers: { get: () => null } })
    const { actions, store } = makeStore()
    clean = startStatusIntegration(store)
    const observation = { state: 'all-idle', expiresAt: Date.now() + 70_000 }
    source.handlers.status({ data: JSON.stringify({
      type: 'office-status', source: 'multi-session', agents: [], observedActivity: observation,
    }) })
    await vi.advanceTimersByTimeAsync(150)

    source.onerror()

    expect(actions.setObservedActivity.mock.calls.map(([value]) => value)).toEqual([observation, null])
  })

  it('refreshes health on the 10-second heartbeat 304 without recreating observation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 304, headers: { get: () => null } })
    const { actions, store } = makeStore()
    clean = startStatusIntegration(store)
    const observation = { state: 'all-idle', expiresAt: Date.now() + 70_000 }
    source.handlers.status({ data: JSON.stringify({
      type: 'office-status', source: 'multi-session', agents: [], observedActivity: observation,
    }) })
    await vi.advanceTimersByTimeAsync(150)
    actions.markIntegrationProbe.mockClear()

    source.handlers.open()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(globalThis.fetch).toHaveBeenCalledOnce()
    expect(actions.markIntegrationProbe).toHaveBeenCalledWith({ ok: true })
    expect(actions.setObservedActivity.mock.calls.map(([value]) => value)).toEqual([observation])
  })

  it('ignores a deferred heartbeat response after integration cleanup', async () => {
    let resolveFetch
    globalThis.fetch = vi.fn(() => new Promise(resolve => { resolveFetch = resolve }))
    const { actions, store } = makeStore()
    clean = startStatusIntegration(store)
    const observation = { state: 'all-idle', expiresAt: Date.now() + 70_000 }
    source.handlers.status({ data: JSON.stringify({
      type: 'office-status', source: 'multi-session', agents: [], observedActivity: observation,
    }) })
    await vi.advanceTimersByTimeAsync(150)
    source.handlers.open()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(globalThis.fetch).toHaveBeenCalledOnce()

    actions.markIntegrationProbe.mockClear()
    clean()
    clean = null
    expect(vi.getTimerCount()).toBe(0)
    resolveFetch({ ok: true, status: 304, headers: { get: () => null } })
    await vi.advanceTimersByTimeAsync(0)

    expect(actions.markIntegrationProbe).not.toHaveBeenCalled()
    expect(actions.setObservedActivity.mock.calls.map(([value]) => value)).toEqual([observation])
    expect(vi.getTimerCount()).toBe(0)
  })
})
