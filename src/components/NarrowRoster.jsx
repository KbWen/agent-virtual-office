import React, { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale, eventName } from '../i18n'
import { CharacterPixelSprite } from './AgentCharacter'
import { agentLineLabel, taskChipLabel, formatTokens } from './ControlPanel'
import { formatTimeAgo } from '../utils/formatTime'
import { comparePresence, isIdleStatus, feedEntries } from '../systems/rosterModel'

// ─── Vertical office: presence rail (COMMS rebuild — Phase 1: the honest, lively spine) ─────────
// The optional ☰ lens on the office. Instead of a flat declaration-ordered list, this is a PRESENCE
// RAIL sorted by salience (blocked > working/planning > recently-done > idle): the row that needs
// attention rises to the top, idle roles dim and sink. The reshuffle itself conveys "the team is
// moving" — using the trustworthy externalStatus, not organic animation. (The activity FEED and the
// motion "juice" land in later phases; this phase delivers correct, calm, alive ordering.)

const presenceColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.idle
const isBusy = (status) => status === 'working' || status === 'planning' || status === 'thinking'

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

function ChatCard({ agent, ext, status, doneCount, blockedCount, subagents, expanded, onToggle, reducedMotion, dimmed }) {
  const name = charName(agent.id)
  const color = presenceColor(status)
  const blocked = status === 'blocked'
  const busy = isBusy(status)
  const since = ext ? formatTimeAgo(lastActiveAt(ext), { compact: true }) : null
  const message = agent.bubble || (ext ? agentLineLabel(ext, t) : null) || behaviorLabel(agent.behavior)
  const tool = taskChipLabel(ext?.task) || (ext ? agentLineLabel(ext, t) : null) || '—'

  return (
    <div
      data-roster-status={status}
      className={`rounded-xl border transition-[opacity,background-color,border-color] duration-300 ${
        blocked
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-white/90 dark:bg-gray-800/80 border-gray-100 dark:border-gray-700'
      } ${dimmed ? 'opacity-60' : 'opacity-100'}`}
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

// ─── Activity feed row (Phase 2) — one real event: status change, handoff, or team event ───────
// Sourced from the store's activityLog, already filtered to non-organic origins. Time-decayed
// opacity (older = quieter) gives the "journal that's been written in" resting feel (calm-tech).
function FeedRow({ entry, color, ageMs, reducedMotion }) {
  const ago = formatTimeAgo(entry.timestamp, { compact: true })
  // decay: full opacity when fresh, easing toward 0.45 over ~20 min — never invisible.
  const opacity = Math.max(0.45, 1 - (ageMs || 0) / (20 * 60 * 1000))
  // Phase 3: a single gentle fade+rise on MOUNT only (new key → React remounts → runs once).
  // reducedMotion → no entrance. CSS reverts to the inline `opacity` (decay) after the 250ms run.
  const anim = reducedMotion ? null : 'chat-feed-in 0.25s ease-out'
  if (entry.type === 'event') {
    return (
      <div className="text-[10px] text-center text-amber-700 dark:text-amber-300/90 py-0.5" style={{ opacity, animation: anim }}>
        🎉 {eventName(entry.message) || entry.message}
      </div>
    )
  }
  if (entry.type === 'handoff') {
    return (
      <div className="flex items-baseline gap-1.5 text-[11px] py-0.5 pl-2 border-l-2" style={{ borderColor: color, opacity, animation: anim }}>
        <span className="text-gray-600 dark:text-gray-300 truncate">{charName(entry.from)} <span className="text-gray-400">→</span> {charName(entry.to)}</span>
        <span className="ml-auto text-[9px] text-gray-400 shrink-0 tabular-nums">{ago}</span>
      </div>
    )
  }
  // status
  const tone = entry.status === 'blocked' ? 'text-red-600 dark:text-red-400'
    : entry.status === 'done' ? 'text-green-700 dark:text-green-400'
    : 'text-gray-600 dark:text-gray-300'
  return (
    <div className="flex items-baseline gap-1.5 text-[11px] py-0.5 pl-2 border-l-2" style={{ borderColor: color, opacity, animation: anim }}>
      <span className="font-medium text-gray-700 dark:text-gray-200 shrink-0">{charName(entry.agentId)}</span>
      <span className={`truncate ${tone}`}>{entry.message}</span>
      <span className="ml-auto text-[9px] text-gray-400 shrink-0 tabular-nums">{ago}</span>
    </div>
  )
}

const HEALTH_DOT = { online: '#1D9E75', degraded: '#E8A317', offline: '#E24B4A', idle: '#9aa' }

export default function NarrowRoster() {
  useLocale() // re-render on language switch
  // Salience-relevant SIGNATURE only — id|status|behavior|bubble|task|expiresAt per agent. It
  // deliberately EXCLUDES position, so the ~30fps movement ticks that replace agent objects do NOT
  // re-render or re-sort the rail (the systems-review thrash fix). useShallow compares the string
  // array element-wise, so it short-circuits unless a salience-relevant field actually changed.
  const presenceSig = useOfficeStore(useShallow((s) =>
    Object.values(s.agents)
      .filter((a) => !a.session)
      .map((a) => {
        const ext = s.externalStatus[a.id]
        return `${a.id}|${ext?.status || a.status || 'idle'}|${a.behavior || ''}|${a.bubble || ''}|${ext?.task || ''}|${ext?.expiresAt || 0}`
      })
  ))
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const helpers = useOfficeStore(useShallow((s) => s.helpers))
  const doneCounts = useOfficeStore(useShallow((s) => s.dailyDoneLedger?.counts || {}))
  const blockedCounts = useOfficeStore(useShallow((s) => s.dailyBlockedLedger?.counts || {}))
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const tokens = useOfficeStore((s) => s.tokens)
  const effort = useOfficeStore((s) => s.effort)
  const activityLog = useOfficeStore(useShallow((s) => s.activityLog))
  const health = useOfficeStore((s) => s.integrationHealth?.state || 'idle')

  const [expandedId, setExpandedId] = useState(null)
  const [notifyPerm, setNotifyPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const requestNotify = () => {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then((p) => setNotifyPerm(p)).catch(() => {})
  }

  // Build rows from ground-truth via getState(), keyed on the signature → no per-movement-tick
  // rebuild. (Reading getState() in a useMemo keyed on a subscribed signature is the same pattern
  // PixelOffice uses for its agentList.)
  const rows = useMemo(() => {
    const s = useOfficeStore.getState()
    return Object.values(s.agents)
      .filter((a) => !a.session)
      .map((a) => {
        const ext = s.externalStatus[a.id]
        const status = ext?.status || a.status || 'idle'
        return { id: a.id, agent: a, ext, status, lastActiveAt: lastActiveAt(ext) }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenceSig])

  const sorted = useMemo(() => [...rows].sort(comparePresence), [rows])
  // The sort is tier-stable: blocked pins to the top; everyone else holds a FIXED id order. So
  // `sorted` only re-orders when an agent crosses the blocked boundary — a rare, meaningful event.
  // We therefore render it DIRECTLY (no debounce/throttle): movement/position ticks never reach
  // here (excluded from presenceSig), and React's keyed reconcile (key=id) moves only the single
  // row that changed — so a newly-blocked agent surfaces to the top IMMEDIATELY, with no per-tick
  // churn for everyone else. (Smooth FLIP animation for that one move lands in Phase 3.)
  const renderRows = sorted

  // Activity feed (Phase 2): real events only (organic theater filtered by feedEntries), newest
  // first, capped. Per-agent colour for the left edge; time-decay handled in FeedRow.
  const colorById = useMemo(() => {
    const map = {}
    for (const r of rows) map[r.id] = r.agent.color
    return map
  }, [rows])
  // Phase 3: when a row is expanded, FOCUS the feed on that agent (their events only). Tapping
  // the row again clears it (expandedId toggles). Otherwise the feed shows the whole team.
  const feed = useMemo(() => {
    const all = feedEntries(activityLog)
    const scoped = expandedId
      ? all.filter((e) => e.agentId === expandedId || e.from === expandedId || e.to === expandedId)
      : all
    return scoped.slice(0, 12)
  }, [activityLog, expandedId])
  const now = Date.now()

  const subagentCount = (roleId) => helpers.reduce((n, h) => (h.parentRole === roleId ? n + 1 : n), 0)
  const activeCount = sorted.filter((r) => !isIdleStatus(r.status)).length
  const totalDone = Object.values(doneCounts).reduce((a, b) => a + (b || 0), 0)
  const quiet = activeCount === 0

  return (
    <div
      className="w-full h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 grid gap-1.5 [align-content:safe_start]"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      data-narrow-roster="1"
    >
      {/* Team pulse header — static tint (no "breathing" per calm-tech). Global token/effort live
          here (team-wide, not per-agent). */}
      <div className="[grid-column:1/-1] flex items-center justify-between gap-2 px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span className="font-medium">
          <span className={quiet ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}>{activeCount}</span> {t('chat.online', 'active')}
          {totalDone > 0 && <> · <span className="text-gray-700 dark:text-gray-200">{totalDone}</span> {t('chat.done', 'done')}</>}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {notifyPerm === 'default' && (
            <button onClick={requestNotify} title={t('chat.enableNotify', 'Notify me when blocked')} className="text-[11px] leading-none hover:opacity-70" aria-label={t('chat.enableNotify', 'Notify me when blocked')}>🔔</button>
          )}
          {effort && <span title={t('chat.effort', 'effort')}>⚡{effort}</span>}
          {tokens && Number.isFinite(tokens.out) && <span title="tokens">{formatTokens(tokens.out)} tok</span>}
          {/* Integration heartbeat/health — so idle never reads as "is it even alive?" */}
          <span className="inline-flex items-center gap-1" title={health} data-roster-health={health}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: HEALTH_DOT[health] || HEALTH_DOT.idle }} />
            {health === 'offline' && <span className="text-red-500">{t('chat.offline', 'Disconnected')}</span>}
          </span>
        </span>
      </div>

      {/* Honest quiet/resting state — "office with the lights low", not a nagging void (calm-tech). */}
      {quiet && (
        <div className="[grid-column:1/-1] text-[11px] text-center text-gray-400 dark:text-gray-500 py-0.5" data-roster-quiet="1">
          {t('chat.quiet', 'Quiet right now — the team is resting')}
        </div>
      )}

      {activeEvent && (
        <div
          className={`[grid-column:1/-1] text-[11px] text-center font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded py-1 ${reducedMotion ? '' : 'animate-pulse'}`}
          data-roster-event="1"
        >
          {activeEvent.id ? eventName(activeEvent.id) : activeEvent.name}
        </div>
      )}

      {renderRows.map((r) => (
        <ChatCard
          key={r.id}
          agent={r.agent}
          ext={r.ext}
          status={r.status}
          dimmed={isIdleStatus(r.status)}
          doneCount={doneCounts[r.id] || 0}
          blockedCount={blockedCounts[r.id] || 0}
          subagents={subagentCount(r.id)}
          expanded={expandedId === r.id}
          onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* Activity feed (Phase 2): the cross-agent "what just happened" stream — real events only
          (organic theater filtered out), newest first, time-decayed. Static here; the rate-limited
          entrance animation is Phase 3. Honest empty states (no nagging void). */}
      {feed.length > 0 ? (
        <div className="[grid-column:1/-1] mt-1 pt-1.5 border-t border-gray-200 dark:border-gray-700" data-roster-feed="1">
          <div className="text-[9px] uppercase tracking-wider text-gray-400 px-1 pb-0.5">
            {t('chat.activity', 'Activity')}
            {expandedId && <span className="normal-case text-gray-500"> · {charName(expandedId)}</span>}
          </div>
          <div className="flex flex-col gap-0.5">
            {feed.map((e) => (
              <FeedRow key={e.id} entry={e} color={colorById[e.agentId] || colorById[e.from] || '#888'} ageMs={now - e.timestamp} reducedMotion={reducedMotion} />
            ))}
          </div>
        </div>
      ) : (!quiet && (
        <div className="[grid-column:1/-1] text-[10px] text-center text-gray-400 dark:text-gray-500 mt-1 pt-1.5 border-t border-gray-200 dark:border-gray-700" data-roster-feed="empty">
          {t('chat.feedEmpty', 'No activity yet — waiting for the team…')}
        </div>
      ))}
    </div>
  )
}
