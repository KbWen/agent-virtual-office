import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore } from '../systems/store.js'
import { resolveHelperLayout, HELPER_BADGE_OFFSET, HOME_POSITIONS } from '../systems/movementSystem'

// A tiny helper figure — a small chibi blob (head + body), deliberately MINIMAL:
// no name tag, no status ring, no speech bubble, no session badge (spec AC1). It reads as
// "a little helper this role pulled in", visually distinct from a full hallway worktree clone.
function HelperSprite({ x, y, color }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(0.85)`} aria-hidden="true" opacity="0.92" className="helper-sprite">
      <rect x={-4} y={0} width={8} height={9} rx={3} fill={color} />
      <circle cx={0} cy={-4} r={4.4} fill="#FFE0C0" />
      <path d={`M -4.4 -4 a 4.4 4.4 0 0 1 8.8 0 Z`} fill={color} opacity="0.6" />
      <circle cx={-1.5} cy={-3.6} r={0.8} fill="#1a1a2a" />
      <circle cx={1.5} cy={-3.6} r={0.8} fill="#1a1a2a" />
    </g>
  )
}

// Groups the flat `helpers` slice by parentRole and renders each role's capped desk huddle.
// HARD-CAP 3 visible sprites + a single "+N" glyph for the rest (so 10+ subagents never pile
// up); a "swamped" 💦 cue appears once a role crosses the heavy threshold.
export default function HelperHuddles() {
  const helpers = useOfficeStore(useShallow((s) => s.helpers))
  if (!helpers || helpers.length === 0) return null

  const counts = {}
  for (const h of helpers) counts[h.parentRole] = (counts[h.parentRole] || 0) + 1

  return (
    <g className="helper-huddles">
      {Object.keys(counts).map((role) => {
        const { sprites, overflow, heavy } = resolveHelperLayout(role, counts[role])
        if (sprites.length === 0) return null
        const anchor = HOME_POSITIONS[role]
        return (
          <g key={role} data-helper-parent={role} data-helper-count={counts[role]}>
            {sprites.map((s, i) => <HelperSprite key={i} x={s.x} y={s.y} color={s.color} />)}
            {overflow > 0 && anchor && (
              <text
                x={anchor.x + HELPER_BADGE_OFFSET.dx} y={anchor.y + HELPER_BADGE_OFFSET.dy}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fontFamily="monospace" fontWeight="bold"
                fill="#ffffff" stroke="#333" strokeWidth="0.5" paintOrder="stroke"
                opacity="0.9" data-helper-overflow={overflow}
              >
                +{overflow}
              </text>
            )}
            {heavy && anchor && (
              <text x={anchor.x - 13} y={anchor.y - 20} fontSize="10" data-helper-heavy="1" aria-hidden="true">💦</text>
            )}
          </g>
        )
      })}
    </g>
  )
}
