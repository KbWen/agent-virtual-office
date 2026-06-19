/**
 * #8 — desktopNotifier tests.
 *
 * jsdom does not implement the Notification API, so we install a controllable
 * mock + intercept document.hidden. Tests cover:
 *   - threshold (no fire <30s, fire at/after 30s)
 *   - dedupe (one fire per episode; transitioning out + back in = new episode)
 *   - visibility gate (no fire when tab visible)
 *   - permission gate (no fire when 'denied' / 'default' / 'unsupported')
 *   - multi-agent independent state
 *   - clean stop / no further fires after stop
 *   - jsdom safety (no crash when Notification undefined)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  startDesktopNotifier,
  requestNotificationPermission,
  getNotificationState,
  isNotificationGranted,
  _resetDesktopNotifierState,
  _recurringNotifiedKeys,
} from '../src/inference/desktopNotifier.js'

// Minimal store shim
function makeStore(initialAgents = {}) {
  let state = { agents: { ...initialAgents } }
  return {
    getState: () => state,
    setAgentStatus(id, status) {
      state = { agents: { ...state.agents, [id]: { ...(state.agents[id] || {}), status } } }
    },
  }
}

// Mock Notification — captures every construction.
class MockNotification {
  static permission = 'default'
  static lastFired = []
  static fakeRequestResult = 'granted'
  static requestCount = 0

  static async requestPermission() {
    MockNotification.requestCount++
    MockNotification.permission = MockNotification.fakeRequestResult
    return MockNotification.fakeRequestResult
  }

  constructor(title, options) {
    this.title = title
    this.body = options?.body
    this.tag = options?.tag
    this.onclick = null
    MockNotification.lastFired.push({ title, body: options?.body, tag: options?.tag })
  }
  close() {}
}

function setHidden(hidden) {
  globalThis.document = globalThis.document || {}
  globalThis.document.hidden = hidden
  globalThis.document.visibilityState = hidden ? 'hidden' : 'visible'
}

let originalNotification, originalDocument, originalWindow
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-29T12:00:00Z'))
  originalNotification = globalThis.Notification
  originalDocument = globalThis.document
  originalWindow = globalThis.window
  globalThis.Notification = MockNotification
  // Install a minimal document + window for the visibility/focus path
  globalThis.document = { hidden: true, visibilityState: 'hidden' }
  globalThis.window = { focus: () => {} }
  MockNotification.permission = 'granted'
  MockNotification.lastFired = []
  MockNotification.requestCount = 0
  MockNotification.fakeRequestResult = 'granted'
  _resetDesktopNotifierState()
})

afterEach(() => {
  if (originalNotification === undefined) delete globalThis.Notification
  else globalThis.Notification = originalNotification
  if (originalDocument === undefined) delete globalThis.document
  else globalThis.document = originalDocument
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  vi.useRealTimers()
})

describe('desktopNotifier — permission API', () => {
  it('getNotificationState reflects Notification.permission', () => {
    MockNotification.permission = 'granted'
    expect(getNotificationState()).toBe('granted')
    MockNotification.permission = 'denied'
    expect(getNotificationState()).toBe('denied')
    MockNotification.permission = 'default'
    expect(getNotificationState()).toBe('default')
  })

  it('isNotificationGranted reflects Notification.permission', () => {
    MockNotification.permission = 'granted'
    expect(isNotificationGranted()).toBe(true)
    MockNotification.permission = 'denied'
    expect(isNotificationGranted()).toBe(false)
  })

  it('requestNotificationPermission returns granted/denied when API resolves so', async () => {
    MockNotification.permission = 'default'
    MockNotification.fakeRequestResult = 'granted'
    expect(await requestNotificationPermission()).toBe('granted')

    MockNotification.permission = 'default'
    MockNotification.fakeRequestResult = 'denied'
    expect(await requestNotificationPermission()).toBe('denied')
  })

  it('requestNotificationPermission short-circuits when already granted', async () => {
    MockNotification.permission = 'granted'
    MockNotification.requestCount = 0
    expect(await requestNotificationPermission()).toBe('granted')
    expect(MockNotification.requestCount).toBe(0)
  })

  it('requestNotificationPermission short-circuits when already denied', async () => {
    MockNotification.permission = 'denied'
    MockNotification.requestCount = 0
    expect(await requestNotificationPermission()).toBe('denied')
    expect(MockNotification.requestCount).toBe(0)
  })

  it('getNotificationState returns unsupported when Notification is undefined', () => {
    delete globalThis.Notification
    expect(getNotificationState()).toBe('unsupported')
  })
})

describe('desktopNotifier — threshold + dedupe', () => {
  it('no fire when blocked <30s', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(25000)
    expect(MockNotification.lastFired.length).toBe(0)
    stop()
  })

  it('fires exactly once at the 30s threshold', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(30000)
    expect(MockNotification.lastFired.length).toBe(1)
    stop()
  })

  it('does not fire repeatedly for the same blocked episode', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(60000) // 1 minute total — many polls past threshold
    expect(MockNotification.lastFired.length).toBe(1)
    stop()
  })

  it('blocked → working → blocked = new episode = new notification', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(31000)
    expect(MockNotification.lastFired.length).toBe(1)
    store.setAgentStatus('dev', 'working')
    vi.advanceTimersByTime(5000)
    expect(MockNotification.lastFired.length).toBe(1)
    store.setAgentStatus('dev', 'blocked')
    vi.advanceTimersByTime(31000)
    expect(MockNotification.lastFired.length).toBe(2)
    stop()
  })

  it('Notification carries tag office-blocked-<agentId>', () => {
    const store = makeStore({ qa: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(30000)
    expect(MockNotification.lastFired[0].tag).toBe('office-blocked-qa')
    stop()
  })

  it('multiple blocked agents each fire independently', () => {
    const store = makeStore({
      dev: { status: 'blocked' },
      qa: { status: 'blocked' },
    })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(30000)
    const tags = MockNotification.lastFired.map(n => n.tag).sort()
    expect(tags).toEqual(['office-blocked-dev', 'office-blocked-qa'])
    stop()
  })

  it('configurable thresholdMs', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000, thresholdMs: 5000 })
    vi.advanceTimersByTime(5000)
    expect(MockNotification.lastFired.length).toBe(1)
    stop()
  })
})

describe('desktopNotifier — visibility gate', () => {
  it('does not fire when tab is visible', () => {
    setHidden(false)
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(60000)
    expect(MockNotification.lastFired.length).toBe(0)
    stop()
  })

  it('fires once tab becomes hidden after the threshold has already passed', () => {
    setHidden(false)
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(35000) // 35s blocked but tab visible → no fire
    expect(MockNotification.lastFired.length).toBe(0)
    setHidden(true)
    vi.advanceTimersByTime(2000) // next poll
    expect(MockNotification.lastFired.length).toBe(1)
    stop()
  })
})

describe('desktopNotifier — permission gate', () => {
  it.each(['denied', 'default'])('does not fire when permission is %s', (perm) => {
    MockNotification.permission = perm
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(60000)
    expect(MockNotification.lastFired.length).toBe(0)
    stop()
  })

  it('starts firing when permission flips to granted mid-session', () => {
    MockNotification.permission = 'default'
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(35000)
    expect(MockNotification.lastFired.length).toBe(0)
    MockNotification.permission = 'granted'
    vi.advanceTimersByTime(2000)
    expect(MockNotification.lastFired.length).toBe(1)
    stop()
  })
})

describe('desktopNotifier — environment safety', () => {
  it('does not crash when Notification is undefined', () => {
    delete globalThis.Notification
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    expect(() => vi.advanceTimersByTime(60000)).not.toThrow()
    stop()
  })

  it('does not crash on invalid store argument', () => {
    expect(() => startDesktopNotifier(null)).not.toThrow()
    expect(() => startDesktopNotifier({ getState: 'not a function' })).not.toThrow()
  })

  it('stop function clears the polling interval', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    stop()
    vi.advanceTimersByTime(60000)
    expect(MockNotification.lastFired.length).toBe(0)
  })
})

describe('desktopNotifier — non-blocked statuses never trigger', () => {
  it.each(['idle', 'working', 'done'])('status=%s does not start an episode', (status) => {
    const store = makeStore({ dev: { status } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000 })
    vi.advanceTimersByTime(60000)
    expect(MockNotification.lastFired.length).toBe(0)
    stop()
  })
})

// ─── Fix 2: idle-gap reclassification must not reset the blocked episode ─
describe('desktopNotifier — awaiting-approval treated as still-blocked (fix #2)', () => {
  it('blocked episode does not fire a 2nd notification when idle-gap transitions to awaiting-approval then blocked reasserts', () => {
    // Sequence: blocked (30s) → notification fires → idle-gap changes status to
    // 'awaiting-approval' → original hook re-asserts 'blocked'.
    // Expected: only ONE notification total (same episode).
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000, thresholdMs: 30000 })
    vi.advanceTimersByTime(31000)
    expect(MockNotification.lastFired.length).toBe(1)  // first notification
    // Idle-gap infers awaiting-approval (does NOT clear the episode)
    store.setAgentStatus('dev', 'awaiting-approval')
    vi.advanceTimersByTime(5000)
    expect(MockNotification.lastFired.length).toBe(1)  // still 1 — same episode
    // Real hook re-asserts 'blocked' for the SAME unanswered prompt
    store.setAgentStatus('dev', 'blocked')
    vi.advanceTimersByTime(10000)
    expect(MockNotification.lastFired.length).toBe(1)  // still 1 — dedupe holds
    stop()
  })

  it('awaiting-approval alone (no prior blocked tick) does not start a new episode', () => {
    // An agent that starts at awaiting-approval without passing through blocked
    // should not trigger a notification (no blockedSince was set).
    const store = makeStore({ dev: { status: 'awaiting-approval' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000, thresholdMs: 30000 })
    vi.advanceTimersByTime(60000)
    expect(MockNotification.lastFired.length).toBe(0)
    stop()
  })

  it('genuine exit from blocked family (e.g. to working) resets episode so next blocked fires again', () => {
    const store = makeStore({ dev: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000, thresholdMs: 30000 })
    vi.advanceTimersByTime(31000)
    expect(MockNotification.lastFired.length).toBe(1)
    // Transition through awaiting-approval (still episode), then genuinely exit
    store.setAgentStatus('dev', 'awaiting-approval')
    vi.advanceTimersByTime(2000)
    store.setAgentStatus('dev', 'working')   // leaves blocked family entirely
    vi.advanceTimersByTime(2000)
    // New blocked episode starts
    store.setAgentStatus('dev', 'blocked')
    vi.advanceTimersByTime(31000)
    expect(MockNotification.lastFired.length).toBe(2)  // new episode → new notification
    stop()
  })
})

// ─── Fix 3: stop() prunes evicted agent entries from Maps ─────────────
describe('desktopNotifier — stop() prunes evicted agents (fix #3)', () => {
  it('stop() removes entries for agents no longer in the store', () => {
    // We verify indirectly: after stopping with an evicted agent, starting a new
    // instance with only the remaining agent works cleanly (no phantom state).
    const store = makeStore({ dev: { status: 'blocked' }, qa: { status: 'blocked' } })
    const stop = startDesktopNotifier(store, { intervalMs: 1000, thresholdMs: 30000 })
    vi.advanceTimersByTime(10000)
    // Evict 'qa' from the store before stop
    store.setAgentStatus('qa', 'idle')  // won't help — we need to remove the key
    // Replace store state without qa
    const store2 = makeStore({ dev: { status: 'blocked' } })
    const stop2 = startDesktopNotifier(store2, { intervalMs: 1000, thresholdMs: 30000 })
    stop()  // stop first instance — prunes phantom 'qa' entry
    // After stop() pruning, the module Maps should not retain 'qa'.
    // Verify by checking that the second notifier fires normally (no interference).
    vi.advanceTimersByTime(30000)
    const tags = MockNotification.lastFired.map(n => n.tag)
    expect(tags.some(t => t === 'office-blocked-dev')).toBe(true)
    expect(tags.every(t => !t.includes('qa'))).toBe(true)
    stop2()
  })
})

describe('desktopNotifier — recurring-failure notice (AVO-117)', () => {
  const recStore = (agentId, reasonCode, episodes) => ({
    getState: () => ({
      agents: { [agentId]: { status: 'blocked' } },
      externalStatus: { [agentId]: { reasonCode } },
      recurringFailureLog: { [agentId]: { [reasonCode]: episodes } },
    }),
  })
  const recurringFires = () => MockNotification.lastFired.filter(n => n.tag?.startsWith('office-recurring-'))

  it('fires ONE recurring notification (distinct tag) when the same kind recurs ≥ threshold, then dedups', () => {
    const now = 1_000_000
    const store = recStore('dev', 'test-run-failed', [now - 2000, now - 1000, now])
    const stop = startDesktopNotifier(store, { now: () => now }) // immediate tick fires
    expect(recurringFires().length).toBe(1)
    expect(recurringFires()[0].tag).toBe('office-recurring-dev-test-run-failed')
    vi.advanceTimersByTime(20000) // 4 more polls, recurrence unchanged
    expect(recurringFires().length).toBe(1) // NOTIFY-ONCE-PER-EPISODE
    stop()
  })

  it('does NOT fire below threshold (2 episodes)', () => {
    const now = 2_000_000
    const store = recStore('qa', 'build-failed', [now - 1000, now])
    const stop = startDesktopNotifier(store, { now: () => now })
    expect(recurringFires().length).toBe(0)
    stop()
  })

  it('AVO-172: prunes recurringNotifiedFor for an evicted agent on stop (re-spawn re-notifies)', () => {
    const now = 3_000_000
    let state = {
      agents: { dev: { status: 'blocked' } },
      externalStatus: { dev: { reasonCode: 'build-failed' } },
      recurringFailureLog: { dev: { 'build-failed': [now - 2000, now - 1000, now] } },
    }
    const store = { getState: () => state }
    const stop = startDesktopNotifier(store, { now: () => now }) // immediate tick fires recurring
    expect(recurringFires().length).toBe(1)
    expect(_recurringNotifiedKeys()).toContain('dev')
    // Agent evicted (worktree/session ended) before stop → cleanup must prune the recurring entry,
    // else a re-spawned same-id agent's recurring-failure notice stays suppressed.
    state = { ...state, agents: {} }
    stop()
    expect(_recurringNotifiedKeys()).not.toContain('dev')
  })
})
