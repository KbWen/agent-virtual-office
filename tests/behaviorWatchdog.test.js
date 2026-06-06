/**
 * Behavior watchdog skip predicate (#50).
 *
 * The AgentCharacter watchdog restarts the scheduling chain when a behavior
 * value sits unchanged past WATCHDOG_TIMEOUT. `shouldSkipBehaviorWatchdog`
 * suppresses that restart when the behavior is legitimately held — during a
 * group event or while the agent has an active session status — so a slow
 * (not dead) behavior is never falsely truncated. These tests pin the exact
 * skip set and, crucially, that ambient/idle states are NOT skipped (the
 * watchdog must still recover a genuinely dead chain).
 */
import { describe, it, expect } from 'vitest'
import { shouldSkipBehaviorWatchdog, ACTIVE_SESSION_STATUSES } from '../src/systems/constants.js'

describe('shouldSkipBehaviorWatchdog — active session statuses', () => {
  it.each(['working', 'thinking', 'blocked', 'awaiting-approval', 'planning'])(
    'status=%s → skip restart (active session, stable behavior expected)',
    (status) => {
      expect(shouldSkipBehaviorWatchdog({ status })).toBe(true)
    }
  )

  it('the active-session set is exactly the documented five statuses', () => {
    expect([...ACTIVE_SESSION_STATUSES].sort()).toEqual(
      ['awaiting-approval', 'blocked', 'planning', 'thinking', 'working']
    )
  })
})

describe('shouldSkipBehaviorWatchdog — ambient statuses are NOT skipped', () => {
  it.each(['idle', 'done', undefined, 'some-unknown-status'])(
    'status=%s → watchdog stays armed (a frozen behavior here means a dead chain)',
    (status) => {
      expect(shouldSkipBehaviorWatchdog({ status })).toBe(false)
    }
  )
})

describe('shouldSkipBehaviorWatchdog — group events', () => {
  it('inGroupEvent skips regardless of status (officeLife owns behavior)', () => {
    expect(shouldSkipBehaviorWatchdog({ status: 'idle', inGroupEvent: true })).toBe(true)
    expect(shouldSkipBehaviorWatchdog({ status: 'done', inGroupEvent: true })).toBe(true)
  })

  it('inGroupEvent false + ambient status → not skipped', () => {
    expect(shouldSkipBehaviorWatchdog({ status: 'idle', inGroupEvent: false })).toBe(false)
  })
})

describe('shouldSkipBehaviorWatchdog — defensive', () => {
  it('null / undefined agent → false (never skip on missing agent)', () => {
    expect(shouldSkipBehaviorWatchdog(null)).toBe(false)
    expect(shouldSkipBehaviorWatchdog(undefined)).toBe(false)
  })
})
