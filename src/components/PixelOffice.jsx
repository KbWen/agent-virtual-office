import React, { useEffect } from 'react'
import { useOfficeStore } from '../systems/store'
import { startOfficeLife } from '../systems/officeLife'
import AgentCharacter from './AgentCharacter'
import {
  Desk, Bookshelf, Plant, Couch, RoundTable, MeetingTable,
  CoffeeMachine, WaterCooler, GateBooth, WallWindow, Whiteboard,
  ServerRack, Clock, Printer, Rug, CoffeeCup
} from './TopDownFurniture'

// ─── Flying Document Animation ──────────────────────────────────────────
function FlyingDocument({ fromPos, toPos, onComplete }) {
  const [progress, setProgress] = React.useState(0)
  const rafRef = React.useRef(null)
  const startRef = React.useRef(null)
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
        onComplete?.()
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [onComplete])

  // Parabolic arc: x linear, y with arc
  const x = fromPos.x + (toPos.x - fromPos.x) * progress
  const arcHeight = -60 * Math.sin(progress * Math.PI)  // arc up
  const y = fromPos.y + (toPos.y - fromPos.y) * progress + arcHeight

  // Slight rotation during flight
  const rotation = progress * 360

  return (
    <g transform={`translate(${x}, ${y - 20})`} opacity={1 - progress * 0.3}>
      {/* Paper document */}
      <g transform={`rotate(${rotation * 0.3}, 0, 0) scale(${1 + Math.sin(progress * Math.PI) * 0.3})`}>
        <rect x={-5} y={-6} width={10} height={12} rx={1} fill="white" stroke="#CCC" strokeWidth="0.5" />
        <line x1={-3} y1={-3} x2={3} y2={-3} stroke="#AAA" strokeWidth="0.5" />
        <line x1={-3} y1={-1} x2={3} y2={-1} stroke="#AAA" strokeWidth="0.5" />
        <line x1={-3} y1={1} x2={2} y2={1} stroke="#AAA" strokeWidth="0.5" />
        <line x1={-3} y1={3} x2={3} y2={3} stroke="#DDD" strokeWidth="0.5" />
      </g>
      {/* Sparkle trail */}
      {progress > 0.1 && progress < 0.9 && (
        <>
          <circle cx={-8} cy={3} r={1.5} fill="#FFD700" opacity={0.6 * (1 - progress)} />
          <circle cx={-12} cy={6} r={1} fill="#FFD700" opacity={0.4 * (1 - progress)} />
        </>
      )}
    </g>
  )
}

function FlyingDocuments() {
  const handoffs = useOfficeStore((s) => s.handoffs)
  const agents = useOfficeStore((s) => s.agents)

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
        onComplete={() => useOfficeStore.getState().removeHandoff(h.id)}
      />
    )
  })
}

function getLightingOverlay(hour) {
  if (hour >= 20) return { fill: '#0a0a2e', opacity: 0.38 }
  if (hour >= 18) return { fill: '#1a1040', opacity: 0.22 }
  if (hour >= 17) return { fill: '#ff6622', opacity: 0.08 }
  if (hour >= 9 && hour < 17) return { fill: '#fff', opacity: 0.0 }
  if (hour >= 7) return { fill: '#ffd080', opacity: 0.07 }
  return { fill: '#000', opacity: 0.5 }
}

function sortByY(agents) {
  return [...agents].sort((a, b) => {
    const ay = (a.targetPosition || a.position || {}).y || 0
    const by = (b.targetPosition || b.position || {}).y || 0
    return ay - by
  })
}

// ─── Personalized desk with character-specific items ─────────────────────
function PersonalDesk({ x, y, label, color, variant, coffeeCount = 0 }) {
  const W = 60, H = 38
  return (
    <g>
      {/* Desk label (character name) */}
      <text x={x} y={y - H / 2 - 4} textAnchor="middle" fontSize="6" fill={color} fontFamily="monospace" fontWeight="bold" opacity="0.7">{label}</text>

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
          {coffeeCount >= 1 && <CoffeeCup x={x + 20} y={y + 8} />}
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
          <circle cx={x + 20} cy={y + 4} r={7} fill="#CC3333" stroke="#AA2222" strokeWidth="1" />
          <circle cx={x + 20} cy={y + 3} r={5} fill="#E24B4A" />
          <text x={x + 20} y={y + 5} textAnchor="middle" fontSize="3.5" fill="white" fontFamily="monospace" fontWeight="bold">GO</text>
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

      {/* Extra coffee cups from behavior */}
      {variant !== 'dev' && coffeeCount >= 1 && <CoffeeCup x={x + 20} y={y + 6} />}
      {coffeeCount >= 2 && <CoffeeCup x={x + 24} y={y - 2} steaming={false} />}
    </g>
  )
}

export default function PixelOffice({ animationQuality = 'full' }) {
  const agents = useOfficeStore((s) => s.agents)
  const hour = useOfficeStore((s) => s.hour)
  const minute = useOfficeStore((s) => s.minute)
  const activeEvent = useOfficeStore((s) => s.activeEvent)

  useEffect(() => {
    const cleanup = startOfficeLife(useOfficeStore)
    return cleanup
  }, [])

  const agentList = sortByY(Object.values(agents))
  const lightOverlay = getLightingOverlay(hour)

  // Individual desk positions matching WAYPOINTS
  const deskData = [
    { id: 'pm',   x: 140, y: 240, label: 'PM',     color: '#378ADD', variant: 'pm' },
    { id: 'arch', x: 260, y: 240, label: 'Arch',    color: '#7F77DD', variant: 'arch' },
    { id: 'qa',   x: 400, y: 220, label: 'QA',      color: '#BA7517', variant: 'qa' },
    { id: 'res',  x: 520, y: 220, label: 'Research', color: '#5DCAA5', variant: 'res' },
    { id: 'dev',  x: 340, y: 340, label: 'Dev',     color: '#1D9E75', variant: 'dev' },
    { id: 'ops',  x: 460, y: 340, label: 'Ops',     color: '#D85A30', variant: 'ops' },
  ]

  return (
    <svg
      viewBox="0 0 800 560"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      style={{ maxHeight: 'calc(100vh - 44px)' }}
    >
      <defs>
        <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.12" />
        </filter>
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
      <WallWindow x={140} y={141} w={36} h={18} hour={hour} />
      <WallWindow x={240} y={141} w={36} h={18} hour={hour} />
      <WallWindow x={340} y={141} w={36} h={18} hour={hour} />
      <WallWindow x={440} y={141} w={36} h={18} hour={hour} />
      {/* Clock mounted on north wall */}
      <Clock x={540} y={150} r={10} hour={hour} minute={minute} />

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

      {/* Floor grid */}
      <g opacity="0.03">
        {[...Array(29)].map((_, i) => <line key={`h${i}`} x1="10" y1={163 + i * 8} x2="598" y2={163 + i * 8} stroke="#000" strokeWidth="0.5" />)}
        {[...Array(74)].map((_, i) => <line key={`v${i}`} x1={10 + i * 8} y1="163" x2={10 + i * 8} y2="399" stroke="#000" strokeWidth="0.5" />)}
      </g>

      {/* Outer walls */}
      <rect x="0" y="0" width="800" height="10" fill="#2a2018" />
      <rect x="0" y="550" width="800" height="10" fill="#2a2018" />
      <rect x="0" y="0" width="10" height="560" fill="#2a2018" />
      <rect x="790" y="0" width="10" height="560" fill="#2a2018" />

      {/* ═══ ENTRANCE ═══ */}
      <WallWindow x={18} y={14} w={44} h={28} hour={hour} />
      <WallWindow x={72} y={14} w={44} h={28} hour={hour} />
      <GateBooth x={100} y={90} />
      <Plant x={170} y={100} />
      <Plant x={170} y={50} />
      <rect x={65} y={120} width={70} height={12} rx={2} fill="#9B8B6B" opacity="0.7" />
      <text x={100} y={129} textAnchor="middle" fontSize="5" fill="#C8A878" fontFamily="monospace" opacity="0.8">WELCOME</text>

      {/* ═══ HALLWAY (connecting entrance to meeting room) ═══ */}
      <WallWindow x={250} y={14} w={44} h={28} hour={hour} />
      <WallWindow x={350} y={14} w={44} h={28} hour={hour} />
      <WallWindow x={450} y={14} w={44} h={28} hour={hour} />
      <WallWindow x={550} y={14} w={44} h={28} hour={hour} />
      {/* Notice board */}
      <rect x={220} y={55} width={50} height={35} rx={2} fill="#8B7355" stroke="#6B5335" strokeWidth="1" />
      <rect x={223} y={58} width={10} height={7} fill="#FFE066" />
      <rect x={236} y={58} width={10} height={7} fill="#FF9E9E" />
      <rect x={223} y={68} width={10} height={7} fill="#A8E6CF" />
      <rect x={236} y={68} width={10} height={7} fill="#87CEEB" />
      <text x={245} y={87} textAnchor="middle" fontSize="4" fill="#8B7355" fontFamily="monospace" opacity="0.6">NOTICE</text>
      {/* Coat rack */}
      <line x1={400} y1={50} x2={400} y2={80} stroke="#6B5335" strokeWidth="2" />
      <circle cx={400} cy={47} r={3} fill="#6B5335" />
      <line x1={393} y1={55} x2={407} y2={55} stroke="#6B5335" strokeWidth="1.5" />
      <Plant x={500} y={55} />
      <Plant x={500} y={105} />

      {/* ═══ MAIN OFFICE ═══ */}
      {/* SHIP IT poster on north wall interior */}
      <rect x={15} y={170} width={50} height={28} rx={2} fill="#F5F0E0" stroke="#CCC" strokeWidth="0.8" />
      <text x={40} y={184} textAnchor="middle" fontSize="5.5" fill="#7F77DD" fontFamily="monospace">SHIP IT</text>
      <text x={40} y={193} textAnchor="middle" fontSize="4.5" fill="#888" fontFamily="monospace">everyday</text>

      {/* Team area labels */}
      <text x={200} y={200} textAnchor="middle" fontSize="7" fill="#378ADD" fontFamily="monospace" opacity="0.4">PLANNING</text>
      <text x={460} y={200} textAnchor="middle" fontSize="7" fill="#BA7517" fontFamily="monospace" opacity="0.4">REVIEW</text>
      <text x={400} y={310} textAnchor="middle" fontSize="7" fill="#1D9E75" fontFamily="monospace" opacity="0.4">ENGINEERING</text>

      {/* Personalized desks */}
      {deskData.map((d) => (
        <PersonalDesk
          key={d.id}
          x={d.x} y={d.y}
          label={d.label}
          color={d.color}
          variant={d.variant}
          coffeeCount={agents[d.id]?.deskItemCount?.coffee || 0}
        />
      ))}

      {/* Whiteboard (left of east wall) */}
      <Whiteboard x={535} y={300} w={55} h={40} />
      <Plant x={22} y={385} />
      <Plant x={575} y={385} />
      <Plant x={22} y={290} />

      {/* ═══ MEETING ROOM ═══ */}
      <text x={705} y={26} textAnchor="middle" fontSize="8" fill="#7070A0" fontFamily="monospace" opacity="0.7">MEETING</text>
      <Rug x={633} y={70} w={148} h={120} color="#7070A0" />
      <MeetingTable x={705} y={162} w={100} h={60} />
      <Plant x={630} y={55} />
      <Plant x={782} y={55} />
      <WallWindow x={632} y={14} w={44} h={26} hour={hour} />
      <WallWindow x={696} y={14} w={44} h={26} hour={hour} />

      {/* ═══ RESEARCH ═══ */}
      <text x={700} y={432} textAnchor="middle" fontSize="7" fill="#6060A0" fontFamily="monospace" opacity="0.7">RESEARCH</text>
      {/* Bookshelves along south outer wall, away from door */}
      <Bookshelf x={470} y={440} width={65} rows={2} />
      <Bookshelf x={625} y={440} width={65} rows={2} />
      <Bookshelf x={700} y={440} width={65} rows={2} />
      <ServerRack x={770} y={442} />
      <Plant x={788} y={540} />

      {/* ═══ LOUNGE ═══ */}
      <text x={120} y={432} textAnchor="middle" fontSize="7" fill="#507050" fontFamily="monospace" opacity="0.7">LOUNGE</text>
      <Rug x={50} y={440} w={180} h={95} color="#507050" />
      <Couch x={55} y={450} width={90} color="#7B8FA1" />
      <RoundTable x={175} y={490} r={22} />
      <CoffeeMachine x={20} y={445} />
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

      {/* ═══ AGENTS ═══ */}
      {agentList.map((agent) => (
        <AgentCharacter key={agent.id} agent={agent} />
      ))}

      {/* ═══ FLYING DOCUMENTS (handoff animation) ═══ */}
      <FlyingDocuments />

      {/* ═══ LIGHTING ═══ */}
      {lightOverlay.opacity > 0 && (
        <rect x="0" y="0" width="800" height="560"
          fill={lightOverlay.fill} opacity={lightOverlay.opacity} pointerEvents="none" />
      )}

      {/* Night screen glow */}
      {hour >= 19 && deskData.map((d) => (
        <g key={`glow-${d.id}`}>
          <radialGradient id={`glow-${d.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4af" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#4af" stopOpacity="0" />
          </radialGradient>
          <ellipse cx={d.x} cy={d.y - 5} rx={30} ry={20} fill={`url(#glow-${d.id})`} pointerEvents="none" />
        </g>
      ))}

      {/* ═══ EVENT BANNER ═══ */}
      {activeEvent && (
        <g pointerEvents="none">
          <rect x={280} y={4} width={240} height={22} rx={11} fill="#FFF8E1" stroke="#F5C842" strokeWidth="1" opacity="0.95">
            <animate attributeName="opacity" values="0;0.95" dur="0.4s" fill="freeze" />
          </rect>
          <circle cx={296} cy={15} r={4} fill="#F5C842">
            <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <text x={400} y={16} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontFamily="monospace" fontWeight="bold" fill="#8B6914"
          >
            {activeEvent.name}
          </text>
        </g>
      )}
    </svg>
  )
}
