import React, { useState, useEffect } from 'react'
import { useOfficeStore } from '../systems/store'
import { behaviorLabel, locale, setLocale, availableLocales, onLocaleChange } from '../i18n'

const statusColors = {
  idle: '#888',
  working: '#EF9F27',
  done: '#5CB88A',
  blocked: '#E24B4A',
}

const statusOptions = ['idle', 'working', 'blocked', 'done']

const platformLabels = {
  browser: 'Browser',
  'claude-cli': 'Claude CLI',
  'claude-desktop': 'Claude Desktop',
  'codex-app': 'Codex App',
  'codex-cli': 'Codex CLI',
  antigravity: 'Antigravity',
  embedded: 'Embedded',
}

export default function ControlPanel({ platform = 'browser', mode = 'full' }) {
  const agents = useOfficeStore((s) => s.agents)
  const isPaused = useOfficeStore((s) => s.isPaused)
  const togglePause = useOfficeStore((s) => s.togglePause)
  const triggerWorkflow = useOfficeStore((s) => s.triggerWorkflow)
  const activeEvent = useOfficeStore((s) => s.activeEvent)
  const hour = useOfficeStore((s) => s.hour)
  const minute = useOfficeStore((s) => s.minute)
  const setAgentBehavior = useOfficeStore((s) => s.setAgentBehavior)
  const externalStatus = useOfficeStore((s) => s.externalStatus)
  const statusSource = useOfficeStore((s) => s.statusSource)

  const [showTest, setShowTest] = useState(false)
  const [lang, setLang] = useState(locale())
  const agentList = Object.values(agents)
  const isPanel = mode === 'panel'

  useEffect(() => onLocaleChange(setLang), [])

  const setStatus = (id, status) => {
    const agent = agents[id]
    if (!agent) return
    useOfficeStore.setState((s) => ({
      agents: {
        ...s.agents,
        [id]: { ...s.agents[id], status },
      },
    }))
  }

  // ─── Panel mode: compact single-line status bar ───
  if (isPanel) {
    return (
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 px-2 py-1 text-[10px] select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* Agent dots with status colors */}
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {agentList.map((agent) => {
              const ext = externalStatus[agent.id]
              return (
                <div key={agent.id} className="flex items-center gap-0.5 shrink-0" title={`${agent.name}: ${ext?.task || agent.behavior}`}>
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span
                    className="inline-block w-1 h-1 rounded-full"
                    style={{ backgroundColor: statusColors[agent.status] || '#888' }}
                  />
                </div>
              )
            })}
          </div>

          {/* Live indicator */}
          {statusSource === 'external' && (
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
            </div>
          )}

          {/* Pause toggle */}
          <button
            onClick={togglePause}
            className="px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {isPaused ? '▶' : '⏸'}
          </button>
        </div>
      </div>
    )
  }

  // ─── Full mode: standard control panel ───
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs select-none z-50">
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Time */}
        <div className="text-gray-500 dark:text-gray-400 font-mono min-w-[42px]">
          {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
        </div>

        {/* Agent status with behavior labels */}
        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
          {agentList.map((agent) => {
            const ext = externalStatus[agent.id]
            const label = ext?.task
              ? ext.task.replace(/^\//, '')
              : behaviorLabel(agent.behavior)
            return (
              <div key={agent.id} className="flex items-center gap-1 shrink-0" title={`${agent.name}: ${ext?.task || agent.behavior}`}>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border border-white/50"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="text-gray-700 dark:text-gray-200 font-medium">{agent.name}</span>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <span className={ext ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>{label}</span>
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full ml-0.5"
                  style={{ backgroundColor: statusColors[agent.status] || '#888' }}
                />
              </div>
            )
          })}
        </div>

        {/* Active event */}
        {activeEvent && (
          <div className="text-yellow-600 dark:text-yellow-400 animate-pulse shrink-0">
            {activeEvent.name}
          </div>
        )}

        {/* Status source indicator */}
        {statusSource === 'external' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Live</span>
          </div>
        )}
        {statusSource === 'fallback' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
              {Object.keys(externalStatus).length} agents
            </span>
          </div>
        )}

        {/* Platform badge */}
        <div className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
          {platformLabels[platform] || platform}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              const locales = availableLocales()
              const idx = locales.indexOf(lang)
              const next = locales[(idx + 1) % locales.length]
              setLocale(next)
              // Reload character names
              window.location.reload()
            }}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 text-[10px]"
            title="Switch language"
          >
            {lang === 'zh-TW' ? 'EN' : '中'}
          </button>
          <button
            onClick={togglePause}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
          >
            {isPaused ? '▶' : '⏸'}
          </button>
          <button
            onClick={triggerWorkflow}
            className="px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            title="Run workflow animation"
          >
            Run
          </button>
          <button
            onClick={() => setShowTest(!showTest)}
            className={`px-2 py-1 rounded border transition-colors ${showTest ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            title="Toggle test controls"
          >
            Test
          </button>
        </div>
      </div>

      {/* Test panel (collapsible) */}
      {showTest && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {agentList.map((agent) => (
              <div key={agent.id} className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: agent.color }} />
                <span className="font-medium text-gray-700 dark:text-gray-200 mr-1">{agent.name}</span>
                {statusOptions.map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatus(agent.id, st)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      agent.status === st
                        ? 'text-white font-bold'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-200 dark:bg-gray-700'
                    }`}
                    style={agent.status === st ? { backgroundColor: statusColors[st] } : {}}
                  >
                    {st}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-gray-400">
            Set agent status to change behavior weights — working: more typing, blocked: frustrated, done: celebratory
          </div>
        </div>
      )}
    </div>
  )
}
