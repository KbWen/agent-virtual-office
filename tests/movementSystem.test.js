import { describe, it, expect } from 'vitest'
import {
  calcFacing,
  needsLocationChange,
  calculatePath,
  getTargetForBehavior,
  WAYPOINTS,
  MEETING_CHAIRS,
  OVERFLOW_POSITIONS,
  OVERFLOW_SLOT_BY_XY,
  HOME_POSITIONS,
} from '../src/systems/movementSystem.js'

// ─── calcFacing ──────────────────────────────────────────────────────
describe('calcFacing', () => {
  it('returns "down" when position is unchanged (dx < 2, dy < 2)', () => {
    expect(calcFacing(100, 100, 100, 100)).toBe('down')
    expect(calcFacing(100, 100, 101, 100)).toBe('down') // dx=1 < threshold
    expect(calcFacing(100, 100, 100, 101)).toBe('down') // dy=1 < threshold
  })

  it('returns "right" for dominant rightward movement', () => {
    expect(calcFacing(100, 100, 200, 110)).toBe('right') // |dx|=100 > |dy|=10
    expect(calcFacing(0, 0, 50, 30)).toBe('right')
  })

  it('returns "left" for dominant leftward movement', () => {
    expect(calcFacing(200, 100, 100, 110)).toBe('left') // |dx|=100 > |dy|=10
    expect(calcFacing(0, 0, -50, 30)).toBe('left')
  })

  it('returns "down" for dominant downward movement', () => {
    expect(calcFacing(100, 100, 105, 200)).toBe('down') // |dy|=100 > |dx|=5
    expect(calcFacing(0, 0, 20, 50)).toBe('down')
  })

  it('returns "up" for dominant upward movement', () => {
    expect(calcFacing(100, 200, 105, 100)).toBe('up') // dy=-100, |dy| > |dx|=5
    expect(calcFacing(0, 100, 20, 50)).toBe('up')
  })

  it('picks horizontal when |dx| strictly greater than |dy|', () => {
    expect(calcFacing(0, 0, 31, 30)).toBe('right')
    expect(calcFacing(0, 0, -31, 30)).toBe('left')
  })

  it('picks vertical when |dy| strictly greater than |dx|', () => {
    expect(calcFacing(0, 0, 20, 21)).toBe('down')
    expect(calcFacing(0, 100, 20, 79)).toBe('up')
  })
})

// ─── needsLocationChange ─────────────────────────────────────────────
describe('needsLocationChange', () => {
  it('returns true for behaviors with a mapped destination', () => {
    expect(needsLocationChange('drink-coffee')).toBe(true)
    expect(needsLocationChange('whiteboard')).toBe(true)
    expect(needsLocationChange('nap')).toBe(true)
    expect(needsLocationChange('toilet')).toBe(true)
    expect(needsLocationChange('research')).toBe(true)
  })

  it('returns true for "meeting" (null destination — special-cased by key presence)', () => {
    expect(needsLocationChange('meeting')).toBe(true)
  })

  it('returns true for social behaviors', () => {
    expect(needsLocationChange('chat')).toBe(true)
    expect(needsLocationChange('thumbs-up')).toBe(true)
    expect(needsLocationChange('pass-document')).toBe(true)
  })

  it('returns false for work/home behaviors not in either list', () => {
    expect(needsLocationChange('work')).toBe(false)
    expect(needsLocationChange('code')).toBe(false)
    expect(needsLocationChange('read')).toBe(false)
    expect(needsLocationChange('unknown-behavior')).toBe(false)
  })
})

// ─── calculatePath — structural invariants ───────────────────────────
// Door and corridor waypoints carry jitter — tests verify structure and
// coordinate bounds, not exact pixel values.
function assertPathInvariants(path, to) {
  expect(Array.isArray(path)).toBe(true)
  expect(path.length).toBeGreaterThanOrEqual(1)
  // Last element is always the original destination
  const last = path[path.length - 1]
  expect(last.x).toBe(to.x)
  expect(last.y).toBe(to.y)
  // All waypoints stay within global canvas bounds
  for (const pt of path) {
    expect(pt.x).toBeGreaterThanOrEqual(0)
    expect(pt.x).toBeLessThanOrEqual(800)
    expect(pt.y).toBeGreaterThanOrEqual(0)
    expect(pt.y).toBeLessThanOrEqual(560)
  }
}

describe('calculatePath — structural invariants', () => {
  it('same zone (entrance) with clear line → direct [to] path', () => {
    const from = { x: 50,  y: 50 }
    const to   = { x: 180, y: 80 }
    const path = calculatePath(from, to)
    assertPathInvariants(path, to)
    expect(path).toHaveLength(1)
  })

  it('same zone mainOffice with desk crossing → corridor detour (length = 2)', () => {
    // Vertical line through PM desk (x1:105,y1:215,x2:175,y2:260)
    // and Designer desk (x1:105,y1:335,x2:175,y2:370) — always triggers corridor routing
    const from = { x: 140, y: 180 }
    const to   = { x: 140, y: 380 }
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      expect(path).toHaveLength(2) // [corridor/fallback, to]
    }
  })

  it('cross-zone mainOffice → meetingRoom always includes door waypoint', () => {
    const from = { x: 300, y: 280 } // center mainOffice
    const to   = { x: 700, y: 200 } // inside meetingRoom
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      expect(path.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('cross-zone entrance → lounge routes through doors', () => {
    const from = { x: 150, y: 60  } // entrance
    const to   = { x: 180, y: 490 } // lounge
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      expect(path.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('multi-zone lounge → research always has ≥ 3 waypoints (both doors + destination)', () => {
    const from = { x: 180, y: 490 } // lounge
    const to   = { x: 620, y: 490 } // research
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      // lounge→research: fromZone≠mainOffice & toZone≠mainOffice →
      // exits via mainToLounge door, then enters via mainToResearch door, then to
      expect(path.length).toBeGreaterThanOrEqual(3)
    }
  })
})

// ─── getTargetForBehavior ─────────────────────────────────────────────
describe('getTargetForBehavior', () => {
  it('meeting → position near meeting chair cluster', () => {
    // MEETING_CHAIRS: x ∈ [645,765], y ∈ [120,205]; jitter ±4px
    for (let i = 0; i < 20; i++) {
      const pos = getTargetForBehavior('dev', 'meeting', {})
      expect(pos).not.toBeNull()
      expect(pos.x).toBeGreaterThanOrEqual(620)
      expect(pos.x).toBeLessThanOrEqual(790)
      expect(pos.y).toBeGreaterThanOrEqual(100)
      expect(pos.y).toBeLessThanOrEqual(230)
    }
  })

  it('drink-coffee → position near coffeeArea in lounge zone', () => {
    // WAYPOINTS.coffeeArea = { x:80, y:475 }, jitter 24 → lounge floor zone
    for (let i = 0; i < 20; i++) {
      const pos = getTargetForBehavior('dev', 'drink-coffee', {})
      expect(pos).not.toBeNull()
      expect(pos.x).toBeGreaterThanOrEqual(15)
      expect(pos.x).toBeLessThanOrEqual(200)
      expect(pos.y).toBeGreaterThanOrEqual(420)
      expect(pos.y).toBeLessThanOrEqual(545)
    }
  })

  it('unknown behavior (not in BEHAVIOR_LOCATIONS) → HOME_POSITIONS for the agent', () => {
    expect(getTargetForBehavior('dev',  'work', {})).toEqual(HOME_POSITIONS['dev'])
    expect(getTargetForBehavior('arch', 'code', {})).toEqual(HOME_POSITIONS['arch'])
    expect(getTargetForBehavior('pm',   'read', {})).toEqual(HOME_POSITIONS['pm'])
  })

  it('unknown agentId with unknown behavior → null', () => {
    expect(getTargetForBehavior('nobody', 'work', {})).toBeNull()
  })

  it('social behavior with another agent → valid floor position', () => {
    const allAgents = {
      dev:  { position: { x: 340, y: 340 } },
      arch: { position: { x: 260, y: 264 } },
    }
    for (let i = 0; i < 20; i++) {
      const pos = getTargetForBehavior('dev', 'chat', allAgents)
      expect(pos).not.toBeNull()
      expect(pos.x).toBeGreaterThanOrEqual(15)
      expect(pos.x).toBeLessThanOrEqual(785)
      expect(pos.y).toBeGreaterThanOrEqual(15)
      expect(pos.y).toBeLessThanOrEqual(545)
    }
  })

  it('social behavior with no other agents → falls back to HOME_POSITIONS, no throw', () => {
    expect(() => getTargetForBehavior('dev', 'chat', {})).not.toThrow()
    expect(getTargetForBehavior('dev', 'chat', {})).toEqual(HOME_POSITIONS['dev'])
  })

  it('null allAgents → no throw, returns home position', () => {
    expect(() => getTargetForBehavior('dev', 'chat', null)).not.toThrow()
    expect(getTargetForBehavior('dev', 'chat', null)).toEqual(HOME_POSITIONS['dev'])
  })
})

// ─── calcFacing — tie and threshold edge cases ───────────────────────
describe('calcFacing — tie and threshold edge cases', () => {
  it('when |dx| === |dy|, vertical direction wins (> not >=)', () => {
    expect(calcFacing(0, 0,   10,  10)).toBe('down')
    expect(calcFacing(0, 10,  10,   0)).toBe('up')
    expect(calcFacing(0, 0,  -10, -10)).toBe('up')
    expect(calcFacing(0, 0,  -10,  10)).toBe('down')
  })

  it('dx=2 is NOT < 2, triggers horizontal (threshold is strict <)', () => {
    // condition: Math.abs(dx) < 2 && Math.abs(dy) < 2 — both must be strictly < 2
    // dx=2 fails the < 2 check → falls to directional → 'right'
    expect(calcFacing(0, 0, 2, 0)).toBe('right')
    expect(calcFacing(0, 0, -2, 0)).toBe('left')
    expect(calcFacing(0, 0, 0, 2)).toBe('down')
    expect(calcFacing(0, 0, 0, -2)).toBe('up')
  })

  it('dx=1 and dy=1 both satisfy < 2, still returns "down"', () => {
    expect(calcFacing(0, 0, 1, 1)).toBe('down') // both < 2 → early return
    expect(calcFacing(0, 0, -1, -1)).toBe('down')
  })
})

// ─── calculatePath — additional zone coverage ────────────────────────
describe('calculatePath — additional zone coverage', () => {
  it('same zone lounge → lounge (no desk check) → direct [to]', () => {
    const from = { x: 100, y: 470 }
    const to   = { x: 380, y: 520 }
    const path = calculatePath(from, to)
    assertPathInvariants(path, to)
    expect(path).toHaveLength(1)
  })

  it('same zone meetingRoom → meetingRoom → direct [to]', () => {
    const from = { x: 650, y: 100 }
    const to   = { x: 750, y: 380 }
    const path = calculatePath(from, to)
    assertPathInvariants(path, to)
    expect(path).toHaveLength(1)
  })

  it('same zone mainOffice corridor-to-corridor (no desk blocking) → direct [to]', () => {
    // y=290 sits between the desk rows — horizontal line hits no desk
    const from = { x: 300, y: 290 }
    const to   = { x: 550, y: 290 }
    const path = calculatePath(from, to)
    assertPathInvariants(path, to)
    expect(path).toHaveLength(1)
  })

  it('same point (from === to) → [to]', () => {
    const pt = { x: 300, y: 280 }
    const path = calculatePath(pt, { ...pt })
    assertPathInvariants(path, pt)
    expect(path).toHaveLength(1)
  })

  it('cross-zone mainOffice → lounge routes through door', () => {
    const from = { x: 300, y: 280 }
    const to   = { x: 100, y: 490 }
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      expect(path.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('cross-zone mainOffice → research routes through door', () => {
    const from = { x: 300, y: 280 }
    const to   = { x: 620, y: 490 }
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      expect(path.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('multi-zone research → meetingRoom has ≥ 3 waypoints', () => {
    const from = { x: 620, y: 490 } // research
    const to   = { x: 700, y: 200 } // meetingRoom
    for (let i = 0; i < 10; i++) {
      const path = calculatePath(from, to)
      assertPathInvariants(path, to)
      expect(path.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('all cross-zone pairs produce valid paths', () => {
    // Spot-check representative point in each zone
    const zones = {
      entrance:    { x: 150, y: 60  },
      mainOffice:  { x: 300, y: 280 },
      meetingRoom: { x: 700, y: 200 },
      lounge:      { x: 180, y: 490 },
      research:    { x: 620, y: 490 },
    }
    for (const [fromName, from] of Object.entries(zones)) {
      for (const [toName, to] of Object.entries(zones)) {
        if (fromName === toName) continue
        const path = calculatePath(from, to)
        assertPathInvariants(path, to)
      }
    }
  })
})

// ─── getTargetForBehavior — full BEHAVIOR_LOCATIONS sweep ─────────────
describe('getTargetForBehavior — all named destination behaviors', () => {
  const FLOOR = { xMin: 15, xMax: 785, yMin: 15, yMax: 545 }

  function assertOnFloor(pos, label) {
    expect(pos, label).not.toBeNull()
    expect(pos.x, `${label}.x`).toBeGreaterThanOrEqual(FLOOR.xMin)
    expect(pos.x, `${label}.x`).toBeLessThanOrEqual(FLOOR.xMax)
    expect(pos.y, `${label}.y`).toBeGreaterThanOrEqual(FLOOR.yMin)
    expect(pos.y, `${label}.y`).toBeLessThanOrEqual(FLOOR.yMax)
  }

  it('every BEHAVIOR_LOCATIONS entry returns a non-null on-floor position', () => {
    const behaviors = [
      'goto-coffee-machine', 'drink-coffee', 'drink-water', 'whiteboard',
      'nap', 'phone-call', 'toilet', 'research', 'print',
      'look-window', 'eat-snack', 'stretch', 'check-phone',
    ]
    for (const b of behaviors) {
      for (let i = 0; i < 5; i++) {
        assertOnFloor(getTargetForBehavior('dev', b, {}), `${b}[${i}]`)
      }
    }
  })

  it('look-window stays in entrance/hallway (y ≤ 133)', () => {
    // WAYPOINTS.window = { x:340, y:100 } — entrance floor zone y2:133
    for (let i = 0; i < 15; i++) {
      const pos = getTargetForBehavior('dev', 'look-window', {})
      expect(pos).not.toBeNull()
      expect(pos.y).toBeLessThanOrEqual(133)
    }
  })

  it('all social behaviors return on-floor positions when other agents present', () => {
    const allAgents = { arch: { position: { x: 260, y: 264 } } }
    for (const b of ['chat', 'thumbs-up', 'pass-document']) {
      for (let i = 0; i < 10; i++) {
        assertOnFloor(getTargetForBehavior('dev', b, allAgents), `${b}[${i}]`)
      }
    }
  })

  it('meeting with all chairs occupied still returns a valid position (uses fallback)', () => {
    // Fill all 8 MEETING_CHAIRS slots so every chair fails the isFree check
    const allAgents = {}
    MEETING_CHAIRS.forEach((c, i) => {
      allAgents[`agent${i}`] = { position: { x: c.x, y: c.y } }
    })
    for (let i = 0; i < 10; i++) {
      const pos = getTargetForBehavior('dev', 'meeting', allAgents)
      expect(pos).not.toBeNull()
      assertOnFloor(pos, `occupied-meeting[${i}]`)
    }
  })

  it('works correctly for all valid core roles as agentId', () => {
    for (const role of ['pm', 'arch', 'dev', 'ops', 'qa', 'res', 'designer']) {
      const pos = getTargetForBehavior(role, 'drink-coffee', {})
      assertOnFloor(pos, `${role}/drink-coffee`)
    }
  })

  it('agent with targetPosition contributes to occupied list (not just position)', () => {
    // social behavior — occupied list reads targetPosition when present
    const allAgents = {
      arch: { position: { x: 260, y: 264 }, targetPosition: { x: 400, y: 300 } },
    }
    for (let i = 0; i < 10; i++) {
      const pos = getTargetForBehavior('dev', 'chat', allAgents)
      assertOnFloor(pos, `targetPosition chat[${i}]`)
    }
  })
})

// ─── HOME_POSITIONS and OVERFLOW_POSITIONS bounds ─────────────────────
describe('HOME_POSITIONS and OVERFLOW_POSITIONS bounds', () => {
  it('all HOME_POSITIONS are within global floor bounds', () => {
    for (const [role, pos] of Object.entries(HOME_POSITIONS)) {
      expect(pos.x, `${role}.x`).toBeGreaterThanOrEqual(15)
      expect(pos.x, `${role}.x`).toBeLessThanOrEqual(785)
      expect(pos.y, `${role}.y`).toBeGreaterThanOrEqual(15)
      expect(pos.y, `${role}.y`).toBeLessThanOrEqual(545)
    }
  })

  it('all OVERFLOW_POSITIONS are in entrance/hallway (y ≤ 133)', () => {
    for (const pos of OVERFLOW_POSITIONS) {
      expect(pos.x).toBeGreaterThanOrEqual(15)
      expect(pos.x).toBeLessThanOrEqual(593)
      expect(pos.y).toBeGreaterThanOrEqual(15)
      expect(pos.y).toBeLessThanOrEqual(133)
    }
  })
})

// ─── Exported constants integrity ────────────────────────────────────
describe('exported constants integrity', () => {
  it('OVERFLOW_SLOT_BY_XY maps every OVERFLOW_POSITIONS entry to its index', () => {
    expect(OVERFLOW_SLOT_BY_XY.size).toBe(OVERFLOW_POSITIONS.length)
    OVERFLOW_POSITIONS.forEach((pos, i) => {
      const key = `${pos.x},${pos.y}`
      expect(OVERFLOW_SLOT_BY_XY.get(key), `slot for ${key}`).toBe(i)
    })
  })

  it('HOME_POSITIONS contains all core agent roles with numeric x,y', () => {
    const coreRoles = ['pm', 'arch', 'dev', 'ops', 'qa', 'res', 'designer']
    for (const role of coreRoles) {
      const pos = HOME_POSITIONS[role]
      expect(pos, `HOME_POSITIONS.${role}`).toBeDefined()
      expect(typeof pos.x, `${role}.x`).toBe('number')
      expect(typeof pos.y, `${role}.y`).toBe('number')
    }
  })

  it('WAYPOINTS contains expected destination keys', () => {
    for (const key of ['coffeeArea', 'whiteboard', 'lounge', 'gate', 'window', 'waterCooler']) {
      expect(WAYPOINTS[key], `WAYPOINTS.${key}`).toBeDefined()
    }
  })

  it('MEETING_CHAIRS is a non-empty array of {x,y} objects', () => {
    expect(Array.isArray(MEETING_CHAIRS)).toBe(true)
    expect(MEETING_CHAIRS.length).toBeGreaterThan(0)
    for (const chair of MEETING_CHAIRS) {
      expect(typeof chair.x).toBe('number')
      expect(typeof chair.y).toBe('number')
    }
  })
})
