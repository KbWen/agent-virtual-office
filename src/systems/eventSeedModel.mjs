/**
 * Real-signal seeded event decision model (PURE).
 *
 * This mirrors the office-life causal layer: real signal edges may trigger a coordinated
 * event immediately, but only when the event exists, remains honest, and cooldowns allow it.
 */

import { eventEligible } from './eventGateModel.mjs'

export const DEFAULT_SEED_COOLDOWN_MS = 120_000
export const PER_EVENT_SEED_COOLDOWN_MULTIPLIER = 3

export const SEED_DECISION = Object.freeze({
  FIRE: 'fire',
  PAUSED: 'paused',
  ACTIVE_EVENT: 'active-event',
  MISSING_EVENT: 'missing-event',
  INELIGIBLE: 'ineligible',
  GLOBAL_COOLDOWN: 'global-cooldown',
  EVENT_COOLDOWN: 'event-cooldown',
  NO_CANDIDATE: 'no-candidate',
})

export const MOOD_SEED_EVENT = Object.freeze({
  frustrated: 'dev-arch-disagree',
  stuck: 'dev-arch-disagree',
  smooth: 'eureka',
})

export const OPS_DONE_SEED_EVENT = 'deploy-success'

function finiteTime(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeSeedCooldownState(seedState = {}) {
  const byEvent = {}
  const source = seedState.byEvent || seedState.seedCooldown || {}
  for (const [eventId, value] of Object.entries(source)) {
    const at = finiteTime(value, 0)
    if (at > 0) byEvent[eventId] = at
  }
  return {
    lastSeedAt: finiteTime(seedState.lastSeedAt, 0),
    byEvent,
  }
}

export function seedEventCandidates(state = {}, prev = {}) {
  if (!prev) return []
  const candidates = []

  if (state.mood !== prev.mood) {
    const moodEvent = MOOD_SEED_EVENT[state.mood]
    if (moodEvent) candidates.push({ eventId: moodEvent, source: 'mood-edge', value: state.mood })
  }

  if (state.externalStatus?.ops?.status === 'done' && prev.externalStatus?.ops?.status !== 'done') {
    candidates.push({ eventId: OPS_DONE_SEED_EVENT, source: 'ops-done-edge', value: 'done' })
  }

  return candidates
}

export function seedEventDecision(event, state = {}, {
  now = Date.now(),
  seedState = {},
  cooldownMs = DEFAULT_SEED_COOLDOWN_MS,
  perEventMultiplier = PER_EVENT_SEED_COOLDOWN_MULTIPLIER,
} = {}) {
  const eventId = event?.id || null
  const cooldown = normalizeSeedCooldownState(seedState)

  if (state?.isPaused) return { fire: false, eventId, reason: SEED_DECISION.PAUSED, cooldownState: cooldown }
  if (state?.activeEvent) return { fire: false, eventId, reason: SEED_DECISION.ACTIVE_EVENT, cooldownState: cooldown }
  if (!event) return { fire: false, eventId, reason: SEED_DECISION.MISSING_EVENT, cooldownState: cooldown }
  if (!eventEligible(event, state, now)) return { fire: false, eventId, reason: SEED_DECISION.INELIGIBLE, cooldownState: cooldown }

  if (now - cooldown.lastSeedAt < cooldownMs) {
    return { fire: false, eventId, reason: SEED_DECISION.GLOBAL_COOLDOWN, cooldownState: cooldown }
  }

  const lastEventSeedAt = cooldown.byEvent[event.id] || 0
  if (lastEventSeedAt && now - lastEventSeedAt < cooldownMs * perEventMultiplier) {
    return { fire: false, eventId, reason: SEED_DECISION.EVENT_COOLDOWN, cooldownState: cooldown }
  }

  return {
    fire: true,
    eventId: event.id,
    reason: SEED_DECISION.FIRE,
    cooldownState: {
      lastSeedAt: now,
      byEvent: { ...cooldown.byEvent, [event.id]: now },
    },
  }
}

export function selectSeedEvent(candidates, eventById, state = {}, options = {}) {
  let seedState = normalizeSeedCooldownState(options.seedState)
  const rejected = []

  for (const candidate of candidates || []) {
    const event = eventById?.[candidate.eventId]
    const decision = seedEventDecision(event, state, { ...options, seedState })
    const row = { ...candidate, ...decision }
    if (decision.fire) {
      return { fire: true, selected: row, rejected, cooldownState: decision.cooldownState }
    }
    rejected.push(row)
    seedState = decision.cooldownState
  }

  return {
    fire: false,
    selected: null,
    rejected,
    cooldownState: seedState,
    reason: rejected.length ? rejected[rejected.length - 1].reason : SEED_DECISION.NO_CANDIDATE,
  }
}

export function buildSeedEventViewModel({ state = {}, prev = {}, eventById = {}, seedState = {}, now = Date.now() } = {}) {
  const candidates = seedEventCandidates(state, prev)
  const selection = selectSeedEvent(candidates, eventById, state, { seedState, now })
  return {
    candidates,
    fire: selection.fire,
    selectedEventId: selection.selected?.eventId || null,
    reason: selection.selected?.reason || selection.reason,
    rejected: selection.rejected.map(({ eventId, source, reason }) => ({ eventId, source, reason })),
    cooldownState: selection.cooldownState,
  }
}
