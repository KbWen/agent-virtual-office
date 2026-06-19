// AVO-117 — recurring failure-mode detection (pure logic; the store holds the state).
// Honest by construction: we aggregate ONLY the real, hook-derived reasonCode stream (AVO-110),
// count DISTINCT blocked episodes (the store decides what an episode-edge is — this module just
// records the timestamps it's given), and claim only a recurring PATTERN of a KIND — never a
// specific root cause (reasonCode is the coarse, observable unit). No React, no store.
import { BLOCKED_FAMILY } from './constants.js'  // AVO-181: shared blocked family (a pure constant, not the store)

// Only AVO-110's SPECIFIC reasons can recur. 'blocked-unknown' is deliberately EXCLUDED — a
// recurring *unknown* cause is low-actionability noise and would over-claim. (Mirrors the
// honesty floor: when we don't know the kind, we don't escalate.)
// AVO-148 (AC-5): the three new structured-event tokens are specific enough to recur;
// blocked-unknown stays excluded.
export const RECURRING_REASONS = Object.freeze([
  'test-run-failed', 'build-failed', 'deps-failed',
  'permission-denied', 'api-rate-limit', 'api-auth-failed',
])

export const RECURRING_THRESHOLD = 3          // distinct blocked episodes…
export const RECURRING_WINDOW_MS = 600_000    // …within this rolling window (10 min)…
export const RECURRING_EPISODE_CAP = 20       // …keep at most this many timestamps per (agent,reason)

function isRecurringReason(reasonCode) {
  return typeof reasonCode === 'string' && RECURRING_REASONS.includes(reasonCode)
}

// The idle-gap inferrer reclassifies a single stuck agent `blocked → awaiting-approval → blocked`
// for the SAME unanswered state (the shared BLOCKED_FAMILY in constants.js). Counting each re-entry as
// a new episode would manufacture a FALSE recurrence from one real block — the exact alarm the spec
// forbids. So a blocked-family status is a CONTINUATION, not a new episode.

// Is `next` the START of a NEW blocked episode (vs a continuation / poll re-read)? New episode =
// entering 'blocked' with a SPECIFIC reason from a NON-blocked-family prior state, OR a genuine
// reason change while already 'blocked'. A blocked↔awaiting-approval flap is NOT a new episode.
export function isNewBlockedEpisode(prev, next) {
  const status = next && next.status
  const reasonCode = next && next.reasonCode
  if (status !== 'blocked' || !isRecurringReason(reasonCode)) return false
  if (!prev) return true
  if (!BLOCKED_FAMILY.has(prev.status)) return true                          // from working/done/idle → new
  if (prev.status === 'blocked' && prev.reasonCode !== reasonCode) return true // reason changed while blocked
  return false                                                                // continuation (incl. idle-gap flap)
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
