import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { calculatePath } from '../src/systems/movementSystem.js'

// Issue #27 — wedged-endpoint hardening. The pathing fuzz deliberately samples clean
// points ≥8px off furniture; this suite covers exactly the excluded band (1–7px),
// which includes OBSTACLE_PUSH_PX = 6 — the standoff clampToFloor emits every day.
// Pre-fix characterization (2026-06-11 probe, seeded): wedge distances 1–7px produced
// ~5% desk-crossing routes (e.g. 52/880 at d=1), all via routeWithinMainOffice's
// last-resort relay or the lounge lane's descent column. The fix (wedge-escape Dijkstra
// candidates + lounge clear-column) must keep this matrix at zero violations.

// Seed BOTH RNG consumers (cf. movementPathingFuzz): calculatePath consumes global
// randomness (corridor/door/polyline jitter) — unseeded failures would not replay.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const realRandom = Math.random
beforeAll(() => { Math.random = mulberry32(0x27aabbcc) })
afterAll(() => { Math.random = realRandom })

const ROOMS = [
  { id: 'entrance',    x1: 15,  y1: 15,  x2: 593, y2: 133 },
  { id: 'mainOffice',  x1: 15,  y1: 168, x2: 593, y2: 394 },
  { id: 'meetingRoom', x1: 628, y1: 15,  x2: 785, y2: 413 },
  { id: 'lounge',      x1: 15,  y1: 424, x2: 451, y2: 545 },
  { id: 'research',    x1: 469, y1: 424, x2: 785, y2: 545 },
]
const FLOOR_ZONES = [
  ...ROOMS,
  { id: 'door-entrance', x1: 90,  y1: 133, x2: 138, y2: 168 },
  { id: 'door-lounge',   x1: 215, y1: 394, x2: 266, y2: 424 },
  { id: 'door-research', x1: 510, y1: 394, x2: 561, y2: 424 },
  { id: 'door-meeting',  x1: 593, y1: 187, x2: 628, y2: 233 },
]

// Independent oracle (re-declared, not imported). Superset of the fuzz list: adds the
// research furniture. The entrance gate booth is deliberately ABSENT — sprites clipping
// its right edge is an accepted trade-off (see movementSystem OBSTACLE_RECTS comment:
// a full-width rect would wall the gate behind its own counter).
const OBSTACLE_RECTS = [
  { name: 'pmDesk',       x1: 105, y1: 215, x2: 175, y2: 260 },
  { name: 'archDesk',     x1: 225, y1: 215, x2: 295, y2: 260 },
  { name: 'qaDesk',       x1: 365, y1: 195, x2: 435, y2: 240 },
  { name: 'resDesk',      x1: 485, y1: 195, x2: 555, y2: 240 },
  { name: 'devDesk',      x1: 305, y1: 315, x2: 375, y2: 360 },
  { name: 'opsDesk',      x1: 425, y1: 315, x2: 495, y2: 360 },
  { name: 'designerDesk', x1: 105, y1: 335, x2: 175, y2: 370 },
  { name: 'meetingTable', x1: 650, y1: 128, x2: 760, y2: 195 },
  { name: 'whiteboard',   x1: 525, y1: 278, x2: 590, y2: 342 },
  { name: 'wc',           x1: 338, y1: 443, x2: 422, y2: 502 },
  { name: 'bookshelves',  x1: 278, y1: 438, x2: 412, y2: 458 },
  { name: 'coffee',       x1: 15,  y1: 438, x2: 70,  y2: 465 },
  { name: 'resShelfA',    x1: 472, y1: 434, x2: 528, y2: 460 },
  { name: 'resShelfB',    x1: 627, y1: 434, x2: 688, y2: 460 },
  { name: 'resShelfC',    x1: 702, y1: 434, x2: 763, y2: 460 },
  { name: 'printer',      x1: 590, y1: 488, x2: 612, y2: 508 },
]

const onFloor = (p) => FLOOR_ZONES.some((z) => p.x >= z.x1 && p.x <= z.x2 && p.y >= z.y1 && p.y <= z.y2)
const obstacleAt = (p) => OBSTACLE_RECTS.find((r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2)

function firstViolation(from, to, step = 2) {
  const path = calculatePath(from, to)
  let cursor = from
  for (const waypoint of path) {
    const dist = Math.hypot(waypoint.x - cursor.x, waypoint.y - cursor.y)
    const n = Math.max(1, Math.ceil(dist / step))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const p = { x: cursor.x + (waypoint.x - cursor.x) * t, y: cursor.y + (waypoint.y - cursor.y) * t }
      if (!onFloor(p)) return { kind: 'off-floor', at: p, path }
      const hit = obstacleAt(p)
      if (hit) return { kind: `crosses ${hit.name}`, at: p, path }
    }
    cursor = waypoint
  }
  return null
}

// Wedge generator: points at exact gap d off each rect's edge midpoints and corners,
// on the floor and outside ALL furniture (a candidate inside an overlapping rect — the
// lounge wc/bookshelves rects overlap — is filtered, not a sample).
function wedgedPoints(d) {
  const pts = []
  for (const r of OBSTACLE_RECTS) {
    const midX = Math.round((r.x1 + r.x2) / 2)
    const midY = Math.round((r.y1 + r.y2) / 2)
    const cands = [
      { x: r.x1 - d, y: midY }, { x: r.x2 + d, y: midY },
      { x: midX, y: r.y1 - d }, { x: midX, y: r.y2 + d },
      { x: r.x1 - d, y: r.y1 - d }, { x: r.x2 + d, y: r.y1 - d },
      { x: r.x1 - d, y: r.y2 + d }, { x: r.x2 + d, y: r.y2 + d },
    ]
    for (const p of cands) {
      if (onFloor(p) && !obstacleAt(p)) pts.push({ ...p, rect: r.name, d })
    }
  }
  return pts
}

const CLEAN_ORIGINS = [
  { x: 60, y: 300 },   // mainOffice west aisle
  { x: 700, y: 300 },  // meetingRoom south of table
  { x: 120, y: 520 },  // lounge lane
]

// Fresh-review HIGH (2026-06-11): lounge graph routing must NOT engage for endpoints in
// the door-lounge strip (y 418–424 — getZone calls it lounge, but the floor there is only
// the door passage x 215–266). An ungated Dijkstra emitted a diagonal through the south
// wall for exactly these inputs (measured 104/720 pairs); the gate falls back to the
// pre-fix lane path, which is fully on-floor.
describe('door-strip endpoints keep an on-floor route (lounge graph gate)', () => {
  it('the reviewed counterexample (218,418.5)→(430,470) never leaves the floor', () => {
    for (let i = 0; i < 25; i++) {
      const v = firstViolation({ x: 218, y: 418.5 }, { x: 430, y: 470 })
      expect(v, v && `${v.kind} at (${v.at.x.toFixed(1)},${v.at.y.toFixed(1)}) via ${JSON.stringify(v.path)}`).toBeNull()
    }
  })

  it('a grid of door-strip → lounge pairs stays on-floor both directions', () => {
    // Only pairs whose DIRECT line hits lounge furniture are pinned — those engage the
    // router (and the gate under test). Furniture-free pairs take the pre-existing
    // early-return direct path, whose own door-strip gap predates this change (review
    // Finding 2, tracked as follow-up) and is deliberately not pinned here.
    const directHitsFurniture = (a, b) => {
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2))
      for (let i = 0; i <= n; i++) {
        const t = i / n
        if (obstacleAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return true
      }
      return false
    }
    const failures = []
    let pinned = 0
    for (const sx of [216, 230, 240, 255, 265]) {
      for (const sy of [410, 416, 420, 423]) {
        for (const t of [{ x: 430, y: 470 }, { x: 300, y: 535 }]) {
          const s = { x: sx, y: sy }
          if (!directHitsFurniture(s, t)) continue
          pinned++
          for (const [from, to] of [[s, t], [t, s]]) {
            const v = firstViolation(from, to)
            if (v) failures.push(`(${from.x},${from.y})->(${to.x},${to.y}) ${v.kind} at (${v.at.x.toFixed(1)},${v.at.y.toFixed(1)})`)
            if (failures.length >= 5) break
          }
        }
      }
    }
    expect(pinned, 'enough router-engaging pairs in the grid').toBeGreaterThan(10)
    expect(failures, `door-strip violations:\n${failures.join('\n')}`).toEqual([])
  })
})

describe('wedged endpoints (1–7px off furniture) route without crossing furniture', () => {
  for (const d of [1, 2, 4, 6, 7]) {
    it(`wedge distance ${d}px — every origin↔wedge pair stays clean`, () => {
      const failures = []
      let checked = 0
      for (const w of wedgedPoints(d)) {
        for (const o of CLEAN_ORIGINS) {
          for (const [from, to] of [[o, w], [w, o]]) {
            checked++
            const v = firstViolation(from, to)
            if (v) {
              failures.push(
                `(${from.x},${from.y})->(${to.x},${to.y}) [wedge ${w.rect} d=${d}] ${v.kind} at ` +
                  `(${v.at.x.toFixed(1)},${v.at.y.toFixed(1)}) via ${JSON.stringify(v.path)}`,
              )
              if (failures.length >= 5) break
            }
          }
          if (failures.length >= 5) break
        }
        if (failures.length >= 5) break
      }
      expect(checked, 'matrix generated enough wedge pairs').toBeGreaterThan(200)
      expect(failures, `wedged-endpoint violations (d=${d}):\n${failures.join('\n')}`).toEqual([])
    }, 30_000)
  }
})
