import { agentSourceList, agentStatus, attentionItems, presenceRows } from './agentStatusModel.mjs'
import { healthDotState } from './integrationStatusModel.mjs'

function agentSnapshot(agent, ext, nameForId) {
  const id = agent.id
  return {
    id,
    name: nameForId(id) || id,
    status: agentStatus(agent, ext),
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

function rowSnapshot(row, nameForId) {
  return agentSnapshot(row.agent, row.ext, nameForId)
}

export function buildAgentStatusSnapshot(state = {}, { nameForId = (id) => id } = {}) {
  const agents = agentSourceList(state.agents).filter((agent) => agent?.id)
  const externalStatus = state.externalStatus || {}
  const statusSource = state.statusSource || 'organic'
  const integrationSource = state.integrationSource || null
  const integrationHealth = state.integrationHealth || null
  const externalCount = Object.keys(externalStatus).length
  const allAgents = agents.map((agent) => agentSnapshot(agent, externalStatus[agent.id], nameForId))
  const attention = attentionItems({ agents, externalStatus, nameForId })
  const presence = presenceRows({ agents, externalStatus })

  return {
    agents: allAgents,
    attention: {
      count: attention.length,
      items: attention,
    },
    presence: {
      rows: presence.rows.map((row) => rowSnapshot(row, nameForId)),
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
