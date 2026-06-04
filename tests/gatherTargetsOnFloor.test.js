import { describe, it, expect, afterEach } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { isOnFloor, isOnObstacle } from '../src/systems/movementSystem.js'

// Regression guard (the gap that let the standup-spread bug ship green): event gather targets must
// never place an agent in a wall or on furniture. Two layers:
//   (1) the STORE clamps every groupTarget (systemic guarantee — no handler can bypass it).
//   (2) the standup spots themselves are on-floor with jitter margin (catches a future bad edit).

afterEach(() => { useOfficeStore.getState().clearAgentGroupEvent('dev') })

describe('event gather targets stay on the walkable floor', () => {
  it('the store CLAMPS an off-floor groupTarget (agent can never be placed in a wall/furniture)', () => {
    const bad = [
      { x: 612, y: 360 }, // the dead wall gap between mainOffice (x≤593) and meetingRoom (x≥628)
      { x: 999, y: 999 }, // far off-map
      { x: 545, y: 320 }, // ON the whiteboard obstacle (x525-590, y278-342)
    ]
    for (const gt of bad) {
      useOfficeStore.getState().setMultipleAgentGroupEvents([
        { id: 'dev', behavior: 'meeting', expression: 'normal', bubble: null, groupTarget: gt },
      ])
      const g = useOfficeStore.getState().agents.dev.groupTarget
      expect(isOnFloor(g.x, g.y), `clamp ${JSON.stringify(gt)}→${JSON.stringify(g)} must be on floor`).toBe(true)
      expect(isOnObstacle(g.x, g.y), `clamp ${JSON.stringify(gt)}→${JSON.stringify(g)} must be clear of furniture`).toBe(false)
    }
  })

  it('the standup gather spots are all on-floor + clear of furniture (incl. ±4 jitter corners)', () => {
    // Mirror of officeLife.js standup whiteboardSpots — fails loudly if a future edit drifts one off-floor.
    const spots = [
      { x: 500, y: 350 }, { x: 525, y: 348 }, { x: 550, y: 350 }, { x: 578, y: 354 },
      { x: 445, y: 382 }, { x: 490, y: 384 }, { x: 535, y: 382 }, { x: 578, y: 380 },
    ]
    for (const s of spots) {
      for (const dx of [-4, 4]) for (const dy of [-4, 4]) {
        expect(isOnFloor(s.x + dx, s.y + dy), `standup ${JSON.stringify(s)}+(${dx},${dy}) off-floor`).toBe(true)
        expect(isOnObstacle(s.x + dx, s.y + dy), `standup ${JSON.stringify(s)}+(${dx},${dy}) on furniture`).toBe(false)
      }
    }
  })
})
