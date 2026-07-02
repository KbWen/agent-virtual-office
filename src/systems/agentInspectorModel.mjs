const DEFAULT_POSITION = Object.freeze({ x: 300, y: 250 })
const DEFAULT_VIEWBOX = Object.freeze({ width: 800, height: 560 })

const PANEL_WIDTH = 200
const PANEL_MARGIN = 10
const PANEL_AGENT_GAP = 56
const INSPECTOR_READ_TARGET = 1.6
const INSPECTOR_SCALE_MAX = 3

export function truncateText(str, max) {
  if (!str) return ''
  const limit = Number.isFinite(max) ? Math.max(0, max) : 0
  const chars = Array.from(String(str))
  return chars.length > limit ? `${chars.slice(0, limit).join('')}…` : String(str)
}

export function recentAgentActivities(activityLog, agentId, max = 5) {
  if (!Array.isArray(activityLog) || !agentId) return []
  const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 5
  return activityLog
    .filter((entry) => entry?.agentId === agentId)
    .slice(0, limit)
}

export function inspectorAnchorPosition(agent, fallback = DEFAULT_POSITION) {
  if (!agent) return fallback
  return (agent.isMoving ? agent.targetPosition : agent.position) || fallback
}

export function inspectorPanelLayout({
  hasTask = false,
  detailCount = 0,
  activityCount = 0,
  sceneScale = 1,
  position = DEFAULT_POSITION,
  viewBox = DEFAULT_VIEWBOX,
  readTarget = INSPECTOR_READ_TARGET,
  scaleMax = INSPECTOR_SCALE_MAX,
  margin = PANEL_MARGIN,
} = {}) {
  const detailsStartY = hasTask ? 94 : 78
  const activityRows = Math.min(Math.max(0, activityCount), 3)
  let contentBottomY = hasTask ? 78 : 62

  if (detailCount > 0) {
    contentBottomY = detailsStartY + (detailCount - 1) * 14
  }

  const activityDividerY = contentBottomY + 8
  const activityStartY = activityDividerY + 12
  if (activityRows > 0) {
    contentBottomY = activityStartY + (activityRows - 1) * 13
  }

  const width = PANEL_WIDTH
  const height = contentBottomY + 16
  const effectiveSceneScale = sceneScale > 0 ? sceneScale : 1
  const scale = Math.min(scaleMax, Math.max(1, readTarget / effectiveSceneScale))
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  const viewportWidth = viewBox?.width ?? DEFAULT_VIEWBOX.width
  const viewportHeight = viewBox?.height ?? DEFAULT_VIEWBOX.height
  const rightEdge = viewportWidth - margin
  const bottomEdge = viewportHeight - margin

  let x = position.x - scaledWidth / 2
  let y = position.y - scaledHeight - PANEL_AGENT_GAP * scale
  if (x < margin) x = margin
  if (x + scaledWidth > rightEdge) x = rightEdge - scaledWidth
  if (y < margin) y = margin
  if (y + scaledHeight > bottomEdge) y = bottomEdge - scaledHeight

  return {
    activityDividerY,
    activityRows,
    activityStartY,
    contentBottomY,
    detailsStartY,
    height,
    panelGap: PANEL_AGENT_GAP,
    scale,
    scaledHeight,
    scaledWidth,
    width,
    x,
    y,
  }
}
