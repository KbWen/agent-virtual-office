import { attentionItems, presenceRows } from './agentStatusModel.mjs'

export function attentionStripState({ agents = [], externalStatus = {}, nameForId = (id) => id } = {}) {
  const items = attentionItems({ agents, externalStatus, nameForId })
  return {
    count: items.length,
    items,
    names: items.map((item) => item.name),
  }
}

export function controlPanelPresenceRows({ agents = [], externalStatus = {} } = {}) {
  return presenceRows({ agents, externalStatus })
}
