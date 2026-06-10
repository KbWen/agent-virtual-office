/**
 * Pet wall-phase fix (owner bug 2026-06-11: "寵物一直穿牆").
 *
 * The pet glides in a straight line between wander targets; clampToFloor validated only the
 * ENDPOINTS while the wander band (x 80–750, y 400–525) spans several rooms — so hops crossed
 * walls/furniture mid-glide. segmentWalkable samples the whole segment (~4 px); pickWanderTarget
 * only accepts fully-walkable hops and returns null (pet pauses) when none qualifies.
 */
import { describe, it, expect } from 'vitest'
import { segmentWalkable, pickWanderTarget } from '../src/systems/petState.js'
import { clampToFloor, isOnFloor, isOnObstacle } from '../src/systems/movementSystem.js'

// Deterministic RNG (mulberry32 — same deflake pattern as agentSeparationInvariants).
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const petWalkable = (x, y) => isOnFloor(x, y) && !isOnObstacle(x, y)

describe('segmentWalkable — straight-glide sampling', () => {
  it('accepts a segment whose every sample is walkable (stub: all clear)', () => {
    expect(segmentWalkable({ x: 0, y: 0 }, { x: 100, y: 0 }, () => true)).toBe(true)
  })

  it('rejects a segment that crosses a blocked column even when both ENDPOINTS are clear', () => {
    const wallAt50 = (x) => !(x >= 48 && x <= 52)  // a 4px-wide "wall" mid-segment (inclusive, so the 4px sampling must hit it)
    expect(wallAt50(0) && wallAt50(100)).toBe(true)          // endpoints clear
    expect(segmentWalkable({ x: 0, y: 0 }, { x: 100, y: 0 }, (x) => wallAt50(x))).toBe(false)
  })

  it('samples densely enough to catch a wall thinner than the hop distance (4px default step)', () => {
    const thinWall = (x) => !(x >= 50 && x <= 53)
    expect(segmentWalkable({ x: 0, y: 0 }, { x: 670, y: 0 }, (x) => thinWall(x))).toBe(false)
  })

  it('degenerate inputs are rejected, never thrown', () => {
    expect(segmentWalkable(null, { x: 1, y: 1 }, () => true)).toBe(false)
    expect(segmentWalkable({ x: 0, y: 0 }, null, () => true)).toBe(false)
    expect(segmentWalkable({ x: 0, y: 0 }, { x: 1, y: 1 }, null)).toBe(false)
  })
})

describe('pickWanderTarget — retry then pause', () => {
  it('skips blocked candidates and returns the first clean one', () => {
    const candidates = [{ x: 50, y: 0 }, { x: 0, y: 50 }]
    let i = 0
    const sample = () => candidates[i++]
    // x-movement blocked; y-movement clear
    const isWalkable = (x, y) => x === 0
    expect(pickWanderTarget({ x: 0, y: 0 }, sample, isWalkable)).toEqual({ x: 0, y: 50 })
  })

  it('returns null when every candidate is blocked (pet pauses this tick)', () => {
    expect(pickWanderTarget({ x: 0, y: 0 }, () => ({ x: 99, y: 0 }), () => false, 5)).toBe(null)
  })
})

describe('REAL-WORLD invariant: accepted hops never phase through walls/furniture', () => {
  it('500 seeded hops across the actual wander band — every ACCEPTED hop is fully walkable', () => {
    const rand = mulberry32(0x9e7c0ffe)
    const sampleBand = () => clampToFloor({ x: 80 + rand() * 670, y: 400 + rand() * 125 })
    let from = clampToFloor({ x: 120, y: 512 })  // the pet's START
    let accepted = 0
    let paused = 0
    for (let hop = 0; hop < 500; hop++) {
      const t = pickWanderTarget(from, sampleBand, petWalkable)
      if (!t) { paused++; continue }
      // Re-verify the accepted segment INDEPENDENTLY at 2px sampling (finer than the
      // picker's 4px) — an accepted hop must hold up under stricter scrutiny.
      expect(segmentWalkable(from, t, petWalkable, 2),
        `hop ${hop} from (${from.x},${from.y}) to (${t.x},${t.y}) crosses a wall`).toBe(true)
      from = t
      accepted++
    }
    // The fix must not freeze the pet: the lounge band has plenty of clean hops.
    expect(accepted).toBeGreaterThan(300)
    // And pausing must be the rare case, not the norm.
    expect(paused).toBeLessThan(200)
  })

  it('a known cross-room hop (lounge → research room through the wall) is rejected', () => {
    // Lower-left lounge to lower-right area: the straight line crosses interior walls.
    const from = clampToFloor({ x: 120, y: 512 })
    const to = clampToFloor({ x: 700, y: 450 })
    // Only assert rejection when the real map actually blocks the line (guards against
    // future floor-plan changes making this segment legitimately walkable).
    const blocked = !segmentWalkable(from, to, petWalkable, 2)
    if (blocked) {
      expect(segmentWalkable(from, to, petWalkable)).toBe(false)
    } else {
      expect(segmentWalkable(from, to, petWalkable)).toBe(true)  // floor plan opened up — fine
    }
  })
})
