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

import { useOfficeStore } from './store.js'
import { VALID_MOODS, MAX_MOOD_DURATION } from './constants.js'

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
let overrideTimer = null
let overrideMood = null
let overrideExpiry = null

function pruneStale() {
  const cutoff = Date.now() - STALE_CUTOFF
  const firstFresh = events.findIndex(e => e.timestamp >= cutoff)
  if (firstFresh > 0) events.splice(0, firstFresh)
  else if (firstFresh === -1) events.length = 0
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

  // 1. Rushing: 5+ events in last 10 seconds.
  // Count with a plain loop — `.filter(...).length` allocated a throwaway array (up to
  // MAX_EVENTS entries) on every computeMood call just to read its length. computeMood
  // runs on every incoming status update via updateStoreMood.
  let recentCount = 0
  for (const e of events) {
    if (now - e.timestamp < RUSHING_WINDOW) recentCount++
  }
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

  // 5. Intense: 3+ distinct roles working in last 30 seconds.
  // Normalize composite multi-session ids ('slug~role') to their base role segment
  // (the part after the LAST '~') before counting. Without this, three worktrees all
  // running a 'dev' agent register as three distinct roles ('feat-x~dev', 'hotfix~dev',
  // 'main~dev') and falsely trip 'intense'. The slug itself may contain '~', so split
  // on the last separator only — consistent with sanitizeRoleId in inferStatus.js and
  // the baseRole derivation in store.js / behaviorEngine.js.
  const activeRoles = new Set()
  for (const e of events) {
    if (now - e.timestamp < INTENSE_WINDOW && e.status !== 'done' && e.status !== 'idle') {
      const role = e.role
      if (typeof role === 'string' && role.includes('~')) {
        activeRoles.add(role.slice(role.lastIndexOf('~') + 1))
      } else {
        activeRoles.add(role)
      }
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
  if (!Array.isArray(eventList)) return
  const now = Date.now()
  let added = 0
  for (const e of eventList) {
    if (!e || typeof e !== 'object') continue
    const { role, status, task, hint } = e
    events.push({ timestamp: now, role, status, task: task || null, hint: hint || null })
    added++
  }

  // Keep window size bounded — one splice is O(n) vs a shift loop's O(k·n)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)

  if (added > 0) {
    resetIdleTimer()
    updateStoreMood()
  }
  // If `added === 0` (empty array / all-skipped entries), skip the mood recompute:
  // computeMood with an empty buffer returns 'idle', so an unguarded call would
  // silently flip mood→idle even though no real signal arrived. The production
  // callers (inferStatus.applyMessage) gate with `if (updates.length > 0)` so
  // this is defense in depth — future callers that forget the gate now stay safe.
}

/**
 * Override the computed mood. Used when POST /api/status includes a `mood` field.
 * Expires after durationMs (default 60s) and falls back to computed mood.
 */
export function setMoodOverride(mood, durationMs = 60000) {
  if (!VALID_MOODS.includes(mood)) return
  if (overrideTimer) clearTimeout(overrideTimer)
  // Clamp BOTH bounds here — this is the single chokepoint for every override caller.
  // The file/API path is pre-clamped by normalizePost, but in-browser channels
  // (postMessage, BroadcastChannel, window.__office_status__) reach setMoodOverride
  // via inferStatus without an upper-bound clamp; without this an untrusted message
  // could pin a mood ~31000 years into the future.
  const raw = Number(durationMs)
  const clampedMs = Math.min(
    Math.max(Number.isFinite(raw) ? raw : 60000, 1000),
    MAX_MOOD_DURATION
  )
  overrideMood = mood
  overrideExpiry = Date.now() + clampedMs
  updateStoreMood()
  // Guarantee the override expires even without incoming events
  overrideTimer = setTimeout(() => {
    overrideTimer = null
    updateStoreMood()
  }, clampedMs + 50)
}

/**
 * Clear all state. Called on cleanup (e.g., component unmount).
 */
export function resetMood() {
  events.length = 0
  overrideMood = null
  overrideExpiry = null
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  if (overrideTimer) { clearTimeout(overrideTimer); overrideTimer = null }
}

// HMR: clear timers on module hot-replacement so orphaned handles don't fire
// against stale closures after Vite replaces this module.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (idleTimer) clearTimeout(idleTimer)
    if (overrideTimer) clearTimeout(overrideTimer)
  })
}
