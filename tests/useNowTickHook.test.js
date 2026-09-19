import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// spec_ref: docs/specs/review-2026-09-19-remediation.md — AC-10 / AC-11 (REV-08)
//
// The suite has no DOM, so react-dom never runs an effect. The consumer tests (nowTick.test.jsx) mock
// the hook itself; this file closes the remaining gap (review round 2, L2) by running the hook's OWN
// body with React's two hooks replaced by recorders: the effect it registers is executed under fake
// timers, and the state setter it drives is observed directly.

let setTick = null
let effects = []
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    useState: (init) => {
      setTick = vi.fn()
      return [typeof init === 'function' ? init() : init, setTick]
    },
    useEffect: (fn, deps) => { effects.push({ fn, deps }) },
  }
})

const { useNowTick, NOW_TICK_MS } = await import('../src/utils/useNowTick.js')

const T0 = Date.UTC(2026, 8, 19, 12, 0, 0)

beforeEach(() => {
  effects = []
  setTick = null
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})
afterEach(() => { vi.useRealTimers() })

describe('useNowTick — the hook body itself (AC-10)', () => {
  it('enabled: registers one effect keyed on [interval, enabled] that re-renders every 10s until cleanup', () => {
    useNowTick(NOW_TICK_MS, true)
    expect(effects).toHaveLength(1)
    expect(effects[0].deps).toEqual([NOW_TICK_MS, true])

    const cleanup = effects[0].fn()
    expect(typeof cleanup).toBe('function')
    vi.advanceTimersByTime(NOW_TICK_MS * 3)
    expect(setTick).toHaveBeenCalledTimes(3)
    // Each tick is a functional update that bumps the counter (so React re-renders the caller).
    const updater = setTick.mock.calls[0][0]
    expect(updater(4)).toBe(5)

    cleanup()
    vi.advanceTimersByTime(NOW_TICK_MS * 5)
    expect(setTick).toHaveBeenCalledTimes(3) // no leak after unmount / disable
  })

  it('disabled: the effect starts no timer and never re-renders the caller', () => {
    useNowTick(NOW_TICK_MS, false)
    expect(effects[0].deps).toEqual([NOW_TICK_MS, false])
    expect(effects[0].fn()).toBeUndefined()
    vi.advanceTimersByTime(NOW_TICK_MS * 10)
    expect(setTick).not.toHaveBeenCalled()
  })

  it('returns the clock at render, not a stored tick timestamp (no stale first frame when enabled late)', () => {
    expect(useNowTick(NOW_TICK_MS, true)).toBe(T0)
    vi.setSystemTime(T0 + 3_600_000) // e.g. the inspector opened an hour after mount, no tick yet
    expect(useNowTick(NOW_TICK_MS, true)).toBe(T0 + 3_600_000)
  })

  it('defaults to the 10s tick, enabled', () => {
    useNowTick()
    expect(effects[0].deps).toEqual([10_000, true])
  })
})
