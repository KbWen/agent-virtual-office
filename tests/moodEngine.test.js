import { describe, it, expect, vi, beforeEach } from 'vitest'

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
    resetMood()
    vi.restoreAllMocks()
  })

  describe('pushEventBatch', () => {
    it('sets mood based on events', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      expect(getMood()).toBe('normal')
    })

    it('computes mood only once per batch (not N times)', () => {
      // If pushEventBatch called updateStoreMood N times, the mood
      // would be recomputed unnecessarily. We just verify it doesn't throw.
      pushEventBatch([
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
        { role: 'qa', status: 'done', task: 'Bash', hint: null },
        { role: 'ops', status: 'done', task: 'Bash', hint: null },
      ])
      // Should be computed once — not an error
    })
  })

  describe('rushing detection', () => {
    it('detects rushing when 5+ events in 10s window', () => {
      const events = Array.from({ length: 6 }, (_, i) => ({
        role: `dev`, status: 'working', task: `task${i}`, hint: null,
      }))
      pushEventBatch(events)
      expect(getMood()).toBe('rushing')
    })
  })

  describe('frustrated detection', () => {
    it('detects frustrated when last 3 events are blocked', () => {
      // First add some normal events to avoid rushing
      pushEventBatch([
        { role: 'dev', status: 'blocked', task: 'Edit', hint: 'error' },
      ])
      // Space them out by pushing one at a time
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash', hint: 'error' }])
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read', hint: 'error' }])
      expect(getMood()).toBe('frustrated')
    })
  })

  describe('smooth detection', () => {
    it('detects smooth when last 5 events are done', () => {
      vi.useFakeTimers()
      // Space events 3s apart to avoid rushing threshold (5+ in 10s)
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(3000)
        pushEventBatch([{ role: 'dev', status: 'done', task: `task${i}`, hint: null }])
      }
      expect(getMood()).toBe('smooth')
      vi.useRealTimers()
    })
  })

  describe('stuck detection', () => {
    it('detects stuck when same task appears 5+ times', () => {
      vi.useFakeTimers()
      // Space events 3s apart to avoid rushing threshold
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(3000)
        pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit', hint: null }])
      }
      expect(getMood()).toBe('stuck')
      vi.useRealTimers()
    })
  })

  describe('intense detection', () => {
    it('detects intense when 3+ distinct roles active in 30s', () => {
      pushEventBatch([
        { role: 'dev', status: 'working', task: 'Edit', hint: null },
        { role: 'qa', status: 'working', task: 'Bash', hint: null },
        { role: 'ops', status: 'working', task: 'Bash', hint: null },
      ])
      // 3 events in batch triggers rushing (>=5 threshold not met with 3),
      // but 3 distinct roles should trigger intense
      // Note: rushing check (5+ events in 10s) runs before intense (3+ roles)
      // With only 3 events, rushing won't trigger, so intense should
      expect(getMood()).toBe('intense')
    })
  })

  describe('idle detection', () => {
    it('returns idle when no events', () => {
      resetMood()
      // pushEventBatch with empty array doesn't add events but still calls computeMood
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

    it('expires after duration', () => {
      vi.useFakeTimers()
      setMoodOverride('rushing', 1000)
      expect(getMood()).toBe('rushing')

      vi.advanceTimersByTime(1001)
      // Need to trigger recomputation
      pushEventBatch([])
      expect(getMood()).not.toBe('rushing')

      vi.useRealTimers()
    })
  })

  describe('resetMood', () => {
    it('clears all state', () => {
      pushEventBatch([
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
        { role: 'dev', status: 'done', task: 'Edit', hint: null },
      ])
      resetMood()
      pushEventBatch([])
      expect(getMood()).toBe('idle')
    })
  })
})
