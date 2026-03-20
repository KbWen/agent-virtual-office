import React, { useEffect, useMemo } from 'react'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale } from '../i18n'
import { formatTimeAgo } from '../utils/formatTime'

const statusEmoji = {
  idle: '💤',
  working: '⚡',
  done: '✅',
  blocked: '🚫',
}

export default function AgentInspector() {
  useLocale()
  const selectedAgent = useOfficeStore((s) => s.selectedAgent)
  const agent = useOfficeStore((s) => s.selectedAgent ? s.agents[s.selectedAgent] : null)
  const ext = useOfficeStore((s) => s.selectedAgent ? s.externalStatus[s.selectedAgent] : null)
  const activityLog = useOfficeStore((s) => s.activityLog)
  const clearSelectedAgent = useOfficeStore((s) => s.clearSelectedAgent)

  // Close on Escape
  useEffect(() => {
    if (!selectedAgent) return
    const handler = (e) => { if (e.key === 'Escape') clearSelectedAgent() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedAgent, clearSelectedAgent])

  if (!selectedAgent || !agent) return null

  const name = charName(selectedAgent)
  const status = agent.status || 'idle'
  const statusLabel = t(`statusLabels.${status}`, status)
  const currentBehavior = behaviorLabel(agent.behavior)
  const task = ext?.label || ext?.task || null
  const color = agent.color || '#888'

  // Recent activities for this agent (last 5)
  const recentActivities = useMemo(() =>
    activityLog
      .filter(a => a.agentId === selectedAgent)
      .slice(0, 5),
    [activityLog, selectedAgent]
  )

  const pos = agent.position || { x: 300, y: 250 }

  // Panel dimensions — expand for activity rows
  const activityRows = Math.min(recentActivities.length, 3)
  const baseH = task ? 90 : 74
  const W = 200, H = baseH + (activityRows > 0 ? 14 + activityRows * 13 : 0)
  // Position panel above agent, clamped to viewport (SVG 800x560)
  let px = pos.x - W / 2
  let py = pos.y - H - 80
  if (px < 10) px = 10
  if (px + W > 790) px = 790 - W
  if (py < 10) py = 10

  return (
    <g
      style={{ opacity: 1, transition: 'opacity 0.2s' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop click to close */}
      <rect x={0} y={0} width={800} height={560} fill="transparent" onClick={clearSelectedAgent} />

      {/* Connection line from panel to agent */}
      <line x1={pos.x} y1={py + H} x2={pos.x} y2={pos.y - 40}
        stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

      {/* Panel background */}
      <rect x={px} y={py} width={W} height={H} rx={8}
        fill="white" stroke={color} strokeWidth="1.5"
        filter="url(#bubble-shadow)" />

      {/* Header bar */}
      <rect x={px} y={py} width={W} height={28} rx={8} fill={color} />
      <rect x={px} y={py + 20} width={W} height={8} fill={color} />

      {/* Name + close button */}
      <text x={px + 10} y={py + 18} fontSize="12" fontFamily="monospace" fontWeight="bold" fill="white">
        {name}
      </text>
      <text x={px + W - 14} y={py + 18} fontSize="12" fontFamily="monospace" fill="white"
        style={{ cursor: 'pointer' }} onClick={clearSelectedAgent}>
        ✕
      </text>

      {/* Status badge */}
      <circle cx={px + 12} cy={py + 42} r={5} fill={STATUS_COLORS[status]} />
      <text x={px + 22} y={py + 45} fontSize="10" fontFamily="monospace" fill={STATUS_COLORS[status]} fontWeight="bold">
        {statusEmoji[status]} {statusLabel}
      </text>

      {/* Current behavior */}
      <text x={px + 10} y={py + 62} fontSize="9" fontFamily="monospace" fill="#666">
        {currentBehavior}
      </text>

      {/* External task label (if any) */}
      {task && (
        <text x={px + 10} y={py + 78} fontSize="9" fontFamily="'Segoe UI', system-ui, sans-serif" fill="#378ADD">
          {truncate(task, 30)}
        </text>
      )}

      {/* Recent activities */}
      {recentActivities.length > 0 && (
        <g>
          <line x1={px + 10} y1={py + (task ? 86 : 70)} x2={px + W - 10} y2={py + (task ? 86 : 70)}
            stroke="#eee" strokeWidth="0.5" />
          {recentActivities.slice(0, 3).map((a, i) => {
            const baseY = py + (task ? 98 : 82) + i * 13
            const ago = formatTimeAgo(a.timestamp, { compact: true })
            return (
              <g key={a.id}>
                <text x={px + 10} y={baseY} fontSize="8" fontFamily="monospace" fill="#999">
                  {ago}
                </text>
                <text x={px + 50} y={baseY} fontSize="8" fontFamily="'Segoe UI', system-ui, sans-serif" fill="#555">
                  {truncate(a.message, 22)}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </g>
  )
}

function truncate(str, max) {
  if (!str) return ''
  const chars = Array.from(str)
  return chars.length > max ? chars.slice(0, max).join('') + '…' : str
}
