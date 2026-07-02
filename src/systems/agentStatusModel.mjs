// Headless agent-status view model.
//
// Keep this free of React, i18n, DOM, and pixel-office concepts so other frontends can reuse the
// same status truth without importing component helpers.

export function agentStatus(agent, ext) {
  return ext?.status || agent?.status || 'idle'
}

export function hasCurrentSignal(ext) {
  return !!(ext?.task || ext?.label || ext?.reasonCode)
}

export function agentSourceList(agents = []) {
  return Array.isArray(agents) ? agents : Object.values(agents || {})
}

export function presenceRows({ agents = [], externalStatus = {} } = {}) {
  const source = agentSourceList(agents)
  const rows = []
  for (const agent of source) {
    const id = agent?.id
    if (!id) continue
    const ext = externalStatus[id]
    const status = agentStatus(agent, ext)
    if (status !== 'idle' || hasCurrentSignal(ext)) rows.push({ agent, ext, status })
  }
  return {
    rows,
    quietCount: Math.max(0, source.filter((agent) => agent?.id).length - rows.length),
  }
}

export function attentionItems({ agents = [], externalStatus = {}, nameForId = (id) => id } = {}) {
  const items = []
  for (const agent of agentSourceList(agents)) {
    const id = agent?.id
    if (!id) continue
    const status = agentStatus(agent, externalStatus[id])
    if (status !== 'blocked' && status !== 'awaiting-approval') continue
    items.push({ id, status, name: nameForId(id) || id })
  }
  return items
}
