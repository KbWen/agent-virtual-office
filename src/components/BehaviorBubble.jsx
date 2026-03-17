import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function BehaviorBubble({ x, y, message }) {
  if (!message) return null

  const textLen = message.length
  const boxW = Math.max(textLen * 8 + 12, 36)
  const boxH = 18
  const bx = x - boxW / 2
  const by = y - boxH - 6

  return (
    <AnimatePresence>
      {message && (
        <motion.g
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.3 }}
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
            {message}
          </text>
        </motion.g>
      )}
    </AnimatePresence>
  )
}
