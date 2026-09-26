// rem-honest-office-events review round 2, finding #3 (blocking) — the AC-1 required-actor check
// was only exercised via the interactive-click path (`triggerInteractiveEvent`), which has its OWN
// separate `hasRequiredActors` call. `fireWithCast` — the path the DAILY/RARE scheduler ticks and
// the real-seed triggers actually use — has an independent call to the same guard, and deleting it
// there passed the full suite. This file isolates that path.
//
// The event catalog is mocked down to a single required-actor event so `pickEligibleEvent` (random
// selection among ELIGIBLE daily events) deterministically lands on it — no Math.random index
// arithmetic against the real 11-event catalog.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../src/config/officeEvents.json', () => ({
  default: {
    daily: [
      { id: 'review-debate', name: 'Review debate', participants: ['dev', 'qa'], duration: 5000 },
    ],
    rare: [],
  },
}))

import { startOfficeLife } from '../src/systems/officeLife.js'
import { useOfficeStore } from '../src/systems/store.js'
import { DAILY_EVENT_INTERVAL } from '../src/systems/constants.js'

describe('fireWithCast (daily-scheduler path) refuses a cast missing its required actor', () => {
  let teardown
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-05T09:00:00'))
    useOfficeStore.setState({ isPaused: false, activeEvent: null, externalStatus: {}, mood: 'normal' })
  })
  afterEach(() => {
    if (teardown) teardown()
    useOfficeStore.setState({ activeEvent: null, externalStatus: {} })
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    teardown = null
  })

  it('review-debate eligible (fresh qa signal) but dev genuinely busy: the daily tick never fires it', () => {
    // eventEligible(review-debate) needs a recent qa/gate signal; dev is busy so the array-filtered
    // cast is ['qa'] only -- non-empty, but missing the required 'dev'. Pin the tick to the
    // EARLIEST point in DAILY_EVENT_INTERVAL and check WHILE the event's 5000ms duration would
    // still be live under a phantom-fire regression -- a big overshoot would let a wrongly-fired
    // phantom event self-clear via its own executeEvent cleanup before the check runs, reading
    // back as a false negative (confirmed: this masked the mutant on first draft of this test).
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useOfficeStore.setState({
      externalStatus: { dev: { status: 'working' }, qa: { status: 'idle', changedAt: Date.now() } },
    })
    teardown = startOfficeLife(useOfficeStore)
    vi.advanceTimersByTime(DAILY_EVENT_INTERVAL[0] + 1)
    expect(useOfficeStore.getState().activeEvent).toBeNull()
    expect(useOfficeStore.getState().agents.qa.inGroupEvent).toBe(false)
  })

  it('regression: with both dev and qa available, the daily tick DOES fire review-debate', () => {
    // Pin the tick to the EARLIEST point in DAILY_EVENT_INTERVAL and check right after it fires,
    // before its own 5000ms duration elapses -- a big overshoot would let the event fire AND
    // self-clear inside the same advanceTimersByTime call, reading back as a false negative.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    useOfficeStore.setState({ externalStatus: { qa: { status: 'idle', changedAt: Date.now() } } })
    teardown = startOfficeLife(useOfficeStore)
    vi.advanceTimersByTime(DAILY_EVENT_INTERVAL[0] + 1)
    expect(useOfficeStore.getState().activeEvent?.id).toBe('review-debate')
  })
})
