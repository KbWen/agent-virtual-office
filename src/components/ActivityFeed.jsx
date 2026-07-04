import React, { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore } from '../systems/store'
import { charName, eventName, useLocale, t } from '../i18n'
import { formatTimeAgo } from '../utils/formatTime'
import { activityFeedMessage } from '../utils/activityFeedLabel'

const typeIcons = {
  event: '🎪',
  status: '⚡',
  behavior: '📝',
}

export default function ActivityFeed({ mode = 'full' }) {
  useLocale()
  const [collapsed, setCollapsed] = useState(true)
  // AVO-141: source the REAL-events eventFeed (FEED_ORIGINS = hook/event/inferred), NOT the all-origins
  // activityLog. The old source surfaced organic officeLife theater (the 8-50/min behavior ticks) PLUS an
  // unshift'd decorative activeEvent banner (lunch/tea/meeting set-pieces) as if they were real activity —
  // fabricated liveliness (ADR-008). The roster already fixed this internally via eventFeed; this floating
  // feed was never migrated. eventFeed is the same write-time, FEED_ORIGINS-filtered buffer the roster reads.
  // Subscribe to eventFeed + rosterMode so the widget re-renders when either changes, but READ the
  // values via getState() below so render reflects CURRENT store state. A bare reactive selector returns
  // the INITIAL snapshot under react-dom/server (this project's render-test tool), so getState() is the
  // SSR-correct read — the same dual-read idiom NarrowRoster uses (a sig subscription + getState()).
  const eventFeedSig = useOfficeStore(useShallow((s) => s.eventFeed))
  const rosterMode = useOfficeStore((s) => s.rosterMode)

  const entries = useMemo(() => useOfficeStore.getState().eventFeed.slice(0, 20), [eventFeedSig])

  if (mode === 'panel') return null  // too compact for panel mode
  // AVO-141 dedup: in roster mode the inline presence-rail feed already shows these real events, so the
  // floating widget is redundant — self-hide (mirrors the mode==='panel' guard). Office mode keeps it.
  // `rosterMode` (reactive) re-renders on toggle; getState() is the authoritative current value (SSR-safe).
  if (rosterMode || useOfficeStore.getState().rosterMode) return null

  const hasEntries = entries.length > 0
  const unreadCount = entries.filter(e => Date.now() - e.timestamp < 30000).length

  return (
    <div className={`fixed top-3 right-3 z-50 select-none transition-all duration-200 ${collapsed ? 'w-10' : 'w-72 max-w-[calc(100vw-1.5rem)]'}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
        title={collapsed ? t('activityFeed.expand', 'Activity Feed') : t('activityFeed.collapse', 'Collapse')}
        aria-label={collapsed ? t('activityFeed.expand', 'Activity Feed') : t('activityFeed.collapse', 'Collapse')}
      >
        <span className="text-sm">📋</span>
        {collapsed && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Feed panel */}
      {!collapsed && (
        <div className="mt-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
              {t('activityFeed.title', 'Activity')}
            </span>
            {hasEntries && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {entries.length} {t('activityFeed.items', 'items')}
              </span>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!hasEntries ? (
              <div className="px-3 py-5 text-center text-xs text-gray-400 dark:text-gray-500">
                {t('activityFeed.empty', 'No activity yet')}
              </div>
            ) : (
              entries.map((entry) => (
                <ActivityEntry key={entry.id} entry={entry} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityEntry({ entry }) {
  // Use hook selectors instead of getState() to stay reactive
  const agentColor = useOfficeStore((s) => entry.agentId ? s.agents[entry.agentId]?.color : null)
  const isRecent = Date.now() - entry.timestamp < 30000
  const icon = typeIcons[entry.type] || '📝'
  const name = entry.agentId ? charName(entry.agentId) : null
  const ago = formatTimeAgo(entry.timestamp)
  const message = activityFeedMessage(entry, { t, eventName })

  return (
    <div className={`px-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 flex items-start gap-2.5 ${isRecent ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-[10px] dark:bg-gray-800">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {name && (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: agentColor }} />
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">{name}</span>
            </>
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto shrink-0">{ago}</span>
        </div>
        <div className="text-[11px] leading-snug text-gray-500 dark:text-gray-400 truncate" title={message.title || undefined}>
          {message.text}
        </div>
      </div>
    </div>
  )
}
