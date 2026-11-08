import { describe, it, expect } from 'vitest'
import { isOnFloor, isOnObstacle } from '../src/systems/movementSystem.js'
import { VISITOR_STOPS, buildVisitorRoute, measureRoute, sampleRoute, visitorDepthIndex } from '../src/systems/visitorRoutes.js'

// The pre-fix hand-authored paths, kept here as the reproduction baseline.
const OLD_BOSS = [[100, 150], [200, 280], [400, 290], [550, 280], [400, 350], [200, 300], [100, 150]]
const OLD_DOG = [[100, 150], [300, 290], [500, 270], [400, 380], [175, 490], [250, 470], [175, 490], [300, 350], [100, 150]]

function badSamples(points, step = 2) {
  const bad = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step))
    for (let k = 0; k <= n; k++) {
      const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n
      if (!isOnFloor(x, y) || isOnObstacle(x, y)) bad.push({ seg: i, x: +x.toFixed(1), y: +y.toFixed(1), floor: isOnFloor(x, y) })
    }
  }
  return bad
}

describe('visitor routes use the shared navigation model', () => {
  it('reproduction baseline: the old straight paths crossed furniture (boss) and walls (dog)', () => {
    const toPts = (p) => p.map(([x, y]) => ({ x, y }))
    // old boss origin was the drawn body, feet ≈ 16 below
    expect(badSamples(toPts(OLD_BOSS).map(p => ({ x: p.x, y: p.y + 16 }))).length).toBeGreaterThan(0)
    expect(badSamples(toPts(OLD_DOG).map(p => ({ x: p.x, y: p.y + 8 }))).some(b => !b.floor)).toBe(true)
  })

  for (const role of ['boss', 'dog']) {
    it(`${role}: 200 randomised builds stay on floor and off every collider (incl. lounge table)`, () => {
      for (let run = 0; run < 200; run++) {
        const route = buildVisitorRoute(VISITOR_STOPS[role])
        const bad = badSamples(route)
        expect(bad, `run ${run}: ${JSON.stringify(bad.slice(0, 3))}`).toEqual([])
        expect(route[0]).toEqual(VISITOR_STOPS[role][0])
        expect(route[route.length - 1]).toEqual(VISITOR_STOPS[role][VISITOR_STOPS[role].length - 1])
      }
    })
  }

  it('every stop is walkable floor off furniture', () => {
    for (const stops of Object.values(VISITOR_STOPS)) {
      for (const s of stops) expect(isOnFloor(s.x, s.y) && !isOnObstacle(s.x, s.y), JSON.stringify(s)).toBe(true)
    }
  })
})

describe('constant-speed sampling', () => {
  it('equal time steps cover equal distance (no speed jumps between segments)', () => {
    const m = measureRoute([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 90 }])
    const p1 = sampleRoute(m, 0.1), p2 = sampleRoute(m, 0.2), p3 = sampleRoute(m, 0.5)
    expect(p1).toMatchObject({ x: 10, y: 0 })
    expect(p2.x).toBe(10); expect(p2.y).toBeCloseTo(10)
    expect(p3.y).toBeCloseTo(40)
    expect(sampleRoute(m, 1)).toMatchObject({ x: 10, y: 90 })
    expect(sampleRoute(m, -1)).toMatchObject({ x: 0, y: 0 })
  })
})

describe('visitorDepthIndex', () => {
  it('places the visitor after employees whose feet are above it', () => {
    expect(visitorDepthIndex([80, 244, 264, 364], 290)).toBe(3)
    expect(visitorDepthIndex([80, 244, 264, 364], 50)).toBe(0)
    expect(visitorDepthIndex([80, 244], 999)).toBe(2)
  })
})
