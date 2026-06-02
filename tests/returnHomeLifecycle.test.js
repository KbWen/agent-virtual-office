import { describe, it, expect } from 'vitest'
import { useOfficeStore } from '../src/systems/store.js'
import { calculatePath, HOME_POSITIONS, WAYPOINTS } from '../src/systems/movementSystem.js'

// Covers the store↔movement handoff that AgentCharacter's return-home effect relies on:
// when an external status clears, every static role is flagged to walk home, the flag is
// consumed exactly once, and the computed return route actually TERMINATES at the home
// position (so the agent is visibly back at its desk, not stranded a few steps short).
const STATIC_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const AWAY_POINTS = [
  WAYPOINTS.coffeeArea,
  WAYPOINTS.whiteboard,
  WAYPOINTS.lounge,
  WAYPOINTS.researchLib,
  WAYPOINTS.phone,
  WAYPOINTS.window,
  WAYPOINTS.toilet,
]

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

describe('return-home lifecycle — store intent + movement endpoint', () => {
  it('clearExternalStatus flags every active static role to return home, then the intent is consumed exactly once', () => {
    const { applyExternalStatus, clearExternalStatus, clearReturnHomeIntent } = useOfficeStore.getState()

    applyExternalStatus(
      STATIC_ROLES.map((role) => ({ agentId: role, status: 'working', task: 'Bash', label: `task-${role}` })),
      { source: 'simulation', statusSource: 'external', integrationSource: 'simulation' },
    )
    clearExternalStatus()

    for (const role of STATIC_ROLES) {
      const a = useOfficeStore.getState().agents[role]
      expect(a, `${role} exists`).toBeTruthy()
      expect(a.status, `${role}.status`).toBe('idle')
      expect(a.returnHomeOnIdle, `${role}.returnHomeOnIdle after clear`).toBe(true)
    }

    // Consume-once: the component clears the flag the moment it starts walking home.
    // A second clear must be a no-op and must NOT disturb idle state — otherwise the
    // effect could re-fire and restart the walk in a loop.
    for (const role of STATIC_ROLES) {
      clearReturnHomeIntent(role)
      const after = useOfficeStore.getState().agents[role]
      expect(after.returnHomeOnIdle, `${role}.returnHomeOnIdle consumed`).toBe(false)
      expect(after.status, `${role}.status preserved`).toBe('idle')

      const snapshot = useOfficeStore.getState()
      clearReturnHomeIntent(role)
      expect(useOfficeStore.getState(), `${role} second clear is a no-op`).toBe(snapshot)
    }
  })

  it('a return-home route from every away location terminates at the role home position', () => {
    for (const role of STATIC_ROLES) {
      const home = HOME_POSITIONS[role]
      for (const away of AWAY_POINTS) {
        const path = calculatePath(away, home)
        expect(path.length, `${role} return route from (${away.x},${away.y}) is empty`).toBeGreaterThanOrEqual(1)
        const end = path[path.length - 1]
        expect(
          dist(end, home),
          `${role} return route ends ${dist(end, home).toFixed(1)}px from home (${end.x},${end.y}) vs (${home.x},${home.y})`,
        ).toBeLessThanOrEqual(2)
      }
    }
  })

  it('a route that is already at home stays trivial (guarded by the <5px idle check)', () => {
    for (const role of STATIC_ROLES) {
      const home = HOME_POSITIONS[role]
      const path = calculatePath(home, home)
      expect(path.length, `${role} home→home path`).toBe(1)
      expect(dist(path[0], home)).toBe(0)
    }
  })
})
