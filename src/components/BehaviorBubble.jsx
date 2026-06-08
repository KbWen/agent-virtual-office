import React, { useEffect, useState, useRef, useMemo } from 'react'

function BehaviorBubble({ x, y, message, below = false, absX = null, scale = 1, sceneW = 800, edgePad = 4 }) {
  const [visible, setVisible] = useState(false)
  const [currentMsg, setCurrentMsg] = useState(message)
  const fadeTimerRef = useRef(null)

  useEffect(() => {
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null }
    if (message) {
      setCurrentMsg(message)
      setVisible(true)
    } else {
      setVisible(false)
      // SVG <g> doesn't fire transitionend — use timeout matching transition duration
      fadeTimerRef.current = setTimeout(() => setCurrentMsg(null), 350)
    }
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current) }
  }, [message])

  // Derive display text + box width ONCE per message. Without this memo the three
  // surrogate-cleaning regexes, the Array.from split, and the per-char width loop
  // re-ran on every render — and BehaviorBubble re-renders on every x/y change while
  // its parent AgentCharacter walks (~30fps). The result depends only on currentMsg,
  // which changes a few times per minute, so x/y movement must not retrigger it.
  const derived = useMemo(() => {
    if (!currentMsg) return null
    return computeBubbleLayout(currentMsg)
  }, [currentMsg])

  if (!derived) return null

  const { displayMsg, boxW } = derived
  const boxH = 26
  // #47 — horizontal edge clamp. The bubble renders in character-local coords centered on x, but
  // an agent at a far-left/right desk would draw a wide bubble PAST the scene's x-edge (the office
  // svg clips its viewBox), cutting the bubble off. When the parent supplies the agent's absolute
  // scene x (`absX`) + the net local→scene scale, we shift the box horizontally so it stays inside
  // [edgePad, sceneW−edgePad] while the TAIL stays anchored on the agent (see tailAnchor below).
  // absX===null (back-compat / no scene context) → shift 0, byte-identical to the old centered box.
  const shift = computeEdgeShift({ boxW, absX, scale, sceneW, edgePad })
  const bx = x - boxW / 2 + shift
  const textX = x + shift
  // Tail tip points at the agent (x); its base attaches to the shifted box, clamped 6px inside the
  // box edges so a large shift slants the tail back to the speaker instead of detaching from it.
  const tailAnchor = Math.max(bx + 6, Math.min(x, bx + boxW - 6))
  // `below`: for agents at the very top of the office, the default (above-the-head) bubble draws
  // past the SVG's top edge and gets clipped. The parent flips it BELOW the agent and the tail
  // points up instead of down.
  const by = below ? y + 8 : y - boxH - 8
  const tailBaseY = below ? by : by + boxH         // edge of the box the tail grows from
  const tailTipY = below ? by - 6 : by + boxH + 6  // the pointed tip (toward the agent)

  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-5px)',
        transition: 'opacity 0.3s, transform 0.3s',
      }}
    >
      {/* Bubble body */}
      <rect
        x={bx} y={by}
        width={boxW} height={boxH}
        rx={8}
        fill="white"
        stroke="#DDD"
        strokeWidth="1"
        filter="url(#bubble-shadow)"
      />
      {/* Triangle pointer: base on the (possibly shifted) box, tip at the agent (x) */}
      <polygon
        points={`${tailAnchor - 5},${tailBaseY} ${tailAnchor + 5},${tailBaseY} ${x},${tailTipY}`}
        fill="white"
        stroke="#DDD"
        strokeWidth="0.6"
      />
      {/* Cover the line where triangle meets rect */}
      <line x1={tailAnchor - 5} y1={tailBaseY} x2={tailAnchor + 5} y2={tailBaseY} stroke="white" strokeWidth="1.5" />
      {/* Text */}
      <text
        x={textX}
        y={by + boxH / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fontWeight="500"
        fill="#333"
      >
        {displayMsg}
      </text>
    </g>
  )
}

// React.memo: AgentCharacter (the parent) re-renders ~30fps while the character walks
// because its renderPos state updates every other RAF frame. BehaviorBubble's props are
// x=0 / y=-68 (constant literals) and message (changes a few times per minute), so on a
// walk-tick re-render none of its props change — memo skips the whole render + the JSX
// reconciliation of its ~5 SVG elements. The inner useMemo only guards the layout math;
// React.memo additionally elides the component invocation itself.
export default React.memo(BehaviorBubble)

// Pure layout derivation — extracted so the memo body stays small and the regex /
// char-width work is unambiguously a function of the message string alone.
function computeBubbleLayout(currentMsg) {
  // Clean garbled characters: U+FFFD and unpaired surrogates only.
  // Full surrogate range strip destroyed non-BMP emoji (\uD83D\uDE80 etc.) \u2014 keep paired surrogates.
  const cleanMsg = currentMsg
    .replace(/\uFFFD/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')   // lone high surrogate
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')  // lone low surrogate

  // Unicode-safe truncation using Array.from (handles surrogate pairs)
  const chars = Array.from(cleanMsg)
  const maxLen = 16
  const displayMsg = chars.length > maxLen ? chars.slice(0, maxLen).join('') + '…' : cleanMsg

  // Width: CJK chars (~11 units) vs ASCII (~6.5 units) at fontSize 11
  let estWidth = 0
  for (const ch of displayMsg) {
    estWidth += ch.codePointAt(0) > 0x2E7F ? 11 : 6.5
  }
  return { displayMsg, boxW: Math.max(Math.ceil(estWidth) + 18, 48) }
}

// #47 — pure horizontal-edge shift (local units) so a bubble centered on an agent at absolute scene
// x `absX` stays inside [edgePad, sceneW − edgePad]. `scale` is the net local→scene factor (so a
// local shift of `s` moves the box `s·scale` in scene units). Returns 0 when no scene context is
// given (absX null / non-finite scale) — the bubble then renders centered as before.
//   box scene span = absX + (localX ± boxW/2 + shift)·scale, with localX = 0 (bubble is centered on
//   the agent). Solve each edge for shift, then pick the value closest to 0 (no shift) that satisfies
//   both — pushing right when it would clip the left edge, left when it would clip the right.
export function computeEdgeShift({ boxW, absX, scale = 1, sceneW = 800, edgePad = 4 }) {
  if (absX == null || !Number.isFinite(absX) || !Number.isFinite(scale) || scale <= 0) return 0
  const half = boxW / 2
  const leftBound = (edgePad - absX) / scale + half          // minimum shift to clear the left edge
  const rightBound = (sceneW - edgePad - absX) / scale - half // maximum shift before clipping right
  // closest-to-zero shift within [leftBound, rightBound]. If the box is wider than the available
  // span (leftBound > rightBound) this yields rightBound — best effort that keeps the right edge in.
  return Math.min(Math.max(0, leftBound), rightBound)
}
