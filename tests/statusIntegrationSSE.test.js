/**
 * startStatusIntegration — SSE retry (R2) + fast-poll continuity during retry (R1) +
 * staleness-refresh wiring (AC1 / R3).
 *
 * Adapted from a fresh-reviewer feasibility harness (2026-09-26 review of
 * fix/client-runtime-hygiene) that proved `startStatusIntegration` CAN be driven directly with
 * a fake `EventSource` + stubbed `fetch`/`window`/`localStorage` + `vi.useFakeTimers()` in this
 * repo's default (node) test environment — no jsdom needed. The static import below is hoisted
 * above any global stubbing in this file (ES module semantics), so `inferStatus.js` (and its
 * transitive `moodEngine.js` → `store.js` import) evaluates with `window` still undefined,
 * exactly like every other test file in this suite.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startStatusIntegration } from '../src/inference/inferStatus.js'

globalThis.localStorage = {
  _m: {},
  getItem(k) { return this._m[k] ?? null },
  setItem(k, v) { this._m[k] = String(v) },
  removeItem(k) { delete this._m[k] },
}

// Fake EventSource: addEventListener-based for 'open'/'status' (matches real usage), plain
// `.onerror` property assignment for errors (matches startSSEListening's own `es.onerror = ...`).
class FakeES {
  static all = []
  constructor(url) { this.url = url; this.listeners = {}; this.closed = false; FakeES.all.push(this) }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  close() { this.closed = true }
  fail() { this.onerror && this.onerror() }
  open() { (this.listeners.open || []).forEach(f => f()) }
}

function mkStore() {
  const calls = { clearExternalStatus: 0 }
  const probes = []
  const st = {
    statusSource: 'organic',
    activeWorkflow: null,
    externalStatus: {},
    agents: {},
    markIntegrationProbe: (p) => probes.push(Boolean(p.ok)),
    clearExternalStatus: () => {
      calls.clearExternalStatus++
      st.statusSource = 'organic'
      st.externalStatus = {}
    },
    pruneHelpers: () => {},
    setActiveWorkflow: () => {},
    // Mirrors just enough of the real store.js applyExternalStatus for applyMessage's routing
    // to have an observable effect: arms statusSource so stalenessSweepAction sees non-organic.
    applyExternalStatus: (updates) => {
      if (updates.length > 0) {
        st.statusSource = 'external'
        st.externalStatus = Object.fromEntries(
          updates.map((u) => [u.agentId, { status: u.status, expiresAt: Date.now() + 300000 }]),
        )
      }
    },
  }
  return { store: { getState: () => st }, st, probes, calls }
}

let fetchState
beforeEach(() => {
  vi.useFakeTimers()
  FakeES.all = []
  globalThis.EventSource = FakeES
  globalThis.window = {
    location: { protocol: 'http:', hostname: 'localhost', hash: '', search: '' },
    addEventListener() {}, removeEventListener() {}, parent: null,
  }
  globalThis.BroadcastChannel = undefined
  // Call 1 returns a real 200 body (delivers one agent update — arms the staleness timer via
  // applyMessage's own resetStalenessTimer() call, a code path unaffected by the R1/AC1 fix
  // under test). Every call after that returns 304 until fetchState.status is changed.
  fetchState = { calls: 0, status: 304, firstBody: JSON.stringify({ type: 'office-status', agents: [{ role: 'dev', status: 'working', task: null, label: null }] }) }
  globalThis.fetch = vi.fn(async () => {
    fetchState.calls++
    if (fetchState.calls === 1) {
      return { status: 200, ok: true, headers: { get: () => '"etag-1"' }, text: async () => fetchState.firstBody }
    }
    return { status: fetchState.status, ok: fetchState.status < 400, headers: { get: () => null }, text: async () => 'null' }
  })
})

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.window
  delete globalThis.EventSource
  delete globalThis.BroadcastChannel
})

// Fails the current (last-created) EventSource 5 times with the real 2s/4s/8s/16s backoff
// between each, matching startSSEListening's MAX_CONSECUTIVE_ERRORS=5 give-up sequence.
async function burnGiveUp() {
  const backoffs = [2000, 4000, 8000, 16000]
  for (let i = 0; i < 5; i++) {
    const cur = FakeES.all[FakeES.all.length - 1]
    cur.fail()
    if (i < backoffs.length) await vi.advanceTimersByTimeAsync(backoffs[i] + 1)
  }
}

describe('SSE retry (R2) — reconnects after giving up, no reconnect storm', () => {
  it('retries ~60s after giving up, keeps exactly one live connection, cleanup cancels a pending retry', async () => {
    const { store } = mkStore()
    const stop = startStatusIntegration(store)
    expect(FakeES.all.length).toBe(1)

    await burnGiveUp()
    const afterGiveUp = FakeES.all.length

    // No retry before 60s.
    await vi.advanceTimersByTimeAsync(59_000)
    expect(FakeES.all.length).toBe(afterGiveUp)

    // Retry fires at ~60s — exactly one new connection, and it's the only OPEN one.
    await vi.advanceTimersByTimeAsync(1_500)
    expect(FakeES.all.length).toBe(afterGiveUp + 1)
    expect(FakeES.all.filter((e) => !e.closed).length).toBe(1)

    // Cleanup (unmount) while a NEXT retry is pending must cancel it — no leaked timer.
    await burnGiveUp()
    const nBeforeCleanup = FakeES.all.length
    stop()
    await vi.advanceTimersByTimeAsync(200_000)
    expect(FakeES.all.length).toBe(nBeforeCleanup)
  })

  it('StrictMode double-mount: an early teardown (before give-up) leaves no dangling retry', async () => {
    const { store } = mkStore()
    const stop1 = startStatusIntegration(store)
    stop1()   // torn before any error — the first instance's onGiveUp must never fire a retry
    const stop2 = startStatusIntegration(store)
    await burnGiveUp()
    const afterGiveUp = FakeES.all.length
    await vi.advanceTimersByTimeAsync(61_000)
    // Exactly one retry connection from the SECOND (live) instance — the first instance's
    // teardown must not have left a timer that also fires.
    expect(FakeES.all.length).toBe(afterGiveUp + 1)
    stop2()
  })
})

describe('fast-poll continuity during a retry (R1 fix)', () => {
  it('does not reset to a fresh 10s heartbeat poller at retry-START — only a confirmed SSE open does that', async () => {
    const { store } = mkStore()
    const stop = startStatusIntegration(store)
    // First connection opens and stabilizes — this DOES legitimately switch to heartbeat mode.
    FakeES.all[0].open()
    await vi.advanceTimersByTimeAsync(10_000)   // MIN_STABLE_MS

    // Now the connection dies and gives up — back to fast polling, then a retry is scheduled.
    await burnGiveUp()

    // From here on, keep every poll response "delivered" (unique body each time) so the fast
    // poller's own adaptive backoff stays pinned at its base interval. This isolates the
    // question under test — does retry-START itself reset/replace the poller? — from the
    // unrelated adaptive-backoff behavior, which would otherwise make a fixed-size timing
    // window flaky (a plain 304 stream ramps the fast poller's interval up to 8s over time).
    let bodyCounter = 0
    globalThis.fetch = vi.fn(async () => {
      fetchState.calls++
      bodyCounter++
      return {
        status: 200, ok: true, headers: { get: () => `"etag-${bodyCounter}"` },
        text: async () => JSON.stringify({
          type: 'office-status', agents: [{ role: 'dev', status: 'working', task: `t${bodyCounter}`, label: null }],
        }),
      }
    })

    await vi.advanceTimersByTimeAsync(59_000)   // just before the 60s retry

    // Fire the retry.
    await vi.advanceTimersByTimeAsync(1_500)
    expect(FakeES.all.length).toBeGreaterThanOrEqual(2)
    const callsAtRetryStart = fetchState.calls

    // Measure the gap to the NEXT fetch call after the retry's ES was created, in small steps.
    // Before the fix: `connectSSE` called `startHeartbeatPolling()` the instant it got a cleanup
    // function back from `startSSEListening` — i.e. at retry-ATTEMPT-start, not at connection
    // success — tearing down the fast poller (whatever its live phase) and replacing it with a
    // BRAND NEW 10s-interval poller whose first tick is always exactly +10000ms from its own
    // start, regardless of what the fast poller was doing a moment earlier. The fix keeps the
    // SAME fast poller (pinned near its ~1s base interval here) running straight through.
    let elapsed = 0
    while (fetchState.calls === callsAtRetryStart && elapsed < 9000) {
      await vi.advanceTimersByTimeAsync(250)
      elapsed += 250
    }
    expect(elapsed).toBeLessThan(2000)

    stop()
  })
})

describe('staleness-refresh wiring (AC1 / R3) — continuous 304 keeps external status alive', () => {
  it('does not clear external status over 200s of confirmed-unchanged (304) polls after one real delivery (past 120s, still under the 300s expiresAt backstop)', async () => {
    const { store, st, calls } = mkStore()
    // No EventSource stubbed removal here — SSE is available, but what matters is the file
    // polling channel's 304 stream refreshing the staleness timer that the initial delivery
    // (below) arms. Let the initial connection open so we're in heartbeat (10s) mode too —
    // the fix must hold in BOTH polling cadences.
    const stop = startStatusIntegration(store)
    FakeES.all[0].open()
    await vi.advanceTimersByTimeAsync(10_000)

    // The very first fetch (call #1, wired in beforeEach) delivers a real agent update via the
    // heartbeat poller — this arms resetStalenessTimer() via applyMessage (inferStatus.js line
    // ~803), a call site NOT touched by the R1/AC1 fix, so the timer is genuinely armed here
    // regardless of whether the fix is present. It also stamps this mock's `expiresAt` at
    // delivery-time + 300000 (mirrors store.js buildExtEntry) — that field is a SEPARATE,
    // independently-correct 300s backstop (R5) that this test must stay well under, or it would
    // conflate two different mechanisms.
    await vi.advanceTimersByTimeAsync(10_000)   // first heartbeat tick delivers the update
    expect(st.statusSource).toBe('external')

    // From here on every poll is a 304. 200s comfortably clears the 120s STALENESS_TIMEOUT
    // (proving the sweep armed above does NOT fire early) while staying well under the 300s
    // expiresAt backstop (proving this test isn't just waiting for THAT mechanism instead).
    await vi.advanceTimersByTimeAsync(200_000)

    // Before the R1 fix (or under a mutation removing both resetStalenessTimer() calls from
    // handleProbe/heartbeatProbe), the sweep armed above would fire at ~120s and clear this.
    expect(calls.clearExternalStatus).toBe(0)
    expect(st.statusSource).toBe('external')

    stop()
  })

  it('still clears within ~300–305s when the hook goes fully silent (the expiresAt backstop, R5 — independent of the 120s sweep)', async () => {
    const { store, st, calls } = mkStore()
    const stop = startStatusIntegration(store)
    FakeES.all[0].open()
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(10_000)   // delivers the one real update, arms expiresAt
    expect(st.statusSource).toBe('external')

    // Run past the 300s expiresAt backstop (delivery landed ~t=10.15s, so 300s later is ~310s;
    // give a little slack for the 5s expiryInterval granularity).
    await vi.advanceTimersByTimeAsync(310_000)

    expect(calls.clearExternalStatus).toBeGreaterThanOrEqual(1)
    expect(st.statusSource).toBe('organic')

    stop()
  })
})
