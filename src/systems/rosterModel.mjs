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

function agentValues(agents = {}) {
  return Array.isArray(agents) ? agents : Object.values(agents || {})
}

function activeStatus(agent, externalStatus = {}) {
  const ext = agent?.id ? externalStatus[agent.id] : null
  return ext?.status || agent?.status || 'idle'
}

// Signature for React subscribers: includes only fields that can change roster salience or labels.
// It deliberately excludes position/movement so per-frame office animation cannot churn the rail.
export function presenceRailSignature({ agents = {}, externalStatus = {} } = {}) {
  return agentValues(agents)
    .filter((agent) => agent && !agent.session)
    .map((agent) => {
      const ext = externalStatus[agent.id]
      return `${agent.id}|${ext?.status || agent.status || 'idle'}|${agent.behavior || ''}|${agent.bubble || ''}|${ext?.task || ''}|${ext?.expiresAt || 0}|${ext?.changedAt || 0}`
    })
}

export function presenceRailRows({ agents = {}, externalStatus = {} } = {}) {
  return agentValues(agents)
    .filter((agent) => agent && !agent.session)
    .map((agent) => {
      const ext = externalStatus[agent.id]
      return { id: agent.id, agent, ext, status: activeStatus(agent, externalStatus) }
    })
}

export function scopedRosterFeed(eventFeed = [], expandedId = null, max = 18) {
  if (!Array.isArray(eventFeed)) return []
  const scoped = expandedId
    ? eventFeed.filter((entry) => entry?.agentId === expandedId || entry?.from === expandedId || entry?.to === expandedId)
    : eventFeed
  return scoped.slice(0, max)
}

export function helperCountByParent(helpers = []) {
  const counts = {}
  if (!Array.isArray(helpers)) return counts
  for (const helper of helpers) {
    if (!helper?.parentRole) continue
    counts[helper.parentRole] = (counts[helper.parentRole] || 0) + 1
  }
  return counts
}

export function buildPresenceRailViewModel({
  agents = {},
  externalStatus = {},
  eventFeed = [],
  helpers = [],
  doneCounts = {},
  blockedCounts = {},
  activeWorkflow = null,
  expandedId = null,
  nameForId = (id) => id,
  maxFeed = 18,
} = {}) {
  const rows = presenceRailRows({ agents, externalStatus })
  const sortedRows = [...rows].sort(comparePresence)
  const subagentCountById = helperCountByParent(helpers)
  const colorById = {}
  for (const row of rows) colorById[row.id] = row.agent?.color

  const activeCount = sortedRows.filter((row) => !isIdleStatus(row.status)).length
  const blockedNames = sortedRows
    .filter((row) => row.status === 'blocked' || row.status === 'awaiting-approval')
    .map((row) => nameForId(row.id))
  const team = teamStatus({ blockedNames, activeWorkflow, activeCount })
  const totalDone = Object.values(doneCounts || {}).reduce((total, count) => total + (count || 0), 0)

  return {
    rows,
    sortedRows,
    renderRows: sortedRows.map((row) => ({
      ...row,
      dimmed: isIdleStatus(row.status),
      doneCount: doneCounts?.[row.id] || 0,
      blockedCount: blockedCounts?.[row.id] || 0,
      subagents: subagentCountById[row.id] || 0,
    })),
    feed: scopedRosterFeed(eventFeed, expandedId, maxFeed),
    colorById,
    subagentCountById,
    activeCount,
    blockedNames,
    team,
    totalDone,
    quiet: activeCount === 0,
  }
}
