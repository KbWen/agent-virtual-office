// Pure presence/feed model for roster-like status views.
//
// Keep this free of React, i18n, store, and pixel-office concepts so other frontends can reuse the
// same team-state ordering and real-signal feed filter without importing UI components.

// Salience tiers are deliberately just TWO:
// 0 = blocked / awaiting-approval — needs a human, so it pins to the top.
// 1 = everyone else — held in stable id order to avoid active/idle jitter.
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
  const tier = PRESENCE_TIER[status]
  return tier === undefined ? 1 : tier
}

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

// Honest team-state strip priority: blocked > workflow > active > none.
// Decorative office events and mood are intentionally not inputs.
export function teamStatus({ blockedNames = [], activeWorkflow = null, activeCount = 0 } = {}) {
  if (blockedNames.length > 0) return { kind: 'blocked', names: blockedNames }
  if (activeWorkflow) return { kind: 'workflow', workflow: activeWorkflow, activeCount }
  if (activeCount > 0) return { kind: 'active', activeCount }
  return { kind: 'none' }
}

export const FEED_ORIGINS = new Set(['hook', 'event', 'inferred'])

export function isFeedWorthy(entry) {
  return !!entry && FEED_ORIGINS.has(entry.origin)
}

export function feedEntries(activityLog) {
  if (!Array.isArray(activityLog)) return []
  return activityLog.filter(isFeedWorthy)
}
