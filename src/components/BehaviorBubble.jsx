import React, { useEffect, useState, useRef, useMemo } from 'react'

function BehaviorBubble({ x, y, message, below = false }) {
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
  // bx is always centered on x — bubble renders in character-local coordinates
  // (old Math.max/min clamp assumed absolute SVG coords, broke text alignment)
  const bx = x - boxW / 2
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
      {/* Triangle pointer (points toward the agent — down when above, up when below) */}
      <polygon
        points={`${x - 5},${tailBaseY} ${x + 5},${tailBaseY} ${x},${tailTipY}`}
        fill="white"
        stroke="#DDD"
        strokeWidth="0.6"
      />
      {/* Cover the line where triangle meets rect */}
      <line x1={x - 5} y1={tailBaseY} x2={x + 5} y2={tailBaseY} stroke="white" strokeWidth="1.5" />
      {/* Text */}
      <text
        x={x}
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
