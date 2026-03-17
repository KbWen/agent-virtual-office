import React, { useEffect } from 'react'
import { useOfficeStore } from '../systems/store'
import { startOfficeLife } from '../systems/officeLife'
import AgentCharacter from './AgentCharacter'
import {
  Plant, Whiteboard, CoffeeMachine, GateBooth, Printer, Window,
} from './OfficeFurniture'

function getLighting(hour) {
  if (hour >= 7 && hour < 9) return { color: '#FFD093', opacity: 0.08 }
  if (hour >= 9 && hour < 17) return { color: '#FFFFFF', opacity: 0.02 }
  if (hour >= 17 && hour < 19) return { color: '#FF8844', opacity: 0.1 }
  if (hour >= 19 && hour < 23) return { color: '#334466', opacity: 0.2 }
  return { color: '#1A1A2E', opacity: 0.35 }
}

export default function IsometricOffice() {
  const agents = useOfficeStore((s) => s.agents)
  const hour = useOfficeStore((s) => s.hour)

  useEffect(() => {
    const cleanup = startOfficeLife(useOfficeStore)
    return cleanup
  }, [])

  const agentList = Object.values(agents)
  const lighting = getLighting(hour)

  // Dark mode detection
  const isDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

  // Floor and wall colors
  const floorColor = isDark ? '#3A3832' : '#E8E4D8'
  const leftWallColor = isDark ? '#4A4842' : '#D4CFC3'
  const rightWallColor = isDark ? '#3E3C36' : '#C5C0B4'
  const ceilingLine = isDark ? '#555' : '#BBB'

  return (
    <svg
      viewBox="0 0 680 520"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      style={{ maxHeight: 'calc(100vh - 40px)' }}
    >
      <defs>
        {/* Bubble shadow filter */}
        <filter id="bubble-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.1" />
        </filter>
        {/* Subtle texture */}
        <pattern id="floor-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="none" />
          <line x1="0" y1="10" x2="20" y2="10" stroke={isDark ? '#444' : '#DDD'} strokeWidth="0.3" opacity="0.3" />
          <line x1="10" y1="0" x2="10" y2="20" stroke={isDark ? '#444' : '#DDD'} strokeWidth="0.3" opacity="0.3" />
        </pattern>
      </defs>

      {/* Background */}
      <rect width="680" height="520" fill={isDark ? '#2A2824' : '#F5F2EB'} />

      {/* Left wall */}
      <rect x="20" y="20" width="640" height="100" fill={leftWallColor} />
      {/* Baseboard */}
      <rect x="20" y="115" width="640" height="5" fill={isDark ? '#555' : '#B8B3A7'} />

      {/* Floor */}
      <rect x="20" y="120" width="640" height="380" fill={floorColor} />
      <rect x="20" y="120" width="640" height="380" fill="url(#floor-pattern)" />

      {/* Ceiling line */}
      <line x1="20" y1="20" x2="660" y2="20" stroke={ceilingLine} strokeWidth="1" />

      {/* Window */}
      <Window x={80} y={35} hour={hour} />

      {/* Whiteboard */}
      <Whiteboard x={350} y={30} />

      {/* Wall decorations - clock */}
      <g>
        <circle cx={260} cy={55} r={12} fill="white" stroke="#AAA" strokeWidth="1" />
        <circle cx={260} cy={55} r={0.8} fill="#333" />
        {/* Hour hand */}
        <line x1={260} y1={55} x2={260 + Math.sin(hour / 12 * Math.PI * 2) * 6}
          y2={55 - Math.cos(hour / 12 * Math.PI * 2) * 6} stroke="#333" strokeWidth="1" />
        {/* Minute hand */}
        <line x1={260} y1={55}
          x2={260 + Math.sin(useOfficeStore.getState().minute / 60 * Math.PI * 2) * 8}
          y2={55 - Math.cos(useOfficeStore.getState().minute / 60 * Math.PI * 2) * 8}
          stroke="#666" strokeWidth="0.6" />
      </g>

      {/* Coffee machine */}
      <CoffeeMachine x={560} y={130} />

      {/* Plants */}
      <Plant x={50} y={460} />
      <Plant x={630} y={145} />

      {/* Printer */}
      <Printer x={590} y={440} />

      {/* Gate booth (for 門神) */}
      <GateBooth x={80} y={430} />

      {/* Agents */}
      {agentList.map((agent) => (
        <AgentCharacter key={agent.id} agent={agent} />
      ))}

      {/* Lighting overlay */}
      <rect
        x="20" y="20" width="640" height="480"
        fill={lighting.color}
        opacity={lighting.opacity}
        pointerEvents="none"
      />

      {/* Night mode: screen glow */}
      {hour >= 19 && agentList.map((agent) => (
        <circle
          key={`glow-${agent.id}`}
          cx={agent.position.x + 2}
          cy={agent.position.y - 16}
          r={20}
          fill="#5ca"
          opacity="0.03"
        />
      ))}
    </svg>
  )
}
