import React from 'react'

// ─── Desk (top-down view) ────────────────────────────────────────────────
// facing: 'down' (default, monitor at top) or 'up' (monitor at bottom, for paired desks)
export function Desk({ x, y, color = '#B8864E', hasMonitor = true, coffeeCount = 0, facing = 'down' }) {
  const W = 52, H = 34
  const up = facing === 'up'
  return (
    <g>
      {/* Chair */}
      <rect x={x - 9} y={up ? y - H / 2 - 15 : y + H / 2 + 1} width={18} height={14} rx={6} fill="#444" opacity="0.7" />
      <rect x={x - 6} y={up ? y - H / 2 - 11 : y + H / 2 + 2} width={12} height={8} rx={3} fill="#666" opacity="0.5" />
      {/* Desk back edge / shelf */}
      <rect x={x - W / 2} y={up ? y + H / 2 - 8 : y - H / 2} width={W} height={8} rx={1} fill="#7A5230" />
      {/* Desk surface */}
      <rect x={x - W / 2} y={up ? y - H / 2 : y - H / 2 + 8} width={W} height={H - 8} rx={1} fill={color} />
      {/* Front edge */}
      <rect x={x - W / 2} y={up ? y - H / 2 : y + H / 2 - 3} width={W} height={3} rx={0.5} fill="#C8965E" />
      {/* Desk shadow */}
      <rect x={x - W / 2 + 2} y={up ? y - H / 2 - 3 : y + H / 2} width={W - 4} height={3} rx={1} fill="rgba(0,0,0,0.07)" />
      {/* Monitor */}
      {hasMonitor && (
        <g>
          {up ? (
            <>
              <rect x={x - 12} y={y + H / 2 - 15} width={24} height={14} rx={1.5} fill="#1a2a3a" />
              <rect x={x - 10} y={y + H / 2 - 13} width={20} height={10} rx={1} fill="#2d5a7e" />
              <line x1={x - 8} y1={y + H / 2 - 11} x2={x + 5} y2={y + H / 2 - 11} stroke="#4af" strokeWidth="0.8" opacity="0.5" />
              <line x1={x - 8} y1={y + H / 2 - 8} x2={x + 8} y2={y + H / 2 - 8} stroke="#4fa" strokeWidth="0.8" opacity="0.4" />
            </>
          ) : (
            <>
              <rect x={x - 12} y={y - H / 2 + 1} width={24} height={14} rx={1.5} fill="#1a2a3a" />
              <rect x={x - 10} y={y - H / 2 + 3} width={20} height={10} rx={1} fill="#2d5a7e" />
              <line x1={x - 8} y1={y - H / 2 + 5} x2={x + 5} y2={y - H / 2 + 5} stroke="#4af" strokeWidth="0.8" opacity="0.5" />
              <line x1={x - 8} y1={y - H / 2 + 8} x2={x + 8} y2={y - H / 2 + 8} stroke="#4fa" strokeWidth="0.8" opacity="0.4" />
              <line x1={x - 8} y1={y - H / 2 + 11} x2={x + 2} y2={y - H / 2 + 11} stroke="#fa4" strokeWidth="0.8" opacity="0.5" />
            </>
          )}
        </g>
      )}
      {/* Coffee cups */}
      {coffeeCount >= 1 && <CoffeeCup x={x + 16} y={y - 4} />}
      {coffeeCount >= 2 && <CoffeeCup x={x + 16} y={y + 6} steaming={false} />}
      {coffeeCount >= 3 && <CoffeeCup x={x + 21} y={y} steaming={false} />}
    </g>
  )
}

// ─── Desk Cluster (two facing desks) ─────────────────────────────────────
// topAgent faces down, bottomAgent faces up — they sit across from each other
export function DeskCluster({ x, topY, bottomY, topCoffee = 0, bottomCoffee = 0, label }) {
  return (
    <g>
      {/* Cluster label */}
      {label && (
        <text x={x} y={topY - 28} textAnchor="middle" fontSize="6" fill="#888" fontFamily="sans-serif" opacity="0.6">{label}</text>
      )}
      {/* Top desk: character sits below desk, faces down at monitor on top */}
      <Desk x={x} y={topY} facing="down" coffeeCount={topCoffee} />
      {/* Bottom desk: character sits above desk, faces up at monitor on bottom */}
      <Desk x={x} y={bottomY} facing="up" coffeeCount={bottomCoffee} />
    </g>
  )
}

// ─── Coffee Cup ──────────────────────────────────────────────────────────
export function CoffeeCup({ x, y, steaming = true }) {
  return (
    <g>
      <rect x={x} y={y} width={6} height={7} rx={1} fill="#F5E6D3" stroke="#D4C4B0" strokeWidth="0.5" />
      <path d={`M${x + 6},${y + 2} Q${x + 9},${y + 3} ${x + 6},${y + 5}`} fill="none" stroke="#D4C4B0" strokeWidth="0.6" />
      <ellipse cx={x + 3} cy={y} rx={3} ry={1.2} fill="#6B4226" />
      {steaming && (
        <g opacity="0.5">
          <path d={`M${x + 2},${y - 2} Q${x + 3},${y - 5} ${x + 2},${y - 8}`} fill="none" stroke="#bbb" strokeWidth="0.5">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.2s" repeatCount="indefinite" />
          </path>
          <path d={`M${x + 4},${y - 2} Q${x + 5},${y - 6} ${x + 4},${y - 9}`} fill="none" stroke="#bbb" strokeWidth="0.4">
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.8s" repeatCount="indefinite" />
          </path>
        </g>
      )}
    </g>
  )
}

// ─── Bookshelf ───────────────────────────────────────────────────────────
export function Bookshelf({ x, y, width = 70, rows = 2 }) {
  const BOOK_COLORS = ['#E24B4A', '#378ADD', '#1D9E75', '#BA7517', '#7F77DD', '#D85A30', '#5DCAA5', '#FF9E9E', '#FFE066']
  const H = rows * 17
  return (
    <g>
      <rect x={x} y={y} width={width} height={H + 6} rx={1} fill="#8B6538" />
      <rect x={x + 2} y={y + 2} width={width - 4} height={H + 2} rx={1} fill="#A07848" />
      {Array.from({ length: rows }).map((_, row) => {
        const ry = y + 4 + row * 17
        let bx = x + 4
        const items = []
        let i = 0
        while (bx < x + width - 8) {
          const c = BOOK_COLORS[(row * 5 + i) % BOOK_COLORS.length]
          const bw = 5 + (i % 3 === 0 ? 3 : 0)
          if (bx + bw > x + width - 6) break
          items.push(<rect key={i} x={bx} y={ry} width={bw} height={13} fill={c} opacity="0.88" />)
          bx += bw + 1
          i++
        }
        return (
          <g key={row}>
            {items}
            <rect x={x + 2} y={ry + 14} width={width - 4} height={2} fill="#7A5228" />
          </g>
        )
      })}
    </g>
  )
}

// ─── Plant ───────────────────────────────────────────────────────────────
export function Plant({ x, y }) {
  return (
    <g>
      <rect x={x - 5} y={y} width={10} height={9} rx={2} fill="#C4724B" />
      <rect x={x - 6} y={y} width={12} height={3} rx={1} fill="#A55A3A" />
      <ellipse cx={x - 4} cy={y - 7} rx={4.5} ry={5.5} fill="#3D8B3D" />
      <ellipse cx={x + 4} cy={y - 8} rx={4} ry={5} fill="#4CAF50" />
      <ellipse cx={x} cy={y - 10} rx={3.5} ry={5} fill="#388E3C" />
      <ellipse cx={x - 2} cy={y - 12} rx={2.5} ry={3.5} fill="#66BB6A" />
    </g>
  )
}

// ─── Couch ───────────────────────────────────────────────────────────────
export function Couch({ x, y, width = 80, color = '#7B8FA1' }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={34} rx={5} fill={color} />
      <rect x={x + 4} y={y + 9} width={width / 2 - 8} height={21} rx={3} fill="#8FA3B8" />
      <rect x={x + width / 2 + 4} y={y + 9} width={width / 2 - 8} height={21} rx={3} fill="#8FA3B8" />
      <rect x={x} y={y} width={width} height={11} rx={4} fill="#5A6E80" />
      <rect x={x} y={y + 9} width={10} height={25} rx={3} fill="#6B7F91" />
      <rect x={x + width - 10} y={y + 9} width={10} height={25} rx={3} fill="#6B7F91" />
    </g>
  )
}

// ─── Round Coffee Table ───────────────────────────────────────────────────
export function RoundTable({ x, y, r = 22 }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#C8965E" stroke="#A07040" strokeWidth="1.5" />
      <circle cx={x} cy={y} r={r - 4} fill="#D4A870" opacity="0.35" />
      <ellipse cx={x} cy={y} rx={r - 8} ry={r - 10} fill="none" stroke="#B07840" strokeWidth="0.5" opacity="0.4" />
    </g>
  )
}

// ─── Meeting Table ────────────────────────────────────────────────────────
export function MeetingTable({ x, y, w = 90, h = 50 }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={8} fill="#C8965E" stroke="#A07040" strokeWidth="1.5" />
      <rect x={x - w / 2 + 6} y={y - h / 2 + 6} width={w - 12} height={h - 12} rx={5} fill="#D4A870" opacity="0.35" />
      {/* Meeting chairs */}
      {[-1, 1].map((side) =>
        [-1, 0, 1].map((pos) => (
          <rect
            key={`${side}-${pos}`}
            x={x + pos * 24 - 7}
            y={side === -1 ? y - h / 2 - 12 : y + h / 2 + 1}
            width={14} height={10} rx={4}
            fill="#555" opacity="0.65"
          />
        ))
      )}
    </g>
  )
}

// ─── Coffee / Vending Machine ─────────────────────────────────────────────
export function CoffeeMachine({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={18} height={26} rx={2} fill="#444" />
      <rect x={x + 2} y={y + 2} width={14} height={10} rx={1} fill="#222" />
      <rect x={x + 3} y={y + 3} width={12} height={8} rx={0.5} fill="#0a2a1a" />
      <text x={x + 9} y={y + 9} textAnchor="middle" fontSize="4" fill="#0f0" fontFamily="monospace">CAFE</text>
      <circle cx={x + 9} cy={y + 18} r={3.5} fill="#E24B4A">
        <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <rect x={x + 2} y={y + 23} width={14} height={3} rx={1} fill="#888" />
    </g>
  )
}

// ─── Water Cooler ─────────────────────────────────────────────────────────
export function WaterCooler({ x, y }) {
  return (
    <g>
      <rect x={x - 5} y={y + 6} width={10} height={14} rx={2} fill="#ccc" />
      <ellipse cx={x} cy={y + 6} rx={5} ry={6} fill="#B0D4F0" stroke="#88B4D8" strokeWidth="0.8" />
      <ellipse cx={x} cy={y} rx={3} ry={4} fill="#D8EEFF" opacity="0.8" />
      <circle cx={x - 2} cy={y + 14} r={1.5} fill="#E24B4A" opacity="0.7" />
      <circle cx={x + 2} cy={y + 14} r={1.5} fill="#378ADD" opacity="0.7" />
    </g>
  )
}

// ─── Gate / Security Booth ────────────────────────────────────────────────
export function GateBooth({ x, y }) {
  return (
    <g>
      <rect x={x - 16} y={y - 10} width={32} height={22} rx={3} fill="#888" stroke="#666" strokeWidth="1" />
      <rect x={x - 14} y={y - 8} width={28} height={18} rx={2} fill="#AAA" />
      <rect x={x + 16} y={y - 6} width={28} height={3} rx={1.5} fill="#E24B4A" stroke="#C43" strokeWidth="0.5" />
      <rect x={x - 44} y={y - 6} width={28} height={3} rx={1.5} fill="#E24B4A" stroke="#C43" strokeWidth="0.5" />
      <rect x={x - 16} y={y - 16} width={32} height={7} rx={1} fill="#E24B4A" />
      <text x={x} y={y - 11} textAnchor="middle" fontSize="4.5" fill="white" fontFamily="monospace" fontWeight="bold">GATE</text>
    </g>
  )
}

// ─── Wall Window ─────────────────────────────────────────────────────────
export function WallWindow({ x, y, w = 42, h = 26, hour = 12 }) {
  const sky = hour >= 20 ? '#0a0a2a' : hour >= 17 ? '#FF8844' : hour >= 7 ? '#87CEEB' : '#1a1a3a'
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={sky} stroke="#AAA" strokeWidth="1.5" />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </g>
  )
}

// ─── Whiteboard ───────────────────────────────────────────────────────────
export function Whiteboard({ x, y, w = 65, h = 42 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#F8F8F0" stroke="#BBB" strokeWidth="1.5" />
      <line x1={x + 5} y1={y + 10} x2={x + 45} y2={y + 10} stroke="#378ADD" strokeWidth="1.5" opacity="0.7" />
      <line x1={x + 5} y1={y + 18} x2={x + 58} y2={y + 18} stroke="#7F77DD" strokeWidth="1.2" opacity="0.6" />
      <rect x={x + 5} y={y + 25} width={14} height={10} rx={1} fill="none" stroke="#1D9E75" strokeWidth="1" opacity="0.8" />
      <rect x={x + 27} y={y + 25} width={14} height={10} rx={1} fill="none" stroke="#1D9E75" strokeWidth="1" opacity="0.8" />
      <line x1={x + 19} y1={y + 30} x2={x + 27} y2={y + 30} stroke="#1D9E75" strokeWidth="0.8" opacity="0.8" />
      <rect x={x + 47} y={y + 5} width={10} height={10} fill="#FFE066" opacity="0.9" />
      <rect x={x + 50} y={y + 19} width={10} height={10} fill="#FF9E9E" opacity="0.8" />
      <rect x={x} y={y + h} width={w} height={4} rx={0.5} fill="#CCC" />
    </g>
  )
}

// ─── Server Rack ──────────────────────────────────────────────────────────
export function ServerRack({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={24} height={42} rx={2} fill="#2a2a2a" stroke="#222" strokeWidth="1" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={x + 2} y={y + 3 + i * 8} width={20} height={6} rx={0.5} fill="#1a1a1a" />
          <circle cx={x + 18} cy={y + 6 + i * 8} r={1.2} fill={i % 2 === 0 ? '#0f0' : '#f80'}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur={`${1.2 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </g>
  )
}

// ─── Clock ────────────────────────────────────────────────────────────────
export function Clock({ x, y, r = 14, hour = 12, minute = 0 }) {
  const hr = ((hour % 12) + minute / 60) / 12 * Math.PI * 2
  const mn = minute / 60 * Math.PI * 2
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="white" stroke="#AAA" strokeWidth="1.5" />
      <circle cx={x} cy={y} r={1} fill="#333" />
      {/* Tick marks */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
        const a = i / 12 * Math.PI * 2
        const big = i % 3 === 0
        return (
          <line key={i}
            x1={x + Math.sin(a) * (r - 2)} y1={y - Math.cos(a) * (r - 2)}
            x2={x + Math.sin(a) * (r - (big ? 5 : 3))} y2={y - Math.cos(a) * (r - (big ? 5 : 3))}
            stroke="#666" strokeWidth={big ? 1.2 : 0.6}
          />
        )
      })}
      {/* Hour hand */}
      <line x1={x} y1={y} x2={x + Math.sin(hr) * (r * 0.55)} y2={y - Math.cos(hr) * (r * 0.55)} stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1={x} y1={y} x2={x + Math.sin(mn) * (r * 0.78)} y2={y - Math.cos(mn) * (r * 0.78)} stroke="#555" strokeWidth="1" strokeLinecap="round" />
    </g>
  )
}

// ─── Printer ──────────────────────────────────────────────────────────────
export function Printer({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={20} height={14} rx={2} fill="#DDD" stroke="#BBB" strokeWidth="0.8" />
      <rect x={x + 3} y={y - 4} width={14} height={5} rx={1} fill="#CCC" />
      <rect x={x + 6} y={y + 11} width={8} height={5} fill="#F5F5F5" opacity="0.8" />
      <rect x={x + 2} y={y + 5} width={16} height={2} rx={0.5} fill="#AAA" opacity="0.5" />
    </g>
  )
}

// ─── Rug / Carpet ─────────────────────────────────────────────────────────
export function Rug({ x, y, w, h, color = '#8B6578' }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={color} opacity="0.35" />
      <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} rx={2} fill={color} opacity="0.2" />
      {/* Fringe */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`t${i}`} x1={x + 10 + i * ((w - 20) / 4)} y1={y} x2={x + 10 + i * ((w - 20) / 4)} y2={y - 4} stroke={color} strokeWidth="1.5" opacity="0.5" />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={`b${i}`} x1={x + 10 + i * ((w - 20) / 4)} y1={y + h} x2={x + 10 + i * ((w - 20) / 4)} y2={y + h + 4} stroke={color} strokeWidth="1.5" opacity="0.5" />
      ))}
    </g>
  )
}
