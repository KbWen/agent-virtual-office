import React, { useEffect, useRef, useState } from 'react'
import { useOfficeStore } from '../systems/store.js'
import { clampToFloor } from '../systems/movementSystem.js'
import { derivePetState, petIsMobile, resolvePetMode, petReadabilityScale, PET_MODES } from '../systems/petState.js'

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
  if (mode === PET_MODES.ALERT) {
    // sitting upright, ears UP, head turned, wide eyes — "noticing a new blocker" (settles to hide)
    return (
      <g aria-hidden="true">
        <path d="M -7 1 q -4 2 -3 4" stroke={fur} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        {/* upright body */}
        <ellipse cx={0} cy={1} rx={5.5} ry={5} fill={fur} />
        <ellipse cx={0} cy={2.5} rx={3} ry={2.4} fill={belly} opacity="0.55" />
        {/* raised head */}
        <circle cx={2} cy={-4} r={3.8} fill={fur} />
        {/* tall alert ears */}
        <path d="M -0.6 -6.4 l -0.4 -3.4 l 2.2 1.8 Z" fill={fur} />
        <path d="M 4.6 -6.4 l 0.4 -3.4 l -2.2 1.8 Z" fill={fur} />
        {/* wide eyes */}
        <circle cx={0.6} cy={-4.2} r={1} fill={dark} />
        <circle cx={3.4} cy={-4.2} r={1} fill={dark} />
        {/* small alert mark */}
        <text x={7} y={-6} fontSize="6" fill="#D98324" opacity="0.9">!</text>
      </g>
    )
  }
  if (mode === PET_MODES.CELEBRATE) {
    // happy: tail straight up, perked, a tiny spark — fires on a real eureka/deploy-success
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
        {/* happy closed-arc eyes */}
        <path d="M 4 -2.4 q 0.8 0.7 1.6 0" stroke={dark} strokeWidth="0.6" fill="none" />
        <path d="M 6.8 -2.4 q 0.8 0.7 1.6 0" stroke={dark} strokeWidth="0.6" fill="none" />
        <text x={9} y={-6} fontSize="6" fill="#E0A800" opacity="0.95">✦</text>
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
  const sceneScale = useOfficeStore((s) => s.sceneScale)

  // ── Two transient event-edge overlays (v2), each a short pose beat over the honest base mode ──
  // celebrate: a real positive event (eureka/deploy-success) — reuses officeLife's event surface.
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (activeEventId === 'eureka' || activeEventId === 'deploy-success') {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 2500)
      return () => clearTimeout(t)
    }
    setCelebrate(false) // event cleared early → drop it so it can't stick (cleanup cancels the reset)
  }, [activeEventId])

  // alert: a NEW blocker just appeared (blockedCount rose) — ears-up "noticing" beat, then it settles
  // back into hide (base is already hide while blocked). Marks a real new-blocker EDGE, not a feeling.
  // Two effects so the auto-clear timer is owned by `alert` itself (NOT by blockedCount): a rapidly
  // oscillating blockedCount would otherwise keep cancelling the reset and leave alert stuck on.
  const [alert, setAlert] = useState(false)
  const prevBlockedRef = useRef(blockedCount)
  useEffect(() => {
    const rose = blockedCount > prevBlockedRef.current
    prevBlockedRef.current = blockedCount
    if (rose) setAlert(true)
  }, [blockedCount])
  useEffect(() => {
    if (!alert) return
    const t = setTimeout(() => setAlert(false), 2500)
    return () => clearTimeout(t)
  }, [alert])

  const baseMode = derivePetState({ mood, blockedCount })
  const mode = resolvePetMode({ base: baseMode, alert, celebrate })

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
  // a calm hop on excited momentum and on the celebrate beat (≤1.5px, reduced-motion off)
  const hop = (mode === PET_MODES.EXCITED || mode === PET_MODES.CELEBRATE) && !reducedMotion
    ? { animation: 'pet-bob 0.6s ease-in-out infinite' } : undefined
  // v2: keep the pet legible when the office docks small without faking size (partial √ counter-scale)
  const petScale = petReadabilityScale(sceneScale)
  // v2: a gentle 220ms fade-in on every mode change (keyed remount) so poses cross instead of snapping
  const fadeIn = reducedMotion ? undefined : { animation: 'pet-fade-in 0.22s ease-out' }

  return (
    <g
      data-office-pet={mode}
      transform={`translate(${pos.x}, ${pos.y})`}
      style={reducedMotion ? undefined : { transition: `transform ${glideMs}ms ease-in-out` }}
      pointerEvents="none"
    >
      <g transform={`scale(${facing * petScale}, ${petScale})`} style={hop}>
        <g key={mode} style={fadeIn}>
          <CatSprite mode={mode} reducedMotion={reducedMotion} />
        </g>
      </g>
    </g>
  )
}
