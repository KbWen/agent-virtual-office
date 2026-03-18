import React, { useEffect, useState } from 'react'

export default function BehaviorBubble({ x, y, message }) {
  const [visible, setVisible] = useState(false)
  const [currentMsg, setCurrentMsg] = useState(message)

  useEffect(() => {
    if (message) {
      setCurrentMsg(message)
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [message])

  if (!currentMsg) return null

  const textLen = currentMsg.length
  const boxW = Math.max(textLen * 8 + 12, 36)
  const boxH = 18
  const bx = x - boxW / 2
  const by = y - boxH - 6

  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-5px)',
        transition: 'opacity 0.3s, transform 0.3s',
      }}
      onTransitionEnd={() => {
        if (!visible) setCurrentMsg(null)
      }}
    >
      {/* Bubble body */}
      <rect
        x={bx} y={by}
        width={boxW} height={boxH}
        rx={6}
        fill="white"
        stroke="#DDD"
        strokeWidth="0.8"
        filter="url(#bubble-shadow)"
      />
      {/* Triangle pointer */}
      <polygon
        points={`${x - 4},${by + boxH} ${x + 4},${by + boxH} ${x},${by + boxH + 5}`}
        fill="white"
        stroke="#DDD"
        strokeWidth="0.5"
      />
      {/* Cover the line where triangle meets rect */}
      <line x1={x - 4} y1={by + boxH} x2={x + 4} y2={by + boxH} stroke="white" strokeWidth="1.2" />
      {/* Text */}
      <text
        x={x}
        y={by + boxH / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="7"
        fontFamily="'Segoe UI', system-ui, sans-serif"
        fill="#444"
      >
        {currentMsg}
      </text>
    </g>
  )
}
