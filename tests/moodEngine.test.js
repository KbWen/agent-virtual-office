import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

    it('expires after duration (pushEventBatch also triggers recompute)', () => {
      setMoodOverride('rushing', 1000)
      expect(getMood()).toBe('rushing')
      vi.advanceTimersByTime(1001)
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
      pushEventBatch([])
      expect(getMood()).toBe('idle')
    })
  })
})
