import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useOfficeStore, STATUS_COLORS } from '../systems/store'
import { charName, behaviorLabel, t, useLocale, eventName } from '../i18n'
import { CharacterPixelSprite } from './AgentCharacter'
import { agentLineLabel } from './ControlPanel'

// Vertical roster widget for a TALL-NARROW column (docked beside your editor). Shows EVERY
// role as a compact card — the real chibi sprite + name + status colour + what they're doing —
// so nothing is cropped off and everything stays readable at a glance, unlike a zoomed scene
// crop. No scene/movement; reuses the existing sprites + status/behavior labels + classifier.
function RosterCard({ agent, ext, reducedMotion }) {
  const name = charName(agent.id)
  const status = ext?.status || agent.status || 'idle'
  const color = STATUS_COLORS[status] || '#888'
  const label = ext ? agentLineLabel(ext, t) : behaviorLabel(agent.behavior)
  const blocked = status === 'blocked'
  const bubble = agent.bubble
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${
        blocked
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-white/80 dark:bg-gray-800/70 border-gray-100 dark:border-gray-700'
      }`}
    >
      <svg viewBox="-18 -40 36 46" width="34" height="44" className="shrink-0" aria-hidden="true">
        <CharacterPixelSprite charId={agent.id} expression={agent.expression || 'normal'} isMoving={false} walkFrame={0} facing="down" />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{name}</span>
          {status !== 'idle' && (
            <span className={`text-[9px] uppercase tracking-wide ${blocked ? 'text-red-500' : 'text-gray-400'}`}>{status}</span>
          )}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{bubble || label}</div>
      </div>
    </div>
  )
}

// Auto-mounted (by PixelOffice) when the container is a tall-narrow column. Lists all home roles;
// caps simultaneous re-render cost by reading only coarse per-agent fields via useShallow.
export default function NarrowRoster() {
  useLocale() // re-render on language switch
  const agents = useOfficeStore(useShallow((s) => Object.values(s.agents).filter((a) => !a.session)))
  const externalStatus = useOfficeStore(useShallow((s) => s.externalStatus))
  const activeEvent = useOfficeStore(useShallow((s) => s.activeEvent))
  const reducedMotion = useOfficeStore((s) => s.reducedMotion)

  return (
    <div className="w-full min-h-full bg-gray-50 dark:bg-gray-900 p-2 flex flex-col gap-1.5" data-narrow-roster="1">
      {activeEvent && (
        <div
          className={`text-[11px] text-center font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded py-1 ${reducedMotion ? '' : 'animate-pulse'}`}
          data-roster-event="1"
        >
          {activeEvent.id ? eventName(activeEvent.id) : activeEvent.name}
        </div>
      )}
      {agents.map((a) => (
        <RosterCard key={a.id} agent={a} ext={externalStatus[a.id]} reducedMotion={reducedMotion} />
      ))}
    </div>
  )
}
