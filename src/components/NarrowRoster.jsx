import React, { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale, eventName } from '../i18n'
import { CharacterPixelSprite } from './AgentCharacter'
import { agentLineLabel, taskChipLabel, formatTokens } from './ControlPanel'
import { formatTimeAgo } from '../utils/formatTime'
import { activityFeedMessage } from '../utils/activityFeedLabel'
import { comparePresence, isIdleStatus, teamStatus } from '../systems/rosterModel'

// ─── Vertical office: presence rail (COMMS rebuild — Phase 1: the honest, lively spine) ─────────
// The optional ☰ lens on the office. Instead of a flat declaration-ordered list, this is a PRESENCE
// RAIL sorted by salience (blocked > working/planning > recently-done > idle): the row that needs
// attention rises to the top, idle roles dim and sink. The reshuffle itself conveys "the team is
// moving" — using the trustworthy externalStatus, not organic animation. (The activity FEED and the
// motion "juice" land in later phases; this phase delivers correct, calm, alive ordering.)

const presenceColor = (status) => STATUS_COLORS[status] || STATUS_COLORS.idle
const isBusy = (status) => status === 'working' || status === 'planning' || status === 'thinking'

// Time the agent's status/task last MEANINGFULLY changed (stamped in applyExternalStatus only on a
// real signature change, NOT on every poll refresh). This is the fix for the "0s everywhere" bug —
// the old code derived this from expiresAt, which the live poll refreshes every tick → always ~now.
function lastChangedAt(ext) {
  return ext && Number.isFinite(ext.changedAt) ? ext.changedAt : null
}

function TypingDots({ reducedMotion }) {
  if (reducedMotion) return <span className="text-gray-400" aria-label={t('statusLabels.working', 'working')}>…</span>
  return (
    <span className="inline-flex items-center gap-[3px] pr-0.5" aria-label={t('statusLabels.working', 'working')}>
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
  // "since last change" — hidden when <10s (too fresh to be meaningful; avoids the "0s" noise) or
  // when the agent has no real status yet. Shows real elapsed time once stamped (e.g. "3m", "12m").
  const changedAt = lastChangedAt(ext)
  const since = changedAt && Date.now() - changedAt >= 10000 ? formatTimeAgo(changedAt, { compact: true }) : null
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
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70" aria-expanded={expanded}>
        <div className="relative shrink-0">
          <svg viewBox="-18 -40 36 46" width="46" height="56" aria-hidden="true">
            <CharacterPixelSprite charId={agent.id} expression={agent.expression || 'normal'} isMoving={false} walkFrame={0} facing="down" />
          </svg>
          <span
            className="absolute bottom-1 right-0 w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800"
            style={{ backgroundColor: color }}
            role="img"
            aria-label={t(`statusLabels.${status}`, status)}
            title={t(`statusLabels.${status}`, status)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold text-gray-800 dark:text-gray-100 truncate">{name}</span>
            {since && <span className="ml-auto text-xs text-gray-400 shrink-0 tabular-nums">{since}</span>}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
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
  // "剛剛/now" for fresh events instead of a bare "0s".
  const ago = ageMs != null && ageMs < 10000 ? t('chat.justNow', 'now') : formatTimeAgo(entry.timestamp, { compact: true })
  // decay: full opacity when fresh, easing toward 0.45 over ~20 min — never invisible.
  const opacity = Math.max(0.45, 1 - (ageMs || 0) / (20 * 60 * 1000))
  // Phase 3: a single gentle fade+rise on MOUNT only (new key → React remounts → runs once).
  // reducedMotion → no entrance. CSS reverts to the inline `opacity` (decay) after the 250ms run.
  const anim = reducedMotion ? null : 'chat-feed-in 0.25s ease-out'
  const message = activityFeedMessage(entry, { t, eventName })
  if (entry.type === 'event') {
    return (
      <div className="text-[12px] text-center text-amber-700 dark:text-amber-300/90 py-1" style={{ opacity, animation: anim }}>
        🎉 {message.text}
      </div>
    )
  }
  if (entry.type === 'handoff') {
    return (
      <div className="flex items-baseline gap-2 text-[13px] py-1 pl-2 border-l-2" style={{ borderColor: color, opacity, animation: anim }}>
        <span className="text-gray-600 dark:text-gray-300 truncate">{charName(entry.from)} <span className="text-gray-400">→</span> {charName(entry.to)}</span>
        <span className="ml-auto text-[10px] text-gray-400 shrink-0 tabular-nums">{ago}</span>
      </div>
    )
  }
  // status
  const tone = entry.status === 'blocked' ? 'text-red-600 dark:text-red-400'
    : entry.status === 'done' ? 'text-green-700 dark:text-green-400'
    : 'text-gray-600 dark:text-gray-300'
  return (
    <div className="flex items-baseline gap-2 text-[13px] py-1.5 pl-2.5 border-l-2" style={{ borderColor: color, opacity, animation: anim }}>
      <span className="font-medium text-gray-700 dark:text-gray-200 shrink-0">{charName(entry.agentId)}</span>
      <span className={`truncate ${tone}`} title={message.title || undefined}>{message.text}</span>
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
        return `${a.id}|${ext?.status || a.status || 'idle'}|${a.behavior || ''}|${a.bubble || ''}|${ext?.task || ''}|${ext?.expiresAt || 0}|${ext?.changedAt || 0}`
      })
  ))
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
  const helpers = useOfficeStore(useShallow((s) => s.helpers))
  const doneCounts = useOfficeStore(useShallow((s) => s.dailyDoneLedger?.counts || {}))
  const blockedCounts = useOfficeStore(useShallow((s) => s.dailyBlockedLedger?.counts || {}))
  // Team-state signal: the REAL workflow phase from hooks (NOT the decorative officeLife activeEvent
  // banner, which is theater — surfacing it as "team status" was the lie the user flagged).
  const activeWorkflow = useOfficeStore((s) => s.activeWorkflow)
  const tokens = useOfficeStore((s) => s.tokens)
  const effort = useOfficeStore((s) => s.effort)
  // The feed reads the dedicated eventFeed buffer (real events only, filled at write time) — NOT a
  // read-time filter of activityLog, whose 50-cap shares space with organic theater and would evict
  // real events before they showed (the cap-before-filter bug).
  const eventFeed = useOfficeStore(useShallow((s) => s.eventFeed))
  const health = useOfficeStore((s) => s.integrationHealth?.state || 'idle')

  const [expandedId, setExpandedId] = useState(null)
  const [notifyPerm, setNotifyPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const requestNotify = () => {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then((p) => setNotifyPerm(p))
      .catch((err) => console.warn('[Office] Notification.requestPermission failed:', err))
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
        return { id: a.id, agent: a, ext, status }
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

  // Activity feed (Phase 2): reads the write-time eventFeed buffer (real events only), newest
  // first, capped. Per-agent colour for the left edge; time-decay handled in FeedRow.
  const colorById = useMemo(() => {
    const map = {}
    for (const r of rows) map[r.id] = r.agent.color
    return map
  }, [rows])
  // Phase 3: when a row is expanded, FOCUS the feed on that agent (their events only). Tapping
  // the row again clears it (expandedId toggles). Otherwise the feed shows the whole team.
  const feed = useMemo(() => {
    const scoped = expandedId
      ? eventFeed.filter((e) => e.agentId === expandedId || e.from === expandedId || e.to === expandedId)
      : eventFeed
    return scoped.slice(0, 18)
  }, [eventFeed, expandedId])
  const now = Date.now()

  // Memoized subagent counts (was an O(rows·helpers) reduce called per row in the render map).
  const subagentCountById = useMemo(() => {
    const map = {}
    for (const h of helpers) map[h.parentRole] = (map[h.parentRole] || 0) + 1
    return map
  }, [helpers])
  const activeCount = sorted.filter((r) => !isIdleStatus(r.status)).length
  const blockedNames = sorted.filter((r) => r.status === 'blocked' || r.status === 'awaiting-approval').map((r) => charName(r.id))
  const team = teamStatus({ blockedNames, activeWorkflow, activeCount })
  const totalDone = Object.values(doneCounts).reduce((a, b) => a + (b || 0), 0)
  const quiet = activeCount === 0

  return (
    // Single column that FILLS the pane width (no max-width gutters — those manufactured the
    // left/right whitespace the owner flagged; "fill the container" is the web-standard, per spec).
    // A thin dock → tidy single column; a wide pane → full-width rows (the office is the wide view
    // via the hybrid, so the ☰ list filling width here is the honest no-whitespace behavior).
    <div
      className="w-full h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 flex flex-col"
      data-narrow-roster="1"
    >
      <div className="w-full min-h-full flex flex-col gap-2">
      {/* Team pulse header — static tint (no "breathing" per calm-tech). Global token/effort live
          here (team-wide, not per-agent). */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 text-[13px] text-gray-500 dark:text-gray-400">
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

      {/* Honest TEAM-STATUS strip — the REAL signal in priority order: who's blocked › the live
          workflow phase › how many are active. Replaces the old decorative officeLife event banner
          (theater that the agents can't truthfully reflect). aria-live so screen readers hear the
          change. Decorative events still live in the activity feed only. */}
      {!quiet && team.kind !== 'none' && (
        <div
          className={`text-[12px] text-center font-medium rounded py-1 px-2 ${
            team.kind === 'blocked'
              ? 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20'
              : 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/60'
          }`}
          data-roster-team={team.kind}
          aria-live="polite"
        >
          {team.kind === 'blocked'
            ? `⚠ ${t('chat.teamBlocked', 'Waiting on you')}: ${team.names.join(', ')}`
            : team.kind === 'workflow'
              ? `${t('chat.teamNow', 'Now')}: ${team.workflow} · ${team.activeCount} ${t('chat.online', 'active')}`
              : `${team.activeCount} ${t('chat.online', 'active')}`}
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
          subagents={subagentCountById[r.id] || 0}
          expanded={expandedId === r.id}
          onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* Activity feed (Phase 2): the cross-agent "what just happened" stream — real events only
          (organic theater filtered out), newest first, time-decayed. Static here; the rate-limited
          entrance animation is Phase 3. Honest empty states (no nagging void). */}
      {feed.length > 0 ? (
        <div className="flex-1 min-h-0 flex flex-col mt-1 pt-2 border-t border-gray-200 dark:border-gray-700" data-roster-feed="1">
          <div className="text-[11px] uppercase text-gray-400 px-1 pb-1">
            {t('chat.activity', 'Activity')}
            {expandedId && <span className="normal-case text-gray-500"> · {charName(expandedId)}</span>}
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto">
            {feed.map((e) => (
              <FeedRow key={e.id} entry={e} color={colorById[e.agentId] || colorById[e.from] || '#888'} ageMs={now - e.timestamp} reducedMotion={reducedMotion} />
            ))}
          </div>
        </div>
      ) : (!quiet && (
        <div className="flex-1 text-[12px] text-center text-gray-400 dark:text-gray-500 mt-1 pt-3 border-t border-gray-200 dark:border-gray-700" data-roster-feed="empty">
          {expandedId
            ? `${charName(expandedId)} — ${t('chat.feedEmptyFocused', 'no recent activity')}`
            : t('chat.feedEmpty', 'No activity yet — waiting for the team…')}
        </div>
      ))}
      </div>
    </div>
  )
}
