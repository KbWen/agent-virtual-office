export function sanitizeBubbleText(message) {
  return String(message ?? '')
    .replace(/\uFFFD/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

export function bubbleDisplayText(message, maxLen = 16) {
  const cleanMsg = sanitizeBubbleText(message)
  const limit = Number.isFinite(maxLen) ? Math.max(0, Math.floor(maxLen)) : 16
  const chars = Array.from(cleanMsg)
  return chars.length > limit ? `${chars.slice(0, limit).join('')}…` : cleanMsg
}

export function estimateBubbleTextWidth(message) {
  let estWidth = 0
  for (const ch of String(message ?? '')) {
    estWidth += ch.codePointAt(0) > 0x2E7F ? 11 : 6.5
  }
  return estWidth
}

export function computeBubbleLayout(message) {
  const cleanMsg = String(message ?? '')
    .replace(/\uFFFD/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
  const chars = Array.from(cleanMsg)
  const displayMsg = chars.length > 16 ? `${chars.slice(0, 16).join('')}…` : cleanMsg
  let estWidth = 0
  for (const ch of displayMsg) {
    estWidth += ch.codePointAt(0) > 0x2E7F ? 11 : 6.5
  }
  return { displayMsg, boxW: Math.max(Math.ceil(estWidth) + 18, 48) }
}

export function computeEdgeShift({ boxW, absX, scale = 1, sceneMinX = 0, sceneW = 800, edgePad = 4 }) {
  if (absX == null || !Number.isFinite(absX) || !Number.isFinite(scale) || scale <= 0) return 0
  const half = boxW / 2
  const minEdge = sceneMinX + edgePad
  const maxEdge = sceneMinX + sceneW - edgePad
  const leftBound = (minEdge - absX) / scale + half
  const rightBound = (maxEdge - absX) / scale - half
  return Math.min(Math.max(0, leftBound), rightBound)
}

export function speechBubbleGeometry({
  x = 0,
  y = 0,
  boxW = 48,
  boxH = 26,
  below = false,
  shift = 0,
} = {}) {
  const bx = x - boxW / 2 + shift
  const textX = x + shift
  const tailInset = Math.min(6, boxW / 2 - 1)
  const tailAnchor = Math.max(bx + tailInset, Math.min(x, bx + boxW - tailInset))
  const by = below ? y + 8 : y - boxH - 8
  const tailBaseY = below ? by : by + boxH
  const tailTipY = below ? by - 6 : by + boxH + 6

  return {
    boxH,
    boxW,
    bx,
    by,
    tailAnchor,
    tailBaseY,
    tailTipY,
    textX,
  }
}
