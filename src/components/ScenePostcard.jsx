import React from 'react'
import { t, useLocale } from '../i18n'

export default function ScenePostcard({ onOpen, sceneScale = 1 }) {
  useLocale()
  const hitSize = Math.min(120, Math.max(32, 44 / Math.max(0.1, sceneScale)))
  const hintScale = Math.min(2.8, Math.max(1, 1 / Math.max(0.1, sceneScale)))
  const activate = event => {
    event.stopPropagation()
    event.currentTarget.focus()
    onOpen()
  }
  return (
    <g transform="translate(256, 73)" role="button" tabIndex={0}
      aria-label={t('cozy.sceneCardAria', 'Pick up the postcard on the notice board')}
      data-scene-cozy="postcard" onClick={activate}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        if (!event.repeat) activate(event)
      }}>
      <title>{t('cozy.sceneCardHint', 'Pick it up for a closer look')}</title>
      <rect x={-hitSize / 2} y={-hitSize / 2} width={hitSize} height={hitSize}
        fill="transparent" pointerEvents="all" />
      <g className="cozy-postcard-paper">
        <rect x={-9} y={-6} width={20} height={16} rx={1} fill="#433323" opacity="0.18" />
        <rect x={-10} y={-8} width={20} height={16} rx={1} fill="#FFF6DE" stroke="#D4BC8E" strokeWidth="0.7" />
        <rect x={-8} y={-6} width={11} height={9} fill="#B9DCE1" />
        <circle cx={-1} cy={-3.5} r={1.8} fill="#FFD068" />
        <path d="M-8 3V0L-5-2-2 1 0-1 3 2V3Z" fill="#79A476" />
        <path d="M5-3h3M5-1h3M-7 5h13" stroke="#BD9E7C" strokeWidth="0.6" />
        <path d="M7 8h3V5Z" fill="#E5D3AD" />
      </g>
      <circle cx={0} cy={-9} r={1.5} fill="#C66B5E" pointerEvents="none" />
      <g data-scene-cozy-hint="postcard" transform={`translate(0, 19) scale(${hintScale})`} pointerEvents="none">
        <rect x={-58} y={0} width={116} height={17} rx={4} fill="#FFF9ED" stroke="#D4BC8E" strokeWidth="0.5" />
        <text x={0} y={11} textAnchor="middle" fontSize={8} fill="#755A3E">{t('cozy.sceneCardHint', 'Pick it up for a closer look')}</text>
      </g>
    </g>
  )
}
