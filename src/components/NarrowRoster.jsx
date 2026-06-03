import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale, eventName } from '../i18n'
import { CharacterPixelSprite } from './AgentCharacter'
import { agentLineLabel, taskChipLabel, formatTokens } from './ControlPanel'
import { formatTimeAgo } from '../utils/formatTime'

// ─── Team-chat widget ─────────────────────────────────────────────────────────
// An OPTIONAL "messaging app" lens on the office (toggled via the ☰ button) — every role is a
// chat row: the real chibi avatar + a presence dot + their latest message, with a live "typing…"
// indicator while they work. Tap a row to expand richer detail (tool/task, today's done/blocked,
// subagents). Built to be glanceable AND alive — relative times tick, presence shifts, messages
// stream — so it stays watchable. Reuses the office's own sprites + status formatters (no rebuild).

const presenceColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.idle
const isBusy = (status) => status === 'working' || status === 'planning'

// "Last active" time, derived from the external status' expiresAt (= set-time + TTL). Read-only —
// avoids touching the heavily-optimised applyExternalStatus. Null when there is no external status.
function lastActiveAt(ext) {
  if (!ext || !Number.isFinite(ext.expiresAt)) return null
  return ext.expiresAt - (ext.status === 'done' ? 10000 : 300000)
}

function TypingDots({ reducedMotion }) {
  if (reducedMotion) return <span className="text-gray-400" aria-label="working">…</span>
  return (
    <span className="inline-flex items-center gap-[3px] pr-0.5" aria-label="working">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-[3px] h-[3px] rounded-full bg-gray-400 dark:bg-gray-500"
          style={{ animation: `chat-typing 1.1s ${i * 0.18}s infinite ease-in-out` }}
        />
      ))}
    </span>
  )
}

function DetailChip({ icon, label, value }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span aria-hidden="true">{icon}</span>
      <span className="text-gray-400 dark:text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{value}</span>
    </div>
  )
}

function ChatCard({ agent, ext, doneCount, blockedCount, subagents, expanded, onToggle, reducedMotion }) {
  const name = charName(agent.id)
  const status = ext?.status || agent.status || 'idle'
  const color = presenceColor(status)
  const blocked = status === 'blocked'
  const busy = isBusy(status)
  const since = ext ? formatTimeAgo(lastActiveAt(ext), { compact: true }) : null
  const message = agent.bubble || (ext ? agentLineLabel(ext, t) : null) || behaviorLabel(agent.behavior)
  const tool = taskChipLabel(ext?.task) || (ext ? agentLineLabel(ext, t) : null) || '—'

  return (
    <div
      className={`rounded-xl border transition-colors ${
        blocked
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-white/90 dark:bg-gray-800/80 border-gray-100 dark:border-gray-700'
      }`}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-2.5 py-2 text-left" aria-expanded={expanded}>
        <div className="relative shrink-0">
          <svg viewBox="-18 -40 36 46" width="38" height="46" aria-hidden="true">
            <CharacterPixelSprite charId={agent.id} expression={agent.expression || 'normal'} isMoving={false} walkFrame={0} facing="down" />
          </svg>
          <span
            className="absolute bottom-1 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-800"
            style={{ backgroundColor: color }}
            title={t(`statusLabels.${status}`, status)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{name}</span>
            {since && <span className="ml-auto text-[10px] text-gray-400 shrink-0 tabular-nums">{since}</span>}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
            {busy ? (
              <>
                <TypingDots reducedMotion={reducedMotion} />
                <span className="truncate">{taskChipLabel(ext?.task) || t(`statusLabels.${status}`, status)}</span>
              </>
            ) : (
              <span className="truncate">{message}</span>
            )}
          </div>
        </div>
        <span className="text-gray-300 dark:text-gray-600 text-[10px] shrink-0" aria-hidden="true">{expanded ? '▴' : '▾'}</span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 pt-1.5 mt-0.5 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <DetailChip icon="🛠" label={t('chat.tool', 'task')} value={tool} />
          <DetailChip icon="✓" label={t('chat.doneToday', 'done')} value={doneCount} />
          <DetailChip icon="⊘" label={t('chat.blockedToday', 'blocked')} value={blockedCount} />
          <DetailChip icon="👥" label={t('chat.subagents', 'subagents')} value={subagents} />
        </div>
      )}
    </div>
  )
}

export default function NarrowRoster() {
  useLocale() // re-render on language switch
  const agents = useOfficeStore(useShallow((s) => Object.values(s.agents).filter((a) => !a.session)))
  const externalStatus = useOfficeStore(useShallow((s) => s.externalStatus))
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const helpers = useOfficeStore(useShallow((s) => s.helpers))
  const doneCounts = useOfficeStore(useShallow((s) => s.dailyDoneLedger?.counts || {}))
  const blockedCounts = useOfficeStore(useShallow((s) => s.dailyBlockedLedger?.counts || {}))
  const tokens = useOfficeStore((s) => s.tokens)
  const effort = useOfficeStore((s) => s.effort)

  const [expandedId, setExpandedId] = useState(null)
  // Relative times stay fresh from the office's own frequent store ticks (movement/events re-render
  // the widget continuously while active); no extra timer needed, and none to keep the page from
  // ever settling. The typing-dots CSS animation supplies the "alive" feel on its own.

  const subagentCount = (roleId) => helpers.reduce((n, h) => (h.parentRole === roleId ? n + 1 : n), 0)
  const activeCount = agents.filter((a) => {
    const st = externalStatus[a.id]?.status || a.status
    return st && st !== 'idle'
  }).length
  const totalDone = Object.values(doneCounts).reduce((a, b) => a + (b || 0), 0)

  return (
    <div
      className="w-full h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 grid gap-1.5 [align-content:safe_center]"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      data-narrow-roster="1"
    >
      {/* Team pulse header — global token/effort live here (they are team-wide, not per-agent) */}
      <div className="[grid-column:1/-1] flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="font-medium">
          <span className="text-gray-700 dark:text-gray-200">{activeCount}</span> {t('chat.online', 'active')}
          {totalDone > 0 && <> · <span className="text-gray-700 dark:text-gray-200">{totalDone}</span> {t('chat.done', 'done')}</>}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {effort && <span title={t('chat.effort', 'effort')}>⚡{effort}</span>}
          {tokens && Number.isFinite(tokens.out) && <span title="tokens">{formatTokens(tokens.out)} tok</span>}
        </span>
      </div>

      {activeEvent && (
        <div
          className={`[grid-column:1/-1] text-[11px] text-center font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded py-1 ${reducedMotion ? '' : 'animate-pulse'}`}
          data-roster-event="1"
        >
          {activeEvent.id ? eventName(activeEvent.id) : activeEvent.name}
        </div>
      )}

      {agents.map((a) => (
        <ChatCard
          key={a.id}
          agent={a}
          ext={externalStatus[a.id]}
          doneCount={doneCounts[a.id] || 0}
          blockedCount={blockedCounts[a.id] || 0}
          subagents={subagentCount(a.id)}
          expanded={expandedId === a.id}
          onToggle={() => setExpandedId((cur) => (cur === a.id ? null : a.id))}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  )
}
