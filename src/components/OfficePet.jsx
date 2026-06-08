import React, { useEffect, useRef, useState } from 'react'
import { useOfficeStore } from '../systems/store.js'
import { clampToFloor } from '../systems/movementSystem.js'
import { derivePetState, petIsMobile, resolvePetMode, petReadabilityScale, petMotionGrammar, PET_MODES } from '../systems/petState.js'
import PetSprite from './petSprites.jsx'

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

export default function OfficePet() {
  const officePet = useOfficeStore((s) => s.officePet)
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const mood = useOfficeStore((s) => s.mood)
  // live blocked count — primitive, so the pet re-renders only when it actually changes.
  const blockedCount = useOfficeStore((s) =>
    Object.values(s.externalStatus).filter((e) => e && e.status === 'blocked').length)
  const activeEventId = useOfficeStore((s) => s.activeEvent?.id || null)
  const sceneScale = useOfficeStore((s) => s.sceneScale)
  const petType = useOfficeStore((s) => s.petType)
  // per-type motion grammar (cosmetic — a Roomba moves like a machine, a dog like a dog). The MODE
  // logic is type-independent; only the FEEL changes.
  const grammar = petMotionGrammar(petType)

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
    const interval = (mode === PET_MODES.EXCITED ? 2000 : 3500) * grammar.cadenceMul
    const id = setInterval(() => {
      const t = randomFloorTarget()
      setFacing(t.x >= posRef.current.x ? 1 : -1)
      posRef.current = t
      setPos(t)
    }, interval)
    return () => clearInterval(id)
  }, [mobile, mode, grammar.cadenceMul])

  if (!officePet) return null

  const glideMs = mode === PET_MODES.EXCITED ? 1400 : 2800
  // a calm hop on excited/celebrate, gated by the type's motion grammar (the vacuum doesn't bob; the
  // dog bobs bigger). reduced-motion off.
  const hop = grammar.bob && (mode === PET_MODES.EXCITED || mode === PET_MODES.CELEBRATE) && !reducedMotion
    ? { animation: `${grammar.bobKeyframe} 0.6s ease-in-out infinite` } : undefined
  // v2: keep the pet legible when the office docks small without faking size (partial √ counter-scale)
  const petScale = petReadabilityScale(sceneScale)
  // v2: a gentle 220ms fade-in on every mode change (keyed remount) so poses cross instead of snapping
  const fadeIn = reducedMotion ? undefined : { animation: 'pet-fade-in 0.22s ease-out' }

  return (
    <g
      data-office-pet={mode}
      data-pet-type={petType}
      transform={`translate(${pos.x}, ${pos.y})`}
      style={reducedMotion ? undefined : { transition: `transform ${glideMs}ms ${grammar.easing}` }}
      pointerEvents="none"
    >
      <g transform={`scale(${facing * petScale}, ${petScale})`} style={hop}>
        <g key={mode} style={fadeIn}>
          <PetSprite type={petType} mode={mode} reducedMotion={reducedMotion} />
        </g>
      </g>
    </g>
  )
}
