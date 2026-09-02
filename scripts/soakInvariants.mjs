/**
 * soakInvariants.mjs — pure world-invariant evaluator for the sim-soak gate (AVO-157).
 *
 * The owner's emergent-class bugs (teleports, standing stacks, frozen walkers, furniture
 * clipping) live in MINUTES of world state, invisible to unit tests. This module turns a
 * sampled timeline into violations — pure and dependency-injected (geometry passed in) so
 * the GATE LOGIC itself is unit-testable (test-the-test, same doctrine as ci-render-smoke).
 *
 * samples: [{ t, agents: { [id]: { x, y, moving, group, offFloor } } }]
 *   t        — ms timestamp (monotonic)
 *   x, y     — RENDERED position (the layer the user's eyes see)
 *   moving   — store isMoving (claimed walk in progress)
 *   group    — store inGroupEvent
 *   offFloor — geometry verdict computed AT SAMPLE TIME by the page (the page imports the
 *              real movementSystem via Vite; node cannot — src/*.js parses as CJS there)
 */

export const TELEPORT_STEP_PX = 48      // ~3x max walk step per 250ms sample at 60px/s
export const SAMPLE_GAP_SKIP_MS = 600   // sampler stall == page main-thread stall → skip delta
export const STACK_DIST_PX = 30         // screen-visible full overlap (circular alarm radius)
export const STACK_RELEASE_PX = 35      // hysteresis: episode ends only past this
export const STACK_SUSTAIN_MS = 3000    // arrival-nudge recovers in ~1s; 3s = a real stuck stack
export const REST_STEP_PX = 0.5         // per-sample step below this = at rest
export const FROZEN_WALKER_MS = 90000   // store claims moving but pixels still — beyond every
                                        // recovery layer (stall watchdog ~3s, doSchedule ≤65s+15s)
export const OFF_FLOOR_SUSTAIN_MS = 2000
export const MAX_VIOLATIONS_PER_KIND = 20

// ─── AVO-195: stale behaviour labels ─────────────────────────────────────────────────────────
// The four invariants above all read POSITION and the `moving` flag. None reads `behavior`, so the
// office can narrate the wrong activity for minutes and this gate cannot see it. Observed for real:
// three agents held `eat-snack` for 254s outside any group event while walking 260-551px, with
// `moving` FALSE throughout — so `frozenWalker`, which requires the flag to be TRUE while pixels
// are still, could not fire by construction and the position checks saw a healthy walker.
//
// KNOWN LIMITATION, stated because it bounds what this signal can mean. A label that never changes
// is NOT the same as a scheduler that never ran: `pickBehavior` can select the SAME behaviour twice
// in a row (the anti-repeat ring guards MESSAGES, not behaviours), and the event-set behaviours
// overlap almost entirely with the doSchedule pools — of `eat-snack` / `nap` / `stretch` / `chat`
// only `meeting` is event-only — so the behaviour name cannot separate the two either. This is a
// smoke signal, not a proof, which is why it warns rather than fails.
//
// Threshold set from that limitation rather than fitted to a sample. A behaviour lasts at most 65s
// and a walk adds ~10-20s, so two consecutive identical picks reach ~170s. 180s therefore requires
// THREE consecutive identical picks to fire legitimately. A first attempt at 90s was set from
// control runs showing a 74-78s maximum and it FALSE-POSITIVED on the very first real soak, at
// 94.9s and 100.5s — kept here as the reason the number is now derived rather than observed.
export const STALE_LABEL_MS = 180000

/**
 * Stretches where an agent's behaviour label never changes while it is NOT in a group event
 * (officeLife legitimately owns behaviour for an event's whole duration, so event time is excluded).
 *
 * Returns `null` — not `[]` — when the timeline carries no `beh` field at all, so "nothing found"
 * and "never looked" cannot render identically.
 */
export function detectStaleLabels(samples, { staleMs = STALE_LABEL_MS, restPx = REST_STEP_PX, ids } = {}) {
  if (!Array.isArray(samples) || samples.length < 2) return null
  const agentIds = ids ?? Object.keys(samples[0].agents || {})
  const hasBeh = samples.some((s) => agentIds.some((id) => s.agents?.[id]?.beh !== undefined))
  if (!hasBeh) return null

  const moved = (i, id) => {
    const a = samples[i].agents?.[id]
    const p = samples[i - 1].agents?.[id]
    return !!(a && p && Math.hypot(a.x - p.x, a.y - p.y) > restPx)
  }
  const out = []
  for (const id of agentIds) {
    let start = null, prev = null, movedIn = 0
    const close = (endIdx) => {
      if (start === null) return
      const ms = samples[endIdx].t - samples[start].t
      // `movedSamples` is what separated "the scheduler froze" from "the label is stale" during the
      // investigation: the frozen reading was refuted by 260-551px of movement inside the stretch.
      if (ms >= staleMs) out.push({ id, behavior: prev, ms, movedSamples: movedIn })
      start = null; movedIn = 0
    }
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i].agents?.[id]
      if (!a) { close(i - 1); prev = null; continue }
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
  return out.sort((a, b) => b.ms - a.ms)
}

/**
 * The longest unchanged-label stretch in the run, reported REGARDLESS of the threshold.
 * A binary over/under verdict hides the trend; on healthy `main` this reads 74-100s, and the run
 * that motivated the check read 254s. Seeing the number move is worth more than a boolean.
 */
export function maxStaleLabelMs(samples, opts = {}) {
  const all = detectStaleLabels(samples, { ...opts, staleMs: 0 })
  return all === null ? null : (all.length ? all[0].ms : 0)
}

export function evaluateSoak(samples) {
  const v = { teleport: [], sustainedStack: [], frozenWalker: [], offFloorRest: [] }
  // GROUP-tagged stacks fail again (re-tightened 2026-06-11): both arrival-geometry holes
  // behind the nightly-run-#2 catch are closed at the store chokepoints — event targets now
  // deconflict against EVERY claimed standing spot (bystanders included), and react-in-place
  // participants side-step when an event would freeze them mid-overlap. A group stack now
  // means a real regression in that machinery; the `group` tag remains for instant triage.
  // AVO-195 lands as a WARNING, not a violation. The evidence that it does not false-positive is
  // four runs; the repo's own `groupStack` shows the warn -> fail promotion path, and promoting this
  // one should follow the same route after it has been quiet on the nightly for a while.
  const warnings = { groupStack: [], staleLabel: detectStaleLabels(samples) ?? [], maxStaleLabelMs: maxStaleLabelMs(samples) }
  const push = (kind, entry) => { if (v[kind].length < MAX_VIOLATIONS_PER_KIND) v[kind].push(entry) }

  // Forensic tails: rolling last-N samples per agent, attached to every violation so a
  // nightly catch self-diagnoses (nightly run #3 caught `res` resting inside the coffee
  // machine at (67,455) — a single coordinate, mechanism unprovable without the approach
  // trajectory; never again). Compact: {t,x,y,m,g,o} with rounded coords.
  const TAIL_LEN = 15
  const tails = {}       // id -> ring of last TAIL_LEN compact samples
  const tailOf = (id) => (tails[id] || []).slice()

  const prev = {}        // id -> { x, y, t }
  const restSince = {}   // id -> ms since at rest (continuous)
  const stillMovingSince = {} // id -> ms since (moving && at rest) started
  const offFloorSince = {}    // id -> ms; one violation per episode
  const offFloorFired = {}
  const pairClose = {}   // "a+b" -> { since, fired }

  for (const s of samples) {
    const ids = Object.keys(s.agents)
    const atRest = {}

    for (const id of ids) {
      const a = s.agents[id]
      const p = prev[id]
      const dt = p ? s.t - p.t : Infinity
      const step = p ? Math.hypot(a.x - p.x, a.y - p.y) : 0

      // Roll the forensic tail BEFORE any violation can fire this sample, so the tail
      // includes the violating sample itself.
      const tail = tails[id] || (tails[id] = [])
      tail.push({ t: Math.round(s.t / 100) / 10, x: Math.round(a.x), y: Math.round(a.y), m: a.moving ? 1 : 0, g: a.group ? 1 : 0, o: a.offFloor ? 1 : 0 })
      if (tail.length > TAIL_LEN) tail.shift()

      // I2 — teleport: a super-walk-speed jump between two healthy samples.
      if (p && dt < SAMPLE_GAP_SKIP_MS && step > TELEPORT_STEP_PX) {
        push('teleport', { id, tSec: Math.round(s.t / 1000), step: Math.round(step), from: `${Math.round(p.x)},${Math.round(p.y)}`, to: `${Math.round(a.x)},${Math.round(a.y)}`, tail: tailOf(id) })
      }

      const resting = p ? step < REST_STEP_PX : false
      atRest[id] = resting
      if (resting) {
        if (!restSince[id]) restSince[id] = p.t
      } else {
        restSince[id] = 0
      }

      // I4 — frozen walker: the store claims a walk is in progress but the pixels have
      // been still longer than EVERY recovery layer combined. (Stale isMoving from an
      // aborted walk self-heals within one behavior cycle ≤65s+15s — hence 90s.)
      if (a.moving && resting) {
        if (!stillMovingSince[id]) stillMovingSince[id] = p.t
        if (s.t - stillMovingSince[id] >= FROZEN_WALKER_MS) {
          push('frozenWalker', { id, tSec: Math.round(s.t / 1000), at: `${Math.round(a.x)},${Math.round(a.y)}`, stillForSec: Math.round((s.t - stillMovingSince[id]) / 1000), tail: tailOf(id) })
          stillMovingSince[id] = s.t // re-arm so one long freeze reports ~once/90s, not per sample
        }
      } else {
        stillMovingSince[id] = 0
      }

      // I3 — off-floor rest: a STANDING agent inside furniture or off the walkable floor.
      const bad = resting && !!a.offFloor
      if (bad && restSince[id] && s.t - restSince[id] >= OFF_FLOOR_SUSTAIN_MS) {
        if (!offFloorFired[id]) {
          push('offFloorRest', { id, tSec: Math.round(s.t / 1000), at: `${Math.round(a.x)},${Math.round(a.y)}`, tail: tailOf(id) })
          offFloorFired[id] = true
        }
        offFloorSince[id] = s.t
      } else if (!bad) {
        offFloorFired[id] = false
      }

      prev[id] = { x: a.x, y: a.y, t: s.t }
    }

    // I1 — sustained stationary stack: two agents fully overlapped at rest. Group-event
    // participants are INCLUDED (their spots are deconflicted at the store chokepoint —
    // a violation there is a real regression); the report tags them for instant triage.
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const A = ids[i], B = ids[j]
        const a = s.agents[A], b = s.agents[B]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const k = A < B ? `${A}+${B}` : `${B}+${A}`
        const bothAtRest = atRest[A] && atRest[B]
        if (d < STACK_DIST_PX && bothAtRest) {
          if (!pairClose[k]) pairClose[k] = { since: s.t, fired: false }
          if (!pairClose[k].fired && s.t - pairClose[k].since >= STACK_SUSTAIN_MS) {
            pairClose[k].fired = true
            push('sustainedStack', { pair: k, tSec: Math.round(s.t / 1000), dist: Math.round(d), at: `${Math.round(a.x)},${Math.round(a.y)}`, group: !!(a.group || b.group), tailA: tailOf(A), tailB: tailOf(B) })
          }
        } else if (d >= STACK_RELEASE_PX || !bothAtRest) {
          delete pairClose[k]
        }
      }
    }
  }

  const total = v.teleport.length + v.sustainedStack.length + v.frozenWalker.length + v.offFloorRest.length
  return { pass: total === 0, total, violations: v, warnings }
}
