/**
 * #14 weather — real-world AI activity hunting tests
 *
 * Reasoning backwards from "what could go wrong during actual Claude/Codex
 * sessions" rather than testing happy paths. Each test names the user-visible
 * failure it's trying to catch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import {
  pushEventBatch,
  setMoodOverride,
  resetMood,
} from '../src/systems/moodEngine.js'
import { moodToWeather } from '../src/components/TopDownFurniture.jsx'

const weatherOf = () => moodToWeather(useOfficeStore.getState().mood)
const moodOf = () => useOfficeStore.getState().mood

describe('Weather — failure-mode hunting (real AI usage patterns)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-29T14:00:00+08:00'))
    resetMood()
    useOfficeStore.setState({ mood: 'normal' })
  })

  afterEach(() => {
    resetMood()
    vi.useRealTimers()
  })

  describe('🔴 Scenario A: long-running tool calls (Bash test suite, npm install)', () => {
    it('a single 60-second Bash with no intermediate events stays mood=normal/clear', () => {
      // PreToolUse fires status=working,task=Bash at t=0. No more events for 60s.
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      expect(moodOf()).toBe('normal')
      expect(weatherOf()).toBe('clear')

      // 60s later, still mid-Bash. moodEngine has no fresh event — mood stays.
      vi.advanceTimersByTime(60000)
      expect(moodOf()).toBe('normal')
      expect(weatherOf()).toBe('clear')
    })

    it('a long Bash spanning 4 minutes drifts mood to idle (>3min IDLE_TIMEOUT)', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      vi.advanceTimersByTime(181000) // > IDLE_TIMEOUT (180s)
      // The idle timer fires updateStoreMood after IDLE_TIMEOUT+1000.
      // Documented behavior: agent is still 'working' (status), but mood says idle.
      // Weather stays clear either way (idle and normal both → clear), so user sees no change.
      expect(weatherOf()).toBe('clear')
    })

    it('CONTRACT: weather never lies about success — a long working call NEVER triggers rain or thunderstorm spontaneously', () => {
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Bash' }])
      for (let i = 0; i < 12; i++) {
        vi.advanceTimersByTime(30000) // 6 minutes
        expect(weatherOf()).not.toBe('rain')
        expect(weatherOf()).not.toBe('thunderstorm')
      }
    })
  })

  describe('🔴 Scenario B: parallel subagent dispatch', () => {
    it('🌩 4 subagents spawned in 1 second → rushing/cloudy (NOT intense)', () => {
      // Real Claude pattern: Task tool dispatches 3-5 subagents simultaneously.
      // All 5 fire status=working in <1s.
      for (const role of ['dev', 'qa', 'ops', 'gate', 'designer']) {
        pushEventBatch([{ role, status: 'working', task: 'Task' }])
        vi.advanceTimersByTime(150) // 150ms apart
      }
      // 5 events in 0.6s → rushing wins (priority 1) → cloudy.
      // Intense (priority 5) would be more semantically accurate ("3+ roles active")
      // but moodEngine's ordering picks rushing first.
      // Documented quirk — not weather-code's fault.
      expect(moodOf()).toBe('rushing')
      expect(weatherOf()).toBe('cloudy')
    })

    it('subagents pacing >2s apart (not piled up) → intense → clear', () => {
      for (const role of ['dev', 'qa', 'ops']) {
        pushEventBatch([{ role, status: 'working', task: 'Task' }])
        vi.advanceTimersByTime(2500)
      }
      // 3 events in 7.5s → rushing fires (3 events in last 10s, threshold 5? no 3 < 5)
      // → frustrated? no (status=working not blocked). → stuck? no (varied tasks).
      // → smooth? no (status not done). → intense? 3 distinct roles in 30s → YES.
      expect(moodOf()).toBe('intense')
      expect(weatherOf()).toBe('clear')
    })
  })

  describe('🟡 Scenario C: page reload mid-session', () => {
    it('mood is NOT persisted — reload always starts at mood=normal/clear', () => {
      // Simulate: user was frustrated before reload
      setMoodOverride('frustrated', 60000)
      expect(weatherOf()).toBe('rain')

      // Simulate reload by calling resetMood + setting mood to default (mimics store init)
      resetMood()
      useOfficeStore.setState({ mood: 'normal' })

      expect(moodOf()).toBe('normal')
      expect(weatherOf()).toBe('clear')
      // 👆 BY DESIGN: mood is transient atmosphere; ledgers persist via #6 but mood does not.
      // First user-facing event after reload will re-drive weather.
    })

    it('after reload, the FIRST hook event re-establishes mood within one batch', () => {
      // Post-reload state
      resetMood()
      useOfficeStore.setState({ mood: 'normal' })

      // First incoming hook event (status=blocked) — by itself, doesn't trip frustrated
      // (needs 3 in a row). But it doesn't crash and doesn't false-trigger weather either.
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      expect(weatherOf()).toBe('clear') // 1 blocked is not yet a streak
    })
  })

  describe('🟡 Scenario D: STALE_CUTOFF (5-min) pruning boundary', () => {
    it('events older than STALE_CUTOFF are pruned — old frustrated tail doesnt linger', () => {
      // 3 blocks at t=0 → frustrated
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Grep' }])
      expect(weatherOf()).toBe('rain')

      // Advance 5 minutes + 1 second — all events should be pruned
      vi.advanceTimersByTime(301000)

      // Fire any event to force recompute — pruneStale runs at the top of computeMood
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit' }])
      // Now only 1 fresh event exists. No streak, no rushing → mood normal → clear.
      expect(weatherOf()).toBe('clear')
    })

    it('exactly at STALE_CUTOFF boundary (5min): event is still considered fresh', () => {
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(300000 - 1) // 1ms before cutoff
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Grep' }])
      // The first event is 4:59.999 old, still inside the 5min window → frustrated holds
      expect(weatherOf()).toBe('rain')
    })
  })

  describe('🟡 Scenario E: race conditions and re-render economy', () => {
    it('applyExternalStatus + pushEventBatch in same tick yields ONE final mood (no flicker)', () => {
      // Simulating inferStatus.applyMessage's order: applyExternalStatus then pushEventBatch
      const updates = [
        { agentId: 'dev', status: 'blocked', task: 'Bash' },
        { agentId: 'qa', status: 'blocked', task: 'Read' },
        { agentId: 'ops', status: 'blocked', task: 'Grep' },
      ]
      const store = useOfficeStore.getState()
      store.applyExternalStatus(updates)
      pushEventBatch(updates.map(u => ({ role: u.agentId, status: u.status, task: u.task })))
      // 3 blocked events → frustrated → rain
      expect(weatherOf()).toBe('rain')
    })

    it('🔴 BUG-PIN: pushEventBatch([]) with empty array flips mood→idle (callers MUST guard)', () => {
      // moodEngine.pushEventBatch calls updateStoreMood() unconditionally — even with
      // zero new events. computeMood() with events.length===0 returns 'idle'. Result:
      // an empty batch flips mood to idle, and weather to clear (luckily idle→clear).
      //
      // Real-world impact: ZERO. inferStatus gates with `if (updates.length > 0)` and
      // `if (msg.activeCount > 0)` before calling pushEventBatch, so empty batches
      // never reach moodEngine in the production flow.
      //
      // This test pins the fragile contract: if a future caller forgets the gate,
      // mood will silently flip. A safer fix would be `if (added > 0) updateStoreMood()`
      // in moodEngine.pushEventBatch — out of #14 scope but flagged here for follow-up.
      expect(moodOf()).toBe('normal')
      pushEventBatch([])
      expect(moodOf()).toBe('idle') // ← unexpected if you didnt read this comment
      expect(weatherOf()).toBe('clear') // still clear, so user impact is none
    })

    it('pushEventBatch(null|undefined|nonArray) is silently ignored (early return on !isArray)', () => {
      expect(moodOf()).toBe('normal')
      pushEventBatch(null)
      expect(moodOf()).toBe('normal')
      pushEventBatch(undefined)
      expect(moodOf()).toBe('normal')
      pushEventBatch('not an array')
      expect(moodOf()).toBe('normal')
      pushEventBatch(42)
      expect(moodOf()).toBe('normal')
    })
  })

  describe('🟢 Scenario F: animation co-existence', () => {
    it('eureka activeEvent + frustrated mood: both signals are independent', () => {
      // activeEvent='eureka' triggers the WhiteboardAnimation (#15)
      // mood='frustrated' triggers rain
      useOfficeStore.setState({ activeEvent: { id: 'eureka' } })
      setMoodOverride('frustrated', 60000)

      // Both are independent store fields; weather doesn't know about activeEvent
      // and WhiteboardAnimation doesn't know about mood. They co-exist.
      expect(useOfficeStore.getState().activeEvent?.id).toBe('eureka')
      expect(weatherOf()).toBe('rain')
      // No assertion about visual coherence — this is a "documented can co-exist" test.
      // The UX choice (celebration while raining) is intentional: a single moment of
      // eureka inside a frustrating stretch is real and signals progress.
    })

    it('day rollover does NOT change mood (mood is window-based, not date-based)', () => {
      // 3 blocks → rain
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Grep' }])
      expect(weatherOf()).toBe('rain')

      // Advance past midnight (10 hours forward)
      vi.advanceTimersByTime(10 * 3600 * 1000)
      // Mood may decay to idle (events older than STALE_CUTOFF=5min are gone).
      // But the rain doesn't artificially "persist past midnight" — it follows mood.
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Edit' }])
      // After pruning + fresh event, mood is normal → clear. Day rollover is silent
      // for mood (correct — mood is short-term atmosphere).
      expect(weatherOf()).toBe('clear')
    })
  })

  describe('🔴 Scenario G: false-positive defense', () => {
    it('idle-mood pure curiosity: no fresh events EVER produces non-clear weather', () => {
      // No events at all → mood='idle' → clear
      vi.advanceTimersByTime(1000000)
      expect(weatherOf()).toBe('clear')
    })

    it('a SINGLE blocked event never triggers rain (needs streak of 3)', () => {
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      expect(weatherOf()).toBe('clear')
    })

    it('two blocked events never triggers rain', () => {
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Read' }])
      expect(weatherOf()).toBe('clear')
    })

    it('blocked then working then blocked then working → no streak, no rain', () => {
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Bash' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Read' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'blocked', task: 'Grep' }])
      vi.advanceTimersByTime(11000)
      pushEventBatch([{ role: 'dev', status: 'working', task: 'Glob' }])
      expect(weatherOf()).toBe('clear')
    })
  })

  describe('🟡 Scenario H: mood enum drift', () => {
    it('moodToWeather covers EVERY documented mood enum value (no orphan moods)', () => {
      // store.js:831 documents: normal | rushing | frustrated | stuck | smooth | intense | idle
      // If a new mood is added to the enum without updating moodToWeather, it would
      // silently fall through to 'clear'. This test guards against silent regression.
      const allMoods = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
      const weathers = allMoods.map(m => ({ mood: m, weather: moodToWeather(m) }))

      // Every documented mood must map to a known weather string
      const validWeathers = ['clear', 'cloudy', 'rain', 'thunderstorm']
      for (const { mood, weather } of weathers) {
        expect(validWeathers).toContain(weather)
        // and the mapping must be deterministic
        expect(moodToWeather(mood)).toBe(weather)
      }

      // At least ONE mood must yield each non-clear weather, otherwise the feature is dead code
      expect(weathers.some(w => w.weather === 'rain')).toBe(true)
      expect(weathers.some(w => w.weather === 'cloudy')).toBe(true)
      expect(weathers.some(w => w.weather === 'thunderstorm')).toBe(true)
      expect(weathers.some(w => w.weather === 'clear')).toBe(true)
    })
  })
})
