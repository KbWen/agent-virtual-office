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
  }, 10_000)

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

describe('behaviorEngine — getHourModifiers exact values', () => {
  it('hour 12: lunch break weights (strong away)', () => {
    expect(getHourModifiers(12)).toEqual({ away: 40, daily: 30, work: 20, social: 10 })
  })

  it('hour 14: post-lunch weights (mixed)', () => {
    expect(getHourModifiers(14)).toEqual({ work: 30, daily: 35, social: 15, away: 20 })
  })

  it('hour 20: overtime weights (heavy work)', () => {
    expect(getHourModifiers(20)).toEqual({ work: 70, daily: 15, social: 5, away: 10 })
  })

  it('hours 13 and 15-19 fall outside all special windows → null', () => {
    for (const h of [13, 15, 16, 17, 18, 19]) {
      expect(getHourModifiers(h), `hour ${h}`).toBeNull()
    }
  })

  it('hours 0-11 (excluding 12) return null', () => {
    for (const h of [0, 1, 5, 7, 9, 10, 11]) {
      expect(getHourModifiers(h), `hour ${h}`).toBeNull()
    }
  })

  it('hour window boundaries: 11 → null, 12 → lunch, 13 → null, 14 → drowsy, 15 → null, 20 → overtime', () => {
    expect(getHourModifiers(11)).toBeNull()
    expect(getHourModifiers(12)).not.toBeNull()
    expect(getHourModifiers(13)).toBeNull()
    expect(getHourModifiers(14)).not.toBeNull()
    expect(getHourModifiers(15)).toBeNull()
    expect(getHourModifiers(20)).not.toBeNull()
  })
})

describe('behaviorEngine — role-specific behavior filtering', () => {
  it('pm-only "gantt-chart" appears for pm in working/intense (in 500 runs)', () => {
    let sawGantt = false
    for (let i = 0; i < 500; i++) {
      const next = getNextBehavior('pm', 'working', 9, 'intense')
      if (next.behaviorId === 'gantt-chart') { sawGantt = true; break }
    }
    expect(sawGantt).toBe(true)
  })

  it('pm-only "gantt-chart" never appears for dev (500 runs)', () => {
    for (let i = 0; i < 500; i++) {
      expect(getNextBehavior('dev', 'working', 9, 'intense').behaviorId).not.toBe('gantt-chart')
    }
  })

  it('qa-only "magnifier" never appears for ops (500 runs)', () => {
    for (let i = 0; i < 500; i++) {
      expect(getNextBehavior('ops', 'working', 9, 'intense').behaviorId).not.toBe('magnifier')
    }
  })

  it('ops-only "deploy-button" never appears for arch (500 runs)', () => {
    for (let i = 0; i < 500; i++) {
      expect(getNextBehavior('arch', 'working', 9, 'normal').behaviorId).not.toBe('deploy-button')
    }
  })

  it('composite agentId "feat-x~dev" extracts dev role: no role-restricted behaviors from other roles', () => {
    const otherRoleOnly = ['gantt-chart', 'magnifier', 'deploy-button', 'shield-verify']
    for (let i = 0; i < 300; i++) {
      const next = getNextBehavior('feat-x~dev', 'working', 9, 'intense')
      expect(otherRoleOnly, `feat-x~dev got restricted behavior: ${next.behaviorId}`).not.toContain(next.behaviorId)
    }
  })
})

// AVO-133: a blocked agent must visibly read as "stuck" — the behavior engine biases it
// toward the frustration cluster (scratch-head / sigh / desk-slam) so trouble is legible
// from posture in peripheral vision before anyone clicks to inspect.
describe('getNextBehavior — blocked biases toward frustration (AVO-133)', () => {
  const FRUSTRATED = ['scratch-head', 'sigh', 'desk-slam']

  it('picks the frustrated category far above a uniform baseline when blocked', () => {
    let frustrated = 0
    const N = 400
    for (let i = 0; i < N; i++) {
      // hour 10 = no hour modifier, mood normal = no mood blend → clean status weights
      if (getNextBehavior('dev', 'blocked', 10, 'normal').category === 'frustrated') frustrated++
    }
    // blocked weights frustrated at 60/100; a uniform pick over 5 categories would be ~20%
    expect(frustrated / N).toBeGreaterThan(0.4)
  })

  it('every frustrated behavior a blocked agent picks is the scratch-head/sigh/desk-slam cluster', () => {
    const seen = new Set()
    for (let i = 0; i < 400; i++) {
      const b = getNextBehavior('qa', 'blocked', 10, 'normal')
      if (b.category === 'frustrated') seen.add(b.behaviorId)
    }
    expect(seen.size).toBeGreaterThan(0)
    for (const id of seen) expect(FRUSTRATED).toContain(id)
  })

  it('an idle agent does NOT read as frustrated (contrast — no false "stuck" signal)', () => {
    let frustrated = 0
    for (let i = 0; i < 400; i++) {
      if (getNextBehavior('dev', 'idle', 10, 'normal').category === 'frustrated') frustrated++
    }
    expect(frustrated / 400).toBeLessThan(0.2)
  })
})
