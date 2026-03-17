import eventsData from '../config/officeEvents.json'

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
    { id: 'drink-coffee', expr: 'happy', msgs: 'coffee', duration: [12000, 25000], effect: 'coffee' },
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
  const entries = Object.entries(weights)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [key, w] of entries) {
    r -= w
    if (r <= 0) return key
  }
  return entries[0][0]
}

function pickBehavior(agentId, category) {
  const pool = behaviors[category] || behaviors.work
  const valid = pool.filter((b) => !b.only || b.only.includes(agentId))
  if (valid.length === 0) return pool[0]
  return valid[Math.floor(Math.random() * valid.length)]
}

function pickMessage(msgKey) {
  if (!msgKey) return null
  const pool = eventsData.bubbleMessages[msgKey]
  if (!pool || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

function randomDuration(range) {
  return range[0] + Math.random() * (range[1] - range[0])
}

// Status-specific bubble chance and message pools
const STATUS_BUBBLE = {
  working: { chance: 0.55, pool: 'working-status' },
  blocked: { chance: 0.75, pool: 'blocked-status' },
  done:    { chance: 0.65, pool: 'done-status' },
}

export function getNextBehavior(agentId, status = 'idle', hour = new Date().getHours()) {
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
  const category = weightedRandom(weights)
  const behavior = pickBehavior(agentId, category)

  // Status-specific messages override behavior messages
  const statusBubble = STATUS_BUBBLE[status]
  let message = null
  if (statusBubble && Math.random() < statusBubble.chance) {
    // Mix: 60% status-specific, 40% behavior-specific
    message = Math.random() < 0.6
      ? pickMessage(statusBubble.pool)
      : pickMessage(behavior.msgs)
  } else {
    message = Math.random() < 0.5 ? pickMessage(behavior.msgs) : null
  }

  const duration = randomDuration(behavior.duration)

  return {
    behaviorId: behavior.id,
    expression: behavior.expr,
    bubble: message,
    duration,
    category,
    effect: behavior.effect || null,
  }
}

export function getHourModifiers(hour) {
  if (hour >= 12 && hour < 13) return { away: 40, daily: 30, work: 20, social: 10 }
  if (hour >= 14 && hour < 15) return { work: 30, daily: 35, social: 15, away: 20 }
  if (hour >= 20) return { work: 70, daily: 15, social: 5, away: 10 }
  return null
}
