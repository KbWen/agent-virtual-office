import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// 2026-09-19 review, REV-08 — relative-time labels ("3m", "waiting · 3m", "1m ago") are computed at
// render, and their components re-render only on store changes. When nothing changes — every agent
// waiting on the human is exactly that case — the labels froze. The review found the roster; the
// inspector's AVO-169 waiting duration and the floating ActivityFeed (labels + the <30s unread badge)
// froze the same way. Each now owns a 10s local tick (useNowTick) and derives every relative time in a
// render from the single `now` the hook returns. Spec: docs/specs/review-2026-09-19-remediation.md

const T0 = Date.UTC(2026, 8, 19, 12, 0, 0)

// ── Controlled clock: the hook is mocked so a test decides what "now" is for a render ──
let mockNow = T0
const useNowTickSpy = vi.fn(() => mockNow)
vi.mock('../src/utils/useNowTick.js', async (importOriginal) => {
  const real = await importOriginal()
  return { ...real, useNowTick: (...args) => useNowTickSpy(...args) }
})

// ── Controlled store: selectors and getState() both read `fakeState` (see panelOverlayBounds) ──
let fakeState = null
vi.mock('../src/systems/store', async (importOriginal) => {
  const real = await importOriginal()
  const useOfficeStore = (selector) => selector(fakeState)
  useOfficeStore.getState = () => fakeState
  useOfficeStore.setState = () => {}
  useOfficeStore.subscribe = () => () => {}
  return { ...real, useOfficeStore, __realStore: real.useOfficeStore }
})

const storeModule = await import('../src/systems/store')
const { startTicker, NOW_TICK_MS } = await vi.importActual('../src/utils/useNowTick.js')
const { formatTimeAgo } = await import('../src/utils/formatTime.js')
const { stateDurationLabel } = await import('../src/components/agentInspectorModel.js')
const { default: NarrowRoster } = await import('../src/components/NarrowRoster.jsx')
const { default: AgentInspector } = await import('../src/components/AgentInspector.jsx')
const { default: ActivityFeed } = await import('../src/components/ActivityFeed.jsx')

function baseState(overrides = {}) {
  const real = storeModule.__realStore.getState()
  return { ...real, externalStatus: {}, eventFeed: [], activityLog: [], rosterMode: false, ...overrides }
}

beforeEach(() => {
  mockNow = T0
  useNowTickSpy.mockClear()
  // A system clock deliberately FAR from the ticked `now`: any label still reading Date.now()
  // instead of the hook's value shows up as a wrong number.
  vi.useFakeTimers()
  vi.setSystemTime(T0 + 6 * 3600_000)
})
afterEach(() => { vi.useRealTimers() })

describe('startTicker — the clock behind useNowTick', () => {
  it('ticks every interval while running and stops on cleanup', () => {
    const onTick = vi.fn()
    const stop = startTicker(onTick, NOW_TICK_MS)
    vi.advanceTimersByTime(NOW_TICK_MS * 3)
    expect(onTick).toHaveBeenCalledTimes(3)
    stop()
    vi.advanceTimersByTime(NOW_TICK_MS * 5)
    expect(onTick).toHaveBeenCalledTimes(3)
  })

  it('the tick is 10s — the same floor the roster already uses before it shows a time', () => {
    expect(NOW_TICK_MS).toBe(10_000)
  })
})

describe('formatTimeAgo / stateDurationLabel honour an explicit now', () => {
  it('formatTimeAgo labels against the given now, and defaults to the system clock', () => {
    expect(formatTimeAgo(T0, { compact: true, now: T0 + 90_000 })).toBe('1m')
    expect(formatTimeAgo(T0, { compact: true })).toBe('6h') // default path unchanged
  })

  it('stateDurationLabel uses `now` for the label as well as for the 30s threshold', () => {
    // Before: the threshold read `now` but the label read Date.now() — two clocks in one label.
    expect(stateDurationLabel('awaiting-approval', T0, T0 + 120_000)).toBe('2m')
  })
})

describe('NarrowRoster — "since" advances with the tick, not with store churn', () => {
  const state = () => baseState({
    rosterMode: true,
    externalStatus: { dev: { status: 'awaiting-approval', changedAt: T0, expiresAt: T0 + 3600_000 } },
    eventFeed: [{ id: 'e1', type: 'status', agentId: 'dev', status: 'awaiting-approval', timestamp: T0 }],
  })

  it('same store, now +60s → +120s: the row label and the feed label both move', () => {
    fakeState = state()
    mockNow = T0 + 60_000
    const at60 = renderToStaticMarkup(<NarrowRoster />)
    mockNow = T0 + 120_000
    const at120 = renderToStaticMarkup(<NarrowRoster />)
    expect(at60).toMatch(/tabular-nums">1m</)
    expect(at120).toMatch(/tabular-nums">2m</)
    expect(at120).not.toMatch(/tabular-nums">1m</)
  })

  it('subscribes to the 10s tick while mounted', () => {
    fakeState = state()
    renderToStaticMarkup(<NarrowRoster />)
    expect(useNowTickSpy).toHaveBeenCalledWith(NOW_TICK_MS, true)
  })
})

describe('AgentInspector — the AVO-169 waiting duration advances while open', () => {
  const state = (selectedAgent) => {
    const base = baseState()
    return {
      ...base,
      selectedAgent,
      agents: { ...base.agents, dev: { ...base.agents.dev, status: 'awaiting-approval', position: { x: 340, y: 364 }, isMoving: false } },
      externalStatus: { dev: { status: 'awaiting-approval', changedAt: T0 } },
    }
  }

  it('same store, now +60s → +180s: "· 1m" becomes "· 3m"', () => {
    fakeState = state('dev')
    mockNow = T0 + 60_000
    expect(renderToStaticMarkup(<AgentInspector />)).toContain(' · 1m')
    mockNow = T0 + 180_000
    expect(renderToStaticMarkup(<AgentInspector />)).toContain(' · 3m')
  })

  it('ticks only while an agent is selected', () => {
    fakeState = state('dev')
    renderToStaticMarkup(<AgentInspector />)
    expect(useNowTickSpy).toHaveBeenLastCalledWith(NOW_TICK_MS, true)
    fakeState = state(null)
    renderToStaticMarkup(<AgentInspector />)
    expect(useNowTickSpy).toHaveBeenLastCalledWith(NOW_TICK_MS, false)
  })
})

describe('ActivityFeed — the unread badge and "ago" labels follow the tick', () => {
  const entry = { id: 'e1', type: 'status', agentId: 'dev', status: 'done', timestamp: T0 - 5_000 }

  it('an entry counts as unread under 30s and stops counting once it is 30s old — with no store change', () => {
    fakeState = baseState({ eventFeed: [entry] })
    mockNow = T0
    expect(renderToStaticMarkup(<ActivityFeed />)).toMatch(/bg-blue-500[^>]*>1</)
    mockNow = T0 + 25_000 // entry is now 30s old
    expect(renderToStaticMarkup(<ActivityFeed />)).not.toMatch(/bg-blue-500[^>]*>1</)
  })

  it('ticks only while it renders: not in panel mode, not in roster mode', () => {
    fakeState = baseState({ eventFeed: [entry] })
    renderToStaticMarkup(<ActivityFeed />)
    expect(useNowTickSpy).toHaveBeenLastCalledWith(NOW_TICK_MS, true)
    renderToStaticMarkup(<ActivityFeed mode="panel" />)
    expect(useNowTickSpy).toHaveBeenLastCalledWith(NOW_TICK_MS, false)
    fakeState = baseState({ eventFeed: [entry], rosterMode: true })
    renderToStaticMarkup(<ActivityFeed />)
    expect(useNowTickSpy).toHaveBeenLastCalledWith(NOW_TICK_MS, false)
  })
})
