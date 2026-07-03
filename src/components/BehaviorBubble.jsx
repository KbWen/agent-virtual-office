import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
  computeBubbleLayout,
  computeEdgeShift,
} from '../systems/speechBubbleModel.mjs'

export { computeEdgeShift } from '../systems/speechBubbleModel.mjs'

function BehaviorBubble({ x, y, message, below = false, absX = null, scale = 1, sceneMinX = 0, sceneW = 800, edgePad = 4 }) {
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
  const shift = computeEdgeShift({ boxW, absX, scale, sceneMinX, sceneW, edgePad })
  const bx = x - boxW / 2 + shift
  const textX = x + shift
  // Tail tip points at the agent (x); its base attaches to the shifted box, inset from the box edges
  // so a large shift slants the tail back to the speaker instead of detaching from it. The inset is
  // capped at boxW/2-1 so the clamp can't invert for a hypothetical sub-12px box (today boxW≥48).
  const tailInset = Math.min(6, boxW / 2 - 1)
  const tailAnchor = Math.max(bx + tailInset, Math.min(x, bx + boxW - tailInset))
  // `below`: for agents at the very top of the office, the default (above-the-head) bubble draws
  // past the SVG's top edge and gets clipped. The parent flips it BELOW the agent and the tail
  // points up instead of down.
  const by = below ? y + 8 : y - boxH - 8
  const tailBaseY = below ? by : by + boxH
  const tailTipY = below ? by - 6 : by + boxH + 6

  return (
    <g
      className="speech-bubble"
      data-bubble-visible={visible ? '1' : '0'}
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
