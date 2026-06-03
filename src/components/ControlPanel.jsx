import React, { useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { classifyTask } from '../systems/classify'
import { behaviorLabel, charName, t, setLocale, availableLocales, useLocale, eventName } from '../i18n'
import { requestNotificationPermission, getNotificationState } from '../inference/desktopNotifier'

const statusOptions = ['idle', 'working', 'blocked', 'done']

// Collapse a raw tool/task name into the same short chip the character's
// TaskLabel (AVO-103) shows, so the control panel never displays the ugly
// `mcp__Server__tool` wire form while the SVG label above the head shows the
// collapsed `Server::tool`. Built-ins stay short (`Bash`), MCP tools collapse
// to `server::tool`, unknowns are truncated. Returns null for an empty task so
// callers can fall back to the localized status label.
export function taskChipLabel(task) {
  if (!task) return null
  return classifyTask(task).visualLabel
}

// AVO-110 (lightweight): for a blocked agent the human `label` carries the
// failure reason the hook detected ("❌ npm test failed"), which is far more
// useful at a glance than the bare tool name (`Bash`). Surface it — truncated
// for the compact status bar — so the persistent status line answers "why is
// this agent stuck?" without needing to open the inspector. Returns null for
// any non-blocked / label-less agent so callers fall back to the tool chip.
const BLOCKED_REASON_CAP = 28
export function blockedReasonLabel(ext) {
  if (!ext || ext.status !== 'blocked' || !ext.label) return null
  const l = ext.label
  return l.length > BLOCKED_REASON_CAP ? l.slice(0, BLOCKED_REASON_CAP - 1) + '…' : l
}

// AVO-108: compact token formatter — 604937 → "605k", 1240000 → "1.2M", 842 → "842".
export function formatTokens(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(Math.round(n))
}

// The single label a ControlPanel agent row shows: blocked reason wins, then the
// collapsed tool chip, then the localized status word. `t` is the i18n lookup.
export function agentLineLabel(ext, t) {
  if (!ext) return null
  return blockedReasonLabel(ext)
    || taskChipLabel(ext.task)
    || t(`statusLabels.${ext.status}`, ext.status)
}

export default function ControlPanel({ platform = 'browser', mode = 'full' }) {
  // Return full agent objects so useShallow can compare by reference. Mapping to
  // new projected objects {id,color,behavior,status} on every call means the inner
  // objects are never Object.is-equal, which breaks React 19's useSyncExternalStore
  // consistency check and causes an infinite update loop.
  const agentList = useOfficeStore(useShallow((s) => Object.values(s.agents)))
  const isPaused = useOfficeStore((s) => s.isPaused)
  const togglePause = useOfficeStore((s) => s.togglePause)
  const triggerWorkflow = useOfficeStore((s) => s.triggerWorkflow)
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const hour = useOfficeStore((s) => s.hour)
  const minute = useOfficeStore((s) => s.minute)
  const externalStatus = useOfficeStore(useShallow((s) => s.externalStatus))
  const statusSource = useOfficeStore((s) => s.statusSource)
  const tokens = useOfficeStore(useShallow((s) => s.tokens))  // AVO-108
  const integrationHealth = useOfficeStore(useShallow((s) => s.integrationHealth))
  // Subscribe to ledger objects (clone-on-write — identity only changes on actual
  // increment or day rollover). Sum in useMemo so the reduction doesn't re-run on
  // unrelated re-renders (clock tick, agent move).
  const dailyDoneCounts = useOfficeStore(useShallow((s) => s.dailyDoneLedger?.counts))
  const dailyBlockedCounts = useOfficeStore(useShallow((s) => s.dailyBlockedLedger?.counts))
  const totalDoneToday = React.useMemo(
    () => Object.values(dailyDoneCounts || {}).reduce((sum, c) => sum + c, 0),
    [dailyDoneCounts]
  )
  const totalBlockedToday = React.useMemo(
    () => Object.values(dailyBlockedCounts || {}).reduce((sum, c) => sum + c, 0),
    [dailyBlockedCounts]
  )

  const [showTest, setShowTest] = useState(false)
  const [showInfo, setShowInfo] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('office-onboarded')
  })
  // Notification permission state (#8). Init from current state; refresh after request.
  const [notifyState, setNotifyState] = useState(() => getNotificationState())
  const handleRequestNotify = async () => {
    const r = await requestNotificationPermission()
    setNotifyState(r)
  }
  const lang = useLocale()
  const isPanel = mode === 'panel'

  const setStatus = (id, status) => {
    useOfficeStore.setState((s) => {
      if (!s.agents[id]) return s
      return {
        agents: {
          ...s.agents,
          [id]: { ...s.agents[id], status },
        },
      }
    })
  }

  const cycleLang = () => {
    const locales = availableLocales()
    const idx = locales.indexOf(lang)
    setLocale(locales[(idx + 1) % locales.length])
  }

  const nextLangLabel = (() => {
    const locales = availableLocales()
    const idx = locales.indexOf(lang)
    const next = locales[(idx + 1) % locales.length]
    const labels = { en: 'EN', 'zh-TW': 'ZH' }
    return labels[next] || next.toUpperCase()
  })()

  const dismissInfo = () => {
    setShowInfo(false)
    localStorage.setItem('office-onboarded', '1')
  }

  // ─── Panel mode: compact single-line status bar ───
  if (isPanel) {
    return (
      <div
        className="bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 px-2 py-1 text-[10px] select-none shrink-0"
        title={t('ui.todayMetricsTooltip', 'Today: {0} done, {1} blocked').replace('{0}', String(totalDoneToday)).replace('{1}', String(totalBlockedToday))}
      >
        {/* AVO-129: panel mode has no "?" popover, so the day's ✓/✗ counts are surfaced
            on-demand here — a hover tooltip plus an always-present sr-only mirror — instead
            of a persistent visible chip. Keeps the compact bar calm; a11y intact. */}
        <span className="sr-only">
          {t('ui.todayMetricsA11y', '{0} completed, {1} blocked today').replace('{0}', String(totalDoneToday)).replace('{1}', String(totalBlockedToday))}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {agentList.map((agent) => {
              const ext = externalStatus[agent.id]
              return (
                <div key={agent.id} className="flex items-center gap-0.5 shrink-0" title={`${charName(agent.id)}: ${ext ? (blockedReasonLabel(ext) || taskChipLabel(ext.task) || ext.status) : agent.behavior}`}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                  <span className="inline-block w-1 h-1 rounded-full" style={{ backgroundColor: STATUS_COLORS[agent.status] || '#888' }} aria-hidden="true" />
                </div>
              )
            })}
          </div>
          {statusSource === 'external' && (
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t('ui.live')}</span>
            </div>
          )}
          {integrationHealth.state === 'offline' && (
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-600 dark:text-red-400 font-medium">{t('status.offline', 'offline')}</span>
            </div>
          )}
          {/* AVO-129: ✓/✗ KPI removed from the persistent bar (the day's rhythm is felt
              through events, not read off a tally). Data path (ledgers) is unchanged. */}
          <button onClick={togglePause} className="px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={isPaused ? t('aria.resume', 'Resume') : t('aria.pause', 'Pause')}>
            {isPaused ? '▶' : '⏸'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Full mode: standard control panel ───
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs select-none z-50">
      {/* Onboarding popover */}
      {showInfo && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs z-50">
          <p className="text-gray-700 dark:text-gray-200 mb-2">
            {t('onboarding.description')}
          </p>
          <div className="text-gray-400 dark:text-gray-500 space-y-0.5 mb-2">
            <div>{t('onboarding.shortcutPause')}</div>
            <div>{t('onboarding.shortcutLang')}</div>
            <div>{t('onboarding.shortcutClick')}</div>
          </div>
          {/* AVO-127 + AVO-129: today's metrics + token usage live here on-demand,
              demoted from the persistent bar to keep the office calm. */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mb-2 text-gray-500 dark:text-gray-400 space-y-0.5 font-mono text-[11px]">
            <div title={t('ui.todayMetricsTooltip', 'Today: {0} done, {1} blocked').replace('{0}', String(totalDoneToday)).replace('{1}', String(totalBlockedToday))}>
              <span aria-hidden="true">✓ {totalDoneToday} · ✗ {totalBlockedToday}</span>
              <span className="sr-only">{t('ui.todayMetricsA11y', '{0} completed, {1} blocked today').replace('{0}', String(totalDoneToday)).replace('{1}', String(totalBlockedToday))}</span>
            </div>
            {tokens && (
              <div title={t('ui.tokensTooltip', 'Context: {0} tokens · last output {1}{2}').replace('{0}', tokens.ctx.toLocaleString()).replace('{1}', tokens.out.toLocaleString()).replace('{2}', tokens.model ? ' · ' + tokens.model : '')}>
                <span aria-hidden="true">🪙 {formatTokens(tokens.ctx)}</span>
                <span className="sr-only">{t('ui.tokensA11y', '{0} context tokens, {1} output tokens').replace('{0}', String(tokens.ctx)).replace('{1}', String(tokens.out))}</span>
              </div>
            )}
          </div>
          <button
            onClick={dismissInfo}
            className="w-full px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors text-[11px] font-medium"
          >
            {t('onboarding.gotIt')}
          </button>
          {/* Triangle pointer */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-gray-500 dark:text-gray-400 font-mono min-w-[42px]">
          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
        </div>

        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
          {agentList.map((agent) => {
            const ext = externalStatus[agent.id]
            const name = charName(agent.id)
            const label = ext ? agentLineLabel(ext, t) : behaviorLabel(agent.behavior)
            return (
              <div key={agent.id} className="flex items-center gap-1 shrink-0" title={`${name}: ${ext ? (blockedReasonLabel(ext) || taskChipLabel(ext.task) || ext.status) : agent.behavior}`}>
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/50" style={{ backgroundColor: agent.color }} />
                <span className="text-gray-700 dark:text-gray-200 font-medium">{name}</span>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <span className={ext ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>{label}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5" style={{ backgroundColor: STATUS_COLORS[agent.status] || '#888' }} aria-hidden="true" />
                <span className="sr-only">{agent.status}</span>
              </div>
            )
          })}
        </div>

        {activeEvent && (
          <div className="text-yellow-600 dark:text-yellow-400 animate-pulse shrink-0">
            {activeEvent.id ? eventName(activeEvent.id) : activeEvent.name}
          </div>
        )}

        {statusSource === 'external' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{t('ui.live')}</span>
          </div>
        )}
        {statusSource === 'fallback' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
              {t('ui.fallbackAgents').replace('{0}', Object.keys(externalStatus).length)}
            </span>
          </div>
        )}
        {integrationHealth.state === 'offline' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
              {t('status.apiOffline', 'status api offline')}
            </span>
          </div>
        )}
        {integrationHealth.state === 'degraded' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              {t('status.apiRetrying', 'status api retrying')}
            </span>
          </div>
        )}

        {/* AVO-129 + AVO-127: the ✓/✗ done/blocked KPI and the 🪙 token meter are no longer
            persistent chrome on the bar (they read as a monitoring dashboard, which this
            vibe tool is explicitly not). Both are surfaced on-demand in the "?" info popover
            above; their data paths (ledgers, tokens) are untouched. */}

        <div className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
          {t('ui.platforms.' + platform, platform)}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notification permission toggle (#8). 'default' = ask, 'granted' = on,
              'denied' = blocked, 'unsupported' = no API. Clicking when 'default'
              triggers requestPermission within a user-gesture (modern browsers
              require this). After 'granted' / 'denied', the button is a non-action
              status indicator. */}
          {notifyState !== 'unsupported' && (
            <button
              onClick={handleRequestNotify}
              disabled={notifyState === 'granted' || notifyState === 'denied'}
              className={`px-2 py-1 rounded border transition-colors text-[10px] ${
                notifyState === 'granted'
                  ? 'border-emerald-400 text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 cursor-default'
                  : notifyState === 'denied'
                    ? 'border-red-400 text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 cursor-default'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={t(`notify.tooltip.${notifyState}`, notifyState === 'granted' ? 'Notifications on' : notifyState === 'denied' ? 'Notifications blocked' : 'Enable notifications')}
              aria-label={t(`notify.aria.${notifyState}`, notifyState === 'granted' ? 'Notifications enabled' : notifyState === 'denied' ? 'Notifications denied' : 'Enable desktop notifications')}
            >
              {notifyState === 'granted' ? '🔔' : notifyState === 'denied' ? '🔕' : '🔔'}
            </button>
          )}
          <button onClick={cycleLang} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 text-[10px]" title={`${t('aria.switchLang', 'Switch language')} (L)`} aria-label={t('aria.switchLang', 'Switch language')}>
            {nextLangLabel}
          </button>
          <button onClick={togglePause} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300" title={`${isPaused ? t('aria.resume', 'Resume') : t('aria.pause', 'Pause')} (Space)`} aria-label={isPaused ? t('aria.resume', 'Resume') : t('aria.pause', 'Pause')}>
            {isPaused ? '▶' : '⏸'}
          </button>
          <button onClick={triggerWorkflow} className="px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors" title={t('aria.runWorkflow', 'Run workflow animation')}>
            {t('ui.run')}
          </button>
          <button
            onClick={() => setShowTest(!showTest)}
            className={`px-2 py-1 rounded border transition-colors ${showTest ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title={t('aria.toggleTest', 'Toggle test controls')}
          >
            {t('ui.test')}
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 text-[10px]"
            title={t('aria.info', 'Info')}
          >
            ?
          </button>
        </div>
      </div>

      {showTest && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {agentList.map((agent) => (
              <div key={agent.id} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                <span className="font-medium text-gray-700 dark:text-gray-200 mr-1">{charName(agent.id)}</span>
                {statusOptions.map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatus(agent.id, st)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      agent.status === st
                        ? 'text-white font-bold'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-200 dark:bg-gray-700'
                    }`}
                    style={agent.status === st ? { backgroundColor: STATUS_COLORS[st] } : {}}
                  >
                    {t(`statusLabels.${st}`, st)}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-gray-400">
            {t('ui.testHint')}
          </div>
        </div>
      )}
    </div>
  )
}
