/**
 * Living-office event honesty gate (PURE).
 *
 * WORK-CLAIM events imply a real coding outcome, so alternate renderers should apply
 * the same eligibility policy without importing the office-life timers or store code.
 */

export const WORK_CLAIM_SIGNAL_WINDOW = 90_000
export const LIVE_FLOOR_FIRE_CHANCE = 0.3
export const LIVE_FLOOR_PULSE_THRESHOLD = 0.2

export const WORK_CLAIM_GATE_IDS = Object.freeze([
  'deploy-success',
  'ops-dev-deploy-check',
  'dev-arch-disagree',
  'eureka',
  'review-debate',
])

export function recentWorkSignal(signal, now = Date.now(), window = WORK_CLAIM_SIGNAL_WINDOW) {
  if (!signal?.changedAt) return false
  const changedAt = Number(signal?.changedAt)
  return Number.isFinite(changedAt) && (now - changedAt) < window
}

export function eventWorkClaimGate(eventId, state = {}, now = Date.now(), { signalWindow = WORK_CLAIM_SIGNAL_WINDOW } = {}) {
  const externalStatus = state?.externalStatus || {}
  switch (eventId) {
    case 'deploy-success':
    case 'ops-dev-deploy-check':
      return recentWorkSignal(externalStatus.ops, now, signalWindow)
    case 'dev-arch-disagree':
      return state?.mood === 'frustrated' || state?.mood === 'stuck'
    case 'eureka':
      return state?.mood === 'smooth'
    case 'review-debate':
      return recentWorkSignal(externalStatus.qa, now, signalWindow) ||
        recentWorkSignal(externalStatus.gate, now, signalWindow)
    default:
      return null
  }
}

export function eventEligible(event, state = {}, now = Date.now(), options = {}) {
  if (!event) return false
  const gate = eventWorkClaimGate(event.id, state, now, options)
  return gate === null ? true : Boolean(gate)
}

export function eligibleEvents(pool, state = {}, now = Date.now(), options = {}) {
  return (pool || []).filter((event) => eventEligible(event, state, now, options))
}

export function pickEligibleEvent(pool, state = {}, {
  now = Date.now(),
  random = Math.random,
  signalWindow = WORK_CLAIM_SIGNAL_WINDOW,
} = {}) {
  const eligible = eligibleEvents(pool, state, now, { signalWindow })
  if (eligible.length === 0) return null
  const index = Math.min(eligible.length - 1, Math.floor(random() * eligible.length))
  return eligible[index]
}

export function floorTickState(state = {}, {
  liveFloorFireChance = LIVE_FLOOR_FIRE_CHANCE,
  pulseThreshold = LIVE_FLOOR_PULSE_THRESHOLD,
} = {}) {
  const statusSource = state?.statusSource || null
  const teamPulse = Number(state?.teamPulse || 0)
  const live = (statusSource === 'external' || statusSource === 'fallback') && teamPulse > pulseThreshold
  return {
    live,
    chance: live ? liveFloorFireChance : 1,
    statusSource,
    teamPulse,
  }
}

export function floorTickAllowed(state = {}, {
  random = Math.random,
  liveFloorFireChance = LIVE_FLOOR_FIRE_CHANCE,
  pulseThreshold = LIVE_FLOOR_PULSE_THRESHOLD,
} = {}) {
  const floor = floorTickState(state, { liveFloorFireChance, pulseThreshold })
  return !floor.live || random() < floor.chance
}

export function buildEventGateViewModel(event, state = {}, {
  now = Date.now(),
  signalWindow = WORK_CLAIM_SIGNAL_WINDOW,
} = {}) {
  const eventId = event?.id || null
  const gate = eventId ? eventWorkClaimGate(eventId, state, now, { signalWindow }) : false
  return {
    eventId,
    eligible: eventEligible(event, state, now, { signalWindow }),
    workClaim: gate !== null,
    gate,
  }
}
