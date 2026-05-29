import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MAX_MOOD_DURATION } from '../src/systems/constants.js'

// Mock zustand store before importing moodEngine
vi.mock('../src/systems/store', () => {
  let mood = 'normal'
  return {
    useOfficeStore: {
      getState: () => ({
        mood,
        setMood: (m) => { mood = m },
      }),
    },
  }
})

const { pushEventBatch, setMoodOverride, resetMood } = await import('../src/systems/moodEngine.js')
const { useOfficeStore } = await import('../src/systems/store')

function getMood() {
  return useOfficeStore.getState().mood
}

describe('moodEngine', () => {
  beforeEach(() => {
    // Fake timers globally: prevents wall-clock dependency and timer leakage between tests.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    resetMood()
  })

  afterEach(() => {
    // Drain pending timers so they don't bleed into the next test's fake-timer queue.
    vi.runOnlyPendingTimers()
    resetMood()              // clear module state before real-timers restore
    vi.useRealTimers()
  })

  describe('pushEventBatch', () => {
    it('sets mood based on events', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      expect(getMood()).toBe('normal')
    })

    it('computes mood only once per batch — result is the expected final mood', () => {
      pushEventBatch([
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
        { role: 'qa', status: 'done', task: 'Bash', hint: null },
        { role: 'ops', status: 'done', task: 'Bash', hint: null },
      ])
      // 3 done events (3 < SMOOTH_STREAK=5, 3 < RUSHING_THRESHOLD=5) → normal
      expect(getMood()).toBe('normal')
    })

    it('does not throw on null batch or null entries', () => {
      expect(() => pushEventBatch(null)).not.toThrow()
      expect(() => pushEventBatch([null, undefined, 42])).not.toThrow()
    })

    it('empty batch does not reset idle timer (no side-effects when nothing added)', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      const moodBefore = getMood()
      pushEventBatch([])
      expect(getMood()).toBe(moodBefore) // mood unchanged by empty batch
    })
  })

  describe('rushing detection', () => {
    it('detects rushing when 5+ events in 10s window', () => {
      const events = Array.from({ length: 6 }, (_, i) => ({
        role: 'dev', status: 'working', task: `task${i}`, hint: null,
      }))
      pushEventBatch(events)
      expect(getMood()).toBe('rushing')
    })
  })

  describe('frustrated detection', () => {
    it('detects frustrated when last 3 events are blocked', () => {
      pushEventBatch([
        { role: 'dev', status: 'blocked', task: 'Edit', hint: 'error' },
        { role: 'dev', status: 'blocked', task: 'Bash', hint: 'error' },
        { role: 'dev', status: 'blocked', task: 'Read', hint: 'error' },
      ])
      expect(getMood()).toBe('frustrated')
    })
  })

  describe('smooth detection', () => {
    it('detects smooth when last 5 events are done', () => {
      // Space events 3s apart to stay below the rushing threshold (5+ events in 10s)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(3000)
        pushEventBatch([{ role: 'dev', status: 'done', task: `task${i}`, hint: null }])
      }
      expect(getMood()).toBe('smooth')
    })
  })

  describe('stuck detection', () => {
    it('detects stuck when same task appears 5+ times', () => {
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(3000)
        pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      }
      expect(getMood()).toBe('stuck')
    })
  })

  describe('intense detection', () => {
    it('detects intense when 3+ distinct roles active in 30s', () => {
      pushEventBatch([
        { role: 'dev', status: 'working', task: 'Edit', hint: null },
        { role: 'qa', status: 'working', task: 'Bash', hint: null },
        { role: 'ops', status: 'working', task: 'Bash', hint: null },
      ])
      // 3 events < RUSHING_THRESHOLD(5); 3 distinct working roles within INTENSE_WINDOW(30s) → intense
      expect(getMood()).toBe('intense')
    })

    it('R76 Fix C: composite multi-session ids of the SAME base role do NOT trip intense', () => {
      // Three worktrees all running a 'dev' agent feed composite 'slug~dev' ids.
      // Before Fix C these counted as 3 distinct roles and falsely produced 'intense'.
      // After normalization (base segment after last '~') they collapse to one role.
      pushEventBatch([
        { role: 'feat-x~dev', status: 'working', task: 'Edit', hint: null },
        { role: 'hotfix~dev', status: 'working', task: 'Bash', hint: null },
        { role: 'main~dev', status: 'working', task: 'Read', hint: null },
      ])
      expect(getMood()).toBe('normal')   // one base role → not intense
    })

    it('R76 Fix C: composite ids of 3 DISTINCT base roles still trip intense', () => {
      // The heuristic must remain consistent between single- and multi-session sources:
      // three genuinely different roles — even when carried as composites — are intense.
      pushEventBatch([
        { role: 'feat-x~dev', status: 'working', task: 'Edit', hint: null },
        { role: 'feat-x~qa', status: 'working', task: 'Bash', hint: null },
        { role: 'feat-x~ops', status: 'working', task: 'Read', hint: null },
      ])
      expect(getMood()).toBe('intense')
    })

    it('R76 Fix C: a slug containing "~" still resolves to the correct base role', () => {
      // scanAndMerge splits on the last separator; the mood engine must match — three
      // nested-slug composites of the same base role must NOT count as distinct.
      pushEventBatch([
        { role: 'a~b~dev', status: 'working', task: 'Edit', hint: null },
        { role: 'c~d~dev', status: 'working', task: 'Bash', hint: null },
        { role: 'e~f~dev', status: 'working', task: 'Read', hint: null },
      ])
      expect(getMood()).toBe('normal')
    })

    it('R76 Fix C: a bare role and a composite of the SAME base count once', () => {
      // Mixed single-session ('dev') + multi-session ('slug~dev') feed — both normalize
      // to 'dev'. With only one other distinct role this stays below the intense threshold.
      pushEventBatch([
        { role: 'dev', status: 'working', task: 'Edit', hint: null },
        { role: 'feat-x~dev', status: 'working', task: 'Bash', hint: null },
        { role: 'qa', status: 'working', task: 'Read', hint: null },
      ])
      // distinct base roles = {dev, qa} = 2 < INTENSE_ROLES(3) → normal
      expect(getMood()).toBe('normal')
    })
  })

  describe('idle detection', () => {
    it('returns idle when no events', () => {
      pushEventBatch([])
      expect(getMood()).toBe('idle')
    })
  })

  describe('setMoodOverride', () => {
    it('overrides computed mood', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      setMoodOverride('frustrated', 60000)
      expect(getMood()).toBe('frustrated')
    })

    it('rejects invalid mood — store is not updated', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      const before = getMood()
      setMoodOverride('hacked', 60000)
      expect(getMood()).toBe(before) // unchanged
    })

    it('expires after duration via overrideTimer (no manual push needed)', () => {
      setMoodOverride('rushing', 1000)
      expect(getMood()).toBe('rushing')
      // Timer fires automatically — no manual pushEventBatch needed
      vi.advanceTimersByTime(1051)
      expect(getMood()).not.toBe('rushing')
    })

    it('expires after duration (overrideTimer fires recompute)', () => {
      // Post-fix: pushEventBatch([]) is a strict no-op (defense in depth against
      // accidental mood→idle flips). The override still expires via overrideTimer
      // which fires updateStoreMood at clampedMs + 50. Advance past that for the
      // natural expiry path.
      setMoodOverride('rushing', 1000)
      expect(getMood()).toBe('rushing')
      vi.advanceTimersByTime(1100) // > 1000ms override + 50ms timer buffer
      expect(getMood()).not.toBe('rushing')
    })

    it('caps duration at MAX_MOOD_DURATION — untrusted channels cannot pin mood forever', () => {
      // postMessage / BroadcastChannel / window.__office_status__ reach setMoodOverride
      // without an upper-bound clamp; the override must still expire within MAX_MOOD_DURATION.
      setMoodOverride('rushing', 999_999_999_999)
      expect(getMood()).toBe('rushing')
      // Just past the cap → override has expired.
      vi.advanceTimersByTime(MAX_MOOD_DURATION + 100)
      pushEventBatch([])
      expect(getMood()).not.toBe('rushing')
    })

    it('does not pin mood for a non-finite duration', () => {
      // NaN/Infinity from a malformed message must fall back to a sane finite duration,
      // not poison overrideExpiry (NaN comparisons would never expire).
      setMoodOverride('rushing', NaN)
      expect(getMood()).toBe('rushing')
      vi.advanceTimersByTime(MAX_MOOD_DURATION + 100)
      pushEventBatch([])
      expect(getMood()).not.toBe('rushing')
    })
  })

  describe('resetMood', () => {
    it('clears all state', () => {
      // Push 5 done events with distinct tasks (same task would trigger stuck before smooth)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(3000)
        pushEventBatch([{ role: 'dev', status: 'done', task: `task${i}`, hint: null }])
      }
      expect(getMood()).toBe('smooth')
      resetMood()
      // Post-fix: pushEventBatch([]) is a strict no-op. Push ONE real event after
      // resetMood — the internal events buffer was cleared by resetMood so a single
      // event puts us at the 'normal' default (1 event, doesnt match any rule).
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      expect(getMood()).toBe('normal')
    })
  })
})
