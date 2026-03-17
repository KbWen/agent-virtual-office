import React, { useMemo } from 'react'
import IsometricOffice from './components/PixelOffice'
import ControlPanel from './components/ControlPanel'
import { detectPlatform, getPlatformConfig } from './systems/platformDetect'

export default function App() {
  const platform = useMemo(() => detectPlatform(), [])
  const config = useMemo(() => getPlatformConfig(platform), [platform])

  return (
    <div className="w-screen h-screen bg-[#F5F2EB] dark:bg-[#1a1814] flex flex-col items-center justify-center overflow-hidden">
      <IsometricOffice animationQuality={config.animationQuality} />
      {config.showControlPanel && <ControlPanel platform={platform} />}
    </div>
  )
}
