import { describe, it, expect } from 'vitest'
import { lineHitsRect } from '../src/systems/movementSystem.js'

// Axis-epsilon hole (chip task_4be9264a, found in the 2026-06-11 zone-mouth review):
// segments with |dx| ≤ 0.1 (or |dy| ≤ 0.1) used to test ONLY the START coordinate
// against the slab — a near-vertical segment whose x drifts across a rect edge plane
// by <0.1px was reported as a miss. Reproduced on main at ~0.3% of random in-rect
// mainOffice pairs via jittered Dijkstra nodes (penetration 0.005–0.3px): visually
// invisible, but the latent flake source for the seeded pathing oracles. The fix
// tests the segment's COORDINATE RANGE in the near-axis branches (conservative:
// never misses a real hit; may over-flag by ≤0.1px — a rejected jitter candidate
// just falls back to the exact node).

const ARCH_DESK = { x1: 225, y1: 215, x2: 295, y2: 260 }

describe('lineHitsRect — near-axis epsilon hole', () => {
  it('near-vertical segment drifting across the x2 edge plane is a HIT (the wild jitter case)', () => {
    // The concrete reproduced graze: jittered node at x=295.000108 connecting down past
    // the desk — start is 0.0001px OUTSIDE the slab, end is 0.008px inside.
    expect(lineHitsRect(295.000108, 285.85, 294.9917, 185.68, ARCH_DESK)).toBe(true)
  })

  it('near-vertical hit detected regardless of direction (swapped endpoints)', () => {
    expect(lineHitsRect(294.9917, 185.68, 295.000108, 285.85, ARCH_DESK)).toBe(true)
  })

  it('near-horizontal segment drifting across the y1 edge plane is a HIT', () => {
    // ay 0.04px above the desk top, by 0.05px below it, x-range fully inside the desk.
    expect(lineHitsRect(240, 214.96, 280, 215.05, ARCH_DESK)).toBe(true)
  })

  it('near-vertical segment clearly OUTSIDE the slab stays a miss (wedge-canyon class)', () => {
    // The d=1 wedge endpoints live on vertical lines just outside desk slabs — these
    // must keep reporting miss or every canyon route would be rejected.
    expect(lineHitsRect(224, 230, 224.05, 250, ARCH_DESK)).toBe(false)
    expect(lineHitsRect(295.2, 230, 295.25, 250, ARCH_DESK)).toBe(false)
  })

  it('near-axis segment beside the rect in the OTHER axis stays a miss', () => {
    // x-range overlaps the slab but the whole segment sits above the desk.
    expect(lineHitsRect(240, 200, 240.05, 210, ARCH_DESK)).toBe(false)
  })

  it('exactly axis-parallel segments keep exact behavior', () => {
    expect(lineHitsRect(240, 200, 240, 250, ARCH_DESK)).toBe(true)   // crosses top edge
    expect(lineHitsRect(224, 200, 224, 250, ARCH_DESK)).toBe(false)  // 1px west of slab
    expect(lineHitsRect(200, 230, 320, 230, ARCH_DESK)).toBe(true)   // horizontal through
  })

  it('general diagonal behavior unchanged', () => {
    expect(lineHitsRect(200, 200, 320, 280, ARCH_DESK)).toBe(true)
    expect(lineHitsRect(200, 200, 210, 280, ARCH_DESK)).toBe(false)
  })
})
