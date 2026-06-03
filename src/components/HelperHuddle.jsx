import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore } from '../systems/store.js'
import { resolveHelperLayout, HELPER_BADGE_OFFSET, HELPER_COLORS } from '../systems/movementSystem'

// Stable empty ref — returning a fresh {} from the selector would itself loop useSyncExternalStore.
const EMPTY = {}

// A tiny helper figure — a small chibi blob (head + body), deliberately MINIMAL: no name tag,
// no status ring, no speech bubble, no session badge. Tinted from the PARENT role's colour so
// the cluster visibly belongs to its lead (vs a full-size hallway worktree clone).
function HelperSprite({ x, y, color, opacity }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(0.85)`} aria-hidden="true" opacity={opacity} className="helper-sprite">
      <rect x={-4} y={0} width={8} height={9} rx={3} fill={color} />
      <circle cx={0} cy={-4} r={4.4} fill="#FFE0C0" />
      <path d="M -4.4 -4 a 4.4 4.4 0 0 1 8.8 0 Z" fill={color} opacity="0.6" />
      <circle cx={-1.5} cy={-3.6} r={0.8} fill="#1a1a2a" />
      <circle cx={1.5} cy={-3.6} r={0.8} fill="#1a1a2a" />
    </g>
  )
}

// Renders each role's capped desk huddle. Helpers anchor to the PARENT'S LIVE position (so they
// trail the lead instead of orphaning at an empty desk when the lead wanders), with a HOME
// fallback inside resolveHelperLayout. HARD-CAP 3 visible + a single "+N" glyph; a soft 💦 cue
// once a role crosses the heavy threshold.
//
// The selector returns a flat map of PRIMITIVE strings ("count|ax|ay|color"), not nested objects:
// useShallow can only stabilize a one-level-shallow value, and the live position is ROUNDED so a
// stationary lead produces an unchanged signature (no re-render) — only the lead actually moving
// (or the helper count changing) re-renders this subtree.
export default function HelperHuddles() {
  const flat = useOfficeStore(useShallow((s) => {
    const helpers = s.helpers
    if (!helpers || helpers.length === 0) return EMPTY
    const counts = {}
    for (const h of helpers) counts[h.parentRole] = (counts[h.parentRole] || 0) + 1
    const out = {}
    for (const role of Object.keys(counts)) {
      const a = s.agents[role]
      const pos = a?.position
      out[role] = `${counts[role]}|${pos ? Math.round(pos.x) : ''}|${pos ? Math.round(pos.y) : ''}|${a?.color || ''}`
    }
    return out
  }))

  const roles = Object.keys(flat)
  if (roles.length === 0) return null

  return (
    <g className="helper-huddles">
      {roles.map((role) => {
        const [countStr, axStr, ayStr, colorStr] = flat[role].split('|')
        const liveAnchor = axStr !== '' ? { x: Number(axStr), y: Number(ayStr) } : undefined
        const { sprites, overflow, heavy, anchor } = resolveHelperLayout(role, Number(countStr), liveAnchor)
        if (sprites.length === 0 || !anchor) return null
        const tint = colorStr || HELPER_COLORS[0]
        return (
          <g key={role} data-helper-parent={role} data-helper-count={countStr}>
            {sprites.map((s, i) => <HelperSprite key={i} x={s.x} y={s.y} color={tint} opacity={0.78 + i * 0.07} />)}
            {overflow > 0 && (
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
            {heavy && (
              <text x={anchor.x - 13} y={anchor.y - 22} fontSize="8" opacity="0.75" data-helper-heavy="1" aria-hidden="true">💦</text>
            )}
          </g>
        )
      })}
    </g>
  )
}
