import { describe, expect, it } from 'vitest'
import {
  BEHAVIOR_LOCATIONS,
  FLOOR_ZONES,
  HOME_POSITIONS,
  MEETING_CHAIRS,
  OBSTACLE_RECTS,
  OFFICE_CANVAS,
  OFFICE_LAYOUT_VERSION,
  OVERFLOW_POSITIONS,
  SOCIAL_BEHAVIOR_IDS,
  WAYPOINTS,
  buildMovementLayoutViewModel,
  calcFacing,
  clampToFloor,
  isOnFloor,
  isOnObstacle,
  needsLocationChange,
  obstacleAt,
  visuallyOverlapping,
  zoneForPoint,
} from '../src/systems/movementLayoutModel.mjs'
import * as movementLayoutModel from '../src/systems/movementLayoutModel.mjs'
import * as movementSystem from '../src/systems/movementSystem.js'

describe('movementLayoutModel', () => {
  it('mirrors stable movementSystem anchor exports without importing React or store', () => {
    expect(WAYPOINTS).toEqual(movementSystem.WAYPOINTS)
    expect(MEETING_CHAIRS).toEqual(movementSystem.MEETING_CHAIRS)
    expect(OVERFLOW_POSITIONS).toEqual(movementSystem.OVERFLOW_POSITIONS)
    expect(HOME_POSITIONS).toEqual(movementSystem.HOME_POSITIONS)
  })

  it('keeps floor, obstacle, safe zone, clamp, facing, and overlap parity for representative points', () => {
    const points = [
      { x: 100, y: 80 },
      { x: 140, y: 240 },
      { x: 620, y: 490 },
      { x: 535, y: 432 },
      { x: 115, y: 125 },
    ]
    for (const point of points) {
      expect(isOnFloor(point.x, point.y), `floor ${point.x},${point.y}`).toBe(movementSystem.isOnFloor(point.x, point.y))
      expect(isOnObstacle(point.x, point.y), `obstacle ${point.x},${point.y}`).toBe(movementSystem.isOnObstacle(point.x, point.y))
      expect(zoneForPoint(point.x, point.y), `zone ${point.x},${point.y}`).toBe(movementSystem.getZone(point.x, point.y))
      expect(clampToFloor(point), `clamp ${point.x},${point.y}`).toEqual(movementSystem.clampToFloor(point))
    }
    expect(zoneForPoint(900, 900)).toBeNull()

    expect(calcFacing(0, 0, 10, 1)).toBe(movementSystem.calcFacing(0, 0, 10, 1))
    expect(calcFacing(0, 0, 1, 10)).toBe(movementSystem.calcFacing(0, 0, 1, 10))
    expect(visuallyOverlapping({ x: 0, y: 0 }, { x: 20, y: 20 })).toBe(
      movementSystem.visuallyOverlapping({ x: 0, y: 0 }, { x: 20, y: 20 }),
    )
  })

  it('keeps behavior location-change semantics but does not expose random target/path selection', () => {
    for (const behaviorId of Object.keys(BEHAVIOR_LOCATIONS)) {
      expect(needsLocationChange(behaviorId), behaviorId).toBe(movementSystem.needsLocationChange(behaviorId))
    }
    for (const behaviorId of ['chat', 'thumbs-up', 'pass-document', 'work', 'code', 'unknown-behavior']) {
      expect(needsLocationChange(behaviorId), behaviorId).toBe(movementSystem.needsLocationChange(behaviorId))
    }
    expect('calculatePath' in movementLayoutModel).toBe(false)
    expect('getTargetForBehavior' in movementLayoutModel).toBe(false)
    expect('DOOR_SIDES' in movementLayoutModel).toBe(false)
    expect('MAIN_ROUTE_NODES' in movementLayoutModel).toBe(false)
  })

  it('describes a renderer-facing layout model with standable anchors', () => {
    const model = buildMovementLayoutViewModel()
    expect(model.canvas).toEqual(OFFICE_CANVAS)
    expect(model.version).toBe(OFFICE_LAYOUT_VERSION)
    expect(model.floorZones).toHaveLength(FLOOR_ZONES.length)
    expect(model.obstacleRects).toHaveLength(OBSTACLE_RECTS.length)
    expect(model.overflowPositions[1]).toEqual({ x: 370, y: 80, slot: 1 })
    expect(model.spriteClearance).toEqual({ rx: 32, ry: 44 })
    expect(SOCIAL_BEHAVIOR_IDS).toEqual(['chat', 'thumbs-up', 'pass-document'])

    for (const [role, pos] of Object.entries(model.homePositions)) {
      expect(isOnFloor(pos.x, pos.y), `${role} home is on floor`).toBe(true)
      expect(obstacleAt(pos.x, pos.y), `${role} home is clear of obstacle`).toBeNull()
    }
    expect('doorSides' in model).toBe(false)
    expect('mainRouteNodes' in model).toBe(false)
  })

  it('freezes exported layout constants and returns mutable view-model clones', () => {
    expect(Object.isFrozen(HOME_POSITIONS)).toBe(true)
    expect(Object.isFrozen(HOME_POSITIONS.dev)).toBe(true)
    expect(() => {
      HOME_POSITIONS.dev.x = 1
    }).toThrow(TypeError)

    const model = buildMovementLayoutViewModel()
    model.homePositions.dev.x = 1
    expect(HOME_POSITIONS.dev.x).toBe(340)
  })
})
