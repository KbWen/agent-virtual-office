import React, { useEffect, useRef, useState } from 'react'
import { useOfficeStore } from '../systems/store.js'
import { clampToFloor } from '../systems/movementSystem.js'
import { derivePetState, petIsMobile, PET_MODES } from '../systems/petState.js'

// ─── Office pet — a signal-driven barometer (#39 / AVO-121) ─────────────────────────────────────
// A small ambient cat whose MODE is an honest readout of real aggregate office state (see
// petState.js): hide when an agent is blocked or the mood is rough, nap when idle, excited on
// momentum, wander otherwise. It is NOT decoration with a fake life — every pose maps to a true
// signal. Movement is a slow CSS-glide wander reusing `clampToFloor` (never `calculatePath`, never
// HOME_POSITIONS / agent coords — Protected Surfaces untouched). reduced-motion → static pose.

const START = clampToFloor({ x: 120, y: 505 })

// Sample a floor point in the lower office band (walkway/lounge) so the pet stays low and out of the
// desk rows. clampToFloor snaps to a floor zone and pushes off any furniture.
function randomFloorTarget() {
  const x = 40 + Math.random() * 720
  const y = 380 + Math.random() * 150
  return clampToFloor({ x, y })
}

// ── Pixel-ish cat sprite. Drawn around local origin; the parent <g> positions + flips it. ──
function CatSprite({ mode, reducedMotion }) {
  const fur = '#9B8579', dark = '#6E5E54', belly = '#D9CCBF'
  if (mode === PET_MODES.NAP) {
    return (
      <g aria-hidden="true">
        {/* curled body */}
        <ellipse cx={0} cy={0} rx={9} ry={5.5} fill={fur} />
        <ellipse cx={0} cy={1.5} rx={6} ry={3} fill={belly} opacity="0.5" />
        {/* tucked head */}
        <circle cx={-6} cy={-1} r={3.6} fill={fur} />
        <path d="M -8.6 -3 l 1.4 -2.2 l 1.4 2.2 Z" fill={fur} />
        {/* closed eye */}
        <path d="M -7.4 -1.2 q 1 0.8 2 0" stroke={dark} strokeWidth="0.5" fill="none" />
        {/* curled tail */}
        <path d="M 8 0 q 5 0 4 -4" stroke={fur} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* rising z's (calm, slow) */}
        <text x={4} y={-7} fontSize="5" fill={dark} opacity="0.7"
          style={reducedMotion ? undefined : { animation: 'pet-snooze 2.4s ease-in-out infinite' }}>z</text>
      </g>
    )
  }
  if (mode === PET_MODES.HIDE) {
    return (
      <g aria-hidden="true">
        {/* crouched, flattened body, ears down */}
        <ellipse cx={0} cy={1} rx={8} ry={3.6} fill={fur} />
        <circle cx={6} cy={-0.5} r={3.4} fill={fur} />
        {/* flattened ears */}
        <path d="M 3.4 -3 l -1.8 -1 l 1.2 2 Z" fill={dark} />
        <path d="M 8.6 -3 l 1.8 -1 l -1.2 2 Z" fill={dark} />
        {/* wary small eyes */}
        <circle cx={5} cy={-0.6} r={0.7} fill={dark} />
        <circle cx={7.4} cy={-0.6} r={0.7} fill={dark} />
        {/* low tucked tail */}
        <path d="M -8 1 q -3 1 -2 3" stroke={fur} strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    )
  }
  // wander / excited — standing cat (tail up when excited)
  const excited = mode === PET_MODES.EXCITED
  return (
    <g aria-hidden="true">
      {/* tail */}
      {excited
        ? <path d="M -7 0 q -5 -2 -4 -7" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        : <path d="M -7 0 q -5 1 -5 -3" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {/* body */}
      <ellipse cx={-1} cy={1} rx={7} ry={4.2} fill={fur} />
      <ellipse cx={-1} cy={2.6} rx={4} ry={2} fill={belly} opacity="0.55" />
      {/* legs */}
      <rect x={-4} y={4} width={1.6} height={3} rx={0.8} fill={dark} />
      <rect x={2} y={4} width={1.6} height={3} rx={0.8} fill={dark} />
      {/* head */}
      <circle cx={6} cy={-1.5} r={4} fill={fur} />
      {/* ears */}
      <path d="M 3.2 -4.4 l -0.6 -3 l 2.4 1.6 Z" fill={fur} />
      <path d="M 8.8 -4.4 l 0.6 -3 l -2.4 1.6 Z" fill={fur} />
      {/* eyes */}
      <circle cx={4.6} cy={-1.8} r={0.8} fill={dark} />
      <circle cx={7.4} cy={-1.8} r={0.8} fill={dark} />
      {/* nose */}
      <circle cx={6} cy={-0.2} r={0.6} fill="#C77" />
    </g>
  )
}

export default function OfficePet() {
  const officePet = useOfficeStore((s) => s.officePet)
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const mood = useOfficeStore((s) => s.mood)
  // live blocked count — primitive, so the pet re-renders only when it actually changes.
  const blockedCount = useOfficeStore((s) =>
    Object.values(s.externalStatus).filter((e) => e && e.status === 'blocked').length)
  const activeEventId = useOfficeStore((s) => s.activeEvent?.id || null)

  // Transient "perk" on a real positive event (reuses officeLife's existing event surface — never a
  // synthetic timer). Never overrides a real blocker (hide stays honest).
  const [perk, setPerk] = useState(false)
  useEffect(() => {
    if (activeEventId === 'eureka' || activeEventId === 'deploy-success') {
      setPerk(true)
      const t = setTimeout(() => setPerk(false), 2500)
      return () => clearTimeout(t)
    }
    // Event cleared before the 2.5s window elapsed → drop the perk now, so it can't get stuck
    // 'true' (the cleanup above cancels the pending reset on the trigger→non-trigger transition).
    setPerk(false)
  }, [activeEventId])

  const baseMode = derivePetState({ mood, blockedCount })
  const mode = perk && baseMode !== PET_MODES.HIDE ? PET_MODES.EXCITED : baseMode

  const [pos, setPos] = useState(START)
  const [facing, setFacing] = useState(1)
  const posRef = useRef(START)

  const mobile = officePet && !reducedMotion && petIsMobile(mode)
  useEffect(() => {
    if (!mobile) return
    const interval = mode === PET_MODES.EXCITED ? 2000 : 3500
    const id = setInterval(() => {
      const t = randomFloorTarget()
      setFacing(t.x >= posRef.current.x ? 1 : -1)
      posRef.current = t
      setPos(t)
    }, interval)
    return () => clearInterval(id)
  }, [mobile, mode])

  if (!officePet) return null

  const glideMs = mode === PET_MODES.EXCITED ? 1400 : 2800
  const bob = mode === PET_MODES.EXCITED && !reducedMotion ? { animation: 'pet-bob 0.6s ease-in-out infinite' } : undefined

  return (
    <g
      data-office-pet={mode}
      transform={`translate(${pos.x}, ${pos.y})`}
      style={reducedMotion ? undefined : { transition: `transform ${glideMs}ms ease-in-out` }}
      pointerEvents="none"
    >
      <g transform={`scale(${facing}, 1)`} style={bob}>
        <CatSprite mode={mode} reducedMotion={reducedMotion} />
      </g>
    </g>
  )
}
