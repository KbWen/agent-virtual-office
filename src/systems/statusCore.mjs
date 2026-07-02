// Public headless status API for package consumers.
//
// This file intentionally re-exports existing node-safe modules instead of defining new behavior.
// It gives alternate renderers a single stable import path for transport normalization, status
// runtime patching, roster/team view-models, and full status snapshots.

export {
  AGENT_CARRY_FIELDS,
  BLOCKED_REASONS,
  FIELD_SANITIZERS,
  MAX_MOOD_DURATION,
  MAX_AGENT_ID_LENGTH,
  nextSeq,
  normalizeAgentStatusUpdates,
  normalizePost,
  sanitizeAgentId,
  sanitizeCarryFields,
  VALID_MOODS,
  VALID_ROLES,
  VALID_STATUSES,
} from '../utils/statusContract.mjs'

export {
  assembleIntegrationPatch,
  buildDynamicStatusAgent,
  buildExternalStatusEntry,
  isDynamicStatusAgent,
  reconcileMultiSessionAgents,
} from './statusRuntime.mjs'

export {
  agentSourceList,
  agentStatus,
  attentionItems,
  hasCurrentSignal,
  presenceRows,
} from './agentStatusModel.mjs'

export {
  buildAgentStatusSnapshot,
} from './agentStatusSnapshot.mjs'

export {
  healthDotState,
} from './integrationStatusModel.mjs'

export {
  comparePresence,
  FEED_ORIGINS,
  feedEntries,
  isFeedWorthy,
  isIdleStatus,
  PRESENCE_TIER,
  salienceTier,
  teamStatus,
} from './rosterModel.mjs'
