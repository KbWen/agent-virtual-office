import { describe, it, expect } from 'vitest'
import { getNextBehavior, getHourModifiers } from '../src/systems/behaviorEngine.js'

// Every VALID_ROLE plus a couple of composite worktree ids — getNextBehavior must
// produce a well-formed result for all of them, including the fallback path.
const ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
const COMPOSITES = ['feat-x~dev', 'long-slug~qa', 'a~b~ops']
const STATUSES = ['idle', 'working', 'done', 'blocked']

describe('behaviorEngine — getNextBehavior contract', () => {
  it('always returns a well-formed behavior object — finite positive duration', () => {
    // Exhaustive sweep: every role × status × representative hours × moods.
    const hours = [0, 9, 12, 14, 20, 23]
    const moods = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
    for (const role of [...ROLES, ...COMPOSITES]) {
      for (const status of STATUSES) {
        for (const hour of hours) {
          for (const mood of moods) {
            // Repeat — weightedRandom is stochastic, exercise many category picks.
            for (let i = 0; i < 12; i++) {
              const next = getNextBehavior(role, status, hour, mood)
              expect(typeof next.behaviorId, `${role}/${status}/${hour}/${mood} behaviorId`).toBe('string')
              expect(next.behaviorId.length).toBeGreaterThan(0)
              expect(typeof next.expression).toBe('string')
              expect(next.expression.length).toBeGreaterThan(0)
              // A NaN/Infinity/<=0 duration would spin doSchedule's setTimeout in a CPU loop.
              expect(Number.isFinite(next.duration), `${role}/${status} duration finite`).toBe(true)
              expect(next.duration).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('never returns an undefined behaviorId from the fallback path', () => {
    // gate/designer only match a few work behaviors — the work category for them is
    // a thin filtered pool. Hammer it to ensure pickBehavior never yields a bad shape.
    for (let i = 0; i < 500; i++) {
      const next = getNextBehavior('gate', 'working', 9, 'intense')
      expect(next.behaviorId).toBeTypeOf('string')
      expect(Number.isFinite(next.duration)).toBe(true)
    }
  })

  it('blocked status can route through the frustrated category with a valid shape', () => {
    let sawFrustrated = false
    for (let i = 0; i < 400; i++) {
      const next = getNextBehavior('dev', 'blocked', 9, 'normal')
      expect(Number.isFinite(next.duration)).toBe(true)
      expect(next.behaviorId).toBeTypeOf('string')
      if (next.category === 'frustrated') sawFrustrated = true
    }
    expect(sawFrustrated).toBe(true)
  })

  it('getHourModifiers returns null outside special windows, objects inside', () => {
    expect(getHourModifiers(9)).toBe(null)
    expect(getHourModifiers(12)).toMatchObject({ away: expect.any(Number) })
    expect(getHourModifiers(14)).toMatchObject({ work: expect.any(Number) })
    expect(getHourModifiers(21)).toMatchObject({ work: expect.any(Number) })
  })
})
