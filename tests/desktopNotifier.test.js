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
