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
  return formatTimeAgo(changedAt, { compact: true })
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
