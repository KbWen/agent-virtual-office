import { STATUS_COLORS } from './statusVisualModel.mjs'
import { behaviorIndicatorState } from './behaviorIndicatorModel.mjs'

export const CHAR_SCALE = 1.35
export const LABEL_SCALE_MAX = 1.5
export const BASE_GLOW = Object.freeze({ op: 0.5, sw: 2 })
export const EFFORT_GLOW = Object.freeze({
  high: Object.freeze({ op: 0.7, sw: 2.5 }),
  xhigh: Object.freeze({ op: 0.85, sw: 3 }),
  max: Object.freeze({ op: 1, sw: 3.5 }),
})

export function computeLabelScale(sceneScale, max = LABEL_SCALE_MAX) {
  if (!(sceneScale > 0)) return 1
  return Math.min(max, 1 / Math.min(sceneScale, 1))
}

export function estimateTextWidth(str) {
  let width = 0
  for (const ch of String(str || '')) {
    width += ch.codePointAt(0) > 0x2E7F ? 10 : 7
  }
  return width
}

export function nameTagMetrics(name, { padding = 16 } = {}) {
  const width = estimateTextWidth(name) + padding
  return { tagW: width, tagHalfW: width / 2 }
}

export function characterStatusVisual({
  status = 'idle',
  color = '#888',
  hovered = false,
  hasActiveHelper = false,
  effort = null,
} = {}) {
  const normalized = status || 'idle'
  const statusColor = STATUS_COLORS[normalized] || null
  const tagFill = normalized !== 'idle' ? (statusColor || color) : color
  const showName = Boolean(hovered || (normalized && normalized !== 'idle'))

  return {
    status: normalized,
    tagFill,
    glowColor: statusColor,
    showName,
    ring: characterStatusRing({ status: normalized, hasActiveHelper, effort }),
  }
}

export function characterStatusRing({ status = 'idle', hasActiveHelper = false, effort = null } = {}) {
  const normalized = status || 'idle'
  if ((normalized === 'working' || normalized === 'planning') && hasActiveHelper) {
    return {
      kind: 'supervising',
      animate: 'slow-breathe',
      ...BASE_GLOW,
      op: Number((BASE_GLOW.op * 0.6).toFixed(2)),
    }
  }
  if (normalized === 'working' || normalized === 'planning') {
    const glow = normalized === 'working' ? (EFFORT_GLOW[effort] || BASE_GLOW) : BASE_GLOW
    return {
      kind: 'active',
      animate: 'pulse',
      ...glow,
    }
  }
  if (normalized === 'blocked') {
    return { kind: 'blocked', animate: 'urgent-breathe', op: 0.4, sw: 2 }
  }
  if (normalized === 'awaiting-approval') {
    return { kind: 'awaiting-approval', animate: 'calm-breathe', op: 0.45, sw: 2 }
  }
  if (normalized === 'done') {
    return { kind: 'done', animate: 'flash', op: 0.6, sw: 2.5 }
  }
  return null
}

export function characterIndicatorState({ status = 'idle', behavior = 'idle', isWalking = false, reasonCode = null } = {}) {
  if (isWalking) {
    return {
      kind: 'none',
      key: 'none',
      behavior: behavior || 'idle',
      iconKey: null,
      variant: null,
      known: true,
    }
  }
  if ((status || 'idle') === 'blocked') {
    return {
      kind: 'blocked-reason',
      key: `reason-${reasonCode || 'unknown'}`,
      reasonCode: reasonCode || null,
      behavior: behavior || 'idle',
      iconKey: 'blocked-reason',
      variant: reasonCode || 'unknown',
      known: true,
    }
  }
  const indicator = behaviorIndicatorState(behavior)
  return {
    kind: 'behavior',
    key: indicator.behavior,
    ...indicator,
  }
}

export function characterBubbleLayout({ position = { x: 0, y: 0 }, labelScale = 1 } = {}) {
  const topIfAbove = position.y - 68 - 34 * labelScale
  const below = topIfAbove < 6
  return {
    below,
    y: below ? 6 : -68,
    topIfAbove,
  }
}

export function characterBubbleMessage({ pokeQuip = null, bubbleVisible = false, bubble = null } = {}) {
  return pokeQuip || (bubbleVisible ? bubble : null)
}
