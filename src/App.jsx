import React, { useMemo, useEffect } from 'react'
import PixelOffice from './components/PixelOffice'
import ControlPanel from './components/ControlPanel'
import ErrorBoundary from './components/ErrorBoundary'
import { detectPlatform, getPlatformConfig } from './systems/platformDetect'
import { useOfficeStore } from './systems/store'
import { setLocale, locale, availableLocales } from './i18n'

function getDisplayMode() {
  if (typeof window === 'undefined') return 'full'
  const params = new URLSearchParams(window.location.search)
  return params.get('mode') || 'full'
}

export default function App() {
  const platform = useMemo(() => detectPlatform(), [])
  const config = useMemo(() => getPlatformConfig(platform), [platform])
  const mode = useMemo(() => getDisplayMode(), [])

  // Global keyboard shortcuts: Space = pause, L = switch language
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        useOfficeStore.getState().togglePause()
      } else if (e.key === 'l' || e.key === 'L') {
        const locales = availableLocales()
        const idx = locales.indexOf(locale())
        setLocale(locales[(idx + 1) % locales.length])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (mode === 'panel') {
    return (
      <ErrorBoundary>
        <div className="w-full h-full bg-[#F5F2EB] dark:bg-[#1a1814] flex flex-col overflow-hidden">
          <PixelOffice animationQuality={config.animationQuality} mode="panel" />
          <ControlPanel platform={platform} mode="panel" />
        </div>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <div className="w-screen h-screen bg-[#F5F2EB] dark:bg-[#1a1814] flex flex-col items-center justify-center overflow-hidden">
        <PixelOffice animationQuality={config.animationQuality} />
        {config.showControlPanel && <ControlPanel platform={platform} />}
      </div>
    </ErrorBoundary>
  )
}
