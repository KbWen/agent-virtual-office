/**
 * Test-the-test for the sim-soak gate (AVO-157, same doctrine as ci-render-smoke AC-6):
 * the evaluator must CATCH each planted violation class and stay SILENT on healthy
 * timelines — a gate that can't fail (or cries wolf) protects nothing.
 */
import { describe, it, expect } from 'vitest'
import {
  evaluateSoak, TELEPORT_STEP_PX, STACK_SUSTAIN_MS, FROZEN_WALKER_MS,
} from '../scripts/soakInvariants.mjs'

// Build a timeline from per-agent track functions: track(id)(t) -> {x,y,moving?,group?,offFloor?}
// offFloor is a per-sample flag (computed in-page by the real runner; planted here directly —
// the geometry functions themselves are covered by furnitureObstacleCompleteness.test.js).
function timeline(ms, step, tracks) {
  const samples = []
  for (let t = 0; t <= ms; t += step) {
    const agents = {}
    for (const [id, fn] of Object.entries(tracks)) {
      const a = fn(t)
      agents[id] = { moving: false, group: false, offFloor: false, ...a }
    }
    samples.push({ t, agents })
  }
  return samples
}

const still = (x, y, extra = {}) => () => ({ x, y, ...extra })
const walk = (x0, y0, vx, vy, extra = {}) => (t) => ({ x: x0 + vx * t / 1000, y: y0 + vy * t / 1000, moving: true, ...extra })

describe('healthy timelines stay silent', () => {
  it('desk work + a normal 60px/s walk → 0 violations', () => {
    const s = timeline(60000, 250, {
      pm: still(140, 264),
      dev: walk(340, 364, 60, 0),
      qa: still(400, 244),
    })
    const r = evaluateSoak(s)
    expect(r.pass).toBe(true)
    expect(r.total).toBe(0)
  })

  it('a brief walk-past within 30px does NOT fire (under sustain threshold)', () => {
    // dev crosses pm's spot at 60px/s — inside 30px for ~1s, never at rest.
    const s = timeline(20000, 250, {
      pm: still(300, 300),
      dev: walk(0, 300, 60, 0),
    })
    expect(evaluateSoak(s).violations.sustainedStack).toHaveLength(0)
  })

  it('a long legitimate desk rest with isMoving=false → no frozenWalker', () => {
    const s = timeline(FROZEN_WALKER_MS * 2, 250, { pm: still(140, 264) })
    expect(evaluateSoak(s).violations.frozenWalker).toHaveLength(0)
  })
})

describe('planted violations are caught', () => {
  it('teleport: a single 100px jump between healthy samples', () => {
    const s = timeline(5000, 250, {
      dev: (t) => (t < 2500 ? { x: 100, y: 100 } : { x: 200, y: 100 }),
    })
    const r = evaluateSoak(s)
    expect(r.violations.teleport.length).toBeGreaterThanOrEqual(1)
    expect(r.violations.teleport[0].id).toBe('dev')
    expect(r.violations.teleport[0].step).toBeGreaterThan(TELEPORT_STEP_PX)
  })

  it('teleport is SKIPPED when the sampler itself stalled (gap > 600ms)', () => {
    const samples = [
      { t: 0, agents: { dev: { x: 100, y: 100, moving: false, group: false } } },
      { t: 250, agents: { dev: { x: 100, y: 100, moving: false, group: false } } },
      // 6s sampler stall (tab hidden / main-thread freeze) then a legit GAP_SNAP jump:
      { t: 6250, agents: { dev: { x: 250, y: 100, moving: false, group: false } } },
    ]
    expect(evaluateSoak(samples).violations.teleport).toHaveLength(0)
  })

  it('sustained stack: two agents at rest 10px apart for >3s — fired once per episode', () => {
    const s = timeline(STACK_SUSTAIN_MS * 4, 250, {
      pm: still(240, 386),
      dev: still(240, 396),
    })
    const r = evaluateSoak(s)
    expect(r.violations.sustainedStack).toHaveLength(1)
    expect(r.violations.sustainedStack[0].pair).toBe('dev+pm')
  })

  it('group-event stacks FAIL again and stay group-tagged (arrival geometry fixed 2026-06-11)', () => {
    // The store chokepoints now deconflict event targets against bystanders AND side-step
    // react-in-place participants — a group stack therefore means a real regression.
    const s = timeline(STACK_SUSTAIN_MS * 2, 250, {
      pm: still(660, 205, { group: true }),
      dev: still(662, 210, { group: true }),
    })
    const r = evaluateSoak(s)
    expect(r.violations.sustainedStack).toHaveLength(1)
    expect(r.violations.sustainedStack[0].group).toBe(true)
    expect(r.pass).toBe(false)
  })

  it('frozen walker: isMoving=true with still pixels past 90s (the frozen-pm class)', () => {
    const s = timeline(FROZEN_WALKER_MS + 10000, 250, {
      pm: still(240, 386, { moving: true }),
    })
    const r = evaluateSoak(s)
    expect(r.violations.frozenWalker.length).toBeGreaterThanOrEqual(1)
    expect(r.violations.frozenWalker[0].id).toBe('pm')
  })

  it('frozen walker does NOT fire when the walk recovers before 90s', () => {
    const s = timeline(FROZEN_WALKER_MS + 20000, 250, {
      pm: (t) => (t < 60000 ? { x: 240, y: 386, moving: true } : { x: 240 + (t - 60000) * 0.06, y: 386, moving: true }),
    })
    expect(evaluateSoak(s).violations.frozenWalker).toHaveLength(0)
  })

  it('off-floor rest: an agent standing inside furniture for >2s — once per episode', () => {
    const s = timeline(8000, 250, { dev: still(95, 100, { offFloor: true }) })
    const r = evaluateSoak(s)
    expect(r.violations.offFloorRest).toHaveLength(1)
    expect(r.violations.offFloorRest[0].id).toBe('dev')
  })

  it('walking THROUGH a non-floor band does not fire off-floor (rest-gated)', () => {
    const s = timeline(4000, 250, { dev: walk(100, 300, 60, 0, { offFloor: true }) })
    expect(evaluateSoak(s).violations.offFloorRest).toHaveLength(0)
  })

  it('every violation carries a forensic tail (approach trajectory, self-diagnosing)', () => {
    const s = timeline(8000, 250, { dev: still(95, 100, { offFloor: true }) })
    const tail = evaluateSoak(s).violations.offFloorRest[0].tail
    expect(Array.isArray(tail)).toBe(true)
    expect(tail.length).toBeGreaterThanOrEqual(8)
    expect(tail[tail.length - 1]).toMatchObject({ x: 95, y: 100, o: 1 })

    const stack = timeline(STACK_SUSTAIN_MS * 4, 250, { pm: still(240, 386), dev: still(240, 396) })
    const sv = evaluateSoak(stack).violations.sustainedStack[0]
    expect(sv.tailA.length).toBeGreaterThanOrEqual(8)
    expect(sv.tailB.length).toBeGreaterThanOrEqual(8)
  })
})

// ─── AVO-195: stale behaviour labels surface as a non-failing warning ─────────────────────────

describe('evaluateSoak — stale behaviour labels (AVO-195)', () => {
  const INTERVAL = 250
  // 600 intervals = 150s, past the 90s threshold. Position advances so the stretch also proves the
  // agent was MOVING while its label sat still -- the distinction that refuted "the scheduler froze".
  const line = (n, { beh, group = false, move = true }) => {
    const out = []
    for (let i = 0; i <= n; i++) {
      out.push({ t: i * INTERVAL, agents: { a: { x: 100 + (move ? i * 10 : 0), y: 50, moving: false, group, offFloor: false, beh } } })
    }
    return out
  }

  it('warns, and does NOT fail, when a label is held past the threshold outside an event', () => {
    const r = evaluateSoak(line(800, { beh: 'eat-snack' }))   // 200s, past the 180s threshold
    expect(r.warnings.staleLabel).toHaveLength(1)
    expect(r.warnings.staleLabel[0]).toMatchObject({ id: 'a', behavior: 'eat-snack' })
    expect(r.warnings.staleLabel[0].movedSamples).toBeGreaterThan(0)
    // Non-failing by design on first landing -- promotion follows the groupStack route.
    expect(r.pass).toBe(true)
    expect(r.total).toBe(0)
  })

  it('does not warn while the agent is in a group event', () => {
    // officeLife owns behaviour for an event's whole duration; that is not a stale label.
    expect(evaluateSoak(line(800, { beh: 'meeting', group: true })).warnings.staleLabel).toHaveLength(0)
  })

  it('does NOT warn at a duration two consecutive identical picks can legitimately produce', () => {
    // A behaviour lasts <= 65s and a walk adds ~10-20s, so ~170s is reachable without any defect.
    // A 90s threshold false-positived on the first real soak at 94.9s and 100.5s; this pins that
    // the number is now derived from the ceiling rather than fitted to a sample.
    const r = evaluateSoak(line(600, { beh: 'typing' }))       // 150s
    expect(r.warnings.staleLabel).toHaveLength(0)
    // ...but the duration is still REPORTED, so a trend is visible below the threshold.
    expect(r.warnings.maxStaleLabelMs).toBe(599 * 250)   // (n-1) intervals: sample 0 establishes the label
  })

  it('reports the observed maximum every run, not just when it crosses', () => {
    expect(evaluateSoak(line(40, { beh: 'typing' })).warnings.maxStaleLabelMs).toBe(39 * 250)
  })

  it('reports an EMPTY warning list, never a crash, when the timeline carries no beh field', () => {
    const noBeh = [
      { t: 0, agents: { a: { x: 100, y: 50, moving: false, group: false, offFloor: false } } },
      { t: 250, agents: { a: { x: 101, y: 50, moving: false, group: false, offFloor: false } } },
    ]
    const r = evaluateSoak(noBeh)
    expect(r.warnings.staleLabel).toEqual([])
    expect(r.pass).toBe(true)
  })
})
