export const HELPER_MAX_VISIBLE = 3
export const HELPER_OFFSETS = Object.freeze([
  Object.freeze({ dx: -15, dy: 16 }),
  Object.freeze({ dx: 15, dy: 16 }),
  Object.freeze({ dx: 0, dy: 27 }),
])
export const HELPER_BADGE_OFFSET = Object.freeze({ dx: 25, dy: 25 })
export const HELPER_COLORS = Object.freeze(['#378ADD', '#1D9E75', '#BA7517'])
export const HELPER_HEAVY_THRESHOLD = 4

export function helperCountByParent(helpers = []) {
  const counts = {}
  if (!Array.isArray(helpers)) return counts
  for (const helper of helpers) {
    if (!helper?.parentRole) continue
    counts[helper.parentRole] = (counts[helper.parentRole] || 0) + 1
  }
  return counts
}

export function resolveAnchoredHelperLayout(count, anchor = null) {
  const n = Math.max(0, count | 0)
  if (!anchor || n === 0) return { sprites: [], overflow: 0, heavy: false, anchor: null }
  const visible = Math.min(n, HELPER_MAX_VISIBLE)
  const sprites = []
  for (let i = 0; i < visible; i++) {
    const off = HELPER_OFFSETS[i]
    sprites.push({ x: anchor.x + off.dx, y: anchor.y + off.dy })
  }
  return {
    sprites,
    overflow: Math.max(0, n - HELPER_MAX_VISIBLE),
    heavy: n >= HELPER_HEAVY_THRESHOLD,
    anchor,
  }
}

export function helperHuddleSignature({ helpers = [], agents = {} } = {}) {
  const counts = helperCountByParent(helpers)
  const out = {}
  for (const role of Object.keys(counts)) {
    const agent = agents?.[role]
    if (!agent) continue
    const pos = agent.position
    out[role] = `${counts[role]}|${pos ? Math.round(pos.x) : ''}|${pos ? Math.round(pos.y) : ''}|${agent.color || ''}`
  }
  return out
}

export function parseHelperHuddleSignatureEntry(value) {
  const [countStr, axStr, ayStr, color] = String(value || '').split('|')
  return {
    count: Number(countStr) || 0,
    anchor: axStr !== '' ? { x: Number(axStr), y: Number(ayStr) } : null,
    color: color || '',
  }
}

export function buildHelperHuddleViewModel({
  helpers = [],
  agents = {},
  defaultAnchors = {},
  fallbackColor = HELPER_COLORS[0],
} = {}) {
  const signature = helperHuddleSignature({ helpers, agents })
  const rows = []
  for (const role of Object.keys(signature)) {
    const parsed = parseHelperHuddleSignatureEntry(signature[role])
    const anchor = parsed.anchor || defaultAnchors?.[role] || null
    const layout = resolveAnchoredHelperLayout(parsed.count, anchor)
    if (layout.sprites.length === 0 || !layout.anchor) continue
    rows.push({
      role,
      count: parsed.count,
      color: parsed.color || fallbackColor,
      ...layout,
    })
  }
  return { signature, rows }
}
