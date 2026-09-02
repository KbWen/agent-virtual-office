import { describe, expect, it, afterEach } from 'vitest'
import { __setRng, resetRng } from '../src/systems/rng.js'
import {
  getNextBehavior, isQuietWindow, __clearRecentPicks,
  RHYTHM_PERIOD_MS, RHYTHM_QUIET_MS,
} from '../src/systems/behaviorEngine.js'

const OUT_TRIP = new Set(['daily', 'social', 'away'])

afterEach(() => { resetRng(); __clearRecentPicks() })

describe('isQuietWindow', () => {
  it('covers the quiet share of each cycle and nothing more', () => {
    expect(isQuietWindow(0)).toBe(true)
    expect(isQuietWindow(RHYTHM_QUIET_MS - 1)).toBe(true)
    expect(isQuietWindow(RHYTHM_QUIET_MS)).toBe(false)
    expect(isQuietWindow(RHYTHM_PERIOD_MS - 1)).toBe(false)
  })

  it('repeats every period', () => {
    for (const cycle of [1, 2, 17]) {
      const base = cycle * RHYTHM_PERIOD_MS
      expect(isQuietWindow(base)).toBe(true)
      expect(isQuietWindow(base + RHYTHM_QUIET_MS)).toBe(false)
    }
  })

  it('is the SAME for every agent at a given instant — a per-agent phase would just be a rate cut', () => {
    // The mechanism is a shared phase: that is what turns deferral into a burst instead of
    // spreading it. Nothing about the function may depend on who is asking.
    expect(isQuietWindow.length).toBeLessThanOrEqual(3)  // (now, period, quiet) — no agent id
  })

  it('survives junk input rather than making the office quiet forever', () => {
    expect(isQuietWindow(Number.NaN)).toBe(false)
    expect(isQuietWindow(undefined)).toBe(false)
    expect(isQuietWindow(1000, 0)).toBe(false)
    // A negative clock maps to the END of a cycle (149999), not the start — the modulo is
    // normalised so it lands in a real phase either way rather than throwing or sticking.
    expect(isQuietWindow(-1)).toBe(false)
    expect(isQuietWindow(-RHYTHM_PERIOD_MS)).toBe(true)
  })

  it('a zero-length quiet share disables it entirely', () => {
    expect(isQuietWindow(0, RHYTHM_PERIOD_MS, 0)).toBe(false)
  })
})

describe('getNextBehavior — quiet window', () => {
  // Force the weighted roll to land on an out-trip: rng()=0.999 selects the last-listed
  // category, and the pools/hour/mood blend keep away/social at the tail.
  const forceOutTrip = () => __setRng(() => 0.999)

  it('an ambient agent takes NO out-trip during the quiet phase', () => {
    forceOutTrip()
    for (let i = 0; i < 30; i++) {
      const r = getNextBehavior(`a${i}`, 'idle', 11, 'normal', 0, 0, true)
      expect(OUT_TRIP.has(r.category), `got ${r.category}`).toBe(false)
    }
  })

  it('the SAME roll does produce an out-trip outside the quiet phase — else the test proves nothing', () => {
    forceOutTrip()
    const cats = new Set()
    for (let i = 0; i < 30; i++) cats.add(getNextBehavior(`b${i}`, 'idle', 11, 'normal', 0, 0, false).category)
    expect([...cats].some((c) => OUT_TRIP.has(c)), `categories seen: ${[...cats]}`).toBe(true)
  })

  it('omitting the argument leaves behaviour exactly as before', () => {
    forceOutTrip()
    const withDefault = getNextBehavior('c', 'idle', 11, 'normal', 0, 0)
    __clearRecentPicks()
    forceOutTrip()
    const explicitFalse = getNextBehavior('c', 'idle', 11, 'normal', 0, 0, false)
    expect(withDefault).toEqual(explicitFalse)
  })

  it('never suppresses a blocked agent’s frustrated behaviour', () => {
    // Honesty: the window may keep an ambient agent at its desk; it must not mute a real state.
    forceOutTrip()
    const seen = new Set()
    for (let i = 0; i < 40; i++) seen.add(getNextBehavior(`d${i}`, 'blocked', 11, 'normal', 0, 0, true).category)
    expect(seen.has('frustrated')).toBe(true)
  })

  it('work behaviours are still produced during the quiet phase — quiet is not frozen', () => {
    forceOutTrip()
    const r = getNextBehavior('e', 'idle', 11, 'normal', 0, 0, true)
    expect(r.category).toBe('work')
    expect(typeof r.behaviorId).toBe('string')
    expect(Number.isFinite(r.duration) && r.duration > 0).toBe(true)
  })
})
