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

// Statuses that mean the agent has an active session. During these, the
// behavior legitimately stays constant for long stretches (a long-running
// bash command, extended thinking, an unanswered permission prompt — see #50),
// so a frozen behavior value is NOT evidence of a dead scheduling chain.
// 'thinking' / 'awaiting-approval' are the idle-gap-inferred counterparts of
// 'working' / 'blocked'; 'planning' is plan mode (AVO-101).
export const ACTIVE_SESSION_STATUSES = new Set([
  'working', 'thinking', 'blocked', 'awaiting-approval', 'planning',
])

// The behavior watchdog (AgentCharacter) restarts the scheduling chain when a
// behavior value sits unchanged past WATCHDOG_TIMEOUT, treating it as a dead
// chain. Skip that restart when behavior is being driven/held externally:
//   - a group event (officeLife owns behavior + duration), or
//   - an active session status (a stable behavior is expected, not a stall).
// Pure so it is unit-testable without mounting the component.
export function shouldSkipBehaviorWatchdog(agent) {
  if (!agent) return false
  return Boolean(agent.inGroupEvent) || ACTIVE_SESSION_STATUSES.has(agent.status)
}

// Movement
export const MIN_AGENT_DIST = 35        // minimum px between any two agents
export const OBSTACLE_PUSH_PX = 6       // px to push character past obstacle edge
export const CORRIDOR_JITTER = 30       // px jitter for corridor waypoints
export const DOOR_JITTER = 20           // px jitter for door waypoints

// Office life events
export const DAILY_EVENT_INTERVAL = [60000, 180000]    // 1–3 min
export const RARE_EVENT_INTERVAL = [300000, 600000]    // 5–10 min
export const TIME_CHECK_INTERVAL = 60000               // 1 min
// living-office-events Phase 2: a WORK-CLAIM event may only fire if its matching real signal
// fired within this window (R2 — the claim must not outlive its truth). Counts/ledgers are NOT
// allowed to extend recency.
export const WORK_CLAIM_SIGNAL_WINDOW = 90000          // 90s, the "recently" bound for work-claims
// When a real session is LIVE, scale the random ambient floor DOWN to this per-tick fire chance
// (scaled, NOT muted — AC-7: working must not feel quieter than idle). Base daily ~1/2min × 0.3
// ≈ 1 coordinated scene / ~6-7min, the calm target band. Real events keep instant priority.
export const LIVE_FLOOR_FIRE_CHANCE = 0.3
// living-office-events Phase 4: a real-signal edge CAUSALLY fires the matching coordinated event;
// per-event cooldown so a flapping signal can't spam (anti-thrash, R4).
export const SEED_COOLDOWN_MS = 120000                 // 2 min per real-seeded event type

// API
export const STATUS_POLL_INTERVAL = 1000   // ms — matches startFilePolling default
export const VALID_ROLES = ['pm', 'arch', 'dev', 'qa', 'ops', 'res', 'gate', 'designer']
export const VALID_STATUSES = ['idle', 'working', 'blocked', 'done', 'planning']  // 'planning' = AVO-101 plan mode
export const VALID_MOODS = ['normal', 'rushing', 'frustrated', 'stuck', 'smooth', 'intense', 'idle']
// AVO-102: Claude Code effort levels (ordinal). The thinking aura intensity scales with this.
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']
export const MAX_MOOD_DURATION = 3_600_000  // 1 hour in ms

export const STATUS_COLORS = {
  idle: '#888',
  working: '#EF9F27',
  done: '#5CB88A',
  blocked: '#E24B4A',
  planning: '#8B7FD6',
}
