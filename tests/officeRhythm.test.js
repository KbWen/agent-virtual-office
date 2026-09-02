import { describe, expect, it } from 'vitest'
import {
  analyzeRhythm, poissonBinomial, formatRhythm,
  REST_STEP_PX, STALE_LABEL_MS,
} from '../scripts/officeRhythm.mjs'

const INTERVAL = 250

/**
 * Build a timeline from a per-agent motion PATTERN string: '#' = moved this interval, '.' = still.
 * Position is the only motion source (the module must never read the `moving` store flag), so the
 * pattern is realised as real pixel deltas.
 */
function timeline(patterns, { beh = {}, group = {} } = {}) {
  const ids = Object.keys(patterns)
  const len = patterns[ids[0]].length
  const x = Object.fromEntries(ids.map((id) => [id, 100]))
  const samples = [{ t: 0, agents: Object.fromEntries(ids.map((id) => [id, { x: x[id], y: 50, moving: false, group: false, ...(beh[id] ? { beh: beh[id][0] } : {}) }])) }]
  for (let i = 0; i < len; i++) {
    const agents = {}
    for (const id of ids) {
      if (patterns[id][i] === '#') x[id] += 10
      agents[id] = {
        x: x[id], y: 50,
        moving: false,                       // deliberately WRONG — nothing may read it
        group: !!(group[id] && group[id][i] === 'G'),
        ...(beh[id] ? { beh: beh[id][i + 1] ?? beh[id][beh[id].length - 1] } : {}),
      }
    }
    samples.push({ t: (i + 1) * INTERVAL, agents })
  }
  return samples
}

describe('poissonBinomial', () => {
  it('reduces to the binomial when every probability is equal', () => {
    // n=3, p=0.5 -> 1/8, 3/8, 3/8, 1/8
    const d = poissonBinomial([0.5, 0.5, 0.5])
    expect(d.map((v) => +v.toFixed(6))).toEqual([0.125, 0.375, 0.375, 0.125])
  })

  it('handles unequal probabilities and always sums to 1', () => {
    const d = poissonBinomial([0.1, 0.9, 0.35, 0.6])
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(d).toHaveLength(5)
  })

  it('is exact for the degenerate cases', () => {
    expect(poissonBinomial([])).toEqual([1])
    expect(poissonBinomial([0, 0])).toEqual([1, 0, 0])
    expect(poissonBinomial([1, 1])).toEqual([0, 0, 1])
  })
})

describe('analyzeRhythm — motion is read from rendered position, never the store flag', () => {
  it('measures motion from pixel deltas even when `moving` says otherwise', () => {
    // Every sample carries moving:false. If the module ever trusted it, this would read 0%.
    const r = analyzeRhythm(timeline({ a: '####....', b: '........' }))
    expect(r.motionShare.a).toBeCloseTo(0.5, 6)
    expect(r.motionShare.b).toBe(0)
  })

  it('ignores sub-threshold jitter', () => {
    const samples = [
      { t: 0, agents: { a: { x: 100, y: 50 } } },
      { t: 250, agents: { a: { x: 100 + REST_STEP_PX * 0.5, y: 50 } } },
    ]
    expect(analyzeRhythm(samples).motionShare.a).toBe(0)
  })
})

describe('analyzeRhythm — the stillness gap is the point', () => {
  it('reports a NEGATIVE gap when trips are spread so someone is always walking', () => {
    // Perfectly anti-correlated: exactly one of the two always moves. Never still, though two
    // independent agents at 50% each would be still 25% of the time.
    const r = analyzeRhythm(timeline({ a: '#.#.#.#.', b: '.#.#.#.#' }))
    expect(r.stillness).toBe(0)
    expect(r.independentStillness).toBeCloseTo(0.25, 6)
    expect(r.stillnessGap).toBeCloseTo(-0.25, 6)
    expect(formatRhythm(r)).toContain('trips SPREAD into the quiet gaps')
  })

  it('reports a POSITIVE gap when trips cluster into bursts', () => {
    // Perfectly correlated: both move together, then both rest. Same per-agent share as above.
    const r = analyzeRhythm(timeline({ a: '##..##..', b: '##..##..' }))
    expect(r.stillness).toBeCloseTo(0.5, 6)
    expect(r.independentStillness).toBeCloseTo(0.25, 6)
    expect(r.stillnessGap).toBeCloseTo(0.25, 6)
    expect(formatRhythm(r)).toContain('trips CLUSTER')
  })

  it('the RATIO is what survives a change in motion level, and the point gap is not', () => {
    // The point gap is bounded by the independent level, so two equally-spread offices at
    // different motion levels report very different gaps. This is the bug that made four real
    // runs look contradictory when they were not comparable.
    const light = analyzeRhythm(timeline({ a: '#...#...', b: '.#...#..' }))   // low motion
    const heavy = analyzeRhythm(timeline({ a: '##.###.#', b: '.##.###.' }))   // high motion
    expect(heavy.independentStillness).toBeLessThan(light.independentStillness)
    // The heavy office CANNOT show the light office's point gap — arithmetic, not behaviour.
    expect(Math.abs(heavy.stillnessGap)).toBeLessThanOrEqual(Math.max(heavy.independentStillness, 1 - heavy.independentStillness) + 1e-9)
    // Both are spread, and the ratio says so for both while the gaps differ.
    expect(light.stillnessRatio).toBeLessThan(1)
    expect(heavy.stillnessRatio).toBeLessThan(1)
  })

  it('the two cases above have IDENTICAL per-agent motion — only the distribution differs', () => {
    const spread = analyzeRhythm(timeline({ a: '#.#.#.#.', b: '.#.#.#.#' }))
    const burst = analyzeRhythm(timeline({ a: '##..##..', b: '##..##..' }))
    expect(spread.meanMotionShare).toBeCloseTo(burst.meanMotionShare, 6)
    // ...which is exactly why a rate metric cannot tell churn from rhythm and this one can.
    expect(spread.stillnessGap).toBeLessThan(burst.stillnessGap)
  })
})

describe('analyzeRhythm — motion concentration', () => {
  it('CV is 0 when every agent walks the same amount', () => {
    expect(analyzeRhythm(timeline({ a: '##..', b: '##..', c: '##..' })).motionCV).toBeCloseTo(0, 6)
  })

  it('CV rises when the same character does all the walking', () => {
    const even = analyzeRhythm(timeline({ a: '##..', b: '##..', c: '##..' }))
    const concentrated = analyzeRhythm(timeline({ a: '####', b: '....', c: '....' }))
    expect(concentrated.motionCV).toBeGreaterThan(even.motionCV)
  })
})

describe('analyzeRhythm — stale behaviour labels (AVO-195)', () => {
  const longPattern = '.'.repeat(600)          // 600 intervals = 150s at 250ms

  it('flags a label held past the threshold outside any group event', () => {
    const r = analyzeRhythm(timeline({ a: longPattern }, { beh: { a: 'x'.repeat(601).split('').map(() => 'eat-snack') } }))
    expect(r.staleLabels).toHaveLength(1)
    expect(r.staleLabels[0]).toMatchObject({ id: 'a', behavior: 'eat-snack' })
    expect(r.staleLabels[0].ms).toBeGreaterThanOrEqual(STALE_LABEL_MS)
  })

  it('does NOT flag the same duration while the agent is in a group event', () => {
    // officeLife legitimately owns behaviour for an event's whole duration.
    const r = analyzeRhythm(timeline(
      { a: longPattern },
      { beh: { a: Array(601).fill('meeting') }, group: { a: 'G'.repeat(600) } },
    ))
    expect(r.staleLabels).toHaveLength(0)
  })

  it('does not flag a healthy cycle that changes well inside the threshold', () => {
    // 74-78s was the worst observed on healthy main; 60s must stay clean.
    const half = Array(120).fill('typing')     // 30s
    const other = Array(120).fill('reading-screen')
    const beh = { a: [...half, ...other, ...half, ...other] }
    const r = analyzeRhythm(timeline({ a: '.'.repeat(beh.a.length - 1) }, { beh }))
    expect(r.staleLabels).toHaveLength(0)
  })

  it('records how much the agent VISIBLY MOVED while the label sat still', () => {
    // This is what separated "the scheduler froze" from "the label is stale" during the
    // investigation: the frozen reading was refuted by 260-551px of movement.
    const beh = { a: Array(601).fill('eat-snack') }
    const r = analyzeRhythm(timeline({ a: '#'.repeat(600) }, { beh }))
    expect(r.staleLabels[0].movedSamples).toBeGreaterThan(0)
  })

  it('reports null rather than zero when the timeline carries no behaviour field', () => {
    // "No stale labels found" and "I never looked" must not render identically.
    const r = analyzeRhythm(timeline({ a: '##..' }))
    expect(r.staleLabels).toBeNull()
    expect(formatRhythm(r)).toContain('not sampled')
  })
})

describe('analyzeRhythm — degenerate input', () => {
  it('reports unusable rather than dividing by zero', () => {
    expect(analyzeRhythm([]).usable).toBe(false)
    expect(analyzeRhythm([{ t: 0, agents: {} }]).usable).toBe(false)
    expect(formatRhythm(analyzeRhythm([]))).toContain('not enough samples')
  })
})

describe('formatRhythm', () => {
  it('always carries the control-run caveat, because the level is not reproducible', () => {
    const out = formatRhythm(analyzeRhythm(timeline({ a: '##..', b: '..##' })))
    expect(out).toContain('paired control run')
    expect(out).toContain('1.4% and 11.8%')
  })
})
