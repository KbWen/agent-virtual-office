import eventsData from '../config/officeEvents.json'
import { randomBubble } from '../i18n'

// 70-80% desk time like Stardew Valley NPCs / Pixel-Agents
// Characters stay at desks 30-120s, walk only occasionally
const baseWeights = { work: 65, daily: 12, social: 13, away: 10 }

const statusOverrides = {
  working: { work: 82, daily: 8, social: 5, away: 5 },
  idle: { work: 55, daily: 18, social: 15, away: 12 },
  done: { work: 25, daily: 25, social: 30, away: 20 },
  blocked: { work: 10, daily: 10, social: 10, away: 10, frustrated: 60 },
}

const behaviors = {
  work: [
    { id: 'typing', expr: 'focused', msgs: 'typing', duration: [18000, 45000] },
    { id: 'reading-screen', expr: 'focused', msgs: 'thinking', duration: [15000, 40000] },
    { id: 'writing-notes', expr: 'normal', msgs: 'thinking', duration: [15000, 35000] },
    { id: 'whiteboard', expr: 'normal', msgs: 'thinking', duration: [20000, 45000], only: ['arch', 'pm'] },
    { id: 'research', expr: 'focused', msgs: 'thinking', duration: [20000, 45000], only: ['res', 'arch'] },
    { id: 'gantt-chart', expr: 'normal', msgs: 'thinking', duration: [15000, 35000], only: ['pm'] },
    { id: 'magnifier', expr: 'focused', msgs: 'thinking', duration: [15000, 35000], only: ['qa'] },
    { id: 'deploy-button', expr: 'happy', msgs: 'done', duration: [10000, 20000], only: ['ops'] },
    { id: 'shield-verify', expr: 'normal', msgs: 'gate-verify', duration: [15000, 30000], only: ['gate'] },
    { id: 'meeting', expr: 'normal', msgs: 'thinking', duration: [25000, 50000] },
  ],
  daily: [
    { id: 'drink-coffee', expr: 'happy', msgs: 'coffee', duration: [12000, 25000] },
    { id: 'drink-water', expr: 'normal', msgs: null, duration: [10000, 20000] },
    { id: 'stretch', expr: 'happy', msgs: 'stretch', duration: [8000, 15000] },
    { id: 'look-window', expr: 'normal', msgs: null, duration: [15000, 28000] },
    { id: 'check-phone', expr: 'happy', msgs: null, duration: [12000, 22000] },
    { id: 'eat-snack', expr: 'happy', msgs: null, duration: [12000, 22000] },
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
  let r = Math.random() * total
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
const FALLBACK_BEHAVIOR = { id: 'typing', expr: 'focused', msgs: 'typing', duration: [18000, 45000] }

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
  return valid[Math.floor(Math.random() * valid.length)]
}

function pickMessage(msgKey) {
  if (!msgKey) return null
  // Try i18n locale first, fall back to officeEvents.json
  const localized = randomBubble(msgKey)
  if (localized) return localized
  const pool = eventsData.bubbleMessages?.[msgKey]
  if (!pool || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

// Resolve a duration range to a concrete ms value. Guards against a malformed
// `duration` (non-array, or array with non-finite endpoints): a NaN duration would
// flow into doSchedule's setTimeout(_, NaN) and re-fire on every tick — a CPU spin.
const DEFAULT_DURATION = 8000
function randomDuration(range) {
  if (!Array.isArray(range) || range.length < 2) return DEFAULT_DURATION
  const [min, max] = range
  if (!Number.isFinite(min) || !Number.isFinite(max)) return DEFAULT_DURATION
  return min + Math.random() * (max - min)
}

// Status-specific bubble chance and message pools
const STATUS_BUBBLE = {
  working: { chance: 0.55, pool: 'working-status' },
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
  idle:       { work: 20, daily: 30, social: 20, away: 30 },
}

export function getNextBehavior(agentId, status = 'idle', hour = new Date().getHours(), mood = 'normal') {
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

  const category = weightedRandom(weights)
  const behavior = pickBehavior(agentId, category)

  // Mood-specific messages get first priority
  let message = null
  const moodBubble = MOOD_BUBBLE[mood]
  if (moodBubble && Math.random() < moodBubble.chance) {
    message = pickMessage(moodBubble.pool)
  }

  // Then status-specific messages
  if (!message) {
    const statusBubble = STATUS_BUBBLE[status]
    if (statusBubble && Math.random() < statusBubble.chance) {
      message = Math.random() < 0.6
        ? pickMessage(statusBubble.pool)
        : pickMessage(behavior.msgs)
    } else {
      message = Math.random() < 0.5 ? pickMessage(behavior.msgs) : null
    }
  }

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
