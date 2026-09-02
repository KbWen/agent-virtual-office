/**
 * officeRhythm.mjs — does the office read as ALIVE, or merely BUSY? (pure)
 *
 * `soakInvariants` answers "is the office BROKEN" — teleports, stacks, frozen walkers, furniture
 * clipping. It cannot answer the two judgements the owner actually makes at a glance:
 * *一直很多人在走動* and *畫面活起來了嗎*. Those live in the DISTRIBUTION of motion over minutes,
 * not in any single frame, so nothing frame-local can see them.
 *
 * Pure and dependency-injected like its siblings (soakInvariants / soakCoverage / soakTarget), so
 * the analysis itself is unit-testable rather than only observable through a 10-minute browser run.
 *
 * samples: [{ t, agents: { [id]: { x, y, moving, group, beh? } } }]   — the sim-soak sample shape.
 *   x, y  RENDERED position. Motion is measured from these, NEVER from the `moving` store flag:
 *         a store field is INTENT, and the two disagree (an agent can be nudged while `moving`
 *         is false, and can claim `moving` while parked). Every number here is what the eye sees.
 *   beh   optional. Present → stale-label detection runs; absent → that section reports null.
 *
 * ── WHY THE INDEPENDENT MODEL MATTERS ────────────────────────────────────────────────────────
 * A raw stillness percentage cannot be interpreted on its own, because it moves with how much
 * each agent happens to walk. The useful quantity is stillness RELATIVE to what uncorrelated
 * agents would produce: an exact Poisson-binomial over each agent's OWN measured motion share.
 *   observed >> independent  → trips CLUSTER (bursts, then real quiet — reads as rhythm)
 *   observed << independent  → trips are SPREAD (someone always walking — reads as churn)
 * Measured on this office 2026-09-02: stillness ran 10.5 and 12.3 points BELOW independence across
 * two runs, i.e. the concurrency cap defers blocked trips into the gaps that would otherwise have
 * been quiet. SCOPE, learned by a fourth run that did not reproduce it: both of those runs recorded
 * `mood: normal`. Mood swings the ambient out-trip share 26% (normal) -> 35% (idle) -> 40% (smooth),
 * so a gap is only comparable against another run at the SAME mood — which is why the runner now
 * records mood and hour in every report. And compare by `stillnessRatio`, not by the point gap:
 * the gap is bounded by the independent level, so it shrinks purely because motion rose. Under a
 * controlled re-measurement the depletion is NOT yet established as a stable property — four runs
 * read 0.53 / 0.10 / 0.97 / 0.61 by ratio.
 *
 * ── THE CAVEAT THAT COST A CONTROL RUN TO LEARN ──────────────────────────────────────────────
 * The stillness LEVEL is not reproducible from a single run. Two 8-minute runs on identical code
 * gave 1.4% and 11.8%. The gap to independence was stable (-12.3 / -10.5) while the level was not.
 * So: quote the GAP from one run; never quote the LEVEL without a paired control run.
 */

/** Rendered-motion threshold, shared with soakInvariants' REST_STEP_PX so both agree on "at rest". */
export const REST_STEP_PX = 0.5

/**
 * A behaviour label that never changes while the agent is NOT in a group event.
 * Bound empirically rather than guessed: on healthy `main`, event-set behaviours are overwritten
 * within 2–27s and the longest unchanged label observed across two runs was 74s and 78s —
 * consistent with the 65s behaviour-duration ceiling plus walk time. A rejected prototype produced
 * 254s. 90s therefore separates the two populations without flagging anything `main` produces.
 * Reported, never thrown: this module measures, the caller decides. (backlog AVO-195)
 */
export const STALE_LABEL_MS = 90000

const clampId = (agents) => Object.keys(agents || {})

/** Exact Poisson-binomial P(k successes) for independent trials with per-trial probabilities. */
export function poissonBinomial(probabilities) {
  let dp = [1]
  for (const p of probabilities) {
    const next = new Array(dp.length + 1).fill(0)
    for (let k = 0; k < dp.length; k++) {
      next[k] += dp[k] * (1 - p)
      next[k + 1] += dp[k] * p
    }
    dp = next
  }
  return dp
}

/**
 * @param {Array} samples  sim-soak sample timeline
 * @param {object} opts    { restPx, staleMs, ids }
 * @returns {object} rhythm report — all shares are 0..1, all durations in ms
 */
export function analyzeRhythm(samples, opts = {}) {
  const restPx = opts.restPx ?? REST_STEP_PX
  const staleMs = opts.staleMs ?? STALE_LABEL_MS
  const ids = opts.ids ?? (samples.length ? clampId(samples[0].agents) : [])
  const intervals = Math.max(0, samples.length - 1)

  if (intervals === 0 || ids.length === 0) {
    return {
      intervals: 0, agents: ids.length, usable: false,
      motionShare: {}, meanMotionShare: null, motionCV: null,
      moverHistogram: [], stillness: null, independentStillness: null,
      stillnessGap: null, crowdShare: null, independentCrowdShare: null,
      deadFrameShare: null, staleLabels: null,
    }
  }

  const moved = (i, id) => {
    const a = samples[i].agents?.[id]
    const p = samples[i - 1].agents?.[id]
    if (!a || !p) return false
    return Math.hypot(a.x - p.x, a.y - p.y) > restPx
  }

  // ── per-agent motion share (rendered truth) ──────────────────────────────────────────────
  const motionShare = {}
  for (const id of ids) {
    let m = 0, t = 0
    for (let i = 1; i < samples.length; i++) {
      if (!samples[i].agents?.[id] || !samples[i - 1].agents?.[id]) continue
      t++
      if (moved(i, id)) m++
    }
    motionShare[id] = t > 0 ? m / t : 0
  }
  const shares = ids.map((id) => motionShare[id])
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length
  const sd = Math.sqrt(shares.reduce((a, b) => a + (b - mean) ** 2, 0) / shares.length)
  // Concentration: a office where the same two characters do all the walking reads worse than
  // one where the same total motion rotates around the room, even at identical total motion.
  const motionCV = mean > 0 ? sd / mean : 0

  // ── concurrent-mover distribution, observed vs independent ───────────────────────────────
  const hist = new Array(ids.length + 1).fill(0)
  for (let i = 1; i < samples.length; i++) hist[ids.filter((id) => moved(i, id)).length]++
  const observed = hist.map((n) => n / intervals)
  const independent = poissonBinomial(shares)
  const sumFrom = (arr, k) => arr.slice(k).reduce((a, b) => a + b, 0)

  // ── dead frames: nothing moving, nobody in an event, no bubble, no label change ───────────
  let dead = 0
  for (let i = 1; i < samples.length; i++) {
    let alive = false
    for (const id of ids) {
      const a = samples[i].agents?.[id]
      const p = samples[i - 1].agents?.[id]
      if (!a) continue
      if (moved(i, id) || a.group || a.bub || (p && a.beh !== undefined && a.beh !== p.beh)) { alive = true; break }
    }
    if (!alive) dead++
  }

  // ── stale labels (AVO-195): the office narrating an activity the agent left long ago ──────
  const hasBeh = samples.some((s) => ids.some((id) => s.agents?.[id]?.beh !== undefined))
  let staleLabels = null
  if (hasBeh) {
    staleLabels = []
    for (const id of ids) {
      let start = null, prev = null, movedIn = 0
      const close = (endIdx) => {
        if (start === null) return
        const ms = samples[endIdx].t - samples[start].t
        if (ms >= staleMs) staleLabels.push({ id, behavior: prev, ms, movedSamples: movedIn })
        start = null; movedIn = 0
      }
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i].agents?.[id]
        if (!a) { close(i - 1); prev = null; continue }
        // A group event legitimately owns behaviour for its duration — only ambient time counts.
        if (a.beh === prev && !a.group) {
          if (start === null) start = i - 1
          if (moved(i, id)) movedIn++
        } else {
          close(i - 1)
        }
        prev = a.beh
      }
      close(samples.length - 1)
    }
    staleLabels.sort((a, b) => b.ms - a.ms)
  }

  return {
    intervals,
    agents: ids.length,
    usable: true,
    motionShare,
    meanMotionShare: mean,
    motionCV,
    moverHistogram: observed,
    independentHistogram: independent,
    stillness: observed[0],
    independentStillness: independent[0],
    // Negative = trips spread into the quiet gaps (churn); positive = they cluster.
    // NOT comparable across different motion levels on its own -- see stillnessRatio.
    stillnessGap: observed[0] - independent[0],
    // The comparable form. An absolute point-gap is BOUNDED BY the independent level: at mean
    // motion 16.8% independent stillness is 22.3% and a -10 point gap is possible, at 23.5% it is
    // 9.2% and the same gap is arithmetically impossible. Two runs at different motion levels can
    // therefore show very different gaps while being equally "spread". The ratio removes that
    // bound: <1 spread, ~1 independent, >1 clustered. Learned by shipping the gap alone and then
    // failing to compare four runs with it.
    stillnessRatio: independent[0] > 0 ? observed[0] / independent[0] : null,
    crowdShare: sumFrom(observed, 3),
    independentCrowdShare: sumFrom(independent, 3),
    deadFrameShare: dead / intervals,
    staleLabels,
  }
}

const pct = (n) => (n === null || n === undefined ? '  n/a' : `${(100 * n).toFixed(1)}%`)

/** Human-readable report. Deliberately leads with the GAP, not the level — see the caveat above. */
export function formatRhythm(r) {
  if (!r.usable) return 'office-rhythm: not enough samples to analyse'
  const lines = [
    `office-rhythm: ${r.intervals} intervals, ${r.agents} agents`,
    `  stillness        ${pct(r.stillness)}  vs independent ${pct(r.independentStillness)}`
      + `  -> gap ${r.stillnessGap >= 0 ? '+' : ''}${(100 * r.stillnessGap).toFixed(1)} pts`
      + `, ratio ${r.stillnessRatio === null ? 'n/a' : r.stillnessRatio.toFixed(2)}`
      + ` (${r.stillnessRatio === null ? 'undefined' : r.stillnessRatio < 0.85 ? 'trips SPREAD into the quiet gaps' : r.stillnessRatio > 1.15 ? 'trips CLUSTER' : 'near-independent'})`,
    '                   compare runs by RATIO, not by the point gap: the gap is bounded by the independent level',
    `  >=1 moving       ${pct(1 - r.stillness)}      >=3 moving ${pct(r.crowdShare)} vs independent ${pct(r.independentCrowdShare)}`,
    `  motion share     mean ${pct(r.meanMotionShare)}   concentration CV ${r.motionCV.toFixed(2)}`,
    `  dead frames      ${pct(r.deadFrameShare)}`,
  ]
  if (r.staleLabels === null) {
    lines.push('  stale labels     not sampled (no `beh` field in the timeline)')
  } else if (r.staleLabels.length === 0) {
    lines.push(`  stale labels     none over ${STALE_LABEL_MS / 1000}s`)
  } else {
    lines.push(`  stale labels     ${r.staleLabels.length} over ${STALE_LABEL_MS / 1000}s:`)
    for (const s of r.staleLabels.slice(0, 5)) {
      lines.push(`      ${s.id} held '${s.behavior}' for ${(s.ms / 1000).toFixed(0)}s outside any event`
        + ` (visibly moving in ${s.movedSamples} samples of it)`)
    }
  }
  lines.push('  NOTE: quote the GAP from a single run; the stillness LEVEL needs a paired control run')
  lines.push('        (two runs on identical code measured 1.4% and 11.8%).')
  return lines.join('\n')
}
