import React from 'react'
import { PET_MODES } from '../systems/petState.js'

// ─── Pet sprites (cosmetic skins for #39) ──────────────────────────────────────────────────────
// Each sprite is a pure function of (mode, reducedMotion). COSMETIC ONLY — the mode is decided
// upstream by the honest barometer (derivePetState/resolvePetMode); a sprite just draws the pose for
// whatever mode it's handed, identically across types. Drawn around local origin (0,0) = floor
// contact; the parent <g> positions/flips/scales it.

// ── Cat (default) ──
function CatSprite({ mode, reducedMotion }) {
  const fur = '#9B8579', dark = '#6E5E54', belly = '#D9CCBF'
  if (mode === PET_MODES.NAP) {
    return (
      <g aria-hidden="true">
        <ellipse cx={0} cy={0} rx={9} ry={5.5} fill={fur} />
        <ellipse cx={0} cy={1.5} rx={6} ry={3} fill={belly} opacity="0.5" />
        <circle cx={-6} cy={-1} r={3.6} fill={fur} />
        <path d="M -8.6 -3 l 1.4 -2.2 l 1.4 2.2 Z" fill={fur} />
        <path d="M -7.4 -1.2 q 1 0.8 2 0" stroke={dark} strokeWidth="0.5" fill="none" />
        <path d="M 8 0 q 5 0 4 -4" stroke={fur} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <text x={4} y={-7} fontSize="5" fill={dark} opacity="0.7"
          style={reducedMotion ? undefined : { animation: 'pet-snooze 2.4s ease-in-out infinite' }}>z</text>
      </g>
    )
  }
  if (mode === PET_MODES.HIDE) {
    return (
      <g aria-hidden="true">
        <ellipse cx={0} cy={1} rx={8} ry={3.6} fill={fur} />
        <circle cx={6} cy={-0.5} r={3.4} fill={fur} />
        <path d="M 3.4 -3 l -1.8 -1 l 1.2 2 Z" fill={dark} />
        <path d="M 8.6 -3 l 1.8 -1 l -1.2 2 Z" fill={dark} />
        <circle cx={5} cy={-0.6} r={0.7} fill={dark} />
        <circle cx={7.4} cy={-0.6} r={0.7} fill={dark} />
        <path d="M -8 1 q -3 1 -2 3" stroke={fur} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  if (mode === PET_MODES.ALERT) {
    return (
      <g aria-hidden="true">
        <path d="M -7 1 q -4 2 -3 4" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <ellipse cx={0} cy={1} rx={5.5} ry={5} fill={fur} />
        <ellipse cx={0} cy={2.5} rx={3} ry={2.4} fill={belly} opacity="0.55" />
        <circle cx={2} cy={-4} r={3.8} fill={fur} />
        <path d="M -0.6 -6.4 l -0.4 -3.4 l 2.2 1.8 Z" fill={fur} />
        <path d="M 4.6 -6.4 l 0.4 -3.4 l -2.2 1.8 Z" fill={fur} />
        <circle cx={0.6} cy={-4.2} r={1} fill={dark} />
        <circle cx={3.4} cy={-4.2} r={1} fill={dark} />
        <text x={7} y={-6} fontSize="6" fill="#D98324" opacity="0.9">!</text>
      </g>
    )
  }
  if (mode === PET_MODES.CELEBRATE) {
    return (
      <g aria-hidden="true">
        <path d="M -7 0 q -3 -3 -1 -8" stroke={fur} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <ellipse cx={-1} cy={1} rx={7} ry={4.2} fill={fur} />
        <ellipse cx={-1} cy={2.6} rx={4} ry={2} fill={belly} opacity="0.55" />
        <rect x={-4} y={4} width={1.6} height={3} rx={0.8} fill={dark} />
        <rect x={2} y={4} width={1.6} height={3} rx={0.8} fill={dark} />
        <circle cx={6} cy={-2} r={4} fill={fur} />
        <path d="M 3.2 -5 l -0.6 -3 l 2.4 1.6 Z" fill={fur} />
        <path d="M 8.8 -5 l 0.6 -3 l -2.4 1.6 Z" fill={fur} />
        <path d="M 4 -2.4 q 0.8 0.7 1.6 0" stroke={dark} strokeWidth="0.6" fill="none" />
        <path d="M 6.8 -2.4 q 0.8 0.7 1.6 0" stroke={dark} strokeWidth="0.6" fill="none" />
        <text x={9} y={-6} fontSize="6" fill="#E0A800" opacity="0.95">✦</text>
      </g>
    )
  }
  const excited = mode === PET_MODES.EXCITED
  return (
    <g aria-hidden="true">
      {excited
        ? <path d="M -7 0 q -5 -2 -4 -7" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        : <path d="M -7 0 q -5 1 -5 -3" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      <ellipse cx={-1} cy={1} rx={7} ry={4.2} fill={fur} />
      <ellipse cx={-1} cy={2.6} rx={4} ry={2} fill={belly} opacity="0.55" />
      <rect x={-4} y={4} width={1.6} height={3} rx={0.8} fill={dark} />
      <rect x={2} y={4} width={1.6} height={3} rx={0.8} fill={dark} />
      <circle cx={6} cy={-1.5} r={4} fill={fur} />
      <path d="M 3.2 -4.4 l -0.6 -3 l 2.4 1.6 Z" fill={fur} />
      <path d="M 8.8 -4.4 l 0.6 -3 l -2.4 1.6 Z" fill={fur} />
      <circle cx={4.6} cy={-1.8} r={0.8} fill={dark} />
      <circle cx={7.4} cy={-1.8} r={0.8} fill={dark} />
      <circle cx={6} cy={-0.2} r={0.6} fill="#C77" />
    </g>
  )
}

// ── Robot vacuum (Roomba). Machine motion grammar: a flat disc, a status LED that reads the mode,
//    a front bumper. Minimal animation by nature (calm-tech friendly). ──
function VacuumSprite({ mode, reducedMotion }) {
  const body = '#3A3F44', top = '#4E555C', rim = '#23262A'
  // LED colour reads the mode (honest: same mode the barometer chose)
  const led = mode === PET_MODES.HIDE ? '#E24B4A'
    : mode === PET_MODES.ALERT ? '#E24B4A'
    : mode === PET_MODES.NAP ? '#E8A317'
    : mode === PET_MODES.CELEBRATE ? '#19C3E6'
    : '#1D9E75'
  const docked = mode === PET_MODES.NAP
  const blink = (mode === PET_MODES.ALERT) && !reducedMotion
  // Machine grammar for legible per-mode SILHOUETTES (not LED-only): nap docks + dims; wander shows a
  // sweep trail; excited adds a dust puff; hide tilts + dims (backed off). All static (calm).
  const tilt = mode === PET_MODES.HIDE ? -12 : 0
  const dim = (mode === PET_MODES.NAP || mode === PET_MODES.HIDE) ? 0.72 : 1
  const sweeping = mode === PET_MODES.WANDER || mode === PET_MODES.EXCITED
  const puffing = mode === PET_MODES.EXCITED
  return (
    <g aria-hidden="true">
      {docked && /* charging dock */ <rect x={-7} y={3} width={14} height={2.4} rx={1} fill="#555" opacity="0.8" />}
      {/* motion sweep lines trailing behind (disc faces +x, so the trail is to the left) */}
      {sweeping && (
        <g stroke="#9aa1a8" strokeWidth="0.7" opacity="0.5" strokeLinecap="round">
          <line x1={-9} y1={-1.6} x2={-12.5} y2={-1.6} />
          <line x1={-9} y1={1.6} x2={-13} y2={1.6} />
        </g>
      )}
      {/* dust puff kicked up when zipping (excited) */}
      {puffing && (
        <g fill="#BCB3A8" opacity="0.5">
          <circle cx={-11} cy={2.6} r={1.4} />
          <circle cx={-13.2} cy={1.6} r={1} />
        </g>
      )}
      {/* disc body — tilts + dims when hiding (retreating) */}
      <g transform={tilt ? `rotate(${tilt})` : undefined} opacity={dim}>
        <ellipse cx={0} cy={1} rx={8} ry={5.4} fill={body} stroke={rim} strokeWidth="0.8" />
        <ellipse cx={0} cy={0.2} rx={5.4} ry={3.4} fill={top} />
        {/* front bumper (faces +x; parent flips via scale for direction) */}
        <path d="M 6 -2 a 6 5.4 0 0 1 0 6" stroke={rim} strokeWidth="1.2" fill="none" opacity="0.7" />
      </g>
      {/* status LED */}
      <circle cx={0} cy={0} r={1.5} fill={led} opacity={mode === PET_MODES.HIDE ? 0.6 : 0.95}
        style={blink ? { animation: 'pet-snooze 0.8s steps(2,end) infinite' } : undefined} />
      {mode === PET_MODES.ALERT && <text x={6} y={-5} fontSize="6" fill="#D98324" opacity="0.9">!</text>}
      {mode === PET_MODES.CELEBRATE && <text x={7} y={-5} fontSize="6" fill="#E0A800" opacity="0.95">✦</text>}
    </g>
  )
}

// ── Dog. Like the cat but doggier: floppy ears, snout, a wagging tail when excited/celebrating. ──
function DogSprite({ mode, reducedMotion }) {
  const fur = '#A6713C', dark = '#6E4A28', belly = '#E0C29A'
  if (mode === PET_MODES.NAP) {
    return (
      <g aria-hidden="true">
        <ellipse cx={0} cy={0} rx={9.5} ry={5.5} fill={fur} />
        <ellipse cx={0} cy={1.6} rx={6} ry={3} fill={belly} opacity="0.5" />
        <circle cx={-6.5} cy={-0.5} r={3.8} fill={fur} />
        <path d="M -9.4 -1.6 q -2 1 -1 3.4" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />{/* floppy ear */}
        <path d="M -7.6 -0.6 q 1 0.8 2 0" stroke={dark} strokeWidth="0.5" fill="none" />
        <path d="M 8.4 0.4 q 4.4 0 3.6 -3.4" stroke={fur} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <text x={4} y={-7} fontSize="5" fill={dark} opacity="0.7"
          style={reducedMotion ? undefined : { animation: 'pet-snooze 2.4s ease-in-out infinite' }}>z</text>
      </g>
    )
  }
  if (mode === PET_MODES.HIDE) {
    return (
      <g aria-hidden="true">
        <ellipse cx={0} cy={1} rx={8.5} ry={3.8} fill={fur} />
        <circle cx={6} cy={0} r={3.6} fill={fur} />
        <path d="M 3.4 -1.6 q -2 0.6 -1.6 2.6" stroke={dark} strokeWidth="1.8" fill="none" strokeLinecap="round" />{/* ear tucked */}
        <circle cx={5} cy={-0.2} r={0.7} fill={dark} />
        <circle cx={7.4} cy={-0.2} r={0.7} fill={dark} />
        <ellipse cx={8.6} cy={1} rx={1.4} ry={1} fill={dark} />{/* snout */}
        <path d="M -8.4 1.2 q -2.6 1 -1.6 3" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  if (mode === PET_MODES.ALERT) {
    return (
      <g aria-hidden="true">
        <path d="M -7.4 1 q -4 2 -3 4" stroke={fur} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <ellipse cx={0} cy={1} rx={5.8} ry={5} fill={fur} />
        <ellipse cx={0} cy={2.6} rx={3} ry={2.4} fill={belly} opacity="0.55" />
        <circle cx={2} cy={-4} r={4} fill={fur} />
        <path d="M -1.4 -5.4 q -2.4 -0.6 -2.6 2.4" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />{/* perked floppy ear */}
        <circle cx={0.8} cy={-4.2} r={1} fill={dark} />
        <circle cx={3.6} cy={-4.2} r={1} fill={dark} />
        <ellipse cx={4} cy={-2.6} rx={1.4} ry={1} fill={dark} />
        <text x={7} y={-6} fontSize="6" fill="#D98324" opacity="0.9">!</text>
      </g>
    )
  }
  if (mode === PET_MODES.CELEBRATE) {
    return (
      <g aria-hidden="true">
        <path d="M -7 0 q -4 -3 -1 -8" stroke={fur} strokeWidth="2.6" fill="none" strokeLinecap="round" />{/* tail up/wag */}
        <ellipse cx={-1} cy={1} rx={7.2} ry={4.2} fill={fur} />
        <ellipse cx={-1} cy={2.6} rx={4} ry={2} fill={belly} opacity="0.55" />
        <rect x={-4} y={4} width={1.8} height={3} rx={0.9} fill={dark} />
        <rect x={2} y={4} width={1.8} height={3} rx={0.9} fill={dark} />
        <circle cx={6} cy={-2} r={4.2} fill={fur} />
        <path d="M 3 -3.6 q -2.2 1 -1.2 3.4" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />
        <ellipse cx={8.6} cy={-1.4} rx={1.6} ry={1.1} fill={dark} />
        <path d="M 8.4 -0.4 l 0 2" stroke="#D9536B" strokeWidth="1" strokeLinecap="round" />{/* tongue */}
        <text x={9} y={-6} fontSize="6" fill="#E0A800" opacity="0.95">✦</text>
      </g>
    )
  }
  const excited = mode === PET_MODES.EXCITED
  return (
    <g aria-hidden="true">
      {excited
        ? <path d="M -7 0 q -5 -2 -3.6 -7" stroke={fur} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        : <path d="M -7 0 q -5 1 -4.6 -3" stroke={fur} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
      <ellipse cx={-1} cy={1} rx={7.2} ry={4.2} fill={fur} />
      <ellipse cx={-1} cy={2.6} rx={4} ry={2} fill={belly} opacity="0.55" />
      <rect x={-4} y={4} width={1.8} height={3} rx={0.9} fill={dark} />
      <rect x={2} y={4} width={1.8} height={3} rx={0.9} fill={dark} />
      <circle cx={6} cy={-1.5} r={4.2} fill={fur} />
      <path d="M 3 -3.4 q -2.2 1 -1.2 3.4" stroke={dark} strokeWidth="2" fill="none" strokeLinecap="round" />{/* floppy ear */}
      <circle cx={5} cy={-1.8} r={0.8} fill={dark} />
      <circle cx={7.6} cy={-1.8} r={0.8} fill={dark} />
      <ellipse cx={8.8} cy={-0.4} rx={1.5} ry={1.1} fill={dark} />{/* snout */}
    </g>
  )
}

export default function PetSprite({ type, mode, reducedMotion }) {
  if (type === 'vacuum') return <VacuumSprite mode={mode} reducedMotion={reducedMotion} />
  if (type === 'dog') return <DogSprite mode={mode} reducedMotion={reducedMotion} />
  return <CatSprite mode={mode} reducedMotion={reducedMotion} />
}
