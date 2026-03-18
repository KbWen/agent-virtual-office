import React, { useMemo } from 'react'
import IsometricOffice from './components/PixelOffice'
import ControlPanel from './components/ControlPanel'
import { detectPlatform, getPlatformConfig } from './systems/platformDetect'

function getDisplayMode() {
  if (typeof window === 'undefined') return 'full'
  const params = new URLSearchParams(window.location.search)
  return params.get('mode') || 'full'
}

export default function App() {
  const platform = useMemo(() => detectPlatform(), [])
  const config = useMemo(() => getPlatformConfig(platform), [platform])
  const mode = useMemo(() => getDisplayMode(), [])

  if (mode === 'panel') {
    return (
      <div className="w-full h-full bg-[#F5F2EB] dark:bg-[#1a1814] flex flex-col overflow-hidden">
        <IsometricOffice animationQuality={config.animationQuality} mode="panel" />
        <ControlPanel platform={platform} mode="panel" />
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-[#F5F2EB] dark:bg-[#1a1814] flex flex-col items-center justify-center overflow-hidden">
      <IsometricOffice animationQuality={config.animationQuality} />
      {config.showControlPanel && <ControlPanel platform={platform} />}
    </div>
  )
}
