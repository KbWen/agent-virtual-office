import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { isOnObstacle, isOnFloor } from '../src/systems/movementSystem.js'

// Nightly sim-soak catch, 2026-08-16 (run 31925068076 on main cb6a76e):
//   [offFloorRest]    ops resting at (89,103)
//   [sustainedStack]  gate+ops dist 25, group:true
// Forensic tail: ops walked (115,175) -> (95,108) -> (89,103) with m=1,o=1 — in transit and
// already inside furniture — then a group event froze it there (m=0, g=1) for the event's
// duration, 25px from `gate` standing at its HOME (100,80).
//
// Mechanism: the react-in-place branch of the group-event chokepoints validated the resting
// position ONLY when the frozen agent happened to visually overlap another agent. With no
// overlap it left `groupTarget` null and froze the agent exactly where it stood — including
// inside an obstacle. The neighbouring `groupTarget` branch has always run clampToFloor.
//
// These tests pin the agent-vs-MAP half of the contract. tests/agentSeparationInvariants.test.js
// covers the agent-vs-AGENT half; both flow through the same two store chokepoints.
//
// NOTE: (89,103) is `isOnFloor: true` but `isOnObstacle: true` — the soak's `offFloor` flag is
// `!isOnFloor || isOnObstacle`, so "off-floor rest" includes standing inside furniture. Asserting
// only `isOnFloor` here would pass against the broken code and prove nothing.
describe('react-in-place group-event participants come to rest somewhere valid', () => {
  const OBSTACLE_POS = { x: 89, y: 103 }   // the exact coordinate the soak caught

  beforeEach(() => {
    expect(isOnObstacle(OBSTACLE_POS.x, OBSTACLE_POS.y), 'fixture must sit inside furniture').toBe(true)
    expect(isOnFloor(OBSTACLE_POS.x, OBSTACLE_POS.y), 'fixture is on-floor-but-in-furniture').toBe(true)
  })

  afterEach(() => {
    const s = useOfficeStore.getState()
    Object.keys(s.agents).forEach((id) => s.clearAgentGroupEvent(id))
  })

  // Where the agent actually ends up standing: a group target when one was resolved,
  // otherwise wherever it was frozen.
  const restingSpot = (id) => {
    const a = useOfficeStore.getState().agents[id]
    return a.groupTarget || a.position
  }

  const freezeInsideFurniture = (id) => {
    useOfficeStore.setState((st) => ({
      agents: {
        ...st.agents,
        [id]: { ...st.agents[id], position: { ...OBSTACLE_POS }, targetPosition: { ...OBSTACLE_POS }, isMoving: true, inGroupEvent: false },
      },
    }))
  }

  // Park every other agent far away so the frozen one overlaps NOBODY — that is the branch
  // the soak exercised, and the branch that skipped validation entirely.
  const scatterOthers = (exceptId) => {
    useOfficeStore.setState((st) => {
      const agents = { ...st.agents }
      let n = 0
      for (const id of Object.keys(agents)) {
        if (id === exceptId) continue
        const far = { x: 600 + (n % 3) * 60, y: 420 + Math.floor(n / 3) * 60 }
        agents[id] = { ...agents[id], position: far, targetPosition: far, isMoving: false, inGroupEvent: false }
        n++
      }
      return { agents }
    })
  }

  it('setAgentGroupEvent: an agent frozen inside furniture is not left standing there', () => {
    const actor = Object.keys(useOfficeStore.getState().agents)[0]
    scatterOthers(actor)
    freezeInsideFurniture(actor)

    useOfficeStore.getState().setAgentGroupEvent(actor, {
      behavior: 'coffee-spill', expression: 'surprised', bubble: null, groupTarget: null,
    })

    const at = restingSpot(actor)
    expect(isOnObstacle(at.x, at.y), `rests inside furniture at (${Math.round(at.x)},${Math.round(at.y)})`).toBe(false)
    expect(isOnFloor(at.x, at.y), `rests off the walkable floor at (${Math.round(at.x)},${Math.round(at.y)})`).toBe(true)
  })

  it('setMultipleAgentGroupEvents: same guarantee on the batch chokepoint', () => {
    const actor = Object.keys(useOfficeStore.getState().agents)[0]
    scatterOthers(actor)
    freezeInsideFurniture(actor)

    useOfficeStore.getState().setMultipleAgentGroupEvents([
      { id: actor, behavior: 'coffee-spill', expression: 'surprised', bubble: null, groupTarget: null },
    ])

    const at = restingSpot(actor)
    expect(isOnObstacle(at.x, at.y), `rests inside furniture at (${Math.round(at.x)},${Math.round(at.y)})`).toBe(false)
    expect(isOnFloor(at.x, at.y), `rests off the walkable floor at (${Math.round(at.x)},${Math.round(at.y)})`).toBe(true)
  })

  it('an agent frozen somewhere already valid is left exactly where it stood', () => {
    const actor = Object.keys(useOfficeStore.getState().agents)[0]
    scatterOthers(actor)
    const VALID = { x: 115, y: 175 }   // ops' own start point from the same forensic tail
    expect(isOnObstacle(VALID.x, VALID.y)).toBe(false)
    useOfficeStore.setState((st) => ({
      agents: { ...st.agents, [actor]: { ...st.agents[actor], position: { ...VALID }, targetPosition: { ...VALID }, isMoving: true, inGroupEvent: false } },
    }))

    useOfficeStore.getState().setAgentGroupEvent(actor, {
      behavior: 'coffee-spill', expression: 'surprised', bubble: null, groupTarget: null,
    })

    const at = restingSpot(actor)
    expect(at.x).toBe(VALID.x)
    expect(at.y).toBe(VALID.y)
  })
})
