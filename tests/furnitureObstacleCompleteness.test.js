/**
 * Furniture-obstacle completeness (owner screenshot 2026-06-11: designer standing INSIDE
 * the gate booth — the entrance/research furniture was never in OBSTACLE_RECTS, so
 * clampToFloor placed characters inside the graphics and the pet's segmentWalkable
 * couldn't see those shelves either).
 *
 * Class-killer invariant: every STANDING destination the movement system can assign must
 * be on the floor and outside EVERY obstacle rect. Desk-center WAYPOINTS entries (pmDesk
 * etc.) are furniture-rendering coordinates, not standing spots — excluded. The `phone`
 * waypoint is deliberately inside the phone booth (you enter a booth) — booth is not an
 * obstacle, so it passes regardless.
 */
import { describe, it, expect } from 'vitest'
import {
  HOME_POSITIONS, WAYPOINTS, MEETING_CHAIRS, DOOR_SIDES, MAIN_ROUTE_NODES,
  OVERFLOW_POSITIONS, isOnFloor, isOnObstacle, clampToFloor,
} from '../src/systems/movementSystem.js'

function expectStandable(label, p) {
  expect(isOnFloor(p.x, p.y), `${label} (${p.x},${p.y}) must be on the floor`).toBe(true)
  expect(isOnObstacle(p.x, p.y), `${label} (${p.x},${p.y}) must NOT be inside furniture`).toBe(false)
}

describe('every standing destination is on-floor and furniture-free', () => {
  it('HOME_POSITIONS', () => {
    for (const [id, p] of Object.entries(HOME_POSITIONS)) expectStandable(`home:${id}`, p)
  })

  it('WAYPOINTS destinations (desk-render centers excluded; phone excluded by design)', () => {
    for (const [key, p] of Object.entries(WAYPOINTS)) {
      if (/Desk$/.test(key) || key === 'phone') continue
      expectStandable(`waypoint:${key}`, p)
    }
  })

  it('MEETING_CHAIRS', () => {
    MEETING_CHAIRS.forEach((p, i) => expectStandable(`chair:${i}`, p))
  })

  it('DOOR_SIDES anchors', () => {
    for (const [door, sides] of Object.entries(DOOR_SIDES)) {
      for (const [zone, p] of Object.entries(sides)) expectStandable(`door:${door}.${zone}`, p)
    }
  })

  it('MAIN_ROUTE_NODES (incl. corridors)', () => {
    MAIN_ROUTE_NODES.forEach((p, i) => expectStandable(`route:${i}`, p))
  })

  it('OVERFLOW_POSITIONS (dynamic-agent slots)', () => {
    OVERFLOW_POSITIONS.forEach((p, i) => expectStandable(`overflow:${i}`, p))
  })
})

describe('the reported clipping cases are actually fixed', () => {
  it('a point inside the gate booth is pushed OUT by clampToFloor', () => {
    const inside = { x: 100, y: 100 }              // booth body center
    expect(isOnObstacle(inside.x, inside.y)).toBe(true)
    const out = clampToFloor(inside)
    expect(isOnObstacle(out.x, out.y)).toBe(false)
  })

  it('points inside the research bookshelves / printer are obstacles now', () => {
    // (server rack intentionally excluded: flush against the wall → no clean push-out)
    for (const p of [{ x: 500, y: 445 }, { x: 650, y: 445 }, { x: 730, y: 445 }, { x: 600, y: 495 }]) {
      expect(isOnObstacle(p.x, p.y), `(${p.x},${p.y}) should be furniture`).toBe(true)
      const out = clampToFloor(p)
      expect(isOnObstacle(out.x, out.y), `clampToFloor escape for (${p.x},${p.y})`).toBe(false)
      expect(isOnFloor(out.x, out.y)).toBe(true)
    }
  })

  it('the phone waypoint remains reachable by design (booth not an obstacle)', () => {
    const p = WAYPOINTS.phone
    expect(isOnObstacle(p.x, p.y)).toBe(false)
  })
})
