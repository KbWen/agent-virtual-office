// ═══ Shared constants — single source of truth for magic numbers ═══

// Animation
export const WALK_SPEED = 80            // pixels per second
export const WALK_FRAME_INTERVAL = 250  // ms between leg alternation

// Behavior scheduling
export const BEHAVIOR_STUCK_RETRIES = 10   // retries before force-unstick (~15s)
export const BEHAVIOR_STUCK_RETRY_MS = 1500
export const WATCHDOG_INTERVAL = 10000     // ms between watchdog checks
// Must exceed the longest legitimate behavior duration, otherwise the watchdog
// force-restarts a behavior that is simply still running. The longest behavior
// is 'meeting' at 50000ms (behaviorEngine.js); add walk-time (~5s) + stuck-retry
// slack (BEHAVIOR_STUCK_RETRIES × BEHAVIOR_STUCK_RETRY_MS ≈ 15s) for safety.
// 20s here truncated >half the work/away behaviors mid-action.
export const WATCHDOG_TIMEOUT = 90000      // ms before watchdog force-restarts behavior chain

// Movement
export const MIN_AGENT_DIST = 35        // minimum px between any two agents
export const OBSTACLE_PUSH_PX = 6       // px to push character past obstacle edge
export const CORRIDOR_JITTER = 30       // px jitter for corridor waypoints
export const DOOR_JITTER = 20           // px jitter for door waypoints

// Office life events
export const DAILY_EVENT_INTERVAL = [60000, 180000]    // 1–3 min
export const RARE_EVENT_INTERVAL = [300000, 600000]    // 5–10 min
export const TIME_CHECK_INTERVAL = 60000               // 1 min

// API
export const STATUS_POLL_INTERVAL = 1000   // ms — matches startFilePolling default
export const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
export const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning']  // 'planning' = AVO-101 plan mode
export const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
export const MAX_MOOD_DURATION = 3_600_000  // 1 hour in ms

export const STATUS_COLORS = {
  idle: '#888',
  working: '#EF9F27',
  done: '#5CB88A',
  blocked: '#E24B4A',
}
