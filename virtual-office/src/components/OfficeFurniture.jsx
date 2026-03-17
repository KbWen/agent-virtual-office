import React from 'react'

// Isometric desk at given position
export function Desk({ x, y, color = '#A0785A' }) {
  const w = 56, h = 18, d = 32
  // top face (rhombus)
  const top = `M${x},${y - d / 2} L${x + w / 2},${y} L${x},${y + d / 2} L${x - w / 2},${y} Z`
  // left face
  const left = `M${x - w / 2},${y} L${x},${y + d / 2} L${x},${y + d / 2 + h} L${x - w / 2},${y + h} Z`
  // right face
  const right = `M${x + w / 2},${y} L${x},${y + d / 2} L${x},${y + d / 2 + h} L${x + w / 2},${y + h} Z`

  return (
    <g className="desk">
      <path d={top} fill={color} stroke="#8B6548" strokeWidth="0.5" />
      <path d={left} fill="#8B6548" stroke="#7A5638" strokeWidth="0.5" />
      <path d={right} fill="#967052" stroke="#7A5638" strokeWidth="0.5" />
    </g>
  )
}

// Monitor on desk
export function Monitor({ x, y, screenOn = true }) {
  return (
    <g className="monitor">
      {/* Screen */}
      <rect x={x - 8} y={y - 18} width={16} height={12} rx={1}
        fill={screenOn ? '#1a2a3a' : '#333'} stroke="#555" strokeWidth="0.5" />
      {screenOn && (
        <>
          <rect x={x - 6} y={y - 16} width={12} height={8} rx={0.5} fill="#2d4a5e" opacity="0.9" />
          {/* Screen glow lines */}
          <line x1={x - 5} y1={y - 14} x2={x + 3} y2={y - 14} stroke="#5ca" strokeWidth="0.5" opacity="0.6" />
          <line x1={x - 5} y1={y - 12} x2={x + 5} y2={y - 12} stroke="#5ac" strokeWidth="0.5" opacity="0.4" />
          <line x1={x - 5} y1={y - 10} x2={x + 1} y2={y - 10} stroke="#5ca" strokeWidth="0.5" opacity="0.5" />
        </>
      )}
      {/* Stand */}
      <rect x={x - 1.5} y={y - 6} width={3} height={4} fill="#666" />
      <rect x={x - 4} y={y - 2} width={8} height={1.5} rx={0.5} fill="#555" />
    </g>
  )
}

// Coffee cup
export function CoffeeCup({ x, y, steaming = true }) {
  return (
    <g className="coffee-cup">
      <rect x={x} y={y - 5} width={5} height={6} rx={1} fill="#F5E6D3" stroke="#D4C4B0" strokeWidth="0.4" />
      <path d={`M${x + 5},${y - 3} Q${x + 8},${y - 2} ${x + 5},${y - 1}`} fill="none" stroke="#D4C4B0" strokeWidth="0.5" />
      <ellipse cx={x + 2.5} cy={y - 5} rx={2.5} ry={1} fill="#6B4226" />
      {steaming && (
        <>
          <path d={`M${x + 1},${y - 7} Q${x + 2},${y - 9} ${x + 1},${y - 11}`}
            fill="none" stroke="#ccc" strokeWidth="0.4" opacity="0.5">
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
            <animate attributeName="d"
              values={`M${x + 1},${y - 7} Q${x + 2},${y - 9} ${x + 1},${y - 11};M${x + 1},${y - 7} Q${x},${y - 9} ${x + 1},${y - 11};M${x + 1},${y - 7} Q${x + 2},${y - 9} ${x + 1},${y - 11}`}
              dur="3s" repeatCount="indefinite" />
          </path>
          <path d={`M${x + 3},${y - 7} Q${x + 4},${y - 10} ${x + 3},${y - 12}`}
            fill="none" stroke="#ccc" strokeWidth="0.3" opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2.5s" repeatCount="indefinite" />
          </path>
        </>
      )}
    </g>
  )
}

// Plant pot
export function Plant({ x, y }) {
  return (
    <g className="plant">
      <rect x={x - 5} y={y - 3} width={10} height={8} rx={1} fill="#C4724B" stroke="#A55A3A" strokeWidth="0.5" />
      {/* Leaves */}
      <ellipse cx={x - 3} cy={y - 8} rx={4} ry={5} fill="#4CAF50" opacity="0.9" />
      <ellipse cx={x + 3} cy={y - 9} rx={3.5} ry={4.5} fill="#66BB6A" opacity="0.85" />
      <ellipse cx={x} cy={y - 11} rx={3} ry={4} fill="#43A047" opacity="0.9" />
    </g>
  )
}

// Whiteboard on wall
export function Whiteboard({ x, y }) {
  return (
    <g className="whiteboard">
      <rect x={x} y={y} width={50} height={35} rx={2} fill="#F8F8F0" stroke="#AAA" strokeWidth="1" />
      {/* Scribbles */}
      <line x1={x + 5} y1={y + 8} x2={x + 30} y2={y + 8} stroke="#378ADD" strokeWidth="1" opacity="0.6" />
      <line x1={x + 5} y1={y + 14} x2={x + 40} y2={y + 14} stroke="#7F77DD" strokeWidth="1" opacity="0.5" />
      <line x1={x + 5} y1={y + 20} x2={x + 25} y2={y + 20} stroke="#1D9E75" strokeWidth="1" opacity="0.6" />
      <rect x={x + 35} y={y + 5} width={8} height={5} fill="#FFE066" opacity="0.7" rx={0.5} />
      <rect x={x + 33} y={y + 22} width={8} height={5} fill="#FF9E9E" opacity="0.6" rx={0.5} />
    </g>
  )
}

// Coffee machine
export function CoffeeMachine({ x, y }) {
  return (
    <g className="coffee-machine">
      <rect x={x} y={y} width={14} height={20} rx={2} fill="#555" stroke="#444" strokeWidth="0.5" />
      <rect x={x + 2} y={y + 3} width={10} height={6} rx={1} fill="#333" />
      <circle cx={x + 7} cy={y + 14} r={2} fill="#E24B4A" opacity="0.8">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </circle>
      <rect x={x + 4} y={y + 18} width={6} height={3} rx={0.5} fill="#888" />
    </g>
  )
}

// Gate booth for 門神
export function GateBooth({ x, y }) {
  return (
    <g className="gate-booth">
      {/* Booth base */}
      <rect x={x - 12} y={y - 5} width={24} height={15} rx={2} fill="#666" stroke="#555" strokeWidth="0.5" />
      {/* Top bar */}
      <rect x={x - 15} y={y - 8} width={30} height={4} rx={1} fill="#E24B4A" />
      {/* Barrier arm */}
      <rect x={x + 12} y={y - 6} width={25} height={2} rx={1} fill="#E24B4A" stroke="#C43" strokeWidth="0.3">
        <animateTransform attributeName="transform" type="rotate"
          values="0 ${x + 12} ${y - 5};-45 ${x + 12} ${y - 5};0 ${x + 12} ${y - 5}"
          dur="8s" repeatCount="indefinite" />
      </rect>
    </g>
  )
}

// Printer
export function Printer({ x, y }) {
  return (
    <g className="printer">
      <rect x={x} y={y} width={16} height={10} rx={1.5} fill="#DDD" stroke="#BBB" strokeWidth="0.5" />
      <rect x={x + 2} y={y - 2} width={12} height={3} rx={1} fill="#CCC" />
      <rect x={x + 5} y={y + 8} width={6} height={3} fill="#F5F5F5" />
    </g>
  )
}

// Window on wall (changes with time)
export function Window({ x, y, hour = 12 }) {
  const skyColors = {
    morning: '#FFD093',
    day: '#87CEEB',
    sunset: '#FF8844',
    night: '#1a2a4a',
    midnight: '#0a0a1e',
  }

  let sky = skyColors.day
  if (hour >= 6 && hour < 9) sky = skyColors.morning
  else if (hour >= 9 && hour < 17) sky = skyColors.day
  else if (hour >= 17 && hour < 19) sky = skyColors.sunset
  else if (hour >= 19 && hour < 23) sky = skyColors.night
  else sky = skyColors.midnight

  return (
    <g className="window">
      <rect x={x} y={y} width={36} height={28} rx={2} fill={sky} stroke="#AAA" strokeWidth="1.5" />
      {/* Window cross */}
      <line x1={x + 18} y1={y} x2={x + 18} y2={y + 28} stroke="#CCC" strokeWidth="1" />
      <line x1={x} y1={y + 14} x2={x + 36} y2={y + 14} stroke="#CCC" strokeWidth="1" />
      {/* Light beam on floor (subtle) */}
      {hour >= 7 && hour < 18 && (
        <polygon
          points={`${x + 5},${y + 30} ${x + 31},${y + 30} ${x + 40},${y + 55} ${x - 5},${y + 55}`}
          fill="#FFE" opacity="0.08"
        />
      )}
    </g>
  )
}
