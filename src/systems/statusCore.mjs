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
  activityAgeMs,
  activityFeedEntries,
  activityIconKey,
  activityOpacity,
  activityTone,
  buildActivityFeedEntryView,
  buildActivityFeedViewModel,
  isActivityForAgent,
} from './activityFeedModel.mjs'

export {
  STATUS_COLORS,
  statusColor,
  statusVisualState,
} from './statusVisualModel.mjs'

export {
  agentLineToken,
  attentionStripState,
  blockedReasonPreview,
  buildActionStripViewModel,
  controlPanelPresenceRows,
  formatTokens,
} from './actionStripModel.mjs'

export {
  assembleIntegrationPatch,
  buildDynamicStatusAgent,
  buildExternalStatusEntry,
  isDynamicStatusAgent,
  reconcileMultiSessionAgents,
} from './statusRuntime.mjs'

export {
  buildDoneEventKey,
  createDailyBlockedLedger,
  createDailyDoneLedger,
  ensureCurrentDailyBlockedLedger,
  ensureCurrentDailyDoneLedger,
  localDayKey,
  validatePersistedDailyBlockedLedger,
  validatePersistedDailyDoneLedger,
} from './dailyLedgerModel.mjs'

export {
  bubbleDisplayText,
  computeBubbleLayout,
  computeEdgeShift,
  estimateBubbleTextWidth,
  sanitizeBubbleText,
  speechBubbleGeometry,
} from './speechBubbleModel.mjs'

export {
  buildHelperHuddleViewModel,
  HELPER_BADGE_OFFSET,
  HELPER_COLORS,
  HELPER_HEAVY_THRESHOLD,
  HELPER_MAX_VISIBLE,
  HELPER_OFFSETS,
  helperCountByParent as helperHuddleCountByParent,
  helperHuddleSignature,
  parseHelperHuddleSignatureEntry,
  resolveAnchoredHelperLayout,
} from './helperHuddleModel.mjs'

export {
  DEFAULT_PAIR_HUDDLE_WINDOW,
  PAIR_HUDDLE_WRITE_TASKS,
  buildPairLinkViewModel,
  fileBasename,
  findSharedFilePair,
  isPairHuddleWriteTask,
  normalizeFilePath,
  pairEndpointPosition,
  pairLinkFile,
} from './pairHuddleModel.mjs'

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
  blockedReasonState,
  classifyBlockedReason,
  BLOCKED_REASON_TABLE_CODES,
} from './blockedReasonModel.mjs'

export {
  BEHAVIOR_INDICATOR_TABLE,
  behaviorIndicatorIconKey,
  behaviorIndicatorState,
  hasBehaviorIndicator,
  KNOWN_CHARACTER_BEHAVIORS,
  NO_INDICATOR_CHARACTER_BEHAVIORS,
} from './behaviorIndicatorModel.mjs'

export {
  BASE_GLOW,
  CHAR_SCALE,
  characterBubbleLayout,
  characterBubbleMessage,
  characterIndicatorState,
  characterStatusRing,
  characterStatusVisual,
  computeLabelScale,
  estimateTextWidth,
  LABEL_SCALE_MAX,
  nameTagMetrics,
} from './agentCharacterModel.mjs'

export {
  buildAgentInspectorMeta,
  countAgentDoneToday,
  inspectorAnchorPosition,
  inspectorPanelLayout,
  inspectorTaskToken,
  recentAgentActivities,
  truncateText,
  waitingStateDuration,
} from './agentInspectorModel.mjs'

export {
  healthDotState,
} from './integrationStatusModel.mjs'

export {
  GATE_SHEET_CAP,
  gatePhaseGlyph,
  gateWaiting,
} from './reviewGate.mjs'

export {
  buildPresenceRailViewModel,
  comparePresence,
  FEED_ORIGINS,
  feedEntries,
  helperCountByParent,
  isFeedWorthy,
  isIdleStatus,
  PRESENCE_TIER,
  presenceRailRows,
  presenceRailSignature,
  salienceTier,
  scopedRosterFeed,
  teamStatus,
} from './rosterModel.mjs'
