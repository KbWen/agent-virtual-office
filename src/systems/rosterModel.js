// ─── Pure presence/feed model for the vertical roster (COMMS rebuild) ──────────────────────
// Extracted so the salience ordering + feed-origin filter are unit-testable in isolation and
// have ONE source of truth. No React, no store — pure functions of plain data.

// Salience tiers — deliberately just TWO:
//   0 = blocked / awaiting-approval — needs a human → pins to the top (the operator's 2-second
//       glance: "is anyone waiting on me?"). This is the ONLY thing that reorders.
//   1 = everyone else (working / planning / thinking / done / idle) — held in a STABLE id order.
// Idle is NOT a separate sinking tier: live agents flip active↔idle constantly between turns, so
// sinking idle would reshuffle the whole column every couple seconds — exactly the "hyperactive
// column" the operator + calm-tech rejected. Instead idle is dimmed IN PLACE (see isIdleStatus),
// the roster stays put, and only a genuinely-blocked agent jumps to the top. Liveliness comes from
// the activity FEED + in-place cues, not from perpetual rail re-sorting. (Verified against live
// hook churn: a 3-tier active/idle sort thrashed; this 2-tier model is stable.)
export const PRESENCE_TIER = {
  blocked: 0,
  'awaiting-approval': 0,
  working: 1,
  planning: 1,
  thinking: 1,
  done: 1,
  idle: 1,
}

export function salienceTier(status) {
  const t = PRESENCE_TIER[status]
  return t === undefined ? 1 : t
}

// Sort comparator: tier ascending (blocked first), then a STABLE id tiebreak so same-tier rows
// keep a fixed order (no jitter, no within-tier churn while agents work).
export function comparePresence(a, b) {
  const ta = salienceTier(a && a.status)
  const tb = salienceTier(b && b.status)
  if (ta !== tb) return ta - tb
  const ia = (a && a.id) || ''
  const ib = (b && b.id) || ''
  return ia < ib ? -1 : ia > ib ? 1 : 0
}

export function isIdleStatus(status) {
  return !status || status === 'idle'
}

// Team-status strip priority (COMMS point 4): the HONEST team signal, most-urgent first —
//   blocked (someone needs a human) > live workflow phase (real hook signal) > active count > none.
// Decorative officeLife events (tea-break/standup/…) and mood/weather are intentionally EXCLUDED:
// they're theater, not team state. Surfacing them as "team status" was the disconnect the user hit
// (a "Review 爭論" banner the agents couldn't truthfully reflect).
export function teamStatus({ blockedNames = [], activeWorkflow = null, activeCount = 0 } = {}) {
  if (blockedNames.length > 0) return { kind: 'blocked', names: blockedNames }
  if (activeWorkflow) return { kind: 'workflow', workflow: activeWorkflow, activeCount }
  if (activeCount > 0) return { kind: 'active', activeCount }
  return { kind: 'none' }
}

// Activity-feed filter — the office's `activityLog` is flooded by organic officeLife "theater"
// (typing/coffee/whiteboard behaviors, 8-50/min) that would drown and evict the real events.
// The feed shows ONLY genuine signal: real hook status changes, workflow/team events, and
// idle-gap-inferred states (which the UI labels as inferred). Organic theater is excluded.
export const FEED_ORIGINS = new Set(['hook', 'event', 'inferred'])

export function isFeedWorthy(entry) {
  return !!entry && FEED_ORIGINS.has(entry.origin)
}

// Order an activityLog (already newest-first) for the feed: drop organic theater, keep the rest in
// the order given. Caller decides how many to show.
export function feedEntries(activityLog) {
  if (!Array.isArray(activityLog)) return []
  return activityLog.filter(isFeedWorthy)
}
