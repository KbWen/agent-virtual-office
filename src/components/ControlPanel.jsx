import React, { useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { behaviorLabel, charName, t, setLocale, availableLocales, useLocale, eventName } from '../i18n'
import { requestNotificationPermission, getNotificationState } from '../inference/desktopNotifier'
import { PET_TYPES } from '../systems/petState.js'
import { THEMES } from '../systems/theme.js'
import { classifyMood } from '../systems/classify.js'
import { renderDailyCard, shareOrDownloadCard, todayKey } from '../systems/dailyCard.js'

const statusOptions = ['idle', 'working', 'blocked', 'done']

// Pure label/format helpers were extracted to controlPanelLabels.js (testable without this JSX
// module). IMPORT them for this component's own render use, AND re-export for back-compat with
// existing importers (NarrowRoster, tests). NOTE: `export { x } from './m'` alone re-exports without
// binding x into THIS module's scope — the component's internal calls would then crash with
// "x is not defined" (regression caught only by actually loading the page).
import { taskChipLabel, blockedReasonLabel, blockedReasonGlyph, formatTokens, agentLineLabel, attentionStripState, controlPanelPresenceRows, shouldShowWatchdogDiag, isRafDebugEnabled, healthDotState } from './controlPanelLabels.js'
export { taskChipLabel, blockedReasonLabel, blockedReasonGlyph, formatTokens, agentLineLabel, attentionStripState, controlPanelPresenceRows, shouldShowWatchdogDiag, isRafDebugEnabled, healthDotState }

// #39 types: emoji shown on the "change pet" button per current skin.
const PET_TYPE_EMOJI = { cat: '🐈', vacuum: '🤖', dog: '🐕', rabbit: '🐇', bird: '🐦', hamster: '🐹' }

// AVO-130: ONE health dot replacing the 2–4 connection/integration pills that used to render
// side-by-side. `dot` comes from the pure `healthDotState` helper. Glance contract: a calm state
// (live/idle) shows the dot alone with detail on hover/focus; a trouble state (offline/degraded/
// fallback) auto-shows its inline label so a real problem is never hidden behind an interaction.
// Fully keyboard-operable: the dot is a focusable button and focus reveals the detail tooltip.
const HEALTH_TONE = {
  red:     { bg: 'bg-red-500',                  text: 'text-red-600 dark:text-red-400' },
  amber:   { bg: 'bg-amber-500',                text: 'text-amber-600 dark:text-amber-400' },
  emerald: { bg: 'bg-emerald-500',              text: 'text-emerald-600 dark:text-emerald-400' },
  gray:    { bg: 'bg-gray-400 dark:bg-gray-500', text: 'text-gray-500 dark:text-gray-400' },
}
function HealthDot({ dot, reducedMotion }) {
  const tone = HEALTH_TONE[dot.tone] || HEALTH_TONE.gray
  const detail = t(dot.labelKey, dot.level).replace('{0}', dot.labelVal == null ? '' : String(dot.labelVal))
  const summary = `${t('aria.health', 'Connection status')}: ${detail}`
  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        className="flex items-center gap-1 rounded px-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 dark:focus-visible:ring-gray-500"
        aria-label={summary}
        title={detail}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${tone.bg} ${dot.pulse && !reducedMotion ? 'animate-pulse' : ''}`} aria-hidden="true" />
        {dot.trouble && <span className={`text-[10px] font-medium ${tone.text}`}>{detail}</span>}
      </button>
      {!dot.trouble && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 px-1.5 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {detail}
        </span>
      )}
    </div>
  )
}

export default function ControlPanel({ platform = 'browser', mode = 'full' }) {
  // Return full agent objects so useShallow can compare by reference. Mapping to
  // new projected objects {id,color,behavior,status} on every call means the inner
  // objects are never Object.is-equal, which breaks React 19's useSyncExternalStore
  // consistency check and causes an infinite update loop.
  const agentList = useOfficeStore(useShallow((s) => Object.values(s.agents)))
  const isPaused = useOfficeStore((s) => s.isPaused)
  const togglePause = useOfficeStore((s) => s.togglePause)
  const rosterMode = useOfficeStore((s) => s.rosterMode)
  const toggleRosterMode = useOfficeStore((s) => s.toggleRosterMode)
  const weatherEffects = useOfficeStore((s) => s.weatherEffects)
  const toggleWeatherEffects = useOfficeStore((s) => s.toggleWeatherEffects)
  const lightingEnabled = useOfficeStore((s) => s.lightingEnabled)
  const toggleLighting = useOfficeStore((s) => s.toggleLighting)
  const soundscapeEnabled = useOfficeStore((s) => s.soundscapeEnabled)
  const toggleSoundscape = useOfficeStore((s) => s.toggleSoundscape)
  const officePet = useOfficeStore((s) => s.officePet)
  const toggleOfficePet = useOfficeStore((s) => s.toggleOfficePet)
  const petType = useOfficeStore((s) => s.petType)
  const setPetType = useOfficeStore((s) => s.setPetType)
  const theme = useOfficeStore((s) => s.theme)              // AVO-123
  const setTheme = useOfficeStore((s) => s.setTheme)
  const mood = useOfficeStore((s) => s.mood)                // AVO-115 share card hero
  // #28: RAF-watchdog stall counter — surfaced as an opt-in DEV diagnostic chip (see render; off by
  // default, `?debug=raf`). Cheap primitive subscription; re-renders only when a stall bumps the count.
  const watchdogRestarts = useOfficeStore((s) => s.watchdogRestarts)
  const triggerWorkflow = useOfficeStore((s) => s.triggerWorkflow)
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const hour = useOfficeStore((s) => s.hour)
  const minute = useOfficeStore((s) => s.minute)
  const externalStatus = useOfficeStore(useShallow((s) => s.externalStatus))
  const statusSource = useOfficeStore((s) => s.statusSource)
  const tokens = useOfficeStore(useShallow((s) => s.tokens))  // AVO-108
  const integrationHealth = useOfficeStore(useShallow((s) => s.integrationHealth))
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)
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
  // AVO-130: collapse statusSource + integrationHealth into a single highest-severity dot state.
  const dotState = healthDotState({ statusSource, integrationHealth, externalCount: Object.keys(externalStatus).length })

  const [showTest, setShowTest] = useState(false)
  // #39 consolidation: a ⚙ settings popover holds the cosmetic toggles + notify + dev test, so the
  // bottom bar stays lean (pause · view · lang · run · ⚙).
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = React.useRef(null)
  useEffect(() => {
    if (!showSettings) return
    const onKey = (e) => { if (e.key === 'Escape') setShowSettings(false) }
    const onDown = (e) => { if (settingsRef.current && !settingsRef.current.contains(e.target)) setShowSettings(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [showSettings])
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
  const attention = React.useMemo(
    () => attentionStripState({ agents: agentList, externalStatus, nameForId: charName }),
    [agentList, externalStatus, lang]
  )
  const presence = React.useMemo(
    () => controlPanelPresenceRows({ agents: agentList, externalStatus }),
    [agentList, externalStatus]
  )
  // AVO-115: opt-in cozy postcard. Gathers ONLY honest signals (done/blocked from the
  // existing ledgers + live mood), renders client-side, then shares-or-downloads. The
  // button is disabled while busy (no double-render).
  const [cardBusy, setCardBusy] = useState(false)
  const handleShareCard = async () => {
    if (cardBusy) return
    setCardBusy(true)
    try {
      const dayKey = todayKey()
      const blob = await renderDailyCard({
        dayKey,
        doneTotal: totalDoneToday,
        blockedTotal: totalBlockedToday,
        mood,
        weather: classifyMood(mood).family,
        locale: lang,
      })
      const filename = t('dailyCard.filename', 'agent-office-{date}.png').replace('{date}', dayKey)
      await shareOrDownloadCard(blob, filename, {
        title: t('dailyCard.shareTitle', 'Today at the office'),
        text: t('dailyCard.shareText', ''),
      })
    } catch (err) {
      console.warn('[Office] share card failed:', err)
    } finally {
      setCardBusy(false)
    }
  }
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
        {attention.count > 0 && (
          <div
            className="mb-1 -mx-1 rounded border border-red-200/70 bg-red-50/90 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:border-red-800/70 dark:bg-red-900/25 dark:text-red-300 truncate"
            aria-live="polite"
            title={`${t('chat.teamBlocked', 'Waiting on you')}: ${attention.names.join(', ')}`}
          >
            ⚠ {t('chat.teamBlocked', 'Waiting on you')}: {attention.names.join(', ')}
          </div>
        )}
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
          {/* AVO-130: one health dot (was separate live + offline pills). */}
          <HealthDot dot={dotState} reducedMotion={reducedMotion} />
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
            {/* AVO-130: platform label demoted from the persistent bar to here. */}
            <div>🖥 {t('ui.platforms.' + platform, platform)}</div>
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

      {/* #39 consolidation: ⚙ settings popover — cosmetic toggles + notifications + dev test, grouped
          off the bar. Esc / click-outside close (see effect). */}
      {showSettings && (
        <div
          ref={settingsRef}
          role="menu"
          aria-label={t('aria.settings', 'Settings')}
          className="absolute bottom-full right-2 mb-2 w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 text-xs z-50"
        >
          {/* AVO-130: controls demoted off the resting bar. Actions (language/view/run/help)
              up top, separated from the cosmetic toggles below by a divider. */}
          {/* Language — same cycle as the old bar button; the (L) shortcut still works globally. */}
          <button onClick={cycleLang}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200"
            aria-label={t('aria.switchLang', 'Switch language')} title={`${t('aria.switchLang', 'Switch language')} (L)`}>
            <span>{t('settings.language', 'Language')}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{nextLangLabel}</span>
          </button>
          {/* View mode — Office / List (was the ☰ bar button). */}
          <button onClick={() => { toggleRosterMode(); setShowSettings(false) }} aria-pressed={rosterMode}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200"
            aria-label={rosterMode ? t('aria.showOffice', 'Show office') : t('aria.showList', 'Show list view')}>
            <span>{t('settings.view', 'View')}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rosterMode ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{rosterMode ? '☰' : '🏢'}</span>
          </button>
          {/* Run workflow animation (was the blue Run bar button). */}
          <button onClick={() => { triggerWorkflow(); setShowSettings(false) }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200"
            title={t('aria.runWorkflow', 'Run workflow animation')}>
            <span>{t('settings.run', 'Run workflow')}</span>
            <span aria-hidden="true">▶</span>
          </button>
          {/* Help & shortcuts — opens the info popover (which carries metrics + platform). */}
          <button onClick={() => { setShowInfo(true); setShowSettings(false) }}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200"
            title={t('aria.info', 'Info')}>
            <span>{t('settings.help', 'Help & shortcuts')}</span>
            <span aria-hidden="true">?</span>
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          {/* Weather */}
          <button role="switch" aria-checked={weatherEffects} onClick={toggleWeatherEffects}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200">
            <span>{t('settings.weather', 'Weather animations')}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${weatherEffects ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{weatherEffects ? t('settings.on', 'On') : t('settings.off', 'Off')}</span>
          </button>
          {/* Time-of-day lighting (AVO-111) */}
          <button role="switch" aria-checked={lightingEnabled} onClick={toggleLighting}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200">
            <span>{t('settings.lighting', 'Time-of-day lighting')}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${lightingEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{lightingEnabled ? t('settings.on', 'On') : t('settings.off', 'Off')}</span>
          </button>
          {/* Ambient soundscape (AVO-122) — off by default; the toggle IS the mute */}
          <button role="switch" aria-checked={soundscapeEnabled} onClick={toggleSoundscape}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200">
            <span>{t('settings.soundscape', 'Ambient soundscape')}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${soundscapeEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{soundscapeEnabled ? t('settings.on', 'On') : t('settings.off', 'Off')}</span>
          </button>
          {/* Office pet */}
          <button role="switch" aria-checked={officePet} onClick={toggleOfficePet}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200">
            <span>{t('settings.pet', 'Office pet')}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${officePet ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{officePet ? t('settings.on', 'On') : t('settings.off', 'Off')}</span>
          </button>
          {/* Pet skin — only meaningful while the pet is shown */}
          {officePet && (
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-200">{t('settings.petSkin', 'Pet skin')}</span>
              <div role="radiogroup" aria-label={t('settings.petSkin', 'Pet skin')} className="flex gap-1">
                {PET_TYPES.map((tp) => (
                  <button key={tp} role="radio" aria-checked={petType === tp} onClick={() => setPetType(tp)}
                    title={t(`settings.skin.${tp}`, tp)} aria-label={t(`settings.skin.${tp}`, tp)}
                    className={`px-1.5 py-0.5 rounded border text-[12px] ${petType === tp ? 'bg-amber-100 border-amber-400 dark:bg-amber-900 dark:border-amber-500' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                    {PET_TYPE_EMOJI[tp]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* AVO-123: office theme — a lightweight tint grade (light themes only; legibility-tested). */}
          <div className="px-2 py-1.5 flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-200">{t('settings.theme', 'Theme')}</span>
            <div role="radiogroup" aria-label={t('settings.theme', 'Theme')} className="flex gap-1">
              {THEMES.map((th) => (
                <button key={th.id} role="radio" aria-checked={theme === th.id} onClick={() => setTheme(th.id)}
                  title={t(`settings.themeNames.${th.id}`, th.id)} aria-label={t(`settings.themeNames.${th.id}`, th.id)}
                  className={`w-5 h-5 rounded-full border ${theme === th.id ? 'border-amber-400 ring-1 ring-amber-400 dark:border-amber-500' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}`}
                  style={{ backgroundColor: th.opacity === 0 ? '#F8F4E8' : th.fill }} />
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          {/* Desktop notifications */}
          {notifyState !== 'unsupported' && (
            <div className="w-full flex items-center justify-between px-2 py-1.5 text-gray-700 dark:text-gray-200">
              <span>{t('settings.notifications', 'Desktop notifications')}</span>
              {notifyState === 'granted'
                ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{t('settings.on', 'On')}</span>
                : notifyState === 'denied'
                  ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t('settings.blocked', 'Blocked')}</span>
                  : <button onClick={handleRequestNotify} className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-[10px] hover:bg-gray-100 dark:hover:bg-gray-700">{t('settings.enable', 'Enable')}</button>}
            </div>
          )}
          {/* Dev test panel toggle */}
          <button role="switch" aria-checked={showTest} onClick={() => setShowTest((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200">
            <span>{t('settings.testPanel', 'Test panel')}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${showTest ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{showTest ? t('settings.on', 'On') : t('settings.off', 'Off')}</span>
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          {/* AVO-115: opt-in cozy share postcard — an action, not a toggle. Lives here in ⚙, never the resting bar. */}
          <button onClick={handleShareCard} disabled={cardBusy}
            aria-label={t('dailyCard.shareAria', 'Generate and download today\'s office postcard')}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-200 disabled:opacity-60 disabled:cursor-wait">
            <span>{t('settings.shareCard', "Share today's card")}</span>
            <span aria-hidden="true">{cardBusy ? '…' : '🖼️'}</span>
          </button>
          {/* Triangle pointer (right-anchored) */}
          <div className="absolute top-full right-3 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white dark:border-t-gray-800" />
        </div>
      )}

      {attention.count > 0 && !rosterMode && (
        <div
          className="mb-1 mx-auto flex max-w-[min(720px,100%)] items-center justify-center gap-1.5 rounded border border-red-200/70 bg-red-50/90 px-2 py-1 text-[11px] font-medium text-red-700 shadow-sm dark:border-red-800/70 dark:bg-red-900/25 dark:text-red-300"
          data-attention-strip="1"
          aria-live="polite"
          title={`${t('chat.teamBlocked', 'Waiting on you')}: ${attention.names.join(', ')}`}
        >
          <span aria-hidden="true">⚠</span>
          <span className="truncate">{t('chat.teamBlocked', 'Waiting on you')}: {attention.names.join(', ')}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-gray-500 dark:text-gray-400 font-mono min-w-[42px]">
          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
        </div>

        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
          {presence.rows.map(({ agent, ext }) => {
            const name = charName(agent.id)
            const label = ext ? agentLineLabel(ext, t) : behaviorLabel(agent.behavior)
            return (
              <div key={agent.id} className="flex items-center gap-1 shrink-0" title={`${name}: ${ext ? (blockedReasonLabel(ext) || taskChipLabel(ext.task) || ext.status) : agent.behavior}`}>
                <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/50" style={{ backgroundColor: agent.color }} />
                <span className="text-gray-700 dark:text-gray-200 font-medium">{name}</span>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                {ext && blockedReasonGlyph(ext) && (
                  <span aria-hidden="true" title={blockedReasonLabel(ext) || ''}>{blockedReasonGlyph(ext)}</span>
                )}
                <span className={ext ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>{label}</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full ml-0.5" style={{ backgroundColor: STATUS_COLORS[agent.status] || '#888' }} aria-hidden="true" />
                <span className="sr-only">{agent.status}</span>
              </div>
            )
          })}
          {presence.quietCount > 0 && (
            <div className="flex items-center gap-1 shrink-0 text-gray-400 dark:text-gray-500" title={t('ui.quietAgentsTooltip', '{0} agents are quiet').replace('{0}', String(presence.quietCount))}>
              <span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
              <span>{t('ui.quietAgents', '{0} quiet').replace('{0}', String(presence.quietCount))}</span>
            </div>
          )}
        </div>

        {activeEvent && (
          <div className={`text-yellow-600 dark:text-yellow-400 shrink-0${reducedMotion ? '' : ' animate-pulse'}`}>
            {activeEvent.id ? eventName(activeEvent.id) : activeEvent.name}
          </div>
        )}

        {/* AVO-130: one health dot replaces the 2–4 connection/integration pills that used to
            render side-by-side. Trouble auto-shows its inline label; calm states reveal detail
            on hover/focus. */}
        <HealthDot dot={dotState} reducedMotion={reducedMotion} />

        {/* AVO-129 + AVO-127: the ✓/✗ KPI and 🪙 token meter live on-demand in the info popover
            (opened from the ⚙ menu). AVO-130: language, list-view, run-workflow, help, and the
            platform label are all demoted off the resting bar into the ⚙ menu / info popover, so
            the persistent cluster is just the health dot + pause + gear. */}

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={togglePause} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300" title={`${isPaused ? t('aria.resume', 'Resume') : t('aria.pause', 'Pause')} (Space)`} aria-label={isPaused ? t('aria.resume', 'Resume') : t('aria.pause', 'Pause')}>
            {isPaused ? '▶' : '⏸'}
          </button>
          {/* #39 + AVO-130: ⚙ menu now also holds language, view-mode, run-workflow, and help,
              alongside the cosmetic toggles + notifications + dev test, so the bar stays lean. */}
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`px-2 py-1 rounded border transition-colors ${showSettings ? 'bg-gray-200 border-gray-400 text-gray-700 dark:bg-gray-700 dark:text-gray-200' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title={t('aria.settings', 'Settings')}
            aria-label={t('aria.settings', 'Settings')}
            aria-haspopup="menu"
            aria-expanded={showSettings}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* #28: DEV-only, OPT-IN RAF-watchdog diagnostic. Off by default for everyone — it's a
          non-actionable internal signal that was just visual noise — and only appears when a dev
          explicitly opts in via `?debug=raf` (or localStorage `avo.debug.raf=on`). The gate still
          LEADS with the literal `import.meta.env.DEV` so esbuild statically evaluates `false && …` in
          prod and dead-code-eliminates this whole branch (JSX + strings) — true zero prod cost. The
          always-on `console.warn` in AgentCharacter's watchdog remains the default dev signal. */}
      {import.meta.env.DEV && shouldShowWatchdogDiag(watchdogRestarts) && (
        <div
          className="mt-1 text-[10px] text-amber-600 dark:text-amber-400"
          data-watchdog-diag={watchdogRestarts}
          title="AgentCharacter RAF walk-loop watchdog restarts — a rising count means dropped frames (tab throttling, HMR, or an exception in animate()). Opt-in DEV diagnostic (?debug=raf)."
        >
          ⚠ {watchdogRestarts} RAF watchdog restart{watchdogRestarts === 1 ? '' : 's'} (dev)
        </div>
      )}

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
