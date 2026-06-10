/**
 * stepWalkFrame — pure per-frame walk math (extracted from AgentCharacter's RAF loop).
 *
 * The load-bearing case is the hidden-tab / jank fast-forward (owner bug 2026-06-11:
 * "8人只看到6人"): rAF freezes in hidden tabs; on return the first frame carries a huge
 * timestamp gap. Pre-fix, the dt clamp resumed frozen walkers as a slow glide — the user
 * watched the stacked pile drift apart. A gap > GAP_SNAP_MS must SNAP the leg to its target.
 */
import { describe, it, expect } from 'vitest'
import { stepWalkFrame, GAP_SNAP_MS, ARRIVE_EPSILON } from '../src/systems/walkFrame.js'

const SPEED = 80  // px/s — representative; the real WALK_SPEED is passed by the caller

describe('stepWalkFrame — normal gliding', () => {
  it('advances toward the target by speed*dt and does not arrive mid-leg', () => {
    const vp = { x: 0, y: 0 }
    const arrived = stepWalkFrame(vp, { x: 100, y: 0 }, 0.1, 16, SPEED)
    expect(arrived).toBe(false)
    expect(vp.x).toBeCloseTo(8, 5)   // 80 px/s * 0.1 s
    expect(vp.y).toBeCloseTo(0, 5)
  })

  it('arrives (snap + true) when the remaining distance is within one step', () => {
    const vp = { x: 95, y: 0 }
    const arrived = stepWalkFrame(vp, { x: 100, y: 0 }, 0.1, 16, SPEED)
    expect(arrived).toBe(true)
    expect(vp).toEqual({ x: 100, y: 0 })
  })

  it('arrives immediately when already within ARRIVE_EPSILON', () => {
    const vp = { x: 99.2, y: 0 }
    const arrived = stepWalkFrame(vp, { x: 100, y: 0 }, 0.016, 16, SPEED)
    expect(arrived).toBe(true)
    expect(vp).toEqual({ x: 100, y: 0 })
    expect(Math.hypot(100 - 99.2, 0)).toBeLessThanOrEqual(ARRIVE_EPSILON)
  })

  it('moves diagonally along the normalized direction', () => {
    const vp = { x: 0, y: 0 }
    stepWalkFrame(vp, { x: 100, y: 100 }, 0.1, 16, SPEED)
    expect(vp.x).toBeCloseTo(vp.y, 5)
    expect(Math.hypot(vp.x, vp.y)).toBeCloseTo(8, 4)
  })
})

describe('stepWalkFrame — hidden-tab / jank fast-forward (the owner-bug case)', () => {
  it(`a timestamp gap > ${GAP_SNAP_MS}ms snaps the leg to its target regardless of dt clamp`, () => {
    const vp = { x: 300, y: 180 }                       // the live-captured frozen pixel
    const arrived = stepWalkFrame(vp, { x: 300, y: 290 }, 0.1, 4200, SPEED)
    expect(arrived).toBe(true)
    expect(vp).toEqual({ x: 300, y: 290 })              // AT the leg target, not an 8px glide
  })

  it('the PRE-FIX behavior is provably different: without the gap rule a 4.2s freeze glides ~8px', () => {
    // Reproduce the old math (dt clamp only) to pin WHY the gap rule exists.
    const vp = { x: 300, y: 180 }
    const dtClamped = Math.min(4200 / 1000, 0.1)
    vp.y += SPEED * dtClamped                            // old behavior: slow glide from the pile
    expect(vp.y).toBeCloseTo(188, 5)                     // ~8px — the user-visible "drift apart"
  })

  it('a gap exactly at the threshold does NOT snap (boundary)', () => {
    const vp = { x: 0, y: 0 }
    const arrived = stepWalkFrame(vp, { x: 100, y: 0 }, 0.1, GAP_SNAP_MS, SPEED)
    expect(arrived).toBe(false)
    expect(vp.x).toBeCloseTo(8, 5)
  })

  it('a normal first frame (gap = one frame) never triggers the snap', () => {
    const vp = { x: 0, y: 0 }
    const arrived = stepWalkFrame(vp, { x: 500, y: 0 }, 0.016, 16, SPEED)
    expect(arrived).toBe(false)
    expect(vp.x).toBeCloseTo(1.28, 3)
  })
})
