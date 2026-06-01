import { describe, it, expect } from 'vitest'
import {
  calculatePath,
  getTargetForBehavior,
  HOME_POSITIONS,
  MEETING_CHAIRS,
  WAYPOINTS,
} from '../src/systems/movementSystem.js'

const FLOOR_ZONES = [
  { id: 'entrance',      x1: 15,  y1: 15,  x2: 593, y2: 133 },
  { id: 'mainOffice',    x1: 15,  y1: 168, x2: 593, y2: 394 },
  { id: 'meetingRoom',   x1: 628, y1: 15,  x2: 785, y2: 413 },
  { id: 'lounge',        x1: 15,  y1: 424, x2: 451, y2: 545 },
  { id: 'research',      x1: 469, y1: 424, x2: 785, y2: 545 },
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

const SAFE_ROUTE_POINTS = [
  ['entrance-door', { x: 115, y: 80 }],
  ['entrance-mid', { x: 300, y: 80 }],
  ['entrance-east', { x: 550, y: 80 }],
  ['main-door-entrance', { x: 115, y: 176 }],
  ['main-top-mid', { x: 300, y: 180 }],
  ['main-top-east', { x: 550, y: 180 }],
  ['main-left-aisle', { x: 80, y: 290 }],
  ['main-mid-aisle', { x: 300, y: 290 }],
  ['main-lounge-door', { x: 240, y: 386 }],
  ['main-research-door', { x: 535, y: 386 }],
  ['meeting-door', { x: 636, y: 210 }],
  ['meeting-north', { x: 640, y: 60 }],
  ['meeting-south', { x: 640, y: 350 }],
  ['meeting-east', { x: 775, y: 390 }],
  ['lounge-door', { x: 240, y: 432 }],
  ['lounge-west', { x: 90, y: 520 }],
  ['lounge-mid', { x: 240, y: 520 }],
  ['lounge-east', { x: 440, y: 520 }],
  ['research-door', { x: 535, y: 432 }],
  ['research-west', { x: 600, y: 520 }],
  ['research-mid', { x: 680, y: 470 }],
  ['research-east', { x: 760, y: 520 }],
]

function onFloor(p) {
  return FLOOR_ZONES.some((z) => p.x >= z.x1 && p.x <= z.x2 && p.y >= z.y1 && p.y <= z.y2)
}

function obstacleAt(p) {
  return OBSTACLE_RECTS.find((r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2)
}

function sampleSegment(a, b, step = 4) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  const n = Math.max(1, Math.ceil(dist / step))
  const points = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return points
}

function assertPathDoesNotCrossWallsOrObstacles(from, to, label) {
  const path = calculatePath(from, to)
  let cursor = from
  for (const waypoint of path) {
    for (const point of sampleSegment(cursor, waypoint)) {
      expect(onFloor(point), `${label} off-floor at (${point.x.toFixed(1)},${point.y.toFixed(1)}) via ${JSON.stringify(path)}`).toBe(true)
      const obstacle = obstacleAt(point)
      expect(obstacle?.name, `${label} crosses ${obstacle?.name} at (${point.x.toFixed(1)},${point.y.toFixed(1)}) via ${JSON.stringify(path)}`).toBeUndefined()
    }
    cursor = waypoint
  }
}

describe('movement deep pathing invariants', () => {
  it('core home-to-destination behavior paths stay on floor and avoid obstacles', () => {
    const behaviors = ['drink-coffee', 'drink-water', 'whiteboard', 'toilet', 'research', 'phone-call', 'look-window', 'print', 'nap']
    for (const [role, home] of Object.entries(HOME_POSITIONS)) {
      for (const behavior of behaviors) {
        const target = getTargetForBehavior(role, behavior, {})
        if (!target) continue
        assertPathDoesNotCrossWallsOrObstacles(home, target, `${role}/${behavior}`)
      }
    }
  })

  it('meeting chair-to-chair paths route around the meeting table', () => {
    for (const from of MEETING_CHAIRS) {
      for (const to of MEETING_CHAIRS) {
        if (from === to) continue
        assertPathDoesNotCrossWallsOrObstacles(from, to, `meeting ${from.x},${from.y}->${to.x},${to.y}`)
      }
    }
  })

  it('movement back to home from common activity locations stays on floor and avoids obstacles', () => {
    const commonLocations = [WAYPOINTS.coffeeArea, WAYPOINTS.whiteboard, WAYPOINTS.lounge, WAYPOINTS.researchLib, WAYPOINTS.phone, WAYPOINTS.window]
    for (const [role, home] of Object.entries(HOME_POSITIONS)) {
      for (const location of commonLocations) {
        assertPathDoesNotCrossWallsOrObstacles(location, home, `${role}/return-home`)
      }
    }
  })

  it('multi-task office simulation: all roles can leave and return without crossing walls or furniture', () => {
    const scenario = [
      ['pm', 'whiteboard'],
      ['arch', 'meeting'],
      ['dev', 'drink-coffee'],
      ['qa', 'research'],
      ['ops', 'phone-call'],
      ['res', 'look-window'],
      ['gate', 'print'],
      ['designer', 'toilet'],
    ]

    const agents = Object.fromEntries(
      Object.entries(HOME_POSITIONS).map(([role, position]) => [role, { position, targetPosition: position }]),
    )

    const destinations = []
    for (const [role, behavior] of scenario) {
      const home = HOME_POSITIONS[role]
      const target = getTargetForBehavior(role, behavior, agents)
      expect(target, `${role}/${behavior} target`).not.toBeNull()
      assertPathDoesNotCrossWallsOrObstacles(home, target, `${role}/${behavior}/leave`)
      destinations.push([role, target])
      agents[role] = { ...agents[role], targetPosition: target }
    }

    for (const [role, from] of destinations) {
      assertPathDoesNotCrossWallsOrObstacles(from, HOME_POSITIONS[role], `${role}/multi-task-return-home`)
    }
  })

  it('walkable-point matrix routes across all rooms without crossing walls or furniture', () => {
    for (const [fromLabel, from] of SAFE_ROUTE_POINTS) {
      expect(onFloor(from), `${fromLabel} test point is on floor`).toBe(true)
      expect(obstacleAt(from)?.name, `${fromLabel} test point overlaps obstacle`).toBeUndefined()

      for (const [toLabel, to] of SAFE_ROUTE_POINTS) {
        assertPathDoesNotCrossWallsOrObstacles(from, to, `${fromLabel}->${toLabel}`)
      }
    }
  }, 10_000)
})
