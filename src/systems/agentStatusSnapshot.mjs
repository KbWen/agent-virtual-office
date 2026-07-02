import { agentSourceList, agentStatus, attentionItems, presenceRows } from './agentStatusModel.mjs'

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
    statusSource: state.statusSource || 'organic',
    integrationSource: state.integrationSource || null,
    integrationHealth: state.integrationHealth || null,
    activeWorkflow: state.activeWorkflow || null,
    activeCount: allAgents.filter((agent) => agent.status !== 'idle').length,
    tokens: state.tokens || null,
    effort: state.effort || null,
    mood: state.mood || null,
  }
}
