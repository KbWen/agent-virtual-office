import React, { useState, useMemo } from 'react'
import { useOfficeStore } from '../systems/store'
import { charName, eventName, useLocale, t } from '../i18n'
import { formatTimeAgo } from '../utils/formatTime'

const typeIcons = {
  event: '🎪',
  status: '⚡',
  behavior: '📝',
}

export default function ActivityFeed({ mode = 'full' }) {
  useLocale()
  const [collapsed, setCollapsed] = useState(true)
  const activityLog = useOfficeStore((s) => s.activityLog)
  const activeEvent = useOfficeStore((s) => s.activeEvent)

  // Inject live event into feed
  const entries = useMemo(() => {
    const items = [...activityLog]
    if (activeEvent) {
      items.unshift({
        id: 'live-event',
        timestamp: Date.now(),
        type: 'event',
        agentId: null,
        message: activeEvent.id ? eventName(activeEvent.id) : activeEvent.name,
      })
    }
    return items.slice(0, 20)
  }, [activityLog, activeEvent])

  if (mode === 'panel') return null // too compact for panel mode

  const hasEntries = entries.length > 0
  const unreadCount = entries.filter(e => Date.now() - e.timestamp < 30000).length

  return (
    <div className={`fixed top-3 right-3 z-50 select-none transition-all duration-200 ${collapsed ? 'w-10' : 'w-64'}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-10 h-10 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
        title={collapsed ? t('activityFeed.expand', 'Activity Feed') : t('activityFeed.collapse', 'Collapse')}
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
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
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
              <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
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

  return (
    <div className={`px-3 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0 flex items-start gap-2 ${isRecent ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
      <span className="text-[10px] mt-0.5 shrink-0">{icon}</span>
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
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
          {entry.message}
        </div>
      </div>
    </div>
  )
}
