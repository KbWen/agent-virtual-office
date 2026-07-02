import { agentSourceList, agentStatus, attentionItems, presenceRows } from './agentStatusModel.mjs'
import { characterIndicatorState, characterStatusVisual } from './agentCharacterModel.mjs'
import { healthDotState } from './integrationStatusModel.mjs'
import { statusVisualState } from './statusVisualModel.mjs'

function hasHelper(helpers, id) {
  return Array.isArray(helpers) && helpers.some((helper) => helper?.parentRole === id)
}

function agentSnapshot(agent, ext, nameForId, context = {}) {
  const id = agent.id
  const status = agentStatus(agent, ext)
  return {
    id,
    name: nameForId(id) || id,
    status,
    visual: statusVisualState(status),
    character: {
      ...characterStatusVisual({
        status,
        color: agent.color || '#888',
        hasActiveHelper: hasHelper(context.helpers, id),
        effort: context.effort || null,
      }),
      indicator: characterIndicatorState({
        status,
        behavior: agent.behavior || 'idle',
        reasonCode: ext?.reasonCode || null,
      }),
    },
    localStatus: agent.status || 'idle',
    hasExternalStatus: !!ext,
    task: ext?.task || null,
    label: ext?.label || null,
    reasonCode: ext?.reasonCode || null,
    activeFile: ext?.activeFile || null,
    changedAt: ext?.changedAt || null,
    expiresAt: ext?.expiresAt || null,
    session: agent.session || null,
  }
}

function rowSnapshot(row, nameForId, context) {
  return agentSnapshot(row.agent, row.ext, nameForId, context)
}

export function buildAgentStatusSnapshot(state = {}, { nameForId = (id) => id } = {}) {
  const agents = agentSourceList(state.agents).filter((agent) => agent?.id)
  const externalStatus = state.externalStatus || {}
  const statusSource = state.statusSource || 'organic'
  const integrationSource = state.integrationSource || null
  const integrationHealth = state.integrationHealth || null
  const context = {
    effort: state.effort || null,
    helpers: state.helpers || [],
  }
  const externalCount = Object.keys(externalStatus).length
  const allAgents = agents.map((agent) => agentSnapshot(agent, externalStatus[agent.id], nameForId, context))
  const attention = attentionItems({ agents, externalStatus, nameForId })
  const presence = presenceRows({ agents, externalStatus })

  return {
    agents: allAgents,
    attention: {
      count: attention.length,
      items: attention,
    },
    presence: {
      rows: presence.rows.map((row) => rowSnapshot(row, nameForId, context)),
      quietCount: presence.quietCount,
    },
    statusSource,
    integrationSource,
    integrationHealth,
    integration: {
      source: statusSource,
      integrationSource,
      externalCount,
      health: healthDotState({ statusSource, integrationHealth, externalCount }),
    },
    activeWorkflow: state.activeWorkflow || null,
    activeCount: allAgents.filter((agent) => agent.status !== 'idle').length,
    tokens: state.tokens || null,
    effort: state.effort || null,
    mood: state.mood || null,
  }
}
