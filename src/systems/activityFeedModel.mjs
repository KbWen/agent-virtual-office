export const ACTIVITY_RECENT_MS = 30000
export const ACTIVITY_FRESH_MS = 10000
export const ACTIVITY_OPACITY_DECAY_MS = 20 * 60 * 1000
export const ACTIVITY_OPACITY_FLOOR = 0.45

export function activityAgeMs(entry, now = Date.now()) {
  if (!Number.isFinite(entry?.timestamp)) return null
  return Math.max(0, now - entry.timestamp)
}

export function activityOpacity(ageMs) {
  if (!Number.isFinite(ageMs)) return 1
  return Math.max(ACTIVITY_OPACITY_FLOOR, 1 - ageMs / ACTIVITY_OPACITY_DECAY_MS)
}

export function activityTone(entry) {
  if (entry?.type !== 'status') return 'neutral'
  if (entry.status === 'blocked') return 'danger'
  if (entry.status === 'done') return 'success'
  return 'neutral'
}

export function activityIconKey(entry) {
  if (entry?.type === 'event') return 'event'
  if (entry?.type === 'status') return 'status'
  return 'behavior'
}

export function isActivityForAgent(entry, agentId) {
  if (!agentId) return true
  return entry?.agentId === agentId || entry?.from === agentId || entry?.to === agentId
}

export function activityFeedEntries(entries = [], { focusedId = null, max = 20 } = {}) {
  if (!Array.isArray(entries)) return []
  const scoped = focusedId ? entries.filter((entry) => isActivityForAgent(entry, focusedId)) : entries
  return scoped.slice(0, max)
}

export function buildActivityFeedEntryView(entry, {
  now = Date.now(),
  messageForEntry = () => ({ text: String(entry?.message ?? ''), title: null }),
  nameForId = (id) => id,
  colorForId = () => null,
  reducedMotion = false,
} = {}) {
  const ageMs = activityAgeMs(entry, now)
  const message = messageForEntry(entry) || { text: '', title: null }
  const agentId = entry?.agentId || null
  const from = entry?.from || null
  const to = entry?.to || null
  const accentColor = colorForId(agentId) || colorForId(from) || null

  return {
    entry,
    id: entry?.id ?? null,
    kind: entry?.type || 'status',
    iconKey: activityIconKey(entry),
    status: entry?.status || null,
    message,
    ageMs,
    isFresh: Number.isFinite(ageMs) && ageMs < ACTIVITY_FRESH_MS,
    isRecent: Number.isFinite(ageMs) && ageMs < ACTIVITY_RECENT_MS,
    opacity: activityOpacity(ageMs),
    animateIn: !reducedMotion,
    tone: activityTone(entry),
    agentId,
    agentName: agentId ? nameForId(agentId) : null,
    agentColor: agentId ? colorForId(agentId) : null,
    from,
    to,
    fromName: from ? nameForId(from) : null,
    toName: to ? nameForId(to) : null,
    accentColor,
  }
}

export function buildActivityFeedViewModel(entries = [], options = {}) {
  const selected = activityFeedEntries(entries, options)
  const rows = selected.map((entry) => buildActivityFeedEntryView(entry, options))
  return {
    entries: rows,
    count: rows.length,
    hasEntries: rows.length > 0,
    unreadCount: rows.filter((row) => row.isRecent).length,
  }
}
