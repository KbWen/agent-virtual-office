import React, { useEffect, useState, useRef } from 'react'

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

  if (!currentMsg) return null

  // Clean garbled characters (U+FFFD replacement char, orphaned surrogates)
  const cleanMsg = currentMsg.replace(/[\uFFFD]/g, '').replace(/[\uD800-\uDFFF]/g, '')

  // Unicode-safe truncation using Array.from (handles surrogate pairs)
  const chars = Array.from(cleanMsg)
  const maxLen = 16
  const displayMsg = chars.length > maxLen ? chars.slice(0, maxLen).join('') + '…' : cleanMsg

  // Width: CJK chars (~11 units) vs ASCII (~6.5 units) at fontSize 11
  let estWidth = 0
  for (const ch of displayMsg) {
    estWidth += ch.codePointAt(0) > 0x2E7F ? 11 : 6.5
  }
  const boxW = Math.max(Math.ceil(estWidth) + 18, 48)
  const boxH = 26
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
