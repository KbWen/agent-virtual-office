import { describe, it, expect } from 'vitest'
import { calculatePath } from '../src/systems/movementSystem.js'

// Property-style fuzz over hundreds of randomly generated room points (seeded, so any
// failure reproduces). The deep test only checks 22 hand-picked anchors; this probes the
// gaps between them — especially destinations near furniture edges where findSafePolyline
// can return null and the corridor fallback might emit a wall-crossing segment.
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
]

// Real waypoints are clamped to stay OBSTACLE_PUSH_PX (6) off furniture, so we sample
// clean points with a slightly larger margin — points wedged against furniture have no
// safe route by construction and would be a meaningless failure.
const MARGIN = 8

function onFloor(p) {
  return FLOOR_ZONES.some((z) => p.x >= z.x1 && p.x <= z.x2 && p.y >= z.y1 && p.y <= z.y2)
}

function obstacleAt(p) {
  return OBSTACLE_RECTS.find((r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2)
}

function nearObstacle(p) {
  return OBSTACLE_RECTS.some(
    (r) => p.x >= r.x1 - MARGIN && p.x <= r.x2 + MARGIN && p.y >= r.y1 - MARGIN && p.y <= r.y2 + MARGIN,
  )
}

// mulberry32 — tiny deterministic PRNG so a failing pair is always reproducible.
function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cleanPoint(rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const room = ROOMS[Math.floor(rng() * ROOMS.length)]
    const p = {
      x: Math.round(room.x1 + 6 + rng() * (room.x2 - room.x1 - 12)),
      y: Math.round(room.y1 + 6 + rng() * (room.y2 - room.y1 - 12)),
    }
    if (onFloor(p) && !nearObstacle(p)) return p
  }
  return null
}

function firstViolation(from, to, step = 4) {
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

describe('movement pathing fuzz — random room-to-room routes stay walkable', () => {
  it('1000 seeded random point pairs never cross a wall or furniture', () => {
    const rng = makeRng(0x5eed1234)
    const failures = []
    let checked = 0

    for (let i = 0; i < 1000; i++) {
      const from = cleanPoint(rng)
      const to = cleanPoint(rng)
      if (!from || !to) continue
      checked++
      const violation = firstViolation(from, to)
      if (violation) {
        failures.push(
          `(${from.x},${from.y})->(${to.x},${to.y}) ${violation.kind} at ` +
            `(${violation.at.x.toFixed(1)},${violation.at.y.toFixed(1)}) via ${JSON.stringify(violation.path)}`,
        )
        if (failures.length >= 5) break
      }
    }

    expect(checked, 'generated enough clean sample points').toBeGreaterThan(500)
    expect(failures, `pathing violations:\n${failures.join('\n')}`).toEqual([])
  }, 15_000)
})
