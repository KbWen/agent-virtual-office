import { WORK_CLAIM_GATE_IDS } from './eventGateModel.mjs'
import { MOOD_SEED_EVENT, OPS_DONE_SEED_EVENT } from './eventSeedModel.mjs'

export const EVENT_CADENCE = Object.freeze({
  DAILY: 'daily',
  RARE: 'rare',
})

export const EVENT_CATEGORY = Object.freeze({
  SOCIAL: 'social',
  WORLD: 'world',
  WORK_CLAIM: 'work-claim',
})

export const PARTICIPANT_SELECTOR = Object.freeze({
  ALL: 'all',
  RANDOM_2_3: 'random-2-3',
  RANDOM_1_NEIGHBOR: 'random-1-neighbor',
  ROLE_ARRAY: 'role-array',
  UNKNOWN: 'unknown',
})

export const INTERACTIVE_REACTION = Object.freeze({
  'deploy-success': Object.freeze({ reactorId: 'ops', bubbleKey: 'deploy-idle' }),
  eureka: Object.freeze({ reactorId: 'arch', bubbleKey: 'eureka-idle' }),
})

export const EVENT_CATEGORY_BY_ID = Object.freeze({
  'deploy-success': EVENT_CATEGORY.WORK_CLAIM,
  'ops-dev-deploy-check': EVENT_CATEGORY.WORK_CLAIM,
  'dev-arch-disagree': EVENT_CATEGORY.WORK_CLAIM,
  eureka: EVENT_CATEGORY.WORK_CLAIM,
  'review-debate': EVENT_CATEGORY.WORK_CLAIM,
  'dog-visit': EVENT_CATEGORY.WORLD,
  'boss-visit': EVENT_CATEGORY.WORLD,
  'ac-broken': EVENT_CATEGORY.WORLD,
  'food-delivery': EVENT_CATEGORY.WORLD,
  'coffee-spill': EVENT_CATEGORY.WORLD,
})

export function flattenEventCatalog(catalog = {}) {
  const rows = []
  for (const cadence of [EVENT_CADENCE.DAILY, EVENT_CADENCE.RARE]) {
    for (const event of catalog?.[cadence] || []) {
      rows.push({ ...event, cadence })
    }
  }
  return rows
}

export function eventById(catalog = {}) {
  const out = {}
  for (const event of flattenEventCatalog(catalog)) out[event.id] = event
  return out
}

export function participantSelectorKind(participants) {
  if (participants === 'all') return PARTICIPANT_SELECTOR.ALL
  if (participants === 'random-2-3') return PARTICIPANT_SELECTOR.RANDOM_2_3
  if (participants === 'random-1-neighbor') return PARTICIPANT_SELECTOR.RANDOM_1_NEIGHBOR
  if (Array.isArray(participants)) return PARTICIPANT_SELECTOR.ROLE_ARRAY
  return PARTICIPANT_SELECTOR.UNKNOWN
}

export function eventCategory(eventOrId) {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id
  return EVENT_CATEGORY_BY_ID[id] || EVENT_CATEGORY.SOCIAL
}

export function eventHasExplicitCategory(eventOrId) {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id
  return Boolean(EVENT_CATEGORY_BY_ID[id])
}

export function interactiveReactionForEvent(eventOrId) {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id
  return INTERACTIVE_REACTION[id] || null
}

export function seedSourcesForEvent(eventOrId) {
  const id = typeof eventOrId === 'string' ? eventOrId : eventOrId?.id
  const sources = []
  for (const [mood, eventId] of Object.entries(MOOD_SEED_EVENT)) {
    if (eventId === id) sources.push({ source: 'mood-edge', value: mood })
  }
  if (id === OPS_DONE_SEED_EVENT) sources.push({ source: 'ops-done-edge', value: 'done' })
  return sources
}

export function buildEventCatalogEntry(event, cadence = null) {
  const category = eventCategory(event)
  return {
    id: event?.id || null,
    cadence: cadence || event?.cadence || null,
    name: event?.name || '',
    durationMs: Number.isFinite(Number(event?.duration)) ? Number(event.duration) : null,
    category,
    workClaim: category === EVENT_CATEGORY.WORK_CLAIM,
    participantSelector: participantSelectorKind(event?.participants),
    participants: Array.isArray(event?.participants) ? [...event.participants] : event?.participants || null,
    interactiveReaction: interactiveReactionForEvent(event),
    seedSources: seedSourcesForEvent(event),
  }
}

export function buildEventCatalogViewModel(catalog = {}) {
  const events = flattenEventCatalog(catalog).map((event) => buildEventCatalogEntry(event))
  const byId = {}
  const byCadence = { [EVENT_CADENCE.DAILY]: [], [EVENT_CADENCE.RARE]: [] }
  const byCategory = {
    [EVENT_CATEGORY.SOCIAL]: [],
    [EVENT_CATEGORY.WORLD]: [],
    [EVENT_CATEGORY.WORK_CLAIM]: [],
  }

  for (const event of events) {
    byId[event.id] = event
    if (byCadence[event.cadence]) byCadence[event.cadence].push(event.id)
    if (byCategory[event.category]) byCategory[event.category].push(event.id)
  }

  return {
    events,
    byId,
    byCadence,
    byCategory,
    workClaimIds: byCategory[EVENT_CATEGORY.WORK_CLAIM],
    interactiveIds: Object.keys(INTERACTIVE_REACTION),
  }
}

export function validateEventCatalogPortability(catalog = {}, {
  allowedRoles = [],
  requireExplicitCategory = false,
} = {}) {
  const view = buildEventCatalogViewModel(catalog)
  const ids = new Set(view.events.map((event) => event.id))
  const allowedRoleSet = new Set(allowedRoles)
  const missingWorkClaimEvents = WORK_CLAIM_GATE_IDS.filter((id) => !ids.has(id))
  const missingInteractiveEvents = Object.keys(INTERACTIVE_REACTION).filter((id) => !ids.has(id))
  const unknownParticipantEvents = view.events
    .filter((event) => event.participantSelector === PARTICIPANT_SELECTOR.UNKNOWN)
    .map((event) => event.id)
  const uncategorizedEvents = requireExplicitCategory
    ? view.events.filter((event) => !eventHasExplicitCategory(event.id)).map((event) => event.id)
    : []
  const invalidRoleEvents = allowedRoleSet.size
    ? view.events
      .filter((event) => Array.isArray(event.participants) && event.participants.some((role) => !allowedRoleSet.has(role)))
      .map((event) => event.id)
    : []
  const duplicateIds = view.events
    .map((event) => event.id)
    .filter((id, index, arr) => id && arr.indexOf(id) !== index)

  return {
    valid: missingWorkClaimEvents.length === 0 &&
      missingInteractiveEvents.length === 0 &&
      unknownParticipantEvents.length === 0 &&
      uncategorizedEvents.length === 0 &&
      invalidRoleEvents.length === 0 &&
      duplicateIds.length === 0,
    missingWorkClaimEvents,
    missingInteractiveEvents,
    unknownParticipantEvents,
    uncategorizedEvents,
    invalidRoleEvents,
    duplicateIds,
  }
}
