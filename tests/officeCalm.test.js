import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from 'zustand/vanilla'
import officeExperience from '../src/config/officeExperience.json'
import { useOfficeStore } from '../src/systems/store.js'
import { resolveOfficeCalm, startOfficeCalm } from '../src/systems/officeCalm.js'
import { OBSERVED_ACTIVITY_TTL_MS } from '../src/utils/statusContract.mjs'

const BASE = 1_800_000_000_000
function eligible(overrides = {}) {
  return { experienceFlags: { calmEnabled: true }, officeCalm: { mode: 'unknown', eligibleSince: null },
    observedActivity: { state: 'all-idle', expiresAt: BASE + OBSERVED_ACTIVITY_TTL_MS },
    integrationHealth: { state: 'online', lastSuccessAt: BASE }, integrationSource: 'multi-session',
    statusSource: 'organic', externalStatus: {}, helpers: [], isPaused: false, ...overrides }
}
function harness(overrides = {}) {
  const updateTime = vi.fn()
  const store = createStore(() => ({ ...eligible(overrides), updateTime }))
  const doc = new EventTarget()
  Object.defineProperty(doc, 'visibilityState', { value: 'visible', writable: true })
  const stop = startOfficeCalm(store, { document: doc })
  return { store, doc, stop, updateTime }
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(BASE) })
afterEach(() => vi.useRealTimers())

describe('AVO-199 honest quiet resolver', () => {
  it('settles continuously and enters quiet at exactly30s, not29999ms', () => {
    const state = eligible()
    const first = resolveOfficeCalm(state, BASE)
    expect(first).toEqual({ mode: 'settling', eligibleSince: BASE })
    expect(resolveOfficeCalm({ ...state, officeCalm: first }, BASE + 29_999).mode).toBe('settling')
    expect(resolveOfficeCalm({ ...state, officeCalm: first }, BASE + 30_000).mode).toBe('quiet')
  })
  it.each([
    { observedActivity: null }, { observedActivity: { state: 'unknown', expiresAt: BASE + 100_000 } },
    { observedActivity: { state: 'all-idle', expiresAt: BASE } },
    { observedActivity: { state: 'all-idle', expiresAt: BASE + OBSERVED_ACTIVITY_TTL_MS + 1 } },
    { observedActivity: { state: 'all-idle', expiresAt: BASE + 100_000, forged: true } },
    { integrationHealth: { state: 'offline', lastSuccessAt: BASE } },
    { integrationHealth: { state: 'degraded', lastSuccessAt: BASE } },
    { integrationHealth: { state: 'online', lastSuccessAt: BASE - 30_001 } },
    { statusSource: 'fallback' }, { integrationSource: 'demo' }, { isPaused: true },
    { experienceFlags: { calmEnabled: false } },
  ])('unknown is never reassuring: %j', (patch) => {
    expect(resolveOfficeCalm(eligible(patch), BASE)).toEqual({ mode: 'unknown', eligibleSince: null })
  })
  it.each(['working', 'planning', 'thinking', 'blocked', 'awaiting-approval', 'done'])(
    'fresh visible %s immediately wins over an idle summary', (status) => {
      const state = eligible({ officeCalm: { mode: 'quiet', eligibleSince: BASE - 30_000 },
        externalStatus: { dev: { status, expiresAt: BASE + 5000 } } })
      expect(resolveOfficeCalm(state, BASE)).toEqual({ mode: 'active', eligibleSince: null })
    })
  it.each([{ dev: { status: 'blocked' } }, { dev: { status: 'awaiting-approval', expiresAt: NaN } }, { dev: null }])('malformed visible evidence fails closed: %j', (externalStatus) => {
    expect(resolveOfficeCalm(eligible({ externalStatus }), BASE).mode).toBe('unknown')
  })
  it('missing or failed observation remains unknown even with a retained active sprite', () => {
    const externalStatus = { dev: { status: 'blocked', expiresAt: BASE + 100_000 } }
    expect(resolveOfficeCalm(eligible({ externalStatus, observedActivity: null }), BASE).mode).toBe('unknown')
    expect(resolveOfficeCalm(eligible({ externalStatus, integrationHealth: { state: 'offline', lastSuccessAt: BASE } }), BASE).mode).toBe('unknown')
  })
  it('one idle entry and empty representatives qualify only with independent trusted proof', () => {
    expect(resolveOfficeCalm(eligible({ externalStatus: { dev: { status: 'idle', expiresAt: BASE + 5000 } } }), BASE).mode).toBe('settling')
    expect(resolveOfficeCalm(eligible({ observedActivity: null, externalStatus: {} }), BASE).mode).toBe('unknown')
    expect(resolveOfficeCalm(eligible({ helpers: [{ id: 'dev#x', expiresAt: BASE + 5000 }] }), BASE).mode).toBe('active')
  })
})

describe('AVO-199 single-deadline controller', () => {
  it('ignores position ticks and duplicate idle polls without restarting settling', async () => {
    const { store, stop } = harness()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(20_000)
    store.setState({ agents: { dev: { position: { x: 20, y: 30 } } },
      integrationHealth: { state: 'online', lastSuccessAt: Date.now() },
      observedActivity: { state: 'all-idle', expiresAt: BASE + OBSERVED_ACTIVITY_TTL_MS } })
    expect(store.getState().officeCalm.eligibleSince).toBe(BASE)
    await vi.advanceTimersByTimeAsync(9999)
    expect(store.getState().officeCalm.mode).toBe('settling')
    await vi.advanceTimersByTimeAsync(1)
    expect(store.getState().officeCalm.mode).toBe('quiet')
    expect(vi.getTimerCount()).toBe(1)
    stop(); expect(vi.getTimerCount()).toBe(0)
  })
  it('expires without store traffic and restarts a full interval after reconnect', async () => {
    const { store, stop } = harness({ observedActivity: { state: 'all-idle', expiresAt: BASE + 35_000 } })
    await vi.advanceTimersByTimeAsync(20_000)
    store.setState({ integrationHealth: { state: 'online', lastSuccessAt: Date.now() } })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(store.getState().officeCalm.mode).toBe('quiet')
    await vi.advanceTimersByTimeAsync(5000)
    expect(store.getState().officeCalm.mode).toBe('unknown')
    store.setState({ observedActivity: { state: 'all-idle', expiresAt: Date.now() + OBSERVED_ACTIVITY_TTL_MS }, integrationHealth: { state: 'online', lastSuccessAt: Date.now() } })
    expect(store.getState().officeCalm).toEqual({ mode: 'settling', eligibleSince: Date.now() })
    stop()
  })
  it('failure, replacement, pause and disable reset eligibility immediately', async () => {
    const { store, stop } = harness()
    await vi.advanceTimersByTimeAsync(10_000)
    store.setState({ integrationSource: 'gemini-cli' })
    expect(store.getState().officeCalm.eligibleSince).toBe(BASE + 10_000)
    store.setState({ integrationHealth: { state: 'offline', lastSuccessAt: BASE } })
    expect(store.getState().officeCalm.mode).toBe('unknown')
    store.setState({ integrationHealth: { state: 'online', lastSuccessAt: Date.now() } })
    expect(store.getState().officeCalm.eligibleSince).toBe(Date.now())
    store.setState({ isPaused: true }); expect(store.getState().officeCalm.mode).toBe('unknown')
    store.setState({ isPaused: false }); expect(store.getState().officeCalm.mode).toBe('settling')
    store.setState({ experienceFlags: { calmEnabled: false } }); expect(store.getState().officeCalm.mode).toBe('unknown')
    stop()
  })
  it('recomputes current time on visible resume and refreshes the existing clock once', () => {
    const { store, doc, stop, updateTime } = harness()
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange'))
    expect(updateTime).not.toHaveBeenCalled()
    vi.setSystemTime(BASE + 130_000)
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange'))
    expect(updateTime).toHaveBeenCalledTimes(1)
    expect(store.getState().officeCalm.mode).toBe('unknown')
    stop(); stop(); expect(vi.getTimerCount()).toBe(0)
    store.setState({ observedActivity: { state: 'all-idle', expiresAt: Date.now() + OBSERVED_ACTIVITY_TTL_MS } })
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(updateTime).toHaveBeenCalledTimes(1)
    expect(store.getState().officeCalm.mode).toBe('unknown')
  })
  it('changes only the transient calm slice and never agent/ledger/mood/health fields', () => {
    const state = eligible({ agents: { dev: { status: 'idle', position: { x: 1, y: 2 } } }, mood: 'normal', dailyDoneLedger: { counts: {} }, activeWorkflow: '/plan' })
    const store = createStore(() => state)
    const stop = startOfficeCalm(store, { document: null })
    const { officeCalm, ...after } = store.getState()
    const { officeCalm: ignored, ...before } = state
    expect(after).toEqual(before)
    expect(officeCalm.mode).toBe('settling')
    stop()
  })
})


describe('AVO-199 actual store boundaries', () => {
  it('loads the approved experience flags and clears proof even without representatives', () => {
    const original = useOfficeStore.getState()
    try {
      expect(officeExperience).toEqual({ calmEnabled: true, offHoursEnabled: false, planningPodEnabled: false })
      expect(original.experienceFlags).toEqual(officeExperience)
      useOfficeStore.setState({ externalStatus: {} })
      original.setObservedActivity({ state: 'all-idle', expiresAt: BASE + 100_000 })
      expect(useOfficeStore.getState().observedActivity?.state).toBe('all-idle')
      original.clearExternalStatus()
      expect(useOfficeStore.getState().observedActivity).toBeNull()
    } finally { useOfficeStore.setState(original, true) }
  })
  it('renews successful connection freshness on304-equivalent probes without changing severity', () => {
    const original = useOfficeStore.getState()
    try {
      useOfficeStore.setState({ integrationHealth: { state: 'online', consecutiveFailures: 0, lastSuccessAt: BASE - 20_000, lastErrorAt: null } })
      original.markIntegrationProbe({ ok: true })
      expect(useOfficeStore.getState().integrationHealth).toEqual({ state: 'online', consecutiveFailures: 0, lastSuccessAt: BASE, lastErrorAt: null })
    } finally { useOfficeStore.setState(original, true) }
  })
})
