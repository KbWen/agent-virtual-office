/**
 * Mood Engine — sliding window analyzer for office atmosphere
 *
 * Observes incoming status events (from any platform: Claude Code, Codex, Antigravity, curl)
 * and computes a team-wide mood that affects character behavior and speech bubbles.
 *
 * Platform-agnostic: mood is inferred from the event stream pattern,
 * not from any specific hook or tool. Any source that pushes status updates
 * will contribute to the mood calculation.
 *
 * Moods: normal | rushing | frustrated | stuck | smooth | intense | idle
 */

import { useOfficeStore } from './store'

const MAX_EVENTS = 20
const IDLE_TIMEOUT = 180000     // 3 minutes of silence → idle
const STALE_CUTOFF = 300000     // prune events older than 5 minutes
const RUSHING_WINDOW = 10000    // 5+ events within 10 seconds → rushing
const RUSHING_THRESHOLD = 5
const FRUSTRATED_STREAK = 3     // 3+ consecutive blocked/error → frustrated
const STUCK_THRESHOLD = 5       // same task 5+ times → stuck
const SMOOTH_STREAK = 5         // 5+ consecutive done → smooth
const INTENSE_ROLES = 3         // 3+ distinct roles active in 30s → intense
const INTENSE_WINDOW = 30000

const events = []
let idleTimer = null
let overrideMood = null
let overrideExpiry = null

function pruneStale() {
  const cutoff = Date.now() - STALE_CUTOFF
  while (events.length > 0 && events[0].timestamp < cutoff) {
    events.shift()
  }
}

function computeMood() {
  // Manual override takes priority
  if (overrideMood && overrideExpiry) {
    if (Date.now() < overrideExpiry) return overrideMood
    overrideMood = null
    overrideExpiry = null
  }

  pruneStale()
  const now = Date.now()

  if (events.length === 0) return 'idle'

  // 1. Rushing: 5+ events in last 10 seconds
  const recentCount = events.filter(e => now - e.timestamp < RUSHING_WINDOW).length
  if (recentCount >= RUSHING_THRESHOLD) return 'rushing'

  // 2. Frustrated: last 3 events are all blocked or error
  if (events.length >= FRUSTRATED_STREAK) {
    const tail = events.slice(-FRUSTRATED_STREAK)
    if (tail.every(e => e.status === 'blocked' || e.hint === 'error')) return 'frustrated'
  }

  // 3. Stuck: same task appears 5+ times in window
  const taskCounts = {}
  for (const e of events) {
    if (e.task) {
      taskCounts[e.task] = (taskCounts[e.task] || 0) + 1
      if (taskCounts[e.task] >= STUCK_THRESHOLD) return 'stuck'
    }
  }

  // 4. Smooth: last 5 events are all done
  if (events.length >= SMOOTH_STREAK) {
    const tail = events.slice(-SMOOTH_STREAK)
    if (tail.every(e => e.status === 'done')) return 'smooth'
  }

  // 5. Intense: 3+ distinct roles working in last 30 seconds
  const activeRoles = new Set()
  for (const e of events) {
    if (now - e.timestamp < INTENSE_WINDOW && e.status !== 'done' && e.status !== 'idle') {
      activeRoles.add(e.role)
    }
  }
  if (activeRoles.size >= INTENSE_ROLES) return 'intense'

  // 6. Idle: most recent event is older than 3 minutes
  const lastEvent = events[events.length - 1]
  if (now - lastEvent.timestamp > IDLE_TIMEOUT) return 'idle'

  // 7. Default
  return 'normal'
}

function updateStoreMood() {
  const mood = computeMood()
  const store = useOfficeStore.getState()
  if (store.mood !== mood) {
    store.setMood(mood)
  }
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    updateStoreMood()
  }, IDLE_TIMEOUT + 1000) // check shortly after idle threshold
}

/**
 * Push multiple events at once — only recomputes mood once after all are queued.
 */
export function pushEventBatch(eventList) {
  const now = Date.now()
  for (const { role, status, task, hint } of eventList) {
    events.push({ timestamp: now, role, status, task: task || null, hint: hint || null })
  }

  // Keep window size bounded
  while (events.length > MAX_EVENTS) {
    events.shift()
  }

  resetIdleTimer()
  updateStoreMood()
}

/**
 * Override the computed mood. Used when POST /api/status includes a `mood` field.
 * Expires after durationMs (default 60s) and falls back to computed mood.
 */
export function setMoodOverride(mood, durationMs = 60000) {
  overrideMood = mood
  overrideExpiry = Date.now() + durationMs
  updateStoreMood()
}

/**
 * Clear all state. Called on cleanup (e.g., component unmount).
 */
export function resetMood() {
  events.length = 0
  overrideMood = null
  overrideExpiry = null
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
}
