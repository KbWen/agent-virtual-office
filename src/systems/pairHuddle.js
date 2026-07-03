export const DEFAULT_PAIR_HUDDLE_WINDOW = 90_000
export const PAIR_HUDDLE_WRITE_TASKS = ['Edit', 'Write']

export function normalizeFilePath(p) {
  if (typeof p !== 'string' || p.length === 0) return null
  return p.replace(/\\/g, '/').toLowerCase()
}

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

export function findSharedFilePair(externalStatus, now, window = DEFAULT_PAIR_HUDDLE_WINDOW) {
  const ext = externalStatus || {}
  const byPath = new Map()
  for (const id of Object.keys(ext)) {
    const es = ext[id]
    if (!es || es.status === 'idle' || !isPairHuddleWriteTask(es.task)) continue
    const norm = normalizeFilePath(es.activeFile)
    if (!norm) continue
    const at = Number(es.activeFileAt)
    if (!Number.isFinite(at) || now - at > window) continue
    if (!byPath.has(norm)) byPath.set(norm, [])
    byPath.get(norm).push({ id, at })
  }

  let best = null
  for (const agents of byPath.values()) {
    if (agents.length < 2) continue
    agents.sort((a, b) => b.at - a.at)
    const [a0, a1] = agents
    if (!best || a1.at > best.freshness) best = { pair: [a0.id, a1.id], freshness: a1.at }
  }
  return best ? best.pair : null
}
