/**
 * Anti-stacking jitter on shared path nodes (owner bug 2026-06-11: "研究員跟不知道誰疊在一起").
 *
 * findSafePolyline returned EXACT shared MAIN_ROUTE_NODES coordinates, so two agents
 * traversing the same aisle at the same moment landed on the SAME pixel (live-captured:
 * pm and dev both at (300,180), distance 0). Intermediate nodes are now jittered with
 * obstacle re-validation and an exact-node fallback; destinations are never offset.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { calculatePath, isOnFloor, isOnObstacle, MAIN_ROUTE_NODES } from '../src/systems/movementSystem.js'

// Seeded RNG (deflake pattern from agentSeparationInvariants).
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const realRandom = Math.random
beforeEach(() => { Math.random = mulberry32(0x57ac4_0ff) })
afterEach(() => { Math.random = realRandom })

// A route that traverses the main-office aisle graph (forces findSafePolyline):
// gate's corner (top-left) to research desk area (right) crosses desk rows.
const FROM = { x: 100, y: 80 }
const TO = { x: 520, y: 244 }

function sampleWalkable(a, b, stepPx = 4) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepPx))
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / steps
    const y = a.y + ((b.y - a.y) * i) / steps
    if (!isOnFloor(x, y) || isOnObstacle(x, y)) return false
  }
  return true
}

describe('shared path nodes are de-stacked', () => {
  it('repeated paths over the same route do NOT all pass through identical node pixels', () => {
    const nodeSamples = []
    for (let run = 0; run < 20; run++) {
      const path = calculatePath(FROM, TO)
      // Collect the intermediate point nearest the known shared aisle node (300,180).
      let nearest = null, best = Infinity
      for (const p of path.slice(0, -1)) {  // exclude the destination
        const d = Math.hypot(p.x - 300, p.y - 180)
        if (d < best) { best = d; nearest = p }
      }
      if (nearest && best < 40) nodeSamples.push(nearest)
    }
    expect(nodeSamples.length).toBeGreaterThan(10)  // the route really uses that aisle
    // Most samples must NOT be the exact shared pixel...
    const exact = nodeSamples.filter((p) => p.x === 300 && p.y === 180).length
    expect(exact).toBeLessThan(nodeSamples.length / 2)
    // ...and the samples must genuinely spread (not all identical to each other).
    const distinct = new Set(nodeSamples.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`))
    expect(distinct.size).toBeGreaterThan(3)
  })

  it('destination is never offset by the jitter', () => {
    for (let run = 0; run < 10; run++) {
      const path = calculatePath(FROM, TO)
      const last = path[path.length - 1]
      expect(last.x).toBe(TO.x)
      expect(last.y).toBe(TO.y)
    }
  })

  it('jittered paths remain fully walkable segment-by-segment (200 seeded routes)', () => {
    const cases = [
      [FROM, TO],
      [{ x: 240, y: 386 }, { x: 550, y: 180 }],   // dev desk → top right
      [{ x: 80, y: 290 }, { x: 520, y: 244 }],    // left aisle → research desk
      [{ x: 300, y: 385 }, { x: 100, y: 80 }],    // bottom aisle → gate corner
    ]
    for (let run = 0; run < 50; run++) {
      for (const [from, to] of cases) {
        const path = calculatePath(from, to)
        let cursor = from
        for (const p of path) {
          expect(sampleWalkable(cursor, p),
            `segment (${Math.round(cursor.x)},${Math.round(cursor.y)})→(${Math.round(p.x)},${Math.round(p.y)}) crosses an obstacle`).toBe(true)
          cursor = p
        }
      }
    }
  })

  it('path nodes are fresh objects, never the shared MAIN_ROUTE_NODES constants (aliasing guard)', () => {
    for (let run = 0; run < 10; run++) {
      const path = calculatePath(FROM, TO)
      for (const p of path) {
        for (const node of MAIN_ROUTE_NODES) expect(p === node).toBe(false)
      }
    }
  })
})
