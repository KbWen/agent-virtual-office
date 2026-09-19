import { classifyTask } from '../systems/classify.js'
import { formatTimeAgo } from '../utils/formatTime'
import { BLOCKED_FAMILY } from '../systems/constants.js'  // AVO-181: single source for the blocked family

// The single line of "what is this agent doing" the inspector shows. The hook's
// human `label` ("✏️ 改 App.jsx", "❌ npm test failed") is richest, so it wins.
// When a channel supplies only a raw task with no label (e.g. the URL-hash
// bridge: `#dev=mcp__notion__create_page`), collapse it through the classifier
// so the inspector never shows the ugly `mcp__Server__tool` wire form — matching
// the character TaskLabel (AVO-103) and the control-panel chip (Round 2).
export function inspectorTaskLabel(ext) {
  if (!ext) return null
  if (ext.label) return ext.label
  if (ext.task) return classifyTask(ext.task).visualLabel
  return null
}

// AVO-169: how long the agent has been in an ACTIONABLE waiting state, shown inline in the inspector.
// Honest by construction — driven only by the real `changedAt` (stamped on a real status/task change),
// returns null below 30s or when `changedAt` is missing (NEVER a fabricated "0m" freshly-entered
// reading). Compact form (e.g. "3m"). Restricted to the two states where "how long" is actionable.
const STATE_DURATION_MIN_MS = 30000

export function stateDurationLabel(status, changedAt, now = Date.now()) {
  if (!BLOCKED_FAMILY.has(status)) return null
  if (!Number.isFinite(changedAt)) return null
  if (now - changedAt < STATE_DURATION_MIN_MS) return null
  return formatTimeAgo(changedAt, { compact: true, now })
}

export function countAgentDoneToday(activityLog, agentId, now = Date.now()) {
  if (!agentId) return 0

  if (activityLog && !Array.isArray(activityLog) && typeof activityLog === 'object') {
    const today = new Date(now)
    const dayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    if (activityLog.dayKey !== dayKey || !activityLog.counts) return 0
    return Number(activityLog.counts[agentId] || 0)
  }

  if (!Array.isArray(activityLog) || activityLog.length === 0) return 0

  const today = new Date(now)
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime()

  return activityLog.filter((entry) =>
    entry?.agentId === agentId
    && entry?.type === 'status'
    && entry?.status === 'done'
    && typeof entry?.timestamp === 'number'
    && entry.timestamp >= startOfDay
    && entry.timestamp <= now
  ).length
}

export function buildAgentInspectorMeta(activityLog, agentId, mood, activeWorkflow, now = Date.now()) {
  return {
    doneToday: countAgentDoneToday(activityLog, agentId, now),
    mood: mood || 'normal',
    activeWorkflow: activeWorkflow || null,
  }
}

// 2026-09-19 review, REV-01: where the inspector card goes, in scene units. It sits above the agent
// and is clamped inside the LIVE viewBox (`bounds` = store.sceneBounds) minus `pad`, NOT a literal
// 800×560 — panel mode crops the scene (e.g. `40 135 580 300`), and a literal clamp put the card's
// header and close button above the crop. `scale` is the readable counter-scale the component asks
// for; it is lowered only when the scaled card would not fit the bounds at all, because a card that
// clips its close button is worse than smaller text. For the full office this equals the previous
// inline clamp (10 / 790 / 10 / 550) whenever the card fits. Bounds too small to hold any card
// (unreachable from PixelOffice's crops) keep a small positive scale instead of mirroring the card.
const FULL_SCENE = { minX: 0, minY: 0, w: 800, h: 560 }
const MIN_CARD_SCALE = 0.25

export function placeInspector({ anchor, W, H, scale, bounds = FULL_SCENE, pad = 10 }) {
  const left = bounds.minX + pad
  const right = bounds.minX + bounds.w - pad
  const top = bounds.minY + pad
  const bottom = bounds.minY + bounds.h - pad
  const s = Math.max(MIN_CARD_SCALE, Math.min(scale, (right - left) / W, (bottom - top) / H))
  const Ws = W * s, Hs = H * s
  const px = Math.max(left, Math.min(anchor.x - Ws / 2, right - Ws))
  const py = Math.max(top, Math.min(anchor.y - Hs - 56 * s, bottom - Hs))
  return { px, py, s }
}
