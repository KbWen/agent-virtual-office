// ═══ Shared constants — single source of truth for magic numbers ═══

// Animation
// 60px/s (was 80): at this ~800x560 scene, 80px/s crossed the office in ~6s and read as
// "rushing to a meeting" (game-feel panel 2026-06-10, owner: 一直走動很躁動). 60 reads as
// an amble. Floor: the longest desk→room path (~900px) must finish inside the stuck
// window — shortest behavior duration (8s) + BEHAVIOR_STUCK retries (~15s) = 23s;
// 900px / 60 = 15s, comfortable.
export const WALK_SPEED = 60            // pixels per second
export const WALK_FRAME_INTERVAL = 250  // ms between leg alternation

// Behavior scheduling
export const BEHAVIOR_STUCK_RETRIES = 10   // retries before force-unstick (~15s)
export const BEHAVIOR_STUCK_RETRY_MS = 1500
export const WATCHDOG_INTERVAL = 10000     // ms between watchdog checks
// Must exceed the longest legitimate behavior duration, otherwise the watchdog
// force-restarts a behavior that is simply still running. The longest behavior
// is 'typing' at 65000ms (behaviorEngine.js calm-rhythm tuning); add walk-time
// (~15s at 60px/s) + stuck-retry slack (BEHAVIOR_STUCK_RETRIES ×
// BEHAVIOR_STUCK_RETRY_MS ≈ 15s) ⇒ 95s; 120s leaves real margin.
// (History: 20s truncated >half the work/away behaviors; 90s was tight once the
// desk durations were lengthened past 45s.)
export const WATCHDOG_TIMEOUT = 120000     // ms before watchdog force-restarts behavior chain

// Statuses that mean the agent has an active session. During these, the
// behavior legitimately stays constant for long stretches (a long-running
// bash command, extended thinking, an unanswered permission prompt — see #50),
// so a frozen behavior value is NOT evidence of a dead scheduling chain.
// 'thinking' / 'awaiting-approval' are the idle-gap-inferred counterparts of
// 'working' / 'blocked'; 'planning' is plan mode (AVO-101).
export const ACTIVE_SESSION_STATUSES = new Set([
  'working', 'thinking', 'blocked', 'awaiting-approval', 'planning',
])

// AVO-181: the "needs-you" blocked family — a real `blocked` + its idle-gap-inferred
// `awaiting-approval` counterpart (an unanswered permission prompt). SINGLE source for the pet
// hide-on-blocker guard (petState), the recurring-episode continuation check (recurringFailure), the
// inspector duration line (agentInspectorModel), and the notifier episode gate (desktopNotifier) —
// so extending the family is ONE edit, not 4 drifting copies.
export const BLOCKED_FAMILY = new Set(['blocked', 'awaiting-approval'])

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
// AVO-106 pair-programming huddle: two distinct agents are "on the same file together" only if
// BOTH touched the byte-identical path within this window. Outside it, the shared file is stale and
// must NOT huddle (honesty — the claim must not outlive its truth).
export const PAIR_HUDDLE_WINDOW = 90000                // 90s shared-file recency bound

// API
export const STATUS_POLL_INTERVAL = 1000   // ms — matches startFilePolling default
// AVO-146 (#122): VALID_ROLES / VALID_STATUSES / VALID_MOODS / MAX_MOOD_DURATION are defined
// ONCE in the node-safe transport contract (statusContract.mjs) and re-exported here, so every
// existing `import { VALID_ROLES } from '../systems/constants.js'` site is unchanged while the
// server runtime (bare Node) imports the same source. 'planning' = AVO-101 plan mode.
export { VALID_ROLES, VALID_STATUSES, VALID_MOODS, MAX_MOOD_DURATION } from '../utils/statusContract.mjs'
// AVO-102: Claude Code effort levels (ordinal). The thinking aura intensity scales with this.
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max']

export const STATUS_COLORS = {
  idle: '#888',
  working: '#EF9F27',
  done: '#5CB88A',
  blocked: '#E24B4A',
  planning: '#8B7FD6',
  // AVO-167: 'awaiting-approval' ("waiting on YOU", idle-gap-inferred from blocked+90s) gets its own
  // cool cyan so it is visually distinct from a normal idle agent in the scene — and distinct from
  // working amber + blocked red. Contrast-guarded (theme.test.js iterates STATUS_COLORS).
  'awaiting-approval': '#1E9FD4',
}
