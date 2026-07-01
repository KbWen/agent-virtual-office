import { describe, it, expect } from 'vitest'
import {
  collectArrivalNudgeClaims,
  hasRafHandle,
  isDocumentFocused,
  RAF_STALL_RESTART_MS,
  shouldRecordRafWatchdogRestart,
  shouldRestartRafWatchdog,
  shouldStopStaleLocalWalk,
} from '../src/components/AgentCharacter.jsx'
import { GAP_SNAP_MS } from '../src/systems/walkFrame.js'

describe('shouldRestartRafWatchdog', () => {
  it('ignores hidden tabs so browser throttling does not create false diagnostics', () => {
    expect(shouldRestartRafWatchdog(1000, 1000 + GAP_SNAP_MS + 1, 'hidden')).toBe(false)
  })

  it('does not restart for visible jank inside the smooth-resume window', () => {
    expect(shouldRestartRafWatchdog(1000, 1000 + RAF_STALL_RESTART_MS, 'visible')).toBe(false)
  })

  it('restarts the lost RAF chain before the long-freeze snap boundary', () => {
    expect(RAF_STALL_RESTART_MS).toBeLessThan(GAP_SNAP_MS)
    expect(shouldRestartRafWatchdog(1000, 1000 + RAF_STALL_RESTART_MS + 1, 'visible')).toBe(true)
    expect(shouldRestartRafWatchdog(1000, 1000 + GAP_SNAP_MS, 'visible')).toBe(true)
  })

  it('does not restart before the first RAF timestamp is recorded', () => {
    expect(shouldRestartRafWatchdog(0, 999999, 'visible')).toBe(false)
    expect(shouldRestartRafWatchdog(NaN, 999999, 'visible')).toBe(false)
  })
})

describe('shouldRecordRafWatchdogRestart', () => {
  it('does not count host-throttled pending frames as an app fault', () => {
    expect(shouldRecordRafWatchdogRestart(true, true, 3)).toBe(false)
  })

  it('does not count recoverable lost chains while the document is not focused', () => {
    expect(shouldRecordRafWatchdogRestart(false, false, 5)).toBe(false)
  })

  it('waits for repeated focused lost chains before surfacing a dev diagnostic', () => {
    expect(shouldRecordRafWatchdogRestart(false, true, 1)).toBe(false)
    expect(shouldRecordRafWatchdogRestart(false, true, 2)).toBe(true)
  })
})

describe('isDocumentFocused', () => {
  it('requires a real focused document', () => {
    expect(isDocumentFocused({ hasFocus: () => true })).toBe(true)
    expect(isDocumentFocused({ hasFocus: () => false })).toBe(false)
  })

  it('treats missing focus APIs as not focused', () => {
    expect(isDocumentFocused({})).toBe(false)
    expect(isDocumentFocused(null)).toBe(false)
  })
})

describe('hasRafHandle', () => {
  it('treats 0 as a valid requestAnimationFrame handle', () => {
    expect(hasRafHandle(0)).toBe(true)
  })

  it('uses only nullish values as the empty sentinel', () => {
    expect(hasRafHandle(null)).toBe(false)
    expect(hasRafHandle(undefined)).toBe(false)
    expect(hasRafHandle(42)).toBe(true)
  })
})

describe('collectArrivalNudgeClaims', () => {
  it('treats moving agents current-leg and journey-end targets as arrival blockers', () => {
    const claims = collectArrivalNudgeClaims({
      arch: { position: { x: 460, y: 364 }, isMoving: false },
      ops: {
        position: { x: 430, y: 360 },
        targetPosition: { x: 470, y: 369 },
        journeyTarget: { x: 460, y: 364 },
        isMoving: true,
      },
    }, 'arch')

    expect(claims.blockers).toContainEqual({ x: 470, y: 369 })
    expect(claims.blockers).toContainEqual({ x: 460, y: 364 })
    expect(claims.claims).toContainEqual({ x: 470, y: 369 })
    expect(claims.claims).toContainEqual({ x: 460, y: 364 })
  })
})

describe('shouldStopStaleLocalWalk', () => {
  it('stops local walking when the authoritative store says the agent is no longer moving', () => {
    expect(shouldStopStaleLocalWalk(true, { isMoving: false })).toBe(true)
  })

  it('does not stop an active authoritative walk', () => {
    expect(shouldStopStaleLocalWalk(true, { isMoving: true })).toBe(false)
  })

  it('does nothing when local walking is already off or the agent is absent', () => {
    expect(shouldStopStaleLocalWalk(false, { isMoving: false })).toBe(false)
    expect(shouldStopStaleLocalWalk(true, null)).toBe(false)
  })
})
