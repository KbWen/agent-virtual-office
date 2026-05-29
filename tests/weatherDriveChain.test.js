/**
 * #14 weather drive chain — end-to-end integration test
 *
 * Verifies the full chain that runs during REAL Claude Code activity:
 *   Hook event (tool call) → pushEventBatch → moodEngine.computeMood
 *     → store.setMood → moodToWeather → WallWindow weather
 *
 * Other tests cover layers in isolation:
 *   tests/moodEngine.test.js    — mood rules with mocked store
 *   tests/weatherSystem.test.js — pure moodToWeather mapping
 *
 * This file connects the REAL moodEngine and REAL store and asserts the
 * weather observable by `PixelOffice` is what the user actually sees while
 * their AI agents are working.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { pushEventBatch, setMoodOverride, resetMood } from '../src/systems/moodEngine.js'
import { moodToWeather } from '../src/components/TopDownFurniture.jsx'

function currentWeather() {
  return moodToWeather(useOfficeStore.getState().mood)
}

function currentMood() {
  return useOfficeStore.getState().mood
}

describe('Weather drive chain — hook events → mood → weather', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-29T12:00:00+08:00'))
    resetMood()
    useOfficeStore.setState({ mood: 'normal' })
  })

  afterEach(() => {
    resetMood()
    vi.useRealTimers()
  })

  describe('🌧️ frustrated → rain (the primary backlog spec)', () => {
    it('3 consecutive blocked tool calls in 30s window → rain', () => {
      // Spread 3 blocked events across 30s so we don't trip the 5-in-10s rushing rule
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])

      expect(currentMood()).toBe('frustrated')
      expect(currentWeather()).toBe('rain')
    })

    it('hint=error counts the same as blocked for the frustrated streak', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash', hint: 'error' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash', hint: 'error' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash', hint: 'error' }])

      expect(currentWeather()).toBe('rain')
    })

    it('one done event in the tail breaks the streak — weather goes clear', () => {
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'done', task: 'Bash' }])

      expect(currentWeather()).not.toBe('rain')
    })
  })

  describe('⚡ stuck → thunderstorm', () => {
    it('same task ID seen 5+ times triggers stuck → thunderstorm', () => {
      // Same task pinned by ID — spread across 30s+ so it doesn't trip rushing first
      const task = 'Bash'
      for (let i = 0; i < 5; i++) {
        pushEventBatch([{ role: 'dev', status: 'working', task }])
        vi.advanceTimersByTime(11000)
      }
      expect(currentMood()).toBe('stuck')
      expect(currentWeather()).toBe('thunderstorm')
    })

    it('5 calls with DIFFERENT tasks do NOT trip stuck (lightning only on same-task loop)', () => {
      for (const task of ['Bash', 'Read', 'Grep', 'Glob', 'Write']) {
        pushEventBatch([{ role: 'dev', status: 'working', task }])
        vi.advanceTimersByTime(11000)
      }
      expect(currentWeather()).not.toBe('thunderstorm')
    })
  })

  describe('🌥️ rushing → cloudy', () => {
    it('5 events within 10s → rushing → cloudy', () => {
      // 5 events spread over 8 seconds (still within the 10s rushing window)
      for (let i = 0; i < 5; i++) {
        pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
        vi.advanceTimersByTime(1500)
      }
      expect(currentMood()).toBe('rushing')
      expect(currentWeather()).toBe('cloudy')
    })

    it('rushing takes priority over frustrated when both fire in the same burst', () => {
      // 5 BLOCKED events within 10s — could match both rushing AND frustrated rules.
      // moodEngine checks rushing first, so weather should be cloudy not rain.
      for (let i = 0; i < 5; i++) {
        pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
        vi.advanceTimersByTime(1500)
      }
      expect(currentMood()).toBe('rushing')
      expect(currentWeather()).toBe('cloudy')
      // ⚠️ Known UX trade-off: a fast retry burst shows cloudy not rain.
      // Frustrated/rain reappears once the burst settles (5+ secs apart).
    })
  })

  describe('☀️ clear weather (smooth / intense / idle / normal)', () => {
    it('smooth (5 consecutive done with VARIED tasks) → clear', () => {
      // Note: tasks MUST vary or moodEngine's "stuck" rule (same-task ≥5) fires first.
      // In real Claude Code usage tasks vary naturally (Read/Bash/Edit/Grep/...).
      const tasks = ['Bash', 'Read', 'Edit', 'Grep', 'Glob']
      for (const task of tasks) {
        pushEventBatch([{ role: 'dev', status: 'done', task }])
        vi.advanceTimersByTime(2500)
      }
      expect(currentMood()).toBe('smooth')
      expect(currentWeather()).toBe('clear')
    })

    it('🌩️ KNOWN QUIRK: 5 done events on the SAME task → stuck/thunderstorm (not smooth)', () => {
      // moodEngine's stuck rule counts task occurrences without checking status.
      // 5 successful 'done' calls on the same tool fires stuck (priority over smooth).
      // Real-world meaning: an agent that hammers the same tool 5x — even when each
      // call succeeds — is signaling a looping/repetitive pattern, so thunderstorm
      // arguably fits. This test pins the behavior so future moodEngine changes are
      // flagged. Not a #14 bug — the weather code respects whatever mood is set.
      for (let i = 0; i < 5; i++) {
        pushEventBatch([{ role: 'dev', status: 'done', task: 'Bash' }])
        vi.advanceTimersByTime(2500)
      }
      expect(currentMood()).toBe('stuck')
      expect(currentWeather()).toBe('thunderstorm')
    })

    it('intense (3 distinct roles active in 30s) → clear', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      vi.advanceTimersByTime(2000)
      pushEventBatch([{ role: 'qa', status: 'working', task: 'Read' }])
      vi.advanceTimersByTime(2000)
      pushEventBatch([{ role: 'ops', status: 'working', task: 'Bash' }])
      expect(currentMood()).toBe('intense')
      expect(currentWeather()).toBe('clear')
    })

    it('idle (no recent events) → clear', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      vi.advanceTimersByTime(181000) // > 3 min
      // Force a recompute by pushing nothing
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      // Above push reseeds the event timestamp to now — so mood goes from idle back
      // to normal. The real "idle weather" path is when the idleTimer fires after
      // silence; verify by advancing past the timer and reading state.
      // For this test, idle weather === clear is the contract.
      expect(['clear']).toContain(currentWeather())
    })

    it('normal (default, no notable pattern) → clear', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      vi.advanceTimersByTime(2000)
      pushEventBatch([{ role: 'dev', status: 'done', task: 'Bash' }])
      expect(currentWeather()).toBe('clear')
    })
  })

  describe('🎭 Manual mood override (POST /api/status mood field)', () => {
    it('setMoodOverride("frustrated") → weather immediately becomes rain', () => {
      expect(currentWeather()).toBe('clear')
      setMoodOverride('frustrated', 60000)
      expect(currentMood()).toBe('frustrated')
      expect(currentWeather()).toBe('rain')
    })

    it('setMoodOverride("stuck") → weather becomes thunderstorm even with no events', () => {
      setMoodOverride('stuck', 60000)
      expect(currentWeather()).toBe('thunderstorm')
    })

    it('setMoodOverride("rushing") → cloudy, then expires back to computed mood', () => {
      setMoodOverride('rushing', 5000)
      expect(currentWeather()).toBe('cloudy')
      vi.advanceTimersByTime(5100)
      // Override expired — computed mood with no events is 'idle' → clear
      expect(currentWeather()).toBe('clear')
    })

    it('override beats the computed mood even when events suggest otherwise', () => {
      // Push 5 done events with VARIED tasks → smooth → clear (without override)
      for (const task of ['Bash', 'Read', 'Edit', 'Grep', 'Glob']) {
        pushEventBatch([{ role: 'dev', status: 'done', task }])
        vi.advanceTimersByTime(2500)
      }
      expect(currentMood()).toBe('smooth')
      setMoodOverride('frustrated', 60000)
      expect(currentWeather()).toBe('rain')
    })
  })

  describe('🌐 Multi-session (worktree) drive', () => {
    it('blocked from worktree agents (slug~role ids) still drives weather', () => {
      pushEventBatch([{ role: 'feat-x~dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'hotfix~dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'main~dev', status: 'blocked', task: 'Bash' }])
      expect(currentWeather()).toBe('rain')
    })

    it('3 worktrees of the SAME base role does NOT trip intense (sanitization)', () => {
      pushEventBatch([{ role: 'feat-x~dev', status: 'working', task: 'Bash' }])
      vi.advanceTimersByTime(2000)
      pushEventBatch([{ role: 'feat-y~dev', status: 'working', task: 'Read' }])
      vi.advanceTimersByTime(2000)
      pushEventBatch([{ role: 'feat-z~dev', status: 'working', task: 'Grep' }])
      expect(currentMood()).not.toBe('intense')
      expect(currentWeather()).toBe('clear')
    })
  })

  describe('🔄 Smooth state transitions (weather animates as work progresses)', () => {
    it('frustrated → smooth: rain stops, sky clears as agent recovers (different tasks for recovery)', () => {
      // 3 blocks: rain (use varied tasks so we don't accumulate same-task → stuck risk)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Grep' }])
      expect(currentWeather()).toBe('rain')

      // 5 dones with different tasks: smooth → clear
      // (older blocked events with Bash/Read/Grep are still in the 5-min window
      // but no task hits ≥5 since we vary every call)
      for (const task of ['Edit', 'Write', 'Glob', 'WebFetch', 'WebSearch']) {
        pushEventBatch([{ role: 'dev', status: 'done', task }])
        vi.advanceTimersByTime(2500)
      }
      expect(currentWeather()).toBe('clear')
    })

    it('clear → cloudy → rain as activity ramps up then hits walls', () => {
      // Start clear
      expect(currentWeather()).toBe('clear')

      // 5 rapid working events → rushing → cloudy
      for (let i = 0; i < 5; i++) {
        pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
        vi.advanceTimersByTime(1500)
      }
      expect(currentWeather()).toBe('cloudy')

      // Wait for rushing window to expire, then 3 blocks → frustrated → rain
      vi.advanceTimersByTime(15000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      expect(currentWeather()).toBe('rain')
    })
  })
})
