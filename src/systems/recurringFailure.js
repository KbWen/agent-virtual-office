// AVO-117 — recurring failure-mode detection (pure logic; the store holds the state).
// Honest by construction: we aggregate ONLY the real, hook-derived reasonCode stream (AVO-110),
// count DISTINCT blocked episodes (the store decides what an episode-edge is — this module just
// records the timestamps it's given), and claim only a recurring PATTERN of a KIND — never a
// specific root cause (reasonCode is the coarse, observable unit). No React, no store import.

// Only AVO-110's SPECIFIC reasons can recur. 'blocked-unknown' is deliberately EXCLUDED — a
// recurring *unknown* cause is low-actionability noise and would over-claim. (Mirrors the
// honesty floor: when we don't know the kind, we don't escalate.)
export const RECURRING_REASONS = Object.freeze(['test-run-failed', 'build-failed', 'deps-failed'])

export const RECURRING_THRESHOLD = 3          // distinct blocked episodes…
export const RECURRING_WINDOW_MS = 600_000    // …within this rolling window (10 min)…
export const RECURRING_EPISODE_CAP = 20       // …keep at most this many timestamps per (agent,reason)

function isRecurringReason(reasonCode) {
  return typeof reasonCode === 'string' && RECURRING_REASONS.includes(reasonCode)
}

// Append one episode timestamp for (agentId, reasonCode), pruning anything outside the window and
// capping the list. Returns a NEW log object (never mutates the input). A no-op (returns the same
// reference) for a non-recurring reason / missing args — SPECIFIC-ONLY honesty guarantee.
export function recordEpisode(log, { agentId, reasonCode, now, windowMs = RECURRING_WINDOW_MS, cap = RECURRING_EPISODE_CAP } = {}) {
  if (!isRecurringReason(reasonCode) || typeof agentId !== 'string' || !agentId || !Number.isFinite(now)) {
    return log || {}
  }
  const base = log || {}
  const cutoff = now - windowMs
  const prior = (base[agentId] && Array.isArray(base[agentId][reasonCode])) ? base[agentId][reasonCode] : []
  const pruned = prior.filter((ts) => Number.isFinite(ts) && ts > cutoff)
  pruned.push(now)
  const capped = pruned.length > cap ? pruned.slice(pruned.length - cap) : pruned
  return {
    ...base,
    [agentId]: { ...(base[agentId] || {}), [reasonCode]: capped },
  }
}

// Count episodes for (agentId, reasonCode) still inside the window as of `now`.
export function recurringInfo(log, { agentId, reasonCode, now, threshold = RECURRING_THRESHOLD, windowMs = RECURRING_WINDOW_MS } = {}) {
  const out = { recurring: false, count: 0, reasonCode: isRecurringReason(reasonCode) ? reasonCode : null }
  if (!isRecurringReason(reasonCode) || typeof agentId !== 'string' || !agentId || !Number.isFinite(now)) return out
  const list = (log && log[agentId] && Array.isArray(log[agentId][reasonCode])) ? log[agentId][reasonCode] : []
  const cutoff = now - windowMs
  const count = list.reduce((n, ts) => (Number.isFinite(ts) && ts > cutoff ? n + 1 : n), 0)
  out.count = count
  out.recurring = count >= threshold
  return out
}

export function isRecurring(log, opts) {
  return recurringInfo(log, opts).recurring
}
