import React, { useEffect, useState, useRef, useMemo } from 'react'

export default function BehaviorBubble({ x, y, message }) {
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
  const by = y - boxH - 8

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
      {/* Triangle pointer */}
      <polygon
        points={`${x - 5},${by + boxH} ${x + 5},${by + boxH} ${x},${by + boxH + 6}`}
        fill="white"
        stroke="#DDD"
        strokeWidth="0.6"
      />
      {/* Cover the line where triangle meets rect */}
      <line x1={x - 5} y1={by + boxH} x2={x + 5} y2={by + boxH} stroke="white" strokeWidth="1.5" />
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
