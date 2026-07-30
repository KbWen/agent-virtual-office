import { describe, it, expect, vi } from 'vitest'
import { calculateJourney, calculatePath, DOOR_SIDES, visuallyOverlapping } from '../src/systems/movementSystem.js'
import { DOOR_JITTER } from '../src/systems/constants.js'
import { STACK_DIST_PX } from '../scripts/soakInvariants.mjs'

// ─── CHARACTERIZATION OF A KNOWN, UNFIXED DEFECT — these assertions encode what IS, not
// what SHOULD be. They PASS today on purpose.
//
// `jitterDoorCrossing` (movementSystem.js) offsets the crossing waypoints ONLY PERPENDICULAR
// to travel (`travelX ? {x: side.x, y: side.y + off} : {x: side.x + off, y: side.y}`). So at
// every door the TRAVEL axis gets EXACTLY ZERO spread, and two agents pausing at the same door
// side are at most DOOR_JITTER apart — inside the soak's STACK_DIST_PX alarm AND inside the
// sprite ellipse. Any pause at a door is therefore a GUARANTEED visual stack.
//
// Its own comment cites the 2026-06-10 forensic where 10/12 real standing-stack events sat at
// the literal coordinate (240,386) — the coordinate `mainToLounge` STILL pins on y today. The
// mitigation turned a 0px point-stack into a 20px line segment; it never reached its own 30px
// alarm. Measured 2026-07-16: 4/4 clean-CI soak stacks landed at x=585 exactly (`mainToMeeting`).
//
// DO NOT "fix" this by raising DOOR_JITTER — the doorway is ~50px wide and `isOnFloor`/
// `isOnObstacle` reject anything outside the passage, so no jitter value can reliably clear
// 30px. THE GEOMETRY CANNOT HOLD TWO AGENTS 30px APART. The real fix is TEMPORAL — a door
// claim / one-at-a-time crossing, i.e. target-time deconfliction per ADR-004 — not spatial.
// This test exists so that raising DOOR_JITTER fails loudly instead of looking like a fix.
describe('door crossing separation (characterization: known defect, not a spec)', () => {
  // Each agent's offset is (Math.random() - 0.5) * DOOR_JITTER, i.e. ±DOOR_JITTER/2, so the
  // worst case two agents can be spread on the free axis is exactly DOOR_JITTER.
  const pairAt = (side, travelX) => [
    travelX ? { x: side.x, y: side.y - DOOR_JITTER / 2 } : { x: side.x - DOOR_JITTER / 2, y: side.y },
    travelX ? { x: side.x, y: side.y + DOOR_JITTER / 2 } : { x: side.x + DOOR_JITTER / 2, y: side.y },
  ]

  for (const [door, sides] of Object.entries(DOOR_SIDES)) {
    const [from, to] = Object.values(sides)
    const travelX = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)

    it(`${door}: pins the travel axis at zero spread and cannot clear the stack alarm`, () => {
      for (const [label, side] of Object.entries(sides)) {
        const [a, b] = pairAt(side, travelX)
        const where = `${door}.${label}`

        // The travel axis is never offset — every agent crosses at the identical coordinate.
        expect(travelX ? Math.abs(a.x - b.x) : Math.abs(a.y - b.y), `${where}: travel-axis spread`).toBe(0)

        // Best case the jitter can do, and it is not enough.
        const spread = Math.hypot(a.x - b.x, a.y - b.y)
        expect(spread, `${where}: max achievable spread`).toBe(DOOR_JITTER)
        expect(spread, `${where}: STILL inside the soak's stack alarm — the defect`).toBeLessThan(STACK_DIST_PX)

        // ...and still a visual stack to the user's eye (the ellipse is 32x44).
        expect(visuallyOverlapping(a, b), `${where}: maximally-spread door pair STILL overlaps`).toBe(true)
      }
    })
  }

  it('documents that no DOOR_JITTER value can fix this spatially', () => {
    // Would need > 2x the alarm to guarantee clearance from a random ±JITTER/2 draw, through a
    // ~50px opening. Recorded so the next reader does not re-derive it by trying.
    expect(DOOR_JITTER).toBeLessThan(STACK_DIST_PX * 2)
  })
})

describe('calculateJourney — physical door identity', () => {
  it('reports no door for a same-zone journey without changing calculatePath output', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const from = { x: 300, y: 250 }
    const to = { x: 420, y: 250 }

    const journey = calculateJourney(from, to)
    expect(journey.doorIds).toEqual([])
    expect(journey.waypoints).toEqual(calculatePath(from, to))
    vi.restoreAllMocks()
  })

  it('reports one physical door for main-office to lounge travel', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const journey = calculateJourney({ x: 300, y: 250 }, { x: 180, y: 490 })
    expect(journey.doorIds).toEqual(['mainToLounge'])
    vi.restoreAllMocks()
  })

  it('reports both physical doors in traversal order for a multi-room journey', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const journey = calculateJourney({ x: 180, y: 490 }, { x: 620, y: 490 })
    expect(journey.doorIds).toEqual(['mainToLounge', 'mainToResearch'])
    vi.restoreAllMocks()
  })
})
