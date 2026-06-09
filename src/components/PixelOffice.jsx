import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore } from '../systems/store'
import { startOfficeLife, triggerInteractiveEvent } from '../systems/officeLife'
import { startStatusIntegration } from '../inference/inferStatus'
import { startDesktopNotifier } from '../inference/desktopNotifier'
import { startIdleGapInference } from '../inference/idleGapInfer'
import { startWorkflowHandoffs } from '../inference/workflowHandoff'
import { eventName, t, useLocale } from '../i18n'
import AgentCharacter from './AgentCharacter'
import HelperHuddles from './HelperHuddle'
import OfficePet from './OfficePet'
import NarrowRoster from './NarrowRoster'
import AgentInspector from './AgentInspector'
import {
  Bookshelf, Plant, Couch, RoundTable, MeetingTable,
  CoffeeMachine, WaterCooler, GateBooth, WallWindow, Whiteboard,
  ServerRack, Clock, Printer, Rug, CoffeeCup, DeskLamp,
  moodToWeather,
} from './TopDownFurniture'

// Weather animation keyframes (#14) live in src/index.css and get bundled by
// Vite into the regular <link rel="stylesheet"> chain — moved out of the
// previous inline <style> tag so strict-CSP environments (corporate intranets
// with `style-src 'self'` and no `'unsafe-inline'`) can serve the office
// without dropping the animations on the floor (#27).

// ─── Sprint Kanban Board ─────────────────────────────────────────────────
// React.memo: PixelOffice re-renders on every minute/hour tick and every
// agentOrderSignature change. SprintKanban's props (x, y, doneCount) are
// unchanged on a clock tick, so memo skips re-building its ~25 SVG elements.
const SprintKanban = React.memo(function SprintKanban({ x, y, doneCount = 0 }) {
  const W = 78, H = 52
  const MAX_CELLS = 6  // 3 rows × 2 per row, leaves row 4 for overflow text
  const filled = Math.min(doneCount, MAX_CELLS)
  const overflow = doneCount > MAX_CELLS ? doneCount - MAX_CELLS : 0
  const todoCards = ['#F5A623', '#7F77DD', '#4A90D9']
  const doingCards = ['#1D9E75', '#E24B4A']
  return (
    <g>
      <rect x={x} y={y} width={W} height={H} rx={2} fill="#F8F4E8" stroke="#C8C0A8" strokeWidth="0.8" />
      {/* Header bar */}
      <rect x={x} y={y} width={W} height={10} rx={2} fill="#7070A0" opacity="0.9" />
      <text x={x + 28} y={y + 7.5} textAnchor="middle" fontSize="6" fill="white" fontFamily="monospace" fontWeight="bold">SPRINT</text>
      <text x={x + W - 4} y={y + 7.5} textAnchor="end" fontSize="6" fill="#FFE08A" fontFamily="monospace" fontWeight="bold">{doneCount}</text>
      {/* Column dividers */}
      <line x1={x + 26} y1={y + 10} x2={x + 26} y2={y + H} stroke="#D8D0C0" strokeWidth="0.6" />
      <line x1={x + 52} y1={y + 10} x2={x + 52} y2={y + H} stroke="#D8D0C0" strokeWidth="0.6" />
      {/* Column headers */}
      <text x={x + 13} y={y + 17} textAnchor="middle" fontSize="5.5" fill="#888" fontFamily="monospace">TODO</text>
      <text x={x + 39} y={y + 17} textAnchor="middle" fontSize="5.5" fill="#888" fontFamily="monospace">DOING</text>
      <text x={x + 65} y={y + 17} textAnchor="middle" fontSize="5.5" fill={filled > 0 ? '#2E7D32' : '#888'} fontFamily="monospace" fontWeight={filled > 0 ? 'bold' : 'normal'}>DONE</text>
      {/* TODO column: static colored task cards */}
      {todoCards.map((color, i) => (
        <rect key={i} x={x + 3} y={y + 20 + i * 8} width={20} height={6} rx={1} fill={color} opacity="0.25" />
      ))}
      {/* DOING column: static cards */}
      {doingCards.map((color, i) => (
        <rect key={i} x={x + 29} y={y + 20 + i * 8} width={20} height={6} rx={1} fill={color} opacity="0.35" />
      ))}
      {/* DONE column: fills dynamically — max 6 cells (3 rows × 2) */}
      {Array.from({ length: filled }).map((_, i) => (
        <rect key={i}
          x={x + 55 + (i % 2) * 9} y={y + 20 + Math.floor(i / 2) * 8}
          width={7} height={6} rx={1} fill="#4CAF50" opacity="0.75"
        />
      ))}
      {/* Row 4: overflow indicator when done count exceeds 6 */}
      {overflow > 0 && (
        <text x={x + 65} y={y + 47} textAnchor="middle" fontSize="4" fill="#2E7D32" fontFamily="monospace" fontWeight="bold">+{overflow}</text>
      )}
    </g>
  )
})

// ─── Flying Document Animation ──────────────────────────────────────────
function FlyingDocument({ fromPos, toPos, onComplete, subtle = false }) {
  const [progress, setProgress] = React.useState(0)
  const rafRef = React.useRef(null)
  const startRef = React.useRef(null)
  const onCompleteRef = React.useRef(onComplete)
  onCompleteRef.current = onComplete
  const DURATION = 800 // ms

  React.useEffect(() => {
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const t = Math.min(1, elapsed / DURATION)
      setProgress(t)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        onCompleteRef.current?.()
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // stable — onComplete stored in ref

  // Parabolic arc: x linear, y with arc
  const x = fromPos.x + (toPos.x - fromPos.x) * progress
  const arcHeight = -60 * Math.sin(progress * Math.PI)  // arc up
  const y = fromPos.y + (toPos.y - fromPos.y) * progress + arcHeight

  // Rotation + scale: subtle workflow handoffs use a calm 60° tilt with no scale
  // pulse (per AVO-105 design "畫面要清楚好懂、不過分花俏"). Organic handoffs from
  // officeLife keep the original 360° spin + 1→1.3→1 scale to read as celebratory.
  const rotation = subtle ? progress * 60 : progress * 360
  const scale = subtle ? 1 : (1 + Math.sin(progress * Math.PI) * 0.3)

  return (
    <g transform={`translate(${x}, ${y - 20})`} opacity={1 - progress * 0.3}>
      {/* Paper document */}
      <g transform={`rotate(${rotation * 0.3}, 0, 0) scale(${scale})`}>
        <rect x={-5} y={-6} width={10} height={12} rx={1} fill="white" stroke="#CCC" strokeWidth="0.5" />
        <line x1={-3} y1={-3} x2={3} y2={-3} stroke="#AAA" strokeWidth="0.5" />
        <line x1={-3} y1={-1} x2={3} y2={-1} stroke="#AAA" strokeWidth="0.5" />
        <line x1={-3} y1={1} x2={2} y2={1} stroke="#AAA" strokeWidth="0.5" />
        <line x1={-3} y1={3} x2={3} y2={3} stroke="#DDD" strokeWidth="0.5" />
      </g>
      {/* Sparkle trail — organic mode only; workflow handoffs stay clean */}
      {!subtle && progress > 0.1 && progress < 0.9 && (
        <>
          <circle cx={-8} cy={3} r={1.5} fill="#FFD700" opacity={0.6 * (1 - progress)} />
          <circle cx={-12} cy={6} r={1} fill="#FFD700" opacity={0.4 * (1 - progress)} />
        </>
      )}
    </g>
  )
}

function FlyingDocuments() {
  const handoffs = useOfficeStore(useShallow((s) => s.handoffs))
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)

  if (reducedMotion) return null
  // Read agent positions via getState() rather than subscribing to s.agents.
  // A FlyingDocument animates a fixed arc between its from/to coords captured at
  // mount — it never needs live position updates. Subscribing to s.agents made
  // FlyingDocuments re-render on EVERY agent RAF position tick (~30fps per walking
  // agent) even when handoffs was empty. Now it re-renders only when handoffs
  // itself changes (a handful of times per minute).
  const agents = useOfficeStore.getState().agents
  return handoffs.map((h) => {
    const fromAgent = agents[h.from]
    const toAgent = agents[h.to]
    if (!fromAgent || !toAgent) return null
    const fromPos = fromAgent.targetPosition || fromAgent.position
    const toPos = toAgent.targetPosition || toAgent.position
    return (
      <FlyingDocument
        key={h.id}
        fromPos={fromPos}
        toPos={toPos}
        subtle={h.subtle}
        onComplete={() => useOfficeStore.getState().removeHandoff(h.id)}
      />
    )
  })
}

function WhiteboardAnimation() {
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const [progress, setProgress] = React.useState(0)
  const rafRef = React.useRef(null)
  const startRef = React.useRef(null)

  const isEureka = activeEvent?.id === 'eureka'

  React.useEffect(() => {
    if (!isEureka) {
      setProgress(0)
      return
    }
    startRef.current = null
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const t = Math.min(1, (timestamp - startRef.current) / 3000)
      setProgress(t)
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isEureka])

  if (!isEureka || progress === 0) return null

  const bx = 537, by = 282
  const line1Len = 40
  const line2Len = 35
  const line3Len = 25
  const circleLen = 50

  const line1Dash = line1Len * Math.min(1, progress * 4)
  const line2Dash = line2Len * Math.max(0, Math.min(1, (progress - 0.25) * 4))
  const line3Dash = line3Len * Math.max(0, Math.min(1, (progress - 0.5) * 4))
  const circleDash = circleLen * Math.max(0, Math.min(1, (progress - 0.7) * 3.33))

  return (
    <g pointerEvents="none" opacity={Math.min(1, progress * 3)}>
      <line x1={bx + 3} y1={by + 8} x2={bx + 43} y2={by + 15}
        stroke="#378ADD" strokeWidth="1.2" strokeLinecap="round"
        strokeDasharray={line1Len}
        strokeDashoffset={line1Len - line1Dash}
      />
      <line x1={bx + 5} y1={by + 20} x2={bx + 40} y2={by + 22}
        stroke="#E24B4A" strokeWidth="0.8" strokeLinecap="round"
        strokeDasharray={line2Len}
        strokeDashoffset={line2Len - line2Dash}
      />
      <line x1={bx + 8} y1={by + 28} x2={bx + 33} y2={by + 30}
        stroke="#1D9E75" strokeWidth="0.8" strokeLinecap="round"
        strokeDasharray={line3Len}
        strokeDashoffset={line3Len - line3Dash}
      />
      <circle cx={bx + 35} cy={by + 14} r={8}
        fill="none" stroke="#F5C842" strokeWidth="1" strokeLinecap="round"
        strokeDasharray={circleLen}
        strokeDashoffset={circleLen - circleDash}
      />
      {progress > 0.85 && (
        <text x={bx + 45} y={by + 10} fontSize="10" fill="#F5C842" fontWeight="bold"
          opacity={Math.min(1, (progress - 0.85) * 6.67)}>
          !
        </text>
      )}
    </g>
  )
}

function getLightingOverlay(hour) {
  if (hour >= 22) return { fill: '#050510', opacity: 0.45 }
  if (hour >= 20) return { fill: '#0a0a2e', opacity: 0.38 }
  if (hour >= 19) return { fill: '#0f1040', opacity: 0.30 }
  if (hour >= 18) return { fill: '#1a1040', opacity: 0.18 }
  if (hour >= 17) return { fill: '#ff6622', opacity: 0.08 }
  if (hour >= 9 && hour < 17) return { fill: '#fff', opacity: 0.0 }
  if (hour >= 7) return { fill: '#ffd080', opacity: 0.07 }
  if (hour >= 6) return { fill: '#FFD093', opacity: 0.05 }
  return { fill: '#050510', opacity: 0.45 }
}

// ─── Clock widget — isolates the per-minute subscription ──────────────────
// PixelOffice's full SVG tree (~1000 elements) is reconciled on every store change
// that hits one of its subscriptions. `minute` advances every 60s, `hour` only once
// per hour — so 59 of every 60 PixelOffice re-renders per hour were driven SOLELY by
// the minute hand. Isolating the `minute` (and `hour`) subscription into this tiny
// wrapper means PixelOffice no longer subscribes to `minute` at all: the minute tick
// now re-renders only this 1-element <Clock>, not the whole office. PixelOffice still
// subscribes to `hour` independently (NightSky / lighting / WallWindow need it).
function ClockWidget({ x, y, r }) {
  const hour = useOfficeStore((s) => s.hour)
  const minute = useOfficeStore((s) => s.minute)
  return <Clock x={x} y={y} r={r} hour={hour} minute={minute} />
}

// ─── Boss character that walks through during boss-visit event ─────────
function WalkingBoss() {
  const [pos, setPos] = React.useState({ x: 100, y: 150 })
  const rafRef = React.useRef(null)
  const startRef = React.useRef(null)
  const DURATION = 9000

  // Boss walks: entrance → across main office → back out
  const PATH = [
    { x: 100, y: 150 }, // entrance
    { x: 200, y: 280 }, // main office left
    { x: 400, y: 290 }, // center
    { x: 550, y: 280 }, // right
    { x: 400, y: 350 }, // loop back
    { x: 200, y: 300 }, // heading out
    { x: 100, y: 150 }, // exit
  ]

  React.useEffect(() => {
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const t = Math.min(1, (timestamp - startRef.current) / DURATION)
      // Interpolate along path
      const totalSegs = PATH.length - 1
      const segFloat = t * totalSegs
      const seg = Math.min(Math.floor(segFloat), totalSegs - 1)
      const segT = segFloat - seg
      const from = PATH[seg]
      const to = PATH[seg + 1]
      setPos({
        x: from.x + (to.x - from.x) * segT,
        y: from.y + (to.y - from.y) * segT,
      })
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <g transform={`translate(${pos.x}, ${pos.y}) scale(1.35)`}>
      {/* Boss shadow */}
      <ellipse cx={0} cy={12} rx={8} ry={3} fill="rgba(0,0,0,0.15)" />
      {/* Boss body — suit */}
      <rect x={-6} y={-4} width={12} height={14} rx={2} fill="#2C3E50" />
      {/* Tie */}
      <line x1={0} y1={-2} x2={0} y2={6} stroke="#C0392B" strokeWidth="1.5" />
      {/* Head */}
      <circle cx={0} cy={-10} r={6} fill="#F5D0A9" />
      {/* Hair (slicked back) */}
      <path d="M-6,-12 Q0,-18 6,-12" fill="#333" />
      {/* Glasses */}
      <line x1={-5} y1={-11} x2={5} y2={-11} stroke="#333" strokeWidth="0.8" />
      <circle cx={-3} cy={-11} r={2.5} fill="none" stroke="#333" strokeWidth="0.8" />
      <circle cx={3} cy={-11} r={2.5} fill="none" stroke="#333" strokeWidth="0.8" />
      {/* Serious expression */}
      <line x1={-2} y1={-8} x2={2} y2={-8} stroke="#8B6548" strokeWidth="0.8" />
      {/* Clipboard */}
      <rect x={6} y={-2} width={6} height={8} rx={1} fill="#C8A060" stroke="#A08040" strokeWidth="0.5" />
      <line x1={7} y1={1} x2={11} y2={1} stroke="#666" strokeWidth="0.5" />
      <line x1={7} y1={3} x2={10} y2={3} stroke="#666" strokeWidth="0.5" />
    </g>
  )
}

// ─── Dog that runs around during dog-visit event ──────────────────────
function OfficeDog() {
  const [pos, setPos] = React.useState({ x: 100, y: 150 })
  const rafRef = React.useRef(null)
  const startRef = React.useRef(null)
  const DURATION = 18000

  const PATH = [
    { x: 100, y: 150 }, { x: 300, y: 290 }, { x: 500, y: 270 },
    { x: 400, y: 380 }, { x: 175, y: 490 }, { x: 250, y: 470 },
    { x: 175, y: 490 }, { x: 300, y: 350 }, { x: 100, y: 150 },
  ]

  React.useEffect(() => {
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const t = Math.min(1, (timestamp - startRef.current) / DURATION)
      const totalSegs = PATH.length - 1
      const segFloat = t * totalSegs
      const seg = Math.min(Math.floor(segFloat), totalSegs - 1)
      const segT = segFloat - seg
      setPos({
        x: PATH[seg].x + (PATH[seg + 1].x - PATH[seg].x) * segT,
        y: PATH[seg].y + (PATH[seg + 1].y - PATH[seg].y) * segT,
      })
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <g transform={`translate(${pos.x}, ${pos.y}) scale(1.35)`}>
      <ellipse cx={0} cy={6} rx={5} ry={2} fill="rgba(0,0,0,0.1)" />
      {/* Body */}
      <ellipse cx={0} cy={0} rx={8} ry={5} fill="#C8964E" />
      {/* Head */}
      <circle cx={8} cy={-3} r={4.5} fill="#D4A860" />
      {/* Ear */}
      <ellipse cx={10} cy={-7} rx={2.5} ry={3} fill="#A07838" />
      {/* Eye */}
      <circle cx={10} cy={-4} r={1} fill="#333" />
      {/* Nose */}
      <circle cx={12} cy={-2} r={1} fill="#333" />
      {/* Tail (wagging) */}
      <line x1={-7} y1={-2} x2={-12} y2={-6} stroke="#C8964E" strokeWidth="2" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate"
          values="-10 -7 -2;10 -7 -2;-10 -7 -2" dur="0.4s" repeatCount="indefinite" />
      </line>
      {/* Legs (bouncing) */}
      <line x1={-4} y1={4} x2={-5} y2={8} stroke="#A07838" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="y2" values="8;6;8" dur="0.3s" repeatCount="indefinite" />
      </line>
      <line x1={4} y1={4} x2={5} y2={8} stroke="#A07838" strokeWidth="1.5" strokeLinecap="round">
        <animate attributeName="y2" values="6;8;6" dur="0.3s" repeatCount="indefinite" />
      </line>
    </g>
  )
}

// Sorts IN PLACE — the sole caller passes a freshly-allocated Object.values()
// array it does not retain, so the previous defensive `[...agents]` copy spread
// that throwaway array a second time for nothing. Sorting the input directly is
// safe given the single known call site (the agentList useMemo below).
function sortByY(agents) {
  return agents.sort((a, b) => {
    const ay = (a.targetPosition || a.position || {}).y || 0
    const by = (b.targetPosition || b.position || {}).y || 0
    return ay - by
  })
}

// ─── Growth system helpers ────────────────────────────────────────────────
const GROWTH_LEVELS = [0, 1, 3, 6] // min daily done count for level 0..3

function growthLevel(count) {
  let lvl = 0
  for (let i = 0; i < GROWTH_LEVELS.length; i++) if (count >= GROWTH_LEVELS[i]) lvl = i
  return lvl
}

// ─── Personalized desk with character-specific items ─────────────────────
// React.memo: each PersonalDesk renders ~80 SVG elements. PixelOffice re-renders
// on every minute/hour tick and every agentOrderSignature change (an agent
// walking), none of which alter a desk's props. Without memo all 7 desks
// re-execute on every such render. The ops desk's onDeployClick is stabilized
// with useCallback in PixelOffice so its identity stays constant across renders.
const PersonalDesk = React.memo(function PersonalDesk({ x, y, label, color, variant, coffeeCount = 0, stickyCount = 0, booksCount = 0, onDeployClick, labelScale = 1 }) {
  const W = 60, H = 38
  return (
    <g>
      {/* Desk label (character name) — POINT 2: counter-scaled so "whose desk" stays legible
          when shrunk (esp. at idle, when the floating name tag is hidden). */}
      <ScaledText x={x} y={y - H / 2 - 4} scale={labelScale} textAnchor="middle" fontSize="6" fill={color} fontFamily="monospace" fontWeight="bold" opacity="0.7">{label}</ScaledText>

      {/* Chair */}
      <rect x={x - 10} y={y + H / 2 + 2} width={20} height={14} rx={7} fill="#444" opacity="0.6" />

      {/* Desk surface */}
      <rect x={x - W / 2} y={y - H / 2} width={W} height={H} rx={2} fill="#B8864E" />
      <rect x={x - W / 2 + 2} y={y - H / 2 + 2} width={W - 4} height={H - 4} rx={1} fill="#C89860" />
      {/* Front edge */}
      <rect x={x - W / 2} y={y + H / 2 - 3} width={W} height={3} rx={1} fill="#A07040" />

      {/* Monitor */}
      <rect x={x - 13} y={y - H / 2 + 2} width={26} height={16} rx={2} fill="#1a2a3a" />
      <rect x={x - 11} y={y - H / 2 + 4} width={22} height={12} rx={1} fill="#2d5a7e" />
      {/* Screen content lines */}
      <line x1={x - 9} y1={y - H / 2 + 7} x2={x + 5} y2={y - H / 2 + 7} stroke="#4af" strokeWidth="0.8" opacity="0.5" />
      <line x1={x - 9} y1={y - H / 2 + 10} x2={x + 8} y2={y - H / 2 + 10} stroke="#4fa" strokeWidth="0.8" opacity="0.4" />
      <line x1={x - 9} y1={y - H / 2 + 13} x2={x + 2} y2={y - H / 2 + 13} stroke="#fa4" strokeWidth="0.8" opacity="0.5" />

      {/* ─── Character-specific desk items ─── */}
      {variant === 'pm' && (
        <g>
          {/* Sticky notes */}
          <rect x={x + 14} y={y - 6} width={8} height={8} fill="#FFE066" opacity="0.9" />
          <rect x={x + 16} y={y - 8} width={8} height={8} fill="#FF9E9E" opacity="0.8" />
          <rect x={x + 12} y={y + 4} width={8} height={8} fill="#A8E6CF" opacity="0.8" />
          {/* Pen holder */}
          <rect x={x - 24} y={y - 4} width={6} height={8} rx={1} fill="#666" />
        </g>
      )}
      {variant === 'arch' && (
        <g>
          {/* Blueprint roll */}
          <rect x={x + 14} y={y - 2} width={14} height={4} rx={2} fill="#8888CC" opacity="0.7" />
          <circle cx={x + 14} cy={y} r={2} fill="#9999DD" />
          {/* Compass / protractor */}
          <circle cx={x - 22} cy={y + 2} r={5} fill="none" stroke="#888" strokeWidth="0.8" opacity="0.6" />
        </g>
      )}
      {variant === 'dev' && (
        <g>
          {/* Extra monitors! */}
          <rect x={x + 14} y={y - H / 2 + 4} width={14} height={10} rx={1} fill="#1a2a3a" />
          <rect x={x + 15} y={y - H / 2 + 5} width={12} height={8} rx={0.5} fill="#1a3a2a" />
          {/* Coffee cups everywhere */}
          <CoffeeCup x={x - 26} y={y - 2} />
          <CoffeeCup x={x - 26} y={y + 8} steaming={false} />
          {growthLevel(coffeeCount) >= 1 && <CoffeeCup x={x + 20} y={y + 8} />}
        </g>
      )}
      {variant === 'qa' && (
        <g>
          {/* Magnifying glass */}
          <circle cx={x + 20} cy={y + 2} r={6} fill="rgba(255,200,100,0.1)" stroke="#BA7517" strokeWidth="1.2" />
          <line x1={x + 24} y1={y + 6} x2={x + 28} y2={y + 10} stroke="#BA7517" strokeWidth="1.8" strokeLinecap="round" />
          {/* Checklist */}
          <rect x={x - 28} y={y - 4} width={12} height={14} rx={1} fill="#F5F0E0" stroke="#CCC" strokeWidth="0.5" />
          <line x1={x - 26} y1={y - 1} x2={x - 19} y2={y - 1} stroke="#5CB88A" strokeWidth="0.8" />
          <line x1={x - 26} y1={y + 2} x2={x - 19} y2={y + 2} stroke="#5CB88A" strokeWidth="0.8" />
          <line x1={x - 26} y1={y + 5} x2={x - 22} y2={y + 5} stroke="#E24B4A" strokeWidth="0.8" />
        </g>
      )}
      {variant === 'ops' && (
        <g>
          {/* Big red deploy button */}
          <g style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onDeployClick?.() }}>
            <circle cx={x + 20} cy={y + 4} r={7} fill="#CC3333" stroke="#AA2222" strokeWidth="1" />
            <circle cx={x + 20} cy={y + 3} r={5} fill="#E24B4A" />
            <text x={x + 20} y={y + 5} textAnchor="middle" fontSize="3.5" fill="white" fontFamily="monospace" fontWeight="bold">GO</text>
          </g>
          {/* Terminal */}
          <rect x={x - 28} y={y - 2} width={12} height={8} rx={1} fill="#1a1a1a" />
          <line x1={x - 26} y1={y + 1} x2={x - 20} y2={y + 1} stroke="#0f0" strokeWidth="0.6" opacity="0.8" />
          <line x1={x - 26} y1={y + 3} x2={x - 22} y2={y + 3} stroke="#0f0" strokeWidth="0.6" opacity="0.5" />
        </g>
      )}
      {variant === 'res' && (
        <g>
          {/* Stack of books */}
          <rect x={x + 14} y={y - 2} width={12} height={3} rx={0.5} fill="#E24B4A" opacity="0.8" />
          <rect x={x + 13} y={y + 1} width={14} height={3} rx={0.5} fill="#378ADD" opacity="0.8" />
          <rect x={x + 15} y={y + 4} width={10} height={3} rx={0.5} fill="#1D9E75" opacity="0.8" />
          <rect x={x + 12} y={y + 7} width={15} height={3} rx={0.5} fill="#7F77DD" opacity="0.8" />
          {/* Open notebook */}
          <rect x={x - 28} y={y - 2} width={14} height={10} rx={1} fill="#F5F0E0" stroke="#DDD" strokeWidth="0.5" />
          <line x1={x - 21} y1={y - 2} x2={x - 21} y2={y + 8} stroke="#DDD" strokeWidth="0.5" />
        </g>
      )}
      {variant === 'designer' && (
        <g>
          {/* iPad with color palette on screen */}
          <rect x={x + 13} y={y - H / 2 + 2} width={14} height={20} rx={2} fill="#1a1a2a" stroke="#E8688A" strokeWidth="0.8" />
          <rect x={x + 14} y={y - H / 2 + 4} width={12} height={15} rx={1} fill="#2a1a2a" />
          {/* Color swatches on iPad */}
          <circle cx={x + 17} cy={y - H / 2 + 8}  r={2.5} fill="#E8688A" opacity="0.9" />
          <circle cx={x + 22} cy={y - H / 2 + 8}  r={2.5} fill="#F5C6D6" opacity="0.9" />
          <circle cx={x + 17} cy={y - H / 2 + 14} r={2.5} fill="#C850A0" opacity="0.9" />
          <circle cx={x + 22} cy={y - H / 2 + 14} r={2.5} fill="#FFE4F0" opacity="0.9" />
          {/* Color swatch fan on desk */}
          <rect x={x - 28} y={y + 2} width={8} height={2} rx={0.5} fill="#E8688A" opacity="0.8" />
          <rect x={x - 28} y={y + 5} width={8} height={2} rx={0.5} fill="#C850A0" opacity="0.8" />
          <rect x={x - 28} y={y + 8} width={8} height={2} rx={0.5} fill="#F5C6D6" opacity="0.8" />
          <rect x={x - 27} y={y}     width={10} height={2} rx={0.5} fill="#FFE4F0" opacity="0.8" />
          {/* Thin design ruler */}
          <rect x={x - 28} y={y - 6} width={14} height={2} rx={0.5} fill="#bbb" opacity="0.6" />
        </g>
      )}

      {/* Extra coffee cups from behavior */}
      {variant !== 'dev' && growthLevel(coffeeCount) >= 1 && <CoffeeCup x={x + 20} y={y + 6} />}
      {growthLevel(coffeeCount) >= 2 && <CoffeeCup x={x + 24} y={y - 2} steaming={false} />}

      {/* Growth system: sticky notes accumulate near monitor (max 3) */}
      {growthLevel(stickyCount) >= 1 && (
        <rect x={x + 10} y={y - 18 + 2} width={6} height={6} fill="#FFE066" opacity="0.7" transform={`rotate(-4, ${x + 13}, ${y - 13})`} />
      )}
      {growthLevel(stickyCount) >= 2 && (
        <rect x={x + 3} y={y - 18 + 2} width={6} height={6} fill="#FF9E9E" opacity="0.65" transform={`rotate(6, ${x + 6}, ${y - 13})`} />
      )}
      {growthLevel(stickyCount) >= 3 && (
        <rect x={x - 5} y={y - 18 + 2} width={6} height={6} fill="#A8E6CF" opacity="0.6" transform={`rotate(-3, ${x - 2}, ${y - 13})`} />
      )}

      {/* Growth system: book stack below monitor (max 3) */}
      {growthLevel(booksCount) >= 1 && (
        <rect x={x - 12} y={y + 12} width={9} height={2.5} rx={0.5} fill="#E24B4A" opacity="0.6" />
      )}
      {growthLevel(booksCount) >= 2 && (
        <rect x={x - 13} y={y + 9.5} width={10} height={2.5} rx={0.5} fill="#378ADD" opacity="0.6" />
      )}
      {growthLevel(booksCount) >= 3 && (
        <rect x={x - 11} y={y + 7} width={8} height={2.5} rx={0.5} fill="#1D9E75" opacity="0.6" />
      )}
    </g>
  )
})

// ─── Night sky visible through windows ───────────────────────────────────────
// React.memo: PixelOffice re-renders every minute (the `minute` clock tick). NightSky's
// only prop is `hour` — its ~20-element SVG tree changes solely when `hour` crosses the
// 6/19 day-night boundary. Memo skips the rebuild on the 59 of 60 minute-ticks per hour
// where `hour` is unchanged.
const NightSky = React.memo(function NightSky({ hour }) {
  if (hour >= 6 && hour < 19) return null

  return (
    <g pointerEvents="none">
      {/* Moon visible through rightmost window */}
      <clipPath id="window-clip-moon">
        <rect x={442} y={143} width={32} height={14} rx={1} />
      </clipPath>
      <g clipPath="url(#window-clip-moon)">
        <circle cx={462} cy={147} r={7} fill="#FFFDE0" opacity="0.9" />
        <circle cx={459} cy={145} r={1.5} fill="#E8E0C0" opacity="0.4" />
        <circle cx={464} cy={149} r={1} fill="#E8E0C0" opacity="0.3" />
      </g>

      {/* Stars scattered across windows */}
      <clipPath id="window-clip-stars">
        <rect x={142} y={143} width={32} height={14} rx={1} />
        <rect x={242} y={143} width={32} height={14} rx={1} />
        <rect x={342} y={143} width={32} height={14} rx={1} />
      </clipPath>
      <g clipPath="url(#window-clip-stars)">
        <circle cx={152} cy={148} r={0.8} fill="#FFF" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={162} cy={145} r={0.5} fill="#FFF" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={254} cy={146} r={0.8} fill="#FFF" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx={268} cy={149} r={0.5} fill="#FFF" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx={348} cy={147} r={0.6} fill="#FFF" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={365} cy={145} r={0.7} fill="#FFF" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.3;0.6" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Entrance windows stars */}
      <clipPath id="window-clip-entrance">
        <rect x={20} y={16} width={40} height={24} rx={1} />
        <rect x={74} y={16} width={40} height={24} rx={1} />
      </clipPath>
      <g clipPath="url(#window-clip-entrance)">
        <circle cx={35} cy={22} r={0.7} fill="#FFF" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2.3s" repeatCount="indefinite" />
        </circle>
        <circle cx={50} cy={28} r={0.5} fill="#FFF" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx={88} cy={24} r={0.8} fill="#FFF" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.9s" repeatCount="indefinite" />
        </circle>
      </g>
    </g>
  )
})

// Static desk positions matching WAYPOINTS — defined outside component to avoid re-creation
const DESK_DATA = [
  { id: 'pm',   x: 140, y: 240, label: 'PM',     color: '#378ADD', variant: 'pm' },
  { id: 'arch', x: 260, y: 240, label: 'Arch',    color: '#7F77DD', variant: 'arch' },
  { id: 'qa',   x: 400, y: 220, label: 'QA',      color: '#BA7517', variant: 'qa' },
  { id: 'res',  x: 520, y: 220, label: 'Research', color: '#5DCAA5', variant: 'res' },
  { id: 'dev',      x: 340, y: 340, label: 'Dev',      color: '#1D9E75', variant: 'dev' },
  { id: 'ops',      x: 460, y: 340, label: 'Ops',      color: '#D85A30', variant: 'ops' },
  { id: 'designer', x: 140, y: 360, label: 'Design',   color: '#E8688A', variant: 'designer' },
]
const DESK_IDS = DESK_DATA.map(({ id }) => id)

function getAgentOrderSignature(agents) {
  return Object.keys(agents).map((id) => {
    const y = agents[id]?.targetPosition?.y ?? agents[id]?.position?.y ?? 0
    return `${id}|${Math.round(y)}`
  })
}

// Static SVG grid lines — pre-built once to avoid re-creating 103 elements per render
const GRID_LINES = (() => {
  const lines = []
  for (let i = 0; i < 29; i++) {
    lines.push(<line key={`h${i}`} x1="10" y1={163 + i * 8} x2="598" y2={163 + i * 8} stroke="#000" strokeWidth="0.5" />)
  }
  for (let i = 0; i < 74; i++) {
    lines.push(<line key={`v${i}`} x1={10 + i * 8} y1="163" x2={10 + i * 8} y2="399" stroke="#000" strokeWidth="0.5" />)
  }
  return lines
})()

// The office scene is authored at a FIXED 800×560 (every desk/home/waypoint is a hardcoded
// movementSystem coordinate, so it can't be reflowed to portrait). The office is the PRIMARY view
// at EVERY size — scaled to fit via SVG `meet`. The roster is an OPTIONAL manual toggle
// (store.rosterMode), never an automatic size-based switch, so the office always leads and the
// list is just an extra glanceable lens the user can opt into.
export const SCENE_W = 800
export const SCENE_H = 560

// POINT 2: the office renders with preserveAspectRatio="xMidYMid meet", so its on-screen scale
// is the SMALLER of the width/height fit ratios — that is what shrinks every in-scene label when
// the office is docked small. AgentCharacter counter-scales labels by 1/this. Pure for unit test.
// A zero/NaN box (pre-layout) returns 1 → no counter-scaling until a real measurement lands.
export function computeSceneScale(rectW, rectH) {
  if (!(rectW > 0) || !(rectH > 0)) return 1
  return Math.min(rectW / SCENE_W, rectH / SCENE_H)
}

// POINT 2: render a <text> counter-scaled around its OWN anchor (x,y), so secondary in-scene
// labels (zone names, desk nameplates) stay legible as the office shrinks. Scaling around the
// text's own anchor keeps it positioned exactly where the plain <text> sat. At scale 1 it is
// byte-identical to a plain <text x y>. Pure presentation; never intercepts pointer events.
function ScaledText({ x, y, scale, children, ...rest }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) translate(${-x}, ${-y})`} pointerEvents="none">
      <text x={x} y={y} {...rest}>{children}</text>
    </g>
  )
}

export default function PixelOffice({ animationQuality = 'full', mode = 'full' }) {
  // Only re-render PixelOffice when agent IDs change, not on every property update.
  // AgentCharacter subscribes to its own agent state independently.
  const agentOrderSignature = useOfficeStore(useShallow((s) => getAgentOrderSignature(s.agents)))
  // Targeted selector — only re-renders when desk-item counts change, not on every
  // agent tick. The three growth items (coffee/sticky/books) are read in ONE flat
  // selector instead of three: a separate useShallow per item ran the selector and
  // allocated a 7-element array three times per store setState. One selector → one
  // allocation. Layout: [coffee×7, sticky×7, books×7].
  const deskItemCounts = useOfficeStore(useShallow((s) => {
    const out = []
    for (const id of DESK_IDS) out.push(s.agents[id]?.deskItemCount?.coffee || 0)
    for (const id of DESK_IDS) out.push(s.agents[id]?.deskItemCount?.sticky || 0)
    for (const id of DESK_IDS) out.push(s.agents[id]?.deskItemCount?.books || 0)
    return out
  }))
  // Subscribe to the ledger reference (changes only on a done event or day rollover),
  // then sum in a memo. The previous inline `Object.values().reduce()` selector re-ran
  // the reduction on EVERY store mutation — every RAF position tick, every behavior
  // change — even though the done-count only changes a few times per minute.
  const dailyDoneCounts = useOfficeStore(useShallow((s) => s.dailyDoneLedger?.counts))
  const totalDoneToday = useMemo(
    () => Object.values(dailyDoneCounts || {}).reduce((sum, c) => sum + c, 0),
    [dailyDoneCounts]
  )
  const hour = useOfficeStore((s) => s.hour)
  // `minute` is intentionally NOT subscribed here — ClockWidget owns that subscription
  // so the per-minute tick re-renders only the clock, not PixelOffice's whole SVG tree.
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const activeWorkflow = useOfficeStore((s) => s.activeWorkflow)
  const hasEverReceivedStatus = useOfficeStore((s) => s.hasEverReceivedStatus)
  // Weather follows team mood. `mood` is a string enum so primitive equality is
  // fine — no useShallow needed. `reducedMotion` toggles only on user-pref change
  // or pause/resume, so the cost of a wide PixelOffice re-render on those is OK.
  const mood = useOfficeStore((s) => s.mood)
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const weatherEffects = useOfficeStore((s) => s.weatherEffects)
  const weather = moodToWeather(mood)
  // #45: WallWindow's reducedMotion prop ONLY governs the WeatherOverlay animation. Feed it the
  // OR of the accessibility pref and the user weather toggle so disabling either renders weather
  // as static decoration (no per-frame rain/cloud/lightning) — the documented CPU-spike fix.
  const weatherReduced = reducedMotion || !weatherEffects
  useLocale() // re-render on language switch so hint text updates

  useEffect(() => {
    const cleanup = startOfficeLife(useOfficeStore)
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = startStatusIntegration(useOfficeStore)
    return cleanup
  }, [])

  useEffect(() => {
    // Desktop notifications (#8): blocked >30s + tab hidden + permission granted → notify.
    // Permission is requested via the ControlPanel 🔔 button — this just starts the
    // poll loop which is a no-op until permission lands.
    const cleanup = startDesktopNotifier(useOfficeStore)
    return cleanup
  }, [])

  useEffect(() => {
    // Idle-gap inference (#C): working+45s gap → thinking; blocked+90s gap → awaiting-approval.
    // Closes Pixel Agents' admitted heuristic gap; the inferred statuses are pre-registered
    // in classify.js STATUS_TABLE and flow through decideBehavior normally.
    const cleanup = startIdleGapInference(useOfficeStore)
    return cleanup
  }, [])

  useEffect(() => {
    // Workflow handoff arrows (AVO-105): when activeWorkflow flips between phases
    // (e.g. /plan → /implement), fire a subtle paper-document arc between the
    // role pair that semantically owns that handoff (arch → dev for plan→implement).
    // Subtle variant (no sparkle, calm rotation) per "clear and not flashy" brief.
    const cleanup = startWorkflowHandoffs(useOfficeStore)
    return cleanup
  }, [])

  // Memoize agent list — re-sort only when the order signature changes (an agent's
  // id set or rounded-y changes), NOT on every property update. `agentOrderSignature`
  // is derived from Object.keys(s.agents), so the agent id set it represents is exactly
  // Object.keys(getState().agents) — sort those values directly. The previous code
  // round-tripped each signature entry through `.split('|', 1)[0]` to recover the id it
  // had just joined in; that split allocated a throwaway array per agent every time the
  // signature changed. `agentOrderSignature` stays in the dep array (it is the precise
  // change trigger); the body just no longer parses it.
  const agentList = useMemo(
    () => sortByY(Object.values(useOfficeStore.getState().agents)),
    [agentOrderSignature]
  )
  // Single memo derives all three id→count maps from the flat selector array.
  // The flat layout is [coffee×N, sticky×N, books×N] where N = DESK_IDS.length.
  const { coffeeCountMap, stickyCountMap, booksCountMap } = useMemo(() => {
    const n = DESK_IDS.length
    const coffee = {}, sticky = {}, books = {}
    for (let i = 0; i < n; i++) {
      const id = DESK_IDS[i]
      coffee[id] = deskItemCounts[i] || 0
      sticky[id] = deskItemCounts[n + i] || 0
      books[id] = deskItemCounts[2 * n + i] || 0
    }
    return { coffeeCountMap: coffee, stickyCountMap: sticky, booksCountMap: books }
  }, [deskItemCounts])
  const lightOverlay = getLightingOverlay(hour)

  // Stable handler for the ops desk's deploy button — a fresh inline arrow on
  // every render would defeat PersonalDesk's React.memo for the ops desk.
  const handleDeployClick = useCallback(
    () => triggerInteractiveEvent(useOfficeStore, 'deploy-success'),
    []
  )

  // Panel mode: auto-adapt viewBox to container shape
  const isPanel = mode === 'panel'
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const [panelViewBox, setPanelViewBox] = useState('60 155 540 260')
  // Office is the primary view at every size; the roster is an opt-in MANUAL toggle (not size-based).
  const rosterMode = useOfficeStore((s) => s.rosterMode)
  // POINT 2: publish the office's live `meet` scale so AgentCharacter can counter-scale labels.
  const setSceneScale = useOfficeStore((s) => s.setSceneScale)
  // POINT 2: read it back too, to counter-scale the top event/workflow banner (its text is tiny).
  const sceneScale = useOfficeStore((s) => s.sceneScale)
  // Keep the top event/workflow banner (a single fontSize-9 pill) at a constant readable on-screen
  // size (~1.4× native) as the office shrinks. No overlap concern (one banner at the top edge), so
  // a simple target/clamp; it scales around its top-centre so it grows downward.
  const bannerScale = Math.min(2, Math.max(1, 1.4 / (sceneScale > 0 ? sceneScale : 1)))
  // Secondary labels (zone names, desk nameplates) — keep legible at a constant ~1.6× native on
  // screen as the office shrinks (capped so a tiny office doesn't blow them up). At desktop the
  // scale is ~1, so the wide view is essentially unchanged.
  const labelTextScale = Math.min(2.4, Math.max(1, 1.6 / (sceneScale > 0 ? sceneScale : 1)))

  const updateViewBox = useCallback(() => {
    if (!isPanel) return
    const el = containerRef.current
    if (!el) return
    const { clientWidth: w, clientHeight: h } = el
    if (w === 0 || h === 0) return
    const ratio = w / h
    // Panel (compact embed): its own intentional crops per container shape.
    const M = 20  // margin to prevent edge clipping of agents
    if (ratio < 1) setPanelViewBox(`${100 - M} ${130 - M} ${400 + M * 2} ${400 + M * 2}`)
    else if (ratio < 1.6) setPanelViewBox(`${60 - M} ${140 - M} ${540 + M * 2} ${340 + M * 2}`)
    else setPanelViewBox(`${60 - M} ${155 - M} ${540 + M * 2} ${260 + M * 2}`)
  }, [isPanel])

  // Only PANEL mode adapts its viewBox to the embed shape. The default office does NOT measure or
  // auto-switch — its view is a manual toggle (rosterMode) — which also means there is no resize-
  // driven state that could get stuck when the embedded preview throttles rAF/ResizeObserver.
  useEffect(() => {
    if (!isPanel) return
    const el = containerRef.current
    if (!el) return
    updateViewBox()
    const ro = new ResizeObserver(() => updateViewBox())
    ro.observe(el)
    const onWinResize = () => updateViewBox()
    window.addEventListener('resize', onWinResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onWinResize)
    }
  }, [updateViewBox, isPanel])

  // POINT 2: measure the default office's live on-screen scale (rendered svg box vs native
  // 800×560) and publish it so agent labels can counter-scale and stay readable as the office
  // shrinks. Direct measure (NO rAF wrapper) — the responsive saga showed rAF-driven measuring
  // sticks under the embedded webview's throttle. Panel mode keeps its own crops, so it does not
  // measure (labels there render native, unchanged). Depends on rosterMode because the svg is
  // unmounted while the roster widget shows — re-running re-attaches the observer on toggle-back.
  useEffect(() => {
    if (isPanel || rosterMode) return
    const el = svgRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSceneScale(computeSceneScale(r.width, r.height))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    // Self-heal poll: this embedded webview (Antigravity preview) throttles ResizeObserver and
    // the window 'resize' event on a LIVE pane drag — the initial observe fires, but a later
    // resize can leave sceneScale stale, so labels render at the wrong (often tiny) size. A
    // setInterval is clamped but never suspended like rAF/RO, so it re-measures and the scale
    // can't stay wrong for more than ~0.6s. setSceneScale no-ops when the value is unchanged,
    // so this poll is free except on an actual size change.
    const poll = setInterval(measure, 600)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      clearInterval(poll)
      // NOTE: deliberately do NOT reset sceneScale to 1 here. On a roster↔office toggle the
      // fresh effect's measure() overwrites it on remount, and the roster view ignores it — a
      // reset would only flash labels to native size for one frame before re-measuring.
    }
  }, [isPanel, rosterMode, setSceneScale])

  const viewBox = isPanel ? panelViewBox : '0 0 800 560'
  // #47: publish the active viewBox x-bounds (minX, width) so BehaviorBubble clamps speech bubbles
  // to the VISIBLE edges in BOTH default (0..800) and panel (cropped) modes — a hardcoded 0..800
  // clamp would target the wrong edges in panel mode and let bubbles clip the crop.
  const setSceneBounds = useOfficeStore((s) => s.setSceneBounds)
  useEffect(() => {
    const parts = viewBox.split(/\s+/).map(Number)
    if (parts.length === 4 && Number.isFinite(parts[0]) && Number.isFinite(parts[2])) {
      setSceneBounds(parts[0], parts[2])
    }
  }, [viewBox, setSceneBounds])
  // Office (non-panel) FILLS THE WIDTH at every pane shape: the svg is width-driven via aspect-ratio
  // (800/560), so the scene ALWAYS spans the full browser width — no left/right whitespace, ever.
  // Its height follows the ratio; the wrapper centers + clips, so a wide-short pane trims the empty
  // ceiling/floor symmetrically (no side gaps) while a tall pane just gets vertical breathing room.
  // Panel mode keeps its own crop+fit (w-full h-full + meet).
  const svgStyle = isPanel ? {} : { aspectRatio: '800 / 560' }

  const svgElement = (
    <svg
      ref={svgRef}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className={isPanel ? 'w-full h-full' : 'w-full'}
      style={svgStyle}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.12" />
        </filter>
        {/* Night-time gradients (defined once, referenced by id) */}
        {DESK_DATA.map((d) => (
          <radialGradient key={`scr-${d.id}`} id={`scr-${d.id}`} cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#4af" stopOpacity="0.10" />
            <stop offset="60%" stopColor="#4af" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#4af" stopOpacity="0" />
          </radialGradient>
        ))}
        <radialGradient id="mtg-light" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE8B0" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#FFE8B0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lounge-light" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD090" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#FFD090" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ═══ BACKGROUND ═══ */}
      <rect width="800" height="560" fill="#3a3028" />

      {/* ═══ ZONE FLOORS ═══ */}
      {/* Entrance + Hallway (top, one continuous space) */}
      <rect x="10" y="10" width="588" height="128" fill="#D0C0A0" rx="2" />
      {/* Main Office */}
      <rect x="10" y="163" width="588" height="236" fill="#C8A878" />
      {/* Meeting Room */}
      <rect x="623" y="10" width="167" height="408" fill="#9898B0" />
      {/* Lounge */}
      <rect x="10" y="419" width="446" height="131" fill="#A8B898" />
      {/* Research */}
      <rect x="464" y="419" width="326" height="131" fill="#9898B0" />

      {/* ═══ THICK WALLS (with depth for windows/clock) ═══ */}
      {/* North wall (entrance/hallway ↔ main office, 25px thick) */}
      <rect x="10" y="138" width="588" height="25" fill="#5a4a3a" />
      <rect x="10" y="160" width="588" height="3" fill="#4a3a2a" opacity="0.5" />
      {/* South wall (main office ↔ lounge/research, 20px thick) */}
      <rect x="10" y="399" width="588" height="20" fill="#5a4a3a" />
      <rect x="10" y="399" width="588" height="3" fill="#4a3a2a" opacity="0.5" />
      {/* East wall (main office ↔ meeting room, 25px thick) */}
      <rect x="598" y="10" width="25" height="408" fill="#5a4a3a" />
      <rect x="598" y="10" width="3" height="408" fill="#4a3a2a" opacity="0.5" />
      {/* Lounge ↔ Research divider */}
      <rect x="456" y="419" width="8" height="131" fill="#5a4a3a" />

      {/* ═══ WINDOWS IN NORTH WALL ═══ */}
      <WallWindow x={140} y={141} w={36} h={18} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={240} y={141} w={36} h={18} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={340} y={141} w={36} h={18} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={440} y={141} w={36} h={18} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      {/* Clock mounted on north wall — own subscription so the minute tick doesn't
          re-render the whole office */}
      <ClockWidget x={540} y={150} r={10} />

      {/* ═══ DOOR OPENINGS (cut through thick walls) ═══ */}
      {/* Entrance → Main Office (north wall) */}
      <rect x="88" y="138" width="52" height="25" fill="#C8A878" />
      <rect x="86" y="138" width="3" height="25" fill="#7a6a5a" />
      <rect x="139" y="138" width="3" height="25" fill="#7a6a5a" />
      {/* Main Office → Lounge (south wall, centered at x≈240) */}
      <rect x="213" y="399" width="55" height="20" fill="#A8B898" />
      <rect x="211" y="399" width="3" height="20" fill="#7a6a5a" />
      <rect x="267" y="399" width="3" height="20" fill="#7a6a5a" />
      {/* Main Office → Research (south wall, centered at x≈535) */}
      <rect x="508" y="399" width="55" height="20" fill="#9898B0" />
      <rect x="506" y="399" width="3" height="20" fill="#7a6a5a" />
      <rect x="562" y="399" width="3" height="20" fill="#7a6a5a" />
      {/* Main Office → Meeting Room (east wall) */}
      <rect x="598" y="185" width="25" height="50" fill="#9898B0" />
      <rect x="598" y="183" width="25" height="3" fill="#7a6a5a" />
      <rect x="598" y="234" width="25" height="3" fill="#7a6a5a" />

      {/* ═══ WALKING CORRIDORS ═══ */}
      <g opacity="0.05">
        <rect x="10" y="280" width="588" height="16" fill="#8a7a5a" />
        <rect x="68" y="163" width="20" height="236" fill="#8a7a5a" />
        <rect x="540" y="163" width="20" height="236" fill="#8a7a5a" />
      </g>

      {/* Floor grid (static, pre-built outside component) */}
      <g opacity="0.03">
        {GRID_LINES}
      </g>

      {/* Outer walls */}
      <rect x="0" y="0" width="800" height="10" fill="#2a2018" />
      <rect x="0" y="550" width="800" height="10" fill="#2a2018" />
      <rect x="0" y="0" width="10" height="560" fill="#2a2018" />
      <rect x="790" y="0" width="10" height="560" fill="#2a2018" />

      {/* ═══ ENTRANCE ═══ */}
      <WallWindow x={18} y={14} w={44} h={28} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={72} y={14} w={44} h={28} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <GateBooth x={100} y={90} />
      <Plant x={170} y={100} />
      <Plant x={170} y={50} />
      <rect x={65} y={120} width={70} height={12} rx={2} fill="#9B8B6B" opacity="0.7" />
      <text x={100} y={129} textAnchor="middle" fontSize="6.5" fill="#C8A878" fontFamily="monospace" opacity="0.85">WELCOME</text>

      {/* ═══ HALLWAY (connecting entrance to meeting room) ═══ */}
      <WallWindow x={250} y={14} w={44} h={28} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={350} y={14} w={44} h={28} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={450} y={14} w={44} h={28} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={550} y={14} w={44} h={28} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      {/* Notice board */}
      <rect x={220} y={55} width={50} height={35} rx={2} fill="#8B7355" stroke="#6B5335" strokeWidth="1" />
      <rect x={223} y={58} width={10} height={7} fill="#FFE066" />
      <rect x={236} y={58} width={10} height={7} fill="#FF9E9E" />
      <rect x={223} y={68} width={10} height={7} fill="#A8E6CF" />
      <rect x={236} y={68} width={10} height={7} fill="#87CEEB" />
      <text x={245} y={87} textAnchor="middle" fontSize="6" fill="#8B7355" fontFamily="monospace" opacity="0.7">NOTICE</text>
      {/* Coat rack */}
      <line x1={400} y1={50} x2={400} y2={80} stroke="#6B5335" strokeWidth="2" />
      <circle cx={400} cy={47} r={3} fill="#6B5335" />
      <line x1={393} y1={55} x2={407} y2={55} stroke="#6B5335" strokeWidth="1.5" />
      <Plant x={500} y={55} />
      <Plant x={500} y={105} />

      {/* Night sky visible through windows */}
      <NightSky hour={hour} />

      {/* ═══ MAIN OFFICE ═══ */}
      {/* SHIP IT poster on north wall interior */}
      <rect x={15} y={170} width={50} height={28} rx={2} fill="#F5F0E0" stroke="#CCC" strokeWidth="0.8" />
      <text x={40} y={184} textAnchor="middle" fontSize="7" fill="#7F77DD" fontFamily="monospace">SHIP IT</text>
      <text x={40} y={194} textAnchor="middle" fontSize="6" fill="#888" fontFamily="monospace">everyday</text>

      {/* Sprint Kanban board on north wall, planning area (clear of door at x=88-140) */}
      <SprintKanban x={160} y={165} doneCount={totalDoneToday} />

      {/* Team area labels — faint opacity-0.4 BACKGROUND text that sits among the desks. Left at
          native size (NOT counter-scaled): enlarging them collides with the desk nameplates in the
          dense desk cluster (跑版). The desk nameplates below carry the readable "who sits here". */}
      <text x={200} y={200} textAnchor="middle" fontSize="7" fill="#378ADD" fontFamily="monospace" opacity="0.4">PLANNING</text>
      <text x={460} y={200} textAnchor="middle" fontSize="7" fill="#BA7517" fontFamily="monospace" opacity="0.4">REVIEW</text>
      <text x={400} y={310} textAnchor="middle" fontSize="7" fill="#1D9E75" fontFamily="monospace" opacity="0.4">ENGINEERING</text>

      {/* Personalized desks */}
      {DESK_DATA.map((d) => (
        <PersonalDesk
          key={d.id}
          x={d.x} y={d.y}
          label={d.label}
          color={d.color}
          variant={d.variant}
          coffeeCount={coffeeCountMap[d.id] || 0}
          stickyCount={stickyCountMap[d.id] || 0}
          booksCount={booksCountMap[d.id] || 0}
          onDeployClick={d.id === 'ops' ? handleDeployClick : undefined}
          labelScale={labelTextScale}
        />
      ))}

      {/* Whiteboard (left of east wall) — clickable triggers eureka */}
      <g style={{ cursor: 'pointer' }} onClick={() => triggerInteractiveEvent(useOfficeStore, 'eureka')}>
        <Whiteboard x={535} y={300} w={55} h={40} />
      </g>
      <Plant x={22} y={385} />
      <Plant x={575} y={385} />
      <Plant x={22} y={290} />

      {/* ═══ MEETING ROOM ═══ */}
      <ScaledText x={705} y={26} scale={labelTextScale} textAnchor="middle" fontSize="8" fill="#7070A0" fontFamily="monospace" opacity="0.7">MEETING</ScaledText>
      <Rug x={633} y={70} w={148} h={120} color="#7070A0" />
      <MeetingTable x={705} y={162} w={100} h={60} />
      <Plant x={630} y={55} />
      <Plant x={782} y={55} />
      <WallWindow x={632} y={14} w={44} h={26} hour={hour} weather={weather} reducedMotion={weatherReduced} />
      <WallWindow x={696} y={14} w={44} h={26} hour={hour} weather={weather} reducedMotion={weatherReduced} />

      {/* ═══ RESEARCH ═══ */}
      <ScaledText x={700} y={432} scale={labelTextScale} textAnchor="middle" fontSize="7" fill="#6060A0" fontFamily="monospace" opacity="0.7">RESEARCH</ScaledText>
      {/* Bookshelves along south outer wall, away from door */}
      <Bookshelf x={470} y={440} width={65} rows={2} />
      <Bookshelf x={625} y={440} width={65} rows={2} />
      <Bookshelf x={700} y={440} width={65} rows={2} />
      <ServerRack x={770} y={442} />
      <Plant x={788} y={540} />

      {/* ═══ LOUNGE ═══ */}
      <ScaledText x={120} y={432} scale={labelTextScale} textAnchor="middle" fontSize="7" fill="#507050" fontFamily="monospace" opacity="0.7">LOUNGE</ScaledText>
      <Rug x={50} y={440} w={180} h={95} color="#507050" />
      <Couch x={55} y={450} width={90} color="#7B8FA1" />
      <RoundTable x={175} y={490} r={22} />
      <g style={{ cursor: 'pointer' }} onClick={() => triggerInteractiveEvent(useOfficeStore, 'tea-break')}>
        <CoffeeMachine x={20} y={445} />
      </g>
      <WaterCooler x={48} y={448} />
      {/* Bookshelf (single, away from WC and doors) */}
      <Bookshelf x={280} y={520} width={60} rows={1} />
      <Plant x={430} y={430} />
      <Plant x={17} y={540} />
      {/* Vending machine */}
      <rect x={22} y={505} width={18} height={22} rx={2} fill="#888" stroke="#666" strokeWidth="0.8" />
      <rect x={24} y={507} width={14} height={18} rx={1} fill="#AAA" />
      <circle cx={36} cy={516} r={1.5} fill="#444" />
      {/* Toilet / WC (bigger) */}
      <g>
        <rect x={340} y={445} width={80} height={55} rx={4} fill="#C8D8C0" stroke="#8A9A7A" strokeWidth="1" />
        <text x={380} y={458} textAnchor="middle" fontSize="7" fill="#5A6A4A" fontFamily="monospace" fontWeight="bold" opacity="0.8">WC</text>
        {/* Toilet stalls */}
        <rect x={348} y={465} width={18} height={14} rx={2} fill="#E8E0D0" stroke="#BBB" strokeWidth="0.5" />
        <rect x={370} y={465} width={18} height={14} rx={2} fill="#E8E0D0" stroke="#BBB" strokeWidth="0.5" />
        {/* Sink */}
        <rect x={395} y={465} width={18} height={10} rx={2} fill="#DDE8F0" stroke="#AAC" strokeWidth="0.5" />
        <circle cx={404} cy={470} r={2} fill="#88AACC" />
        {/* Mirror */}
        <rect x={396} y={460} width={16} height={4} rx={1} fill="#B0D0E8" stroke="#8AB" strokeWidth="0.3" />
        {/* Door line */}
        <line x1={340} y1={485} x2={420} y2={485} stroke="#8A9A7A" strokeWidth="0.5" opacity="0.5" />
        <text x={380} y={495} textAnchor="middle" fontSize="4" fill="#7A8A6A" fontFamily="monospace" opacity="0.6">🚻</text>
      </g>
      {/* Phone booth */}
      <g>
        <rect x={735} y={455} width={45} height={45} rx={4} fill="#8888AA" stroke="#6666AA" strokeWidth="1" />
        <text x={758} y={470} textAnchor="middle" fontSize="6" fill="#BBBBDD" fontFamily="monospace" fontWeight="bold" opacity="0.9">PHONE</text>
        {/* Phone on wall */}
        <rect x={745} y={478} width={14} height={16} rx={2} fill="#666688" />
        <circle cx={752} cy={485} r={4} fill="#555577" />
        <rect x={749} y={482} width={6} height={2} rx={1} fill="#7777AA" />
        {/* Receiver */}
        <line x1={748} y1={478} x2={756} y2={478} stroke="#AAAACC" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <Printer x={600} y={495} />

      {/* ═══ CONNECTION HINT (shown until first external status is received) ═══ */}
      {!hasEverReceivedStatus && (
        <g className="animate-pulse" opacity="0.85" pointerEvents="none">
          <text x="400" y="28" textAnchor="middle" fontSize="11" fill="#d4c8a0" fontFamily="monospace">
            {t('hint.noConnection')}
          </text>
        </g>
      )}

      {/* ═══ OFFICE PET ═══ (#39 — ambient cat; signal-driven barometer. Painted behind agents so
          they naturally occlude it when overlapping. Renders nothing when toggled off.) */}
      <OfficePet />

      {/* ═══ SUBAGENT HELPER HUDDLES ═══ (capped helper figures — painted BEHIND the agents
          so the full-size lead is never clipped by its own helpers; they trail the lead's live pos) */}
      <HelperHuddles />

      {/* ═══ AGENTS ═══ */}
      {agentList.map((agent) => (
        <AgentCharacter key={agent.id} agent={agent} />
      ))}

      {/* ═══ SPECIAL EVENT CHARACTERS ═══ */}
      {activeEvent?.id === 'boss-visit' && <WalkingBoss />}
      {activeEvent?.id === 'dog-visit' && <OfficeDog />}

      {/* ═══ FLYING DOCUMENTS (handoff animation) ═══ */}
      <FlyingDocuments />
      <WhiteboardAnimation />

      {/* ═══ AGENT INSPECTOR (click-to-inspect popover) ═══ */}
      <AgentInspector />

      {/* ═══ LIGHTING ═══ */}
      {lightOverlay.opacity > 0 && (
        <rect x="0" y="0" width="800" height="560"
          fill={lightOverlay.fill} opacity={lightOverlay.opacity} pointerEvents="none" />
      )}

      {/* ═══ NIGHT EFFECTS ═══ */}
      {hour >= 19 && (
        <g pointerEvents="none">
          {/* Monitor screen glow on desks (gradients defined in <defs>) */}
          {DESK_DATA.map((d) => (
            <ellipse key={`glow-${d.id}`} cx={d.x} cy={d.y - 8} rx={32} ry={22} fill={`url(#scr-${d.id})`} />
          ))}
          {/* Desk lamps (warm glow) */}
          {DESK_DATA.map((d) => (
            <DeskLamp key={`lamp-${d.id}`} x={d.x + 22} y={d.y - 14} on />
          ))}
          {/* Meeting room ceiling light */}
          <ellipse cx={705} cy={162} rx={60} ry={45} fill="url(#mtg-light)" />
          {/* Lounge ambient warm light */}
          <ellipse cx={120} cy={480} rx={80} ry={50} fill="url(#lounge-light)" />
          {/* Late-night OVERTIME indicator (office clock hour ≥ 22). Declutter/calm-tech: a persistent
              CONDITION (it's late) gets a STEADY, muted chip — NOT the old infinite red pulse, which
              read as an alarm that re-fired the eye every 2s. The night lighting already signals late;
              this is a quiet confirmation, not a warning. (Red is reserved for real blocked state.) */}
          {hour >= 22 && (
            <g opacity="0.6">
              <rect x={485} y={142} width={45} height={14} rx={7} fill="#6B5335" />
              <text x={507} y={149} textAnchor="middle" dominantBaseline="middle" fontSize="6.5" fill="#E8D8B0" fontFamily="monospace" fontWeight="bold">
                OVERTIME
              </text>
            </g>
          )}
        </g>
      )}

      {/* ═══ EVENT / WORKFLOW BANNER ═══ */}
      {(activeEvent || activeWorkflow) && (
        <g pointerEvents="none" transform={`translate(400, 2) scale(${bannerScale}) translate(-400, -2)`}>
          <rect x={250} y={2} width={300} height={26} rx={13}
            fill={activeWorkflow ? '#E8F5E9' : '#FFF8E1'}
            stroke={activeWorkflow ? '#4CAF50' : '#F5C842'}
            strokeWidth="1.5" opacity="0.95"
          >
            <animate attributeName="opacity" values="0;0.95" dur="0.4s" fill="freeze" />
          </rect>
          <circle cx={268} cy={15} r={4} fill={activeWorkflow ? '#4CAF50' : '#F5C842'}>
            <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <text x={400} y={16} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontFamily="monospace" fontWeight="bold"
            fill={activeWorkflow ? '#2E7D32' : '#8B6914'}
          >
            {activeWorkflow || (activeEvent?.id ? eventName(activeEvent.id) : activeEvent?.name)}
          </text>
          {activeWorkflow && (
            <g transform="translate(535, 6)">
              <rect x={0} y={4} width={4} height={8} rx={2} fill="#378ADD" />
              <circle cx={2} cy={3} r={3} fill="#555" />
              <circle cx={2} cy={3} r={2} fill="#777" />
              <line x1={2} y1={12} x2={2} y2={16} stroke="#888" strokeWidth="0.8" />
              <line x1={0} y1={16} x2={4} y2={16} stroke="#888" strokeWidth="0.8" />
              <path d="M6,1 Q8,-1 6,3" fill="none" stroke="#4CAF50" strokeWidth="0.5" opacity="0.6">
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" />
              </path>
              <path d="M8,0 Q11,-2 8,4" fill="none" stroke="#4CAF50" strokeWidth="0.4" opacity="0.4">
                <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.2s" repeatCount="indefinite" />
              </path>
            </g>
          )}
        </g>
      )}
    </svg>
  )

  if (isPanel) {
    return (
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {svgElement}
      </div>
    )
  }

  // Office-primary: the full scene by default at every size. The roster is shown ONLY when the user
  // manually toggles it (store.rosterMode) — an optional lens, never an automatic size-based switch.
  // Office branch CENTERS + CLIPS: the width-driven svg spans the full width, so vertical overflow on
  // a wide-short pane is clipped symmetrically (no left/right whitespace) and vertical slack on a tall
  // pane is centered. Roster branch keeps its own internal scroll.
  return rosterMode ? (
    <div ref={containerRef} className="w-full flex-1 overflow-hidden min-h-0">
      <NarrowRoster />
    </div>
  ) : (
    <div ref={containerRef} className="w-full flex-1 overflow-hidden min-h-0 flex items-center justify-center">
      {svgElement}
    </div>
  )
}
