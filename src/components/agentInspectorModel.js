import { classifyTask } from '../systems/classify.js'
import { formatTimeAgo } from '../utils/formatTime'
export {
  buildAgentInspectorMeta,
  countAgentDoneToday,
  inspectorAnchorPosition,
  inspectorPanelLayout,
  recentAgentActivities,
  truncateText,
} from '../systems/agentInspectorModel.mjs'

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
export function stateDurationLabel(status, changedAt, now = Date.now()) {
  if (status !== 'blocked' && status !== 'awaiting-approval') return null
  if (!Number.isFinite(changedAt)) return null
  if (now - changedAt < 30000) return null
  return formatTimeAgo(changedAt, { compact: true })
}
