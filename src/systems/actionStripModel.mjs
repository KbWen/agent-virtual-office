import { healthDotState } from './integrationStatusModel.mjs'
export {
  agentLineToken,
  blockedReasonPreview,
  formatTokens,
} from './actionStripLineModel.mjs'
export {
  attentionStripState,
  controlPanelPresenceRows,
} from './actionStripPresenceModel.mjs'
import {
  attentionStripState,
  controlPanelPresenceRows,
} from './actionStripPresenceModel.mjs'

export function buildActionStripViewModel({
  agents = [],
  externalStatus = {},
  nameForId = (id) => id,
  statusSource = 'organic',
  integrationHealth = null,
} = {}) {
  return {
    attention: attentionStripState({ agents, externalStatus, nameForId }),
    health: healthDotState({
      statusSource,
      integrationHealth,
      externalCount: Object.keys(externalStatus || {}).length,
    }),
    presence: controlPanelPresenceRows({ agents, externalStatus }),
  }
}
