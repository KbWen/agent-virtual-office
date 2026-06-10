// AVO-117 — pure recurring-detection honesty invariants.
import { describe, it, expect } from 'vitest'
import {
  recordEpisode, recurringInfo, isRecurring, isNewBlockedEpisode,
  RECURRING_REASONS, RECURRING_THRESHOLD, RECURRING_WINDOW_MS, RECURRING_EPISODE_CAP,
} from '../src/systems/recurringFailure.js'

const T0 = 1_000_000_000_000
// record N episodes for (agent, reason) at evenly-spaced times ending at `end`
function build(agent, reason, n, { end = T0, gap = 1000 } = {}) {
  let log = {}
  for (let i = n - 1; i >= 0; i--) log = recordEpisode(log, { agentId: agent, reasonCode: reason, now: end - i * gap })
  return log
}

describe('AVO-117 recurringFailure — honesty invariants', () => {
  it('THRESHOLD-FLOOR: 1 or 2 episodes → not recurring; 3rd crosses', () => {
    expect(recurringInfo(build('dev', 'test-run-failed', 1), { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 }).recurring).toBe(false)
    expect(recurringInfo(build('dev', 'test-run-failed', 2), { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 }).recurring).toBe(false)
    const r = recurringInfo(build('dev', 'test-run-failed', 3), { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 })
    expect(r.recurring).toBe(true)
    expect(r.count).toBe(3)
  })

  it('SPECIFIC-ONLY: blocked-unknown never records and never recurs', () => {
    let log = {}
    for (let i = 0; i < 5; i++) log = recordEpisode(log, { agentId: 'dev', reasonCode: 'blocked-unknown', now: T0 + i })
    expect(log).toEqual({}) // no-op — nothing recorded
    expect(isRecurring(log, { agentId: 'dev', reasonCode: 'blocked-unknown', now: T0 + 10 })).toBe(false)
  })

  it('SPECIFIC-ONLY: absent / non-enum reason is a no-op', () => {
    expect(recordEpisode({}, { agentId: 'dev', reasonCode: 'evil', now: T0 })).toEqual({})
    expect(recordEpisode({}, { agentId: 'dev', reasonCode: undefined, now: T0 })).toEqual({})
    expect(recordEpisode({}, { agentId: '', reasonCode: 'test-run-failed', now: T0 })).toEqual({})
  })

  it('WINDOW-DECAY: 3 episodes spread BEYOND the window → not recurring', () => {
    // gap larger than the window so only the latest survives the cutoff each time
    const log = build('dev', 'build-failed', 3, { end: T0, gap: RECURRING_WINDOW_MS + 1000 })
    const r = recurringInfo(log, { agentId: 'dev', reasonCode: 'build-failed', now: T0 })
    expect(r.recurring).toBe(false)
    expect(r.count).toBe(1) // pruning keeps the list short; only the in-window one counts
  })

  it('WINDOW-DECAY: 3 episodes WITHIN the window → recurring', () => {
    const log = build('dev', 'build-failed', 3, { end: T0, gap: 60_000 }) // 1 min apart, all < 10 min
    expect(isRecurring(log, { agentId: 'dev', reasonCode: 'build-failed', now: T0 })).toBe(true)
  })

  it('per-(agent,reason) isolation: dev tests recurring does not make qa or dev-build recurring', () => {
    const log = build('dev', 'test-run-failed', 3)
    expect(isRecurring(log, { agentId: 'qa', reasonCode: 'test-run-failed', now: T0 })).toBe(false)
    expect(isRecurring(log, { agentId: 'dev', reasonCode: 'build-failed', now: T0 })).toBe(false)
    expect(isRecurring(log, { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 })).toBe(true)
  })

  it('recordEpisode is immutable (returns a new log; input untouched)', () => {
    const a = build('dev', 'deps-failed', 2)
    const snapshot = JSON.stringify(a)
    const b = recordEpisode(a, { agentId: 'dev', reasonCode: 'deps-failed', now: T0 + 5000 })
    expect(JSON.stringify(a)).toBe(snapshot) // unchanged
    expect(b).not.toBe(a)
    expect(b.dev['deps-failed'].length).toBe(3)
  })

  it('cap bounds the per-(agent,reason) list', () => {
    let log = {}
    for (let i = 0; i < RECURRING_EPISODE_CAP + 10; i++) {
      log = recordEpisode(log, { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 + i * 100 })
    }
    expect(log.dev['test-run-failed'].length).toBeLessThanOrEqual(RECURRING_EPISODE_CAP)
  })

  describe('isNewBlockedEpisode — EPISODE-EDGE rule (incl. idle-gap flap)', () => {
    const B = (reasonCode) => ({ status: 'blocked', reasonCode })
    it('entering blocked from a non-blocked state with a specific reason → new', () => {
      expect(isNewBlockedEpisode(null, B('test-run-failed'))).toBe(true)
      expect(isNewBlockedEpisode({ status: 'working' }, B('test-run-failed'))).toBe(true)
      expect(isNewBlockedEpisode({ status: 'done' }, B('build-failed'))).toBe(true)
    })
    it('poll re-read of the SAME (blocked, reason) → NOT new', () => {
      expect(isNewBlockedEpisode(B('test-run-failed'), B('test-run-failed'))).toBe(false)
    })
    it('idle-gap flap blocked→awaiting-approval→blocked of the SAME stuck state → NOT new (no false recurrence)', () => {
      // prev was reclassified to awaiting-approval; the same prompt re-asserts blocked
      expect(isNewBlockedEpisode({ status: 'awaiting-approval', reasonCode: null }, B('test-run-failed'))).toBe(false)
    })
    it('reason CHANGE while blocked → new episode of the new kind', () => {
      expect(isNewBlockedEpisode(B('test-run-failed'), B('build-failed'))).toBe(true)
    })
    it('blocked-unknown / non-specific → never a new episode', () => {
      expect(isNewBlockedEpisode({ status: 'working' }, B('blocked-unknown'))).toBe(false)
      expect(isNewBlockedEpisode(null, { status: 'working', reasonCode: 'test-run-failed' })).toBe(false)
    })
  })

  it('WINDOW boundary: an episode exactly windowMs old is excluded (strict >)', () => {
    const log = { dev: { 'test-run-failed': [T0 - RECURRING_WINDOW_MS] } } // exactly at cutoff
    expect(recurringInfo(log, { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 }).count).toBe(0)
    const log2 = { dev: { 'test-run-failed': [T0 - RECURRING_WINDOW_MS + 1] } } // 1ms inside
    expect(recurringInfo(log2, { agentId: 'dev', reasonCode: 'test-run-failed', now: T0 }).count).toBe(1)
  })

  it('exports the 6 specific reasons (3 original + 3 AVO-148); blocked-unknown excluded', () => {
    expect(RECURRING_REASONS).toEqual([
      'test-run-failed', 'build-failed', 'deps-failed',
      'permission-denied', 'api-rate-limit', 'api-auth-failed',
    ])
    expect(RECURRING_REASONS).not.toContain('blocked-unknown')
    expect(RECURRING_THRESHOLD).toBe(3)
  })
})
