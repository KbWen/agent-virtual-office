import React, { useEffect, useRef, useState } from 'react'
import { useOfficeStore } from '../systems/store.js'
import { clampToFloor } from '../systems/movementSystem.js'
import { derivePetState, petIsMobile, resolvePetMode, petReadabilityScale, petMotionGrammar, runTarget, PET_MODES } from '../systems/petState.js'
import PetSprite from './petSprites.jsx'

// ─── Office pet — a signal-driven barometer (#39 / AVO-121) ─────────────────────────────────────
// A small ambient cat whose MODE is an honest readout of real aggregate office state (see
// petState.js): hide when an agent is blocked or the mood is rough, nap when idle, excited on
// momentum, wander otherwise. It is NOT decoration with a fake life — every pose maps to a true
// signal. Movement is a slow CSS-glide wander reusing `clampToFloor` (never `calculatePath`, never
// HOME_POSITIONS / agent coords — Protected Surfaces untouched). reduced-motion → static pose.

const START = clampToFloor({ x: 120, y: 512 })

// #39 delight: a base legibility bump. The sprite is authored at ~9px radius; ×1.7 makes its pose +
// face actually readable at native office size (it was a ~18px speck). Composes with the v2
// readability counter-scale (which only adds MORE when the office docks small). Scaling is about the
// sprite's local origin (0,0) = floor contact, so feet stay planted.
const PET_BASE_SCALE = 1.7

// Sample a floor point in the lower office band (walkway/lounge) so the pet stays low and out of the
// desk rows. Band: y 400–525 (so the larger pet can't reach up into desks) and x ≥ 80 (so the now-
// clickable pet doesn't sit over the lower-left coffee-machine tea-break click target at ~x20 y445).
function randomFloorTarget() {
  const x = 80 + Math.random() * 670
  const y = 400 + Math.random() * 125
  return clampToFloor({ x, y })
}

export default function OfficePet() {
  const officePet = useOfficeStore((s) => s.officePet)
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const mood = useOfficeStore((s) => s.mood)
  // live blocked count — primitive, so the pet re-renders only when it actually changes.
  const blockedCount = useOfficeStore((s) =>
    Object.values(s.externalStatus).filter((e) => e && e.status === 'blocked').length)
  // #39: the position of a currently-blocked agent (so the pet can trot over and "point at" it). A
  // PRIMITIVE "x,y" string → stable re-render; reads the store's already-published agent.position
  // (read-only — never HOME_POSITIONS / movement internals).
  const blockedAgentPos = useOfficeStore((s) => {
    const id = Object.keys(s.externalStatus).find((k) => s.externalStatus[k]?.status === 'blocked')
    const p = id && s.agents[id]?.position
    return p && Number.isFinite(p.x) ? `${Math.round(p.x)},${Math.round(p.y)}` : null
  })
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
  // keep the latest blocked-agent position handy for the run-to-desk effect (below, after pos exists)
  const blockedPosRef = useRef(blockedAgentPos)
  useEffect(() => { blockedPosRef.current = blockedAgentPos }, [blockedAgentPos])

  const baseMode = derivePetState({ mood, blockedCount })
  const mode = resolvePetMode({ base: baseMode, alert, celebrate })

  // #39 delight: click-to-pet — a purely cosmetic, user-initiated ♥ beat (no mode/state change, never
  // affects the honest reading). Auto-clears after 1s.
  const [petted, setPetted] = useState(false)
  useEffect(() => {
    if (!petted) return
    const t = setTimeout(() => setPetted(false), 1000)
    return () => clearTimeout(t)
  }, [petted])

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

  // #39: when a new blocker appears (alert turns true), trot over and stand just below a blocked
  // agent's desk so the pet POINTS AT a real blocker (motion = information; the honest beat made
  // legible). With multiple blockers it targets the first one found — still always a REAL blocker, so
  // honesty holds. Reads the store's published agent.position only — no movement-system / HOME_POSITIONS coupling.
  useEffect(() => {
    if (!alert || !officePet) return
    const raw = blockedPosRef.current
    if (!raw) return
    const [bx, by] = raw.split(',').map(Number)
    const rt = runTarget({ x: bx, y: by })
    if (!rt) return
    const dest = clampToFloor(rt)
    setFacing(dest.x >= posRef.current.x ? 1 : -1)
    posRef.current = dest
    setPos(dest)
  }, [alert, officePet])

  if (!officePet) return null

  const glideMs = mode === PET_MODES.EXCITED ? 1400 : 2800
  // a calm hop on excited/celebrate, gated by the type's motion grammar (the vacuum doesn't bob; the
  // dog bobs bigger). reduced-motion off.
  const hop = grammar.bob && (mode === PET_MODES.EXCITED || mode === PET_MODES.CELEBRATE) && !reducedMotion
    ? { animation: `${grammar.bobKeyframe} 0.6s ease-in-out infinite` } : undefined
  // v2: keep the pet legible when the office docks small without faking size (partial √ counter-scale),
  // composed with the base legibility bump.
  const petScale = petReadabilityScale(sceneScale) * PET_BASE_SCALE
  // a squash-stretch "pop" on every mode change (keyed remount) so honest state changes are FELT, not
  // just faded. reduced-motion → instant swap.
  const pop = reducedMotion ? undefined : { animation: 'pet-pop 0.3s ease-out' }
  // #39 delight: a brief celebrate spotlight — a few ✦ rise off the pet on a REAL deploy/eureka. Once
  // per event (rides the celebrate transient), reduced-motion suppressed.
  const showConfetti = mode === PET_MODES.CELEBRATE && !reducedMotion

  return (
    <g
      data-office-pet={mode}
      data-pet-type={petType}
      data-petted={petted ? '1' : undefined}
      aria-hidden="true"
      transform={`translate(${pos.x}, ${pos.y})`}
      style={reducedMotion ? { cursor: 'pointer' } : { transition: `transform ${glideMs}ms ${grammar.easing}`, cursor: 'pointer' }}
      pointerEvents="auto"
      onClick={() => setPetted(true)}
    >
      <g transform={`scale(${facing * petScale}, ${petScale})`} style={hop}>
        <g key={mode} style={pop}>
          <PetSprite type={petType} mode={mode} reducedMotion={reducedMotion} />
        </g>
        {showConfetti && (
          <g pointerEvents="none" aria-hidden="true">
            {[-6, 0, 6].map((dx, i) => (
              <text key={i} x={dx} y={-9} fontSize="5" textAnchor="middle" fill="#E0A800"
                style={{ animation: `pet-confetti 1.2s ease-out ${i * 0.14}s both` }}>✦</text>
            ))}
          </g>
        )}
        {petted && (
          <text x={0} y={-9} fontSize="6" textAnchor="middle" fill="#E2588B" aria-hidden="true"
            style={reducedMotion ? undefined : { animation: 'pet-heart 1s ease-out both' }}>♥</text>
        )}
      </g>
    </g>
  )
}
