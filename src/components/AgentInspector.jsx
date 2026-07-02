import React, { useEffect, useMemo } from 'react'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale } from '../i18n'
import { formatTimeAgo } from '../utils/formatTime'
import {
  buildAgentInspectorMeta,
  inspectorAnchorPosition,
  inspectorPanelLayout,
  inspectorTaskLabel,
  recentAgentActivities,
  stateDurationLabel,
  truncateText,
} from './agentInspectorModel'

const statusEmoji = {
  idle: '💤',
  working: '⚡',
  done: '✅',
  blocked: '🚫',
  planning: '🧠',
  'awaiting-approval': '⏳',  // AVO-167: "waiting on you"
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
    return recentAgentActivities(activityLog, selectedAgent)
  }, [activityLog, selectedAgent])

  const inspectorMeta = useMemo(() => {
    if (!selectedAgent) return { doneToday: 0, mood: 'normal', activeWorkflow: null }
    return buildAgentInspectorMeta(dailyDoneLedger, selectedAgent, mood, activeWorkflow)
  }, [activeWorkflow, dailyDoneLedger, mood, selectedAgent])

  if (!selectedAgent || !agent) return null

  const name = charName(selectedAgent)
  const status = agent.status || 'idle'
  const statusLabel = t(`statusLabels.${status}`, status)
  // AVO-169: inline "how long" for the actionable waiting states (honest, real changedAt, ≥30s only).
  const stateSince = stateDurationLabel(status, ext?.changedAt)
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

  const pos = inspectorAnchorPosition(agent)
  const layout = inspectorPanelLayout({
    hasTask: Boolean(task),
    detailCount: detailRows.length,
    activityCount: recentActivities.length,
    sceneScale,
    position: pos,
  })
  const {
    activityDividerY,
    activityStartY,
    detailsStartY,
    height: H,
    scale: s,
    scaledHeight: Hs,
    scaledWidth: Ws,
    width: W,
    x: px,
    y: py,
  } = layout

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
          {statusEmoji[status]} {statusLabel}{stateSince ? ` · ${stateSince}` : ''}
        </text>

        {/* Current behavior */}
        <text x={10} y={62} fontSize="9" fontFamily="monospace" fill="#666">
          {currentBehavior}
        </text>

        {/* External task label (if any) */}
        {task && (
          <text x={10} y={78} fontSize="9" fontFamily="'Segoe UI', system-ui, sans-serif" fill="#378ADD">
            {truncateText(task, 30)}
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
                    {truncateText(row.value, 18)}
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
                    {truncateText(a.message, 22)}
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
