import React, { useEffect, useMemo } from 'react'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale } from '../i18n'
import { formatTimeAgo } from '../utils/formatTime'
import { buildAgentInspectorMeta, inspectorTaskLabel } from './agentInspectorModel'

// POINT 2 follow-up: the inspector counter-scales so its small detail fonts (8–9px) stay readable
// at ANY office scale. Only ONE inspector is ever open and it is clamped inside the viewBox, so it
// has NO overlap constraint — instead of merely cancelling the shrink (net 1.0, which leaves the
// 8px detail text at 8px) we aim for a CONSTANT readable on-screen size ≈ 1.6× native
// (net = sceneScale × s = INSPECTOR_READ_TARGET), capped (×3) so the scaled panel still fits 800×560.
const INSPECTOR_READ_TARGET = 1.6
const INSPECTOR_SCALE_MAX = 3

const statusEmoji = {
  idle: '💤',
  working: '⚡',
  done: '✅',
  blocked: '🚫',
  planning: '🧠',
}

export default function AgentInspector() {
  useLocale()
  const selectedAgent = useOfficeStore((s) => s.selectedAgent)
  const agent = useOfficeStore((s) => s.selectedAgent ? s.agents[s.selectedAgent] : null)
  const ext = useOfficeStore((s) => s.selectedAgent ? s.externalStatus[s.selectedAgent] : null)
  // Gate the high-churn subscriptions on selectedAgent. activityLog is reassigned on every
  // behavior/status/event change (many times per minute) and dailyDoneLedger on every
  // applyExternalStatus call. When no agent is inspected the panel renders null — yet a raw
  // `s.activityLog` / `s.dailyDoneLedger` subscription still re-rendered it on each mutation
  // for nothing. Returning a stable `null` while closed makes those mutations Object.is-equal,
  // so the inspector only re-renders for log/ledger changes while it is actually open.
  const activityLog = useOfficeStore((s) => s.selectedAgent ? s.activityLog : null)
  const dailyDoneLedger = useOfficeStore((s) => s.selectedAgent ? s.dailyDoneLedger : null)
  const mood = useOfficeStore((s) => s.mood)
  const activeWorkflow = useOfficeStore((s) => s.activeWorkflow)
  const clearSelectedAgent = useOfficeStore((s) => s.clearSelectedAgent)
  // POINT 2: counter-scale factor so the popover holds a readable on-screen size as the office shrinks.
  const sceneScale = useOfficeStore((s) => s.sceneScale)

  // Close on Escape
  useEffect(() => {
    if (!selectedAgent) return
    const handler = (e) => { if (e.key === 'Escape') clearSelectedAgent() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedAgent, clearSelectedAgent])

  // Hooks must be called unconditionally (React Rules of Hooks),
  // so this must appear before the early-return guard.
  const recentActivities = useMemo(() => {
    if (!selectedAgent) return []
    return activityLog
      .filter(a => a.agentId === selectedAgent)
      .slice(0, 5)
  }, [activityLog, selectedAgent])

  const inspectorMeta = useMemo(() => {
    if (!selectedAgent) return { doneToday: 0, mood: 'normal', activeWorkflow: null }
    return buildAgentInspectorMeta(dailyDoneLedger, selectedAgent, mood, activeWorkflow)
  }, [activeWorkflow, dailyDoneLedger, mood, selectedAgent])

  if (!selectedAgent || !agent) return null

  const name = charName(selectedAgent)
  const status = agent.status || 'idle'
  const statusLabel = t(`statusLabels.${status}`, status)
  const currentBehavior = behaviorLabel(agent.behavior)
  const task = inspectorTaskLabel(ext)
  const color = agent.color || '#888'
  const detailRows = [
    {
      label: t('inspector.doneToday', 'Done today'),
      value: String(inspectorMeta.doneToday),
      valueFill: '#2E7D32',
    },
    {
      label: t('inspector.mood', 'Mood'),
      value: t(`moodLabels.${inspectorMeta.mood}`, inspectorMeta.mood),
      valueFill: '#6A4C93',
    },
    inspectorMeta.activeWorkflow
      ? {
          label: t('inspector.activeWorkflow', 'Workflow'),
          value: inspectorMeta.activeWorkflow,
          valueFill: '#1565C0',
        }
      : null,
  ].filter(Boolean)

  // While moving, anchor to targetPosition so the panel follows where the agent is heading
  // rather than staying frozen at the departure point.
  const pos = (agent.isMoving ? agent.targetPosition : agent.position) || { x: 300, y: 250 }

  const detailsStartY = task ? 94 : 78
  const activityRows = Math.min(recentActivities.length, 3)
  let contentBottomY = task ? 78 : 62
  if (detailRows.length > 0) {
    contentBottomY = detailsStartY + (detailRows.length - 1) * 14
  }
  const activityDividerY = contentBottomY + 8
  const activityStartY = activityDividerY + 12
  if (activityRows > 0) {
    contentBottomY = activityStartY + (activityRows - 1) * 13
  }

  // Panel dimensions — expand for metadata and activity rows
  const W = 200, H = contentBottomY + 16
  // POINT 2: scale the whole popover by `s` so its text stays readable when the office is small.
  // Clamp using the SCALED footprint (Ws×Hs) so the enlarged panel still fits the 800×560 viewBox.
  const s = Math.min(INSPECTOR_SCALE_MAX, Math.max(1, INSPECTOR_READ_TARGET / (sceneScale > 0 ? sceneScale : 1)))
  const Ws = W * s, Hs = H * s
  // Position scaled panel above the agent, clamped to viewport (SVG 800x560)
  let px = pos.x - Ws / 2
  let py = pos.y - Hs - 56 * s
  if (px < 10) px = 10
  if (px + Ws > 790) px = 790 - Ws
  if (py < 10) py = 10
  if (py + Hs > 550) py = 550 - Hs

  return (
    <g
      style={{ opacity: 1, transition: 'opacity 0.2s' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop click to close */}
      <rect x={0} y={0} width={800} height={560} fill="transparent" onClick={clearSelectedAgent} />

      {/* Connection line from panel to agent (anchors to the SCALED panel bottom) */}
      <line x1={pos.x} y1={py + Hs} x2={pos.x} y2={pos.y - 40}
        stroke={color} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

      {/* POINT 2: whole popover scaled by `s` — content authored in local 0..W / 0..H coords so the
          text grows with the panel and stays readable as the office shrinks. */}
      <g transform={`translate(${px}, ${py}) scale(${s})`}>
        {/* Panel background */}
        <rect x={0} y={0} width={W} height={H} rx={8}
          fill="white" stroke={color} strokeWidth="1.5"
          filter="url(#bubble-shadow)" />

        {/* Header bar */}
        <rect x={0} y={0} width={W} height={28} rx={8} fill={color} />
        <rect x={0} y={20} width={W} height={8} fill={color} />

        {/* Name + close button */}
        <text x={10} y={18} fontSize="12" fontFamily="monospace" fontWeight="bold" fill="white">
          {name}
        </text>
        <g role="button" tabIndex={0} aria-label={t('aria.close', 'Close inspector')}
          onClick={clearSelectedAgent}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearSelectedAgent() } }}
          style={{ cursor: 'pointer' }}>
          <text x={W - 14} y={18} fontSize="12" fontFamily="monospace" fill="white">
            ✕
          </text>
        </g>

        {/* Status badge */}
        <circle cx={12} cy={42} r={5} fill={STATUS_COLORS[status] || color || '#888'} />
        <text x={22} y={45} fontSize="10" fontFamily="monospace" fill={STATUS_COLORS[status] || color || '#888'} fontWeight="bold">
          {statusEmoji[status]} {statusLabel}
        </text>

        {/* Current behavior */}
        <text x={10} y={62} fontSize="9" fontFamily="monospace" fill="#666">
          {currentBehavior}
        </text>

        {/* External task label (if any) */}
        {task && (
          <text x={10} y={78} fontSize="9" fontFamily="'Segoe UI', system-ui, sans-serif" fill="#378ADD">
            {truncate(task, 30)}
          </text>
        )}

        {/* Summary details */}
        {detailRows.length > 0 && (
          <g>
            {detailRows.map((row, i) => {
              const rowY = detailsStartY + i * 14
              return (
                <g key={row.label}>
                  <text x={10} y={rowY} fontSize="8" fontFamily="monospace" fill="#888">
                    {row.label}
                  </text>
                  <text x={W - 10} y={rowY} fontSize="8" fontFamily="'Segoe UI', system-ui, sans-serif" fill={row.valueFill}
                    textAnchor="end">
                    {truncate(row.value, 18)}
                  </text>
                </g>
              )
            })}
          </g>
        )}

        {/* Recent activities */}
        {recentActivities.length > 0 && (
          <g>
            <line x1={10} y1={activityDividerY} x2={W - 10} y2={activityDividerY}
              stroke="#eee" strokeWidth="0.5" />
            {recentActivities.slice(0, 3).map((a, i) => {
              const baseY = activityStartY + i * 13
              const ago = formatTimeAgo(a.timestamp, { compact: true })
              return (
                <g key={a.id}>
                  <text x={10} y={baseY} fontSize="8" fontFamily="monospace" fill="#999">
                    {ago}
                  </text>
                  <text x={50} y={baseY} fontSize="8" fontFamily="'Segoe UI', system-ui, sans-serif" fill="#555">
                    {truncate(a.message, 22)}
                  </text>
                </g>
              )
            })}
          </g>
        )}
      </g>
    </g>
  )
}

function truncate(str, max) {
  if (!str) return ''
  const chars = Array.from(str)
  return chars.length > max ? chars.slice(0, max).join('') + '…' : str
}
