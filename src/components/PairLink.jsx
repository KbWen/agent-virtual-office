import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore } from '../systems/store.js'
import { charName, t, useLocale } from '../i18n'

/**
 * AVO-106 — co-editing pair overlay (PURE presentational).
 * Draws a faint desk-to-desk connecting line + a small 🔗 <file> label between two agents who are
 * co-EDITING the byte-identical file. It NEVER moves an agent or touches status/behavior — the
 * agents stay exactly where they are (R1: a tracked desk is never modulated). Honest depiction of
 * "these two are both editing this file right now", nothing more. Exported for SSR unit tests.
 */
export function PairLink({ fromPos, toPos, file, ariaLabel }) {
  if (!fromPos || !toPos) return null
  // Connect a touch above each sprite's anchor so the line reads as "between them", not at the feet.
  const y1 = fromPos.y - 8
  const y2 = toPos.y - 8
  const midX = (fromPos.x + toPos.x) / 2
  const midY = (y1 + y2) / 2 - 5
  return (
    <g className="pair-link" aria-label={ariaLabel} role="img" pointerEvents="none">
      {/* faint static dashed link — calm, no animation (calm-tech) */}
      <line
        x1={fromPos.x} y1={y1} x2={toPos.x} y2={y2}
        stroke="#7F77DD" strokeWidth="1.1" strokeDasharray="3 3" opacity="0.45"
        strokeLinecap="round"
      />
      {file && (
        <text
          x={midX} y={midY} textAnchor="middle"
          fontSize="7" fontFamily="monospace" fill="#7F77DD" opacity="0.9"
        >{`🔗 ${file}`}</text>
      )}
    </g>
  )
}

/**
 * Store-driven container: renders the link when store.pairLink is set, tracking the two agents'
 * LIVE positions (so the line follows them — but it never writes them). Renders nothing otherwise.
 */
export default function PairLinkOverlay() {
  useLocale()  // re-render aria label on language switch
  const link = useOfficeStore(useShallow((s) => s.pairLink))
  // Read the two agents' live positions; useShallow re-renders only when an endpoint actually moves.
  const positions = useOfficeStore(useShallow((s) => {
    if (!s.pairLink) return null
    const a = s.agents[s.pairLink.a]
    const b = s.agents[s.pairLink.b]
    if (!a || !b) return null
    return { from: a.targetPosition || a.position, to: b.targetPosition || b.position }
  }))
  if (!link || !positions || !positions.from || !positions.to) return null
  const ariaLabel = `${charName(link.a)} & ${charName(link.b)} — ${t('pairLink.coediting')} ${link.file}`
  return <PairLink fromPos={positions.from} toPos={positions.to} file={link.file} ariaLabel={ariaLabel} />
}
