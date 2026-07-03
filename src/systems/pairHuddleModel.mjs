/**
 * AVO-106 — Co-editing pair detector and renderer-facing link model (PURE).
 *
 * Honest shared-file correlation: a pair exists only when two distinct agents are currently
 * co-editing the byte-identical file inside the recency window. This module is node-safe so
 * alternate renderers can reuse the same honesty contract without importing React/store code.
 */

export const DEFAULT_PAIR_HUDDLE_WINDOW = 90_000
export const PAIR_HUDDLE_WRITE_TASKS = ['Edit', 'Write']

// Normalize a file path for comparison. Legacy behavior is case-insensitive for the Windows host.
export function normalizeFilePath(p, { caseSensitive = false } = {}) {
  if (typeof p !== 'string' || p.length === 0) return null
  const norm = p.replace(/\\/g, '/')
  return caseSensitive ? norm : norm.toLowerCase()
}

// Basename of a path (display only — language-neutral, honest: it is the real file name).
export function fileBasename(p) {
  if (typeof p !== 'string' || p.length === 0) return ''
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '')
  const slash = norm.lastIndexOf('/')
  return slash === -1 ? norm : norm.slice(slash + 1)
}

export function isPairHuddleWriteTask(task) {
  if (task == null || task === '') return true
  return PAIR_HUDDLE_WRITE_TASKS.includes(String(task))
}

/**
 * Find the best shared-file pair in an externalStatus snapshot.
 * @param {object} externalStatus  { [agentId]: { status, activeFile, activeFileAt, ... } }
 * @param {number} now             Date.now()
 * @param {number} window          recency bound in ms
 * @param {object} options         { caseSensitive?: boolean }
 * @returns {[string, string] | null}  [leadId, partnerId] (most-recent first) or null
 */
export function findSharedFilePair(externalStatus, now, window = DEFAULT_PAIR_HUDDLE_WINDOW, options = {}) {
  const ext = externalStatus || {}
  const byPath = new Map()
  for (const id of Object.keys(ext)) {
    const es = ext[id]
    if (!es || es.status === 'idle') continue
    if (!isPairHuddleWriteTask(es.task)) continue
    const norm = normalizeFilePath(es.activeFile, options)
    if (!norm) continue
    const at = Number(es.activeFileAt)
    if (!Number.isFinite(at) || now - at > window) continue
    if (!byPath.has(norm)) byPath.set(norm, [])
    byPath.get(norm).push({ id, at })
  }

  let best = null
  for (const [pathKey, agents] of byPath) {
    if (agents.length < 2) continue
    agents.sort((a, b) => b.at - a.at)
    const [a0, a1] = agents
    const freshness = a1.at
    if (!best || freshness > best.freshness) {
      best = { pair: [a0.id, a1.id], freshness, pathKey }
    }
  }
  return best ? best.pair : null
}

export function pairEndpointPosition(agent) {
  if (!agent) return null
  return agent.targetPosition || agent.position || null
}

export function pairLinkFile(externalStatus, pair) {
  if (!Array.isArray(pair) || pair.length < 2) return ''
  const ext = externalStatus || {}
  return ext[pair[0]]?.activeFile || ext[pair[1]]?.activeFile || ''
}

export function buildPairLinkViewModel({
  externalStatus,
  agents = {},
  now = Date.now(),
  window = DEFAULT_PAIR_HUDDLE_WINDOW,
  caseSensitive = false,
} = {}) {
  const pair = findSharedFilePair(externalStatus, now, window, { caseSensitive })
  if (!pair) {
    return { visible: false, pair: null, link: null, positions: null }
  }

  const rawFile = pairLinkFile(externalStatus, pair)
  const link = {
    a: pair[0],
    b: pair[1],
    file: fileBasename(rawFile),
    path: rawFile,
    pathKey: normalizeFilePath(rawFile, { caseSensitive }),
  }
  const from = pairEndpointPosition(agents[pair[0]])
  const to = pairEndpointPosition(agents[pair[1]])

  return {
    visible: true,
    pair,
    link,
    positions: from && to ? { from, to } : null,
  }
}
