export const PORTABLE_CORE_VERSION = 'portable-core-v1'

export const PORTABLE_CORE_CAPABILITIES = Object.freeze([
  Object.freeze({ id: 'status-contract', subpath: './status-contract', layer: 'transport', category: 'status-input', aggregate: true }),
  Object.freeze({ id: 'normalize-post', subpath: './normalize-post', layer: 'transport', category: 'status-input', aggregate: false }),
  Object.freeze({ id: 'status-runtime', subpath: './status-runtime', layer: 'runtime', category: 'status-state', aggregate: true }),
  Object.freeze({ id: 'status-core', subpath: './status-core', layer: 'aggregate', category: 'status-api', aggregate: false }),
  Object.freeze({ id: 'portable-core-manifest', subpath: './portable-core-manifest', layer: 'discovery', category: 'package-map', aggregate: true }),
  Object.freeze({ id: 'daily-ledger-model', subpath: './daily-ledger-model', layer: 'runtime', category: 'progress-ledger', aggregate: true }),
  Object.freeze({ id: 'agent-status-model', subpath: './agent-status-model', layer: 'view-model', category: 'presence', aggregate: true }),
  Object.freeze({ id: 'agent-status-snapshot', subpath: './agent-status-snapshot', layer: 'view-model', category: 'presence', aggregate: true }),
  Object.freeze({ id: 'action-strip-model', subpath: './action-strip-model', layer: 'view-model', category: 'attention-strip', aggregate: true }),
  Object.freeze({ id: 'roster-model', subpath: './roster-model', layer: 'view-model', category: 'presence', aggregate: true }),
  Object.freeze({ id: 'activity-feed-model', subpath: './activity-feed-model', layer: 'view-model', category: 'activity-feed', aggregate: true }),
  Object.freeze({ id: 'integration-status-model', subpath: './integration-status-model', layer: 'view-model', category: 'integration-health', aggregate: true }),
  Object.freeze({ id: 'blocked-reason-model', subpath: './blocked-reason-model', layer: 'view-model', category: 'blocked-state', aggregate: true }),
  Object.freeze({ id: 'status-visual-model', subpath: './status-visual-model', layer: 'view-model', category: 'visual-token', aggregate: true }),
  Object.freeze({ id: 'agent-character-model', subpath: './agent-character-model', layer: 'view-model', category: 'character-rendering', aggregate: true }),
  Object.freeze({ id: 'behavior-indicator-model', subpath: './behavior-indicator-model', layer: 'view-model', category: 'behavior-rendering', aggregate: true }),
  Object.freeze({ id: 'agent-inspector-model', subpath: './agent-inspector-model', layer: 'view-model', category: 'inspection', aggregate: true }),
  Object.freeze({ id: 'speech-bubble-model', subpath: './speech-bubble-model', layer: 'view-model', category: 'speech', aggregate: true }),
  Object.freeze({ id: 'context-bubble-model', subpath: './context-bubble-model', layer: 'view-model', category: 'speech', aggregate: true }),
  Object.freeze({ id: 'bubble-visibility-model', subpath: './bubble-visibility-model', layer: 'view-model', category: 'speech', aggregate: true }),
  Object.freeze({ id: 'poke-reaction-model', subpath: './poke-reaction-model', layer: 'interaction-model', category: 'micro-interaction', aggregate: true }),
  Object.freeze({ id: 'helper-huddle-model', subpath: './helper-huddle-model', layer: 'view-model', category: 'collaboration', aggregate: true }),
  Object.freeze({ id: 'pair-huddle-model', subpath: './pair-huddle-model', layer: 'view-model', category: 'collaboration', aggregate: true }),
  Object.freeze({ id: 'review-gate-model', subpath: './review-gate-model', layer: 'view-model', category: 'approval-flow', aggregate: true }),
  Object.freeze({ id: 'workflow-handoff-model', subpath: './workflow-handoff-model', layer: 'view-model', category: 'workflow-flow', aggregate: true }),
  Object.freeze({ id: 'event-catalog-model', subpath: './event-catalog-model', layer: 'runtime', category: 'event-system', aggregate: true }),
  Object.freeze({ id: 'event-gate-model', subpath: './event-gate-model', layer: 'runtime', category: 'event-system', aggregate: true }),
  Object.freeze({ id: 'event-seed-model', subpath: './event-seed-model', layer: 'runtime', category: 'event-system', aggregate: true }),
  Object.freeze({ id: 'event-juice-model', subpath: './event-juice-model', layer: 'view-model', category: 'event-feedback', aggregate: true }),
  Object.freeze({ id: 'time-event-model', subpath: './time-event-model', layer: 'runtime', category: 'event-system', aggregate: true }),
  Object.freeze({ id: 'movement-layout-model', subpath: './movement-layout-model', layer: 'view-model', category: 'layout', aggregate: true }),
  Object.freeze({ id: 'ambient-appearance-model', subpath: './ambient-appearance-model', layer: 'view-model', category: 'ambience', aggregate: true }),
  Object.freeze({ id: 'ambient-sound-model', subpath: './ambient-sound-model', layer: 'view-model', category: 'ambience', aggregate: true }),
  Object.freeze({ id: 'pet-state-model', subpath: './pet-state-model', layer: 'view-model', category: 'companion', aggregate: true }),
])

export function portableCoreSubpaths({ aggregateOnly = false } = {}) {
  return PORTABLE_CORE_CAPABILITIES
    .filter((capability) => !aggregateOnly || capability.aggregate)
    .map((capability) => capability.subpath)
}

export function portableCoreCapabilitiesByLayer() {
  return PORTABLE_CORE_CAPABILITIES.reduce((layers, capability) => {
    const list = layers[capability.layer] ?? []
    return { ...layers, [capability.layer]: [...list, capability] }
  }, {})
}

export function portableCoreCapabilityBySubpath(subpath) {
  return PORTABLE_CORE_CAPABILITIES.find((capability) => capability.subpath === subpath) ?? null
}
