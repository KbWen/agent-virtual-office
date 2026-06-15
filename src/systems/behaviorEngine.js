import eventsData from '../config/officeEvents.json'
import { randomBubble, t } from '../i18n'
import { rng } from './rng.js'

// 70-80% desk time like Stardew Valley NPCs / Pixel-Agents
// Characters stay at desks 30-120s, walk only occasionally.
// Calm-rhythm tuning (owner 2026-06-10 "一直走動很躁動 / 都不去其他房間"): the work pool
// previously contained solo `meeting` — for most roles 1/4 of work picks ≈ 20% of ALL
// cycles became a lone march to the meeting room, dwarfing break-room trips (live audit:
// ≥1 walker on screen 83% of samples, pm spent 30% of a 3-min window in the meeting room
// alone). Solo meeting is removed (officeLife group events still gather agents there —
// that's the legible, honest channel for meeting-room use); desk durations lengthened so
// the office reads "alive but calm"; break-room dwells lengthened so visits are SEEN.
// Calm-rhythm round 2 (owner 2026-06-15 "一直看到很多人在走動 / 只有兩個人在座位"): the
// structural OUT-TRIP rate was still too high — measured category split for an ambient agent
// was 45% out-trips (idle/normal) and 55% (idle-mood), so with 8 agents independently rolling
// there was almost always someone in transit. Walk speed/duration are NOT the lever (already
// long); the fix is to sit more often. `work` raised, trimmed from `away`/`daily`; `social`
// deliberately PRESERVED (chatting is the "alive/fun" channel, not the clutter). Only ambient
// weights move — `working` (real-work, R1 honesty) / `done` / `blocked` are untouched.
const baseWeights = { work: 74, daily: 8, social: 13, away: 5 }

const statusOverrides = {
  working: { work: 82, daily: 8, social: 5, away: 5 },
  idle: { work: 68, daily: 12, social: 14, away: 6 },
  done: { work: 25, daily: 25, social: 30, away: 20 },
  blocked: { work: 10, daily: 10, social: 10, away: 10, frustrated: 60 },
}

const behaviors = {
  work: [
    // Desk durations 30-65s (was 18-45s): fewer cycles/hour = fewer walk opportunities.
    // 65s ceiling is bound by WATCHDOG_TIMEOUT — see constants.js for the math.
    { id: 'typing', expr: 'focused', msgs: 'typing', duration: [30000, 65000] },
    { id: 'reading-screen', expr: 'focused', msgs: 'thinking', duration: [25000, 55000] },
    { id: 'writing-notes', expr: 'normal', msgs: 'thinking', duration: [20000, 50000] },
    { id: 'whiteboard', expr: 'normal', msgs: 'thinking', duration: [20000, 45000], only: ['arch', 'pm'] },
    { id: 'research', expr: 'focused', msgs: 'thinking', duration: [20000, 45000], only: ['res', 'arch'] },
    { id: 'gantt-chart', expr: 'normal', msgs: 'thinking', duration: [15000, 35000], only: ['pm'] },
    { id: 'magnifier', expr: 'focused', msgs: 'thinking', duration: [15000, 35000], only: ['qa'] },
    { id: 'deploy-button', expr: 'happy', msgs: 'done', duration: [10000, 20000], only: ['ops'] },
    { id: 'shield-verify', expr: 'normal', msgs: 'gate-verify', duration: [15000, 30000], only: ['gate'] },
    // NOTE: no solo 'meeting' here — a lone agent marching to the meeting room every few
    // cycles was the #1 restlessness source. Group events (officeLife) own that room.
  ],
  daily: [
    // Break-room dwells lengthened (panel: transit must stay SHORTER than dwell, or the
    // trip reads as "walked there just to walk back").
    { id: 'drink-coffee', expr: 'happy', msgs: 'coffee', duration: [18000, 35000] },
    { id: 'drink-water', expr: 'normal', msgs: null, duration: [15000, 30000] },
    { id: 'stretch', expr: 'happy', msgs: 'stretch', duration: [8000, 15000] },
    { id: 'look-window', expr: 'normal', msgs: null, duration: [15000, 28000] },
    { id: 'check-phone', expr: 'happy', msgs: null, duration: [15000, 30000] },
    { id: 'eat-snack', expr: 'happy', msgs: null, duration: [15000, 30000] },
    { id: 'print', expr: 'normal', msgs: null, duration: [10000, 20000] },
  ],
  social: [
    { id: 'chat', expr: 'happy', msgs: 'chat', duration: [15000, 30000] },
    { id: 'pass-document', expr: 'normal', msgs: null, duration: [12000, 22000] },
    { id: 'thumbs-up', expr: 'happy', msgs: 'done', duration: [8000, 15000] },
  ],
  away: [
    { id: 'goto-coffee-machine', expr: 'normal', msgs: 'coffee', duration: [15000, 28000] },
    { id: 'toilet', expr: 'normal', msgs: null, duration: [20000, 40000] },
    { id: 'nap', expr: 'sleepy', msgs: null, duration: [25000, 45000] },
    { id: 'phone-call', expr: 'normal', msgs: 'phone', duration: [15000, 28000] },
  ],
  frustrated: [
    { id: 'scratch-head', expr: 'confused', msgs: 'frustrated', duration: [6000, 12000] },
    { id: 'sigh', expr: 'tired', msgs: 'frustrated', duration: [6000, 12000] },
    { id: 'desk-slam', expr: 'confused', msgs: 'frustrated', duration: [4000, 8000] },
  ],
}

function weightedRandom(weights) {
  // Iterate keys directly — Object.entries() would allocate an array of [key,value]
  // pairs on every call (once per agent per behavior cycle). A single Object.keys
  // pass is enough; total and selection both read weights[key] in place.
  const keys = Object.keys(weights)
  let total = 0
  for (const key of keys) total += weights[key]
  let r = rng() * total
  for (const key of keys) {
    r -= weights[key]
    if (r <= 0) return key
  }
  return keys[0]
}

// Fallback behavior entry — used when a category has zero behaviors valid for a
// role. MUST share the exact shape of a `behaviors` pool entry ({ id, expr, msgs,
// duration:[min,max] }). A mismatched shape (e.g. { behaviorId, duration:number })
// would make getNextBehavior read behavior.id === undefined and feed a scalar to
// randomDuration → NaN duration → doSchedule's setTimeout(_, NaN) fires immediately,
// pinning the CPU in a tight re-schedule loop.
const FALLBACK_BEHAVIOR = { id: 'typing', expr: 'focused', msgs: 'typing', duration: [30000, 65000] }

// Cache of role-filtered behavior pools, keyed "category|baseRole". pickBehavior runs
// once per agent per behavior cycle; the `.filter(b => !b.only || b.only.includes(...))`
// scan + array allocation is invariant for a given (category, role) pair — the behavior
// catalogue is static. Resolve each pair once, then reuse the cached filtered array.
const _validBehaviorCache = new Map()

function getValidBehaviors(category, baseRole) {
  const key = `${category}|${baseRole}`
  const cached = _validBehaviorCache.get(key)
  if (cached) return cached
  const pool = behaviors[category] || behaviors.work
  const valid = pool.filter((b) => !b.only || b.only.includes(baseRole))
  _validBehaviorCache.set(key, valid)
  return valid
}

function pickBehavior(agentId, category) {
  const baseRole = agentId.includes('~') ? agentId.split('~').pop() : agentId
  const valid = getValidBehaviors(category, baseRole)
  if (valid.length === 0) return FALLBACK_BEHAVIOR
  return valid[Math.floor(rng() * valid.length)]
}

/**
 * Pick a random message from the pool identified by msgKey.
 *
 * AC-S1a: caller-owned anti-repeat ring buffer. `recent` is a caller-managed array of the
 * last N picks (max 2). pickMessage filters out those entries before selecting, so in a pool
 * of ≥3 lines the same line can never be returned twice in a row. The buffer is NOT
 * module-global — it lives in the caller's scope (getNextBehavior / transient agent slot).
 * pickMessage itself is a pure function given (msgKey, recent).
 *
 * @param {string|null} msgKey
 * @param {string[]} recent  caller-owned last-picks ring (max 2); default []
 * @returns {string|null}
 */
export function pickMessage(msgKey, recent = []) {
  if (!msgKey) return null
  // Try i18n locale first (full array), then fall back to officeEvents.json
  let pool = null
  const i18nPool = t(`bubbles.${msgKey}`)
  if (Array.isArray(i18nPool) && i18nPool.length > 0) {
    pool = i18nPool
  } else {
    const evtPool = eventsData.bubbleMessages?.[msgKey]
    if (Array.isArray(evtPool) && evtPool.length > 0) pool = evtPool
  }
  if (!pool) return null
  // Anti-repeat: filter out last-2 picks only if the pool is large enough
  const filtered = pool.length > recent.length
    ? pool.filter((m) => !recent.includes(m))
    : pool
  if (filtered.length === 0) return pool[Math.floor(rng() * pool.length)]
  return filtered[Math.floor(rng() * filtered.length)]
}

// Resolve a duration range to a concrete ms value. Guards against a malformed
// `duration` (non-array, or array with non-finite endpoints): a NaN duration would
// flow into doSchedule's setTimeout(_, NaN) and re-fire on every tick — a CPU spin.
const DEFAULT_DURATION = 8000
function randomDuration(range) {
  if (!Array.isArray(range) || range.length < 2) return DEFAULT_DURATION
  const [min, max] = range
  if (!Number.isFinite(min) || !Number.isFinite(max)) return DEFAULT_DURATION
  return min + rng() * (max - min)
}

// Status-specific bubble chance and message pools.
// AC-S1b: working.chance lowered 0.55 → 0.20 (REDUCE-not-add; see spec AC-C1 / baseline fixture).
// blocked and done are UNCHANGED (honesty: those states deserve voice).
const STATUS_BUBBLE = {
  working: { chance: 0.20, pool: 'working-status' },
  blocked: { chance: 0.75, pool: 'blocked-status' },
  done:    { chance: 0.65, pool: 'done-status' },
}

// Mood-specific bubble pools (i18n keys under "bubbles")
const MOOD_BUBBLE = {
  rushing:    { chance: 0.4, pool: 'mood-rushing' },
  frustrated: { chance: 0.6, pool: 'mood-frustrated' },
  stuck:      { chance: 0.5, pool: 'mood-stuck' },
  smooth:     { chance: 0.5, pool: 'mood-smooth' },
  intense:    { chance: 0.3, pool: 'mood-intense' },
  idle:       { chance: 0.4, pool: 'mood-idle' },
}

// Mood-specific weight modifiers — blended 30% into the current weights
const moodModifiers = {
  rushing:    { work: 85, daily: 5,  social: 5,  away: 5 },
  frustrated: { work: 15, daily: 10, social: 10, away: 5, frustrated: 60 },
  stuck:      { work: 30, daily: 10, social: 10, away: 10, frustrated: 40 },
  smooth:     { work: 30, daily: 20, social: 35, away: 15 },
  intense:    { work: 80, daily: 8,  social: 7,  away: 5 },
  // Calm-rhythm round 2 (2026-06-15): idle-mood is the quiet-office case the owner watches, and
  // the old {work:20, away:30, daily:30} turned a bored office into a walkathon (55% out-trips).
  // Eased toward sitting — still the MOST relaxed/social mood (out-trips stay above `normal`),
  // just not a clutter of constant transit. `social` kept at 20 (chatting is the charm).
  idle:       { work: 42, daily: 22, social: 20, away: 16 },
}

// AC-S1a: caller-owned anti-repeat ring buffer, per-agent transient slot.
// The map is keyed by agentId; each slot holds the last 2 picked message strings.
// NOT persisted — exists only in module memory for the lifetime of the page/process.
// Mirrors the pairHuddle.js / pokeReaction.js pattern for transient per-agent state.
const _recentPicks = new Map()

function getRecentPicks(agentId) {
  if (!_recentPicks.has(agentId)) _recentPicks.set(agentId, [])
  return _recentPicks.get(agentId)
}

function pushRecentPick(agentId, msg) {
  if (!msg) return
  const buf = getRecentPicks(agentId)
  buf.push(msg)
  if (buf.length > 2) buf.shift()
}

// Exported for tests only — allows clearing the ring in beforeEach.
export function __clearRecentPicks() { _recentPicks.clear() }

export function getNextBehavior(agentId, status = 'idle', hour = new Date().getHours(), mood = 'normal', teamPulse = 0) {
  // Start with status-based weights, then apply hour modifiers
  let weights = { ...(statusOverrides[status] || baseWeights) }
  const hourMod = getHourModifiers(hour)
  if (hourMod) {
    // Blend: 60% status weights + 40% hour modifiers
    for (const key of Object.keys(hourMod)) {
      if (weights[key] != null) {
        weights[key] = Math.round(weights[key] * 0.6 + hourMod[key] * 0.4)
      }
    }
  }

  // Mood modifiers: blend 30% mood weights into current weights
  const mm = moodModifiers[mood]
  if (mm) {
    for (const key of Object.keys(mm)) {
      weights[key] = Math.round((weights[key] || 0) * 0.7 + mm[key] * 0.3)
    }
  }

  // L2 teamPulse "lean-in" (spec living-office-events.md): the busier the REAL session is, the more
  // an UNTRACKED agent's organic rhythm tightens toward focus — fewer coffee runs / wanders, more
  // desk work. Applies in ALL moods incl. `normal` (where `mm` is undefined and the above no-ops).
  // The CALLER passes teamPulse=0 for tracked agents, so this never modulates a real-work desk (R1).
  if (teamPulse > 0) {
    const FOCUS = { work: 90, daily: 4, social: 3, away: 3 } // `frustrated` intentionally untouched
    const k = Math.min(0.4, teamPulse * 0.4)
    for (const key of Object.keys(FOCUS)) {
      weights[key] = Math.round((weights[key] || 0) * (1 - k) + FOCUS[key] * k)
    }
  }

  const category = weightedRandom(weights)
  const behavior = pickBehavior(agentId, category)

  // AC-S1a: use per-agent ring buffer for anti-repeat
  const recent = getRecentPicks(agentId)

  // Mood-specific messages get first priority
  let message = null
  const moodBubble = MOOD_BUBBLE[mood]
  if (moodBubble && rng() < moodBubble.chance) {
    message = pickMessage(moodBubble.pool, recent)
  }

  // Then status-specific messages
  if (!message) {
    const statusBubble = STATUS_BUBBLE[status]
    if (statusBubble && rng() < statusBubble.chance) {
      message = rng() < 0.6
        ? pickMessage(statusBubble.pool, recent)
        : pickMessage(behavior.msgs, recent)
    } else {
      message = rng() < 0.5 ? pickMessage(behavior.msgs, recent) : null
    }
  }

  // Record pick in ring buffer for anti-repeat
  pushRecentPick(agentId, message)

  const duration = randomDuration(behavior.duration)

  return {
    behaviorId: behavior.id,
    expression: behavior.expr,
    bubble: message,
    duration,
    category,
  }
}

export function getHourModifiers(hour) {
  if (hour >= 12 && hour < 13) return { away: 40, daily: 30, work: 20, social: 10 }
  if (hour >= 14 && hour < 15) return { work: 30, daily: 35, social: 15, away: 20 }
  if (hour >= 20) return { work: 70, daily: 15, social: 5, away: 10 }
  return null
}
