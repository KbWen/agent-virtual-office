/**
 * #8 — Desktop notifications for sustained-blocked agents.
 *
 * Polls the store every 5 seconds. When an agent stays in `status === 'blocked'`
 * for at least 30 seconds AND the tab is not in the foreground AND the user
 * has granted Notification permission, fires a single browser Notification per
 * blocked episode (transitions out of blocked reset the dedupe key).
 *
 * Design constraints:
 *   1. Permission UX: modern browsers reject `Notification.requestPermission()`
 *      outside a user-gesture context. We expose `requestNotificationPermission`
 *      separately so the UI can wire it to a button click.
 *   2. Visibility gate: no point notifying when the user is already watching
 *      the office. `document.hidden` is the broadest-supported gate.
 *   3. Dedupe: notify ONCE per blocked episode. An episode is defined by the
 *      timestamp at which the agent first entered blocked. Keyed by agentId →
 *      blocked-since timestamp. Transition out of blocked clears the maps.
 *   4. Browser tag-collapse: each Notification uses `tag: office-blocked-<id>`
 *      so the OS replaces an older notification for the same agent.
 *   5. Cleanup: `startDesktopNotifier` returns a stop function. Caller is
 *      responsible (PixelOffice useEffect already handles cleanup).
 *
 * jsdom and SSR safety: every browser-API access is `typeof`-checked. In
 * environments without Notification or window, the module never throws and
 * polling becomes a no-op.
 */
import { t, charName } from '../i18n.js'
import { recurringInfo } from '../systems/recurringFailure.js'

const DEFAULT_BLOCKED_THRESHOLD_MS = 30_000
const POLL_INTERVAL_MS = 5_000

// Per-agent dedupe state. Module-scope so reload-style remounts share continuity.
const blockedSince = new Map()  // agentId → timestamp when first observed in blocked state
const notifiedFor  = new Map()  // agentId → blocked-since timestamp we already fired for
// AVO-117: recurring-failure dedupe — agentId → reasonCode we already fired a recurring notice for.
// Reset on leaving the blocked family so a fresh recurrence (after recovery) can re-fire once.
const recurringNotifiedFor = new Map()

// Statuses that the idle-gap inferrer reclassifies FROM 'blocked' (fix #2).
// These are still considered part of the same blocked episode for dedupe
// purposes — clearing blockedSince/notifiedFor here would cause a 2nd OS
// notification when the same unanswered prompt re-asserts 'blocked'.
const BLOCKED_DERIVED = new Set(['awaiting-approval'])

export function getNotificationState() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission  // 'default' | 'granted' | 'denied'
}

export function isNotificationGranted() {
  return getNotificationState() === 'granted'
}

/**
 * Request browser permission. Must be called from a user-gesture handler in
 * Chrome / Firefox / Safari to avoid auto-rejection.
 *
 * Returns 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export async function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied')  return 'denied'
  try {
    const r = await Notification.requestPermission()
    return r ?? 'default'
  } catch {
    return 'denied'
  }
}

function isTabHidden() {
  if (typeof document === 'undefined') return false
  // `document.hidden` is the canonical signal; `visibilityState` is the more
  // expressive variant. We treat any non-'visible' state as hidden.
  if (typeof document.hidden === 'boolean') return document.hidden
  return document.visibilityState !== 'visible'
}

function fireNotification(agentId) {
  if (typeof Notification === 'undefined' || typeof window === 'undefined') return
  if (Notification.permission !== 'granted') return
  const name = charName(agentId)
  const title = t('notify.blockedTitle', 'Agent stuck')
  const body  = t('notify.blockedBody', '{0} has been blocked for 30+ seconds')
    .replace('{0}', name)
  try {
    const n = new Notification(title, {
      body,
      tag: `office-blocked-${agentId}`,
      // `silent: false` keeps the OS default sound; `requireInteraction: false`
      // lets the notification auto-dismiss after the usual OS timeout.
      silent: false,
      requireInteraction: false,
    })
    n.onclick = () => {
      try { window.focus() } catch { /* ignore */ }
      try { n.close() } catch { /* ignore */ }
    }
  } catch {
    /* Some browsers throw on permission-misalignment edge cases. Swallow. */
  }
}

// AVO-117: recurring-failure notification — the agent keeps hitting the SAME specific kind of block.
// Wording claims only the recurring PATTERN, never a root cause. Distinct tag from the 30s-blocked one.
function fireRecurringNotification(agentId, reasonCode) {
  if (typeof Notification === 'undefined' || typeof window === 'undefined') return
  if (Notification.permission !== 'granted') return
  const name = charName(agentId)
  const title = t('recurringFailure.notifyTitle', 'Recurring failure')
  const body  = t('recurringFailure.notifyBody', '{0} keeps hitting the same kind of failure').replace('{0}', name)
  try {
    const n = new Notification(title, { body, tag: `office-recurring-${agentId}-${reasonCode}`, silent: false, requireInteraction: false })
    n.onclick = () => { try { window.focus() } catch { /* ignore */ } try { n.close() } catch { /* ignore */ } }
  } catch {
    /* Swallow — same defensive posture as fireNotification. */
  }
}

/**
 * Internal: one polling tick. Walks the store's agents and decides whether
 * to start, continue, fire, or clear an episode for each agent.
 *
 * `now()` is injected for deterministic tests.
 */
function tick(store, opts, now = Date.now) {
  const t0 = now()
  // Permission + visibility gates are cheap, check first to short-circuit
  // before the per-agent loop.
  const canFire = isNotificationGranted() && isTabHidden()
  const agents = store.getState().agents
  for (const id of Object.keys(agents)) {
    const a = agents[id]
    if (a?.status === 'blocked' || BLOCKED_DERIVED.has(a?.status)) {
      // 'blocked' and derived statuses (e.g. 'awaiting-approval' inferred by idle-gap)
      // are treated as the SAME episode. If the episode started while status was 'blocked'
      // and idle-gap reclassified to 'awaiting-approval', we must not clear blockedSince —
      // doing so would reset the episode and allow a 2nd OS notification when the real
      // 'blocked' signal re-asserts for the same unanswered prompt.
      if (a?.status === 'blocked' && !blockedSince.has(id)) blockedSince.set(id, t0)
      // AVO-117: recurring-failure notice — fire ONCE per recurring (agent, reason) while in the
      // blocked family. Independent of the 30s-duration notice above (a recurrence is its own signal).
      if (canFire) {
        const st = store.getState()
        const rc = st.externalStatus?.[id]?.reasonCode
        if (recurringInfo(st.recurringFailureLog, { agentId: id, reasonCode: rc, now: t0 }).recurring
            && recurringNotifiedFor.get(id) !== rc) {
          fireRecurringNotification(id, rc)
          recurringNotifiedFor.set(id, rc)
        }
      }
      if (!canFire || !blockedSince.has(id)) continue
      const since = blockedSince.get(id)
      if (t0 - since >= opts.thresholdMs && notifiedFor.get(id) !== since) {
        fireNotification(id)
        notifiedFor.set(id, since)  // dedupe — same episode keyed by start-time
      }
    } else {
      // Genuine transition out of blocked family → reset all maps so the next
      // blocked episode (and a fresh recurrence) is fresh.
      blockedSince.delete(id)
      notifiedFor.delete(id)
      recurringNotifiedFor.delete(id)
    }
  }
}

/**
 * Start the desktop-notifier polling loop. Returns a stop function.
 *
 * Options:
 *   thresholdMs   — blocked-duration before notification fires (default 30000)
 *   intervalMs    — polling interval (default 5000)
 *   now           — clock injector for deterministic tests (default Date.now)
 *
 * Idempotency: calling start without stopping the previous instance leaks
 * the prior interval. PixelOffice's useEffect cleans up correctly so this
 * is not enforced here.
 */
export function startDesktopNotifier(store, options = {}) {
  const opts = {
    thresholdMs: options.thresholdMs ?? DEFAULT_BLOCKED_THRESHOLD_MS,
    intervalMs:  options.intervalMs  ?? POLL_INTERVAL_MS,
    now:         options.now          ?? Date.now,
  }
  if (typeof store?.getState !== 'function') {
    // Defensive: invalid store argument should not crash the host component.
    return () => {}
  }
  if (typeof setInterval === 'undefined') {
    return () => {}
  }
  // First tick fires immediately so an already-blocked agent at startup
  // doesnt have to wait a full interval for episode recognition.
  tick(store, opts, opts.now)
  const id = setInterval(() => tick(store, opts, opts.now), opts.intervalMs)
  return function stopDesktopNotifier() {
    if (typeof clearInterval !== 'undefined') clearInterval(id)
    // Prune Map entries for agents no longer present in the store so
    // evicted/worktree agents don't accumulate across spawned instances.
    const currentAgents = store.getState?.()?.agents ?? {}
    for (const agentId of blockedSince.keys()) {
      if (!(agentId in currentAgents)) {
        blockedSince.delete(agentId)
        notifiedFor.delete(agentId)
      }
    }
  }
}

/**
 * Test/inspection helper: wipe the dedupe maps. Production code should not
 * need this — the polling loop maintains them via transition-out cleanup.
 */
export function _resetDesktopNotifierState() {
  blockedSince.clear()
  notifiedFor.clear()
}
