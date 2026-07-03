export const BUBBLE_PRIORITY = Object.freeze({
  blocked: 0,
  'awaiting-approval': 0,
  done: 1,
  working: 2,
  planning: 2,
  thinking: 2,
})

export const BUBBLE_VISIBLE_CAP = 3
export const BUBBLE_ROTATE_MS = 2500

export function bubblePriority(status) {
  const p = BUBBLE_PRIORITY[status]
  return p === undefined ? 3 : p
}

let _memo = null
export function selectVisibleBubbles(agents, externalStatus, cap = BUBBLE_VISIBLE_CAP, now = 0, rotateMs = BUBBLE_ROTATE_MS) {
  const period = rotateMs > 0 ? rotateMs : 1
  const epoch = Math.floor(Math.max(0, now) / period)
  if (_memo && _memo.agents === agents && _memo.ext === externalStatus
      && _memo.cap === cap && _memo.epoch === epoch && _memo.rotateMs === rotateMs) {
    return _memo.result
  }

  const ext = externalStatus || {}
  const candidates = []
  for (const id of Object.keys(agents || {})) {
    const a = agents[id]
    if (!a || !a.bubble) continue
    const status = (ext[id] && ext[id].status) || a.status || 'idle'
    const changedAt = ext[id] && Number.isFinite(ext[id].changedAt) ? ext[id].changedAt : 0
    candidates.push({ id, pri: bubblePriority(status), changedAt })
  }

  let result
  if (candidates.length === 0) {
    result = new Set()
  } else {
    const ids = candidates.map((c) => c.id).sort()
    const offset = ids.length ? (epoch % ids.length) : 0
    const rankMap = new Map(ids.map((id, i) => [id, (i - offset + ids.length) % ids.length]))
    const rankOf = (id) => rankMap.get(id) ?? 0
    candidates.sort((x, y) => x.pri - y.pri || y.changedAt - x.changedAt || rankOf(x.id) - rankOf(y.id))
    result = new Set(candidates.slice(0, Math.max(0, cap)).map((c) => c.id))
  }

  _memo = { agents, ext: externalStatus, cap, epoch, rotateMs, result }
  return result
}

export function buildBubbleVisibilityViewModel({
  agents = {},
  externalStatus = {},
  cap = BUBBLE_VISIBLE_CAP,
  now = 0,
  rotateMs = BUBBLE_ROTATE_MS,
} = {}) {
  const visible = selectVisibleBubbles(agents, externalStatus, cap, now, rotateMs)
  return {
    cap: Math.max(0, cap),
    rotateMs,
    visibleIds: [...visible],
    visible,
  }
}
