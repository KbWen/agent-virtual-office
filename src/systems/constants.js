// ═══ Shared constants — single source of truth for magic numbers ═══

// Animation
export const WALK_SPEED = 80            // pixels per second
export const WALK_FRAME_INTERVAL = 250  // ms between leg alternation

// Behavior scheduling
export const BEHAVIOR_STUCK_RETRIES = 10   // retries before force-unstick (~15s)
export const BEHAVIOR_STUCK_RETRY_MS = 1500
export const WATCHDOG_INTERVAL = 10000     // ms between watchdog checks
export const WATCHDOG_TIMEOUT = 20000      // ms before watchdog force-restarts behavior chain

// Movement
export const MIN_AGENT_DIST = 35        // minimum px between any two agents
export const OBSTACLE_PUSH_PX = 6       // px to push character past obstacle edge
export const CORRIDOR_JITTER = 30       // px jitter for corridor waypoints
export const DOOR_JITTER = 20           // px jitter for door waypoints

// Office life events
export const DAILY_EVENT_INTERVAL = [60000, 180000]    // 1-3 min
export const RARE_EVENT_INTERVAL = [300000, 600000]    // 5-10 min
export const TIME_CHECK_INTERVAL = 60000               // 1 min

// API
export const STATUS_POLL_INTERVAL = 2000   // ms
export const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate']
export const VALID_STATUSES = ['idle', 'working', 'blocked', 'done']
