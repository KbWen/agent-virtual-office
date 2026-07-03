export const EVENT_JUICE = Object.freeze({
  'deploy-success': Object.freeze({
    kind: 'confetti',
    count: 14,
    durationMs: 1200,
    animationName: 'office-confetti',
    delayStepMs: 40,
    anchor: Object.freeze({ x: 360, y: 130 }),
    layer: 'floor-cosmetic',
    semanticState: false,
  }),
  eureka: Object.freeze({
    kind: 'sparkle',
    count: 6,
    durationMs: 900,
    animationName: 'office-sparkle',
    delayStepMs: 70,
    anchor: Object.freeze({ x: 537, y: 282 }),
    offset: Object.freeze({ x: 35, y: 10 }),
    radius: Object.freeze({ x: 15, y: 12 }),
    layer: 'floor-cosmetic',
    semanticState: false,
  }),
})

export const JUICED_EVENT_IDS = Object.freeze(Object.keys(EVENT_JUICE))

export function juiceForEvent(eventId, { reducedMotion = false } = {}) {
  if (reducedMotion) return null
  const juice = EVENT_JUICE[eventId]
  return juice ? { ...juice, eventId } : null
}

export function shouldShakeDesk(behavior, reducedMotion = false) {
  return !reducedMotion && behavior === 'desk-slam'
}

export function buildEventJuiceViewModel(eventId, options = {}) {
  const juice = juiceForEvent(eventId, options)
  if (!juice) {
    return {
      visible: false,
      eventId: eventId || null,
      juice: null,
      particles: [],
      semanticState: false,
    }
  }

  const particles = Array.from({ length: juice.count }, (_, index) => ({
    key: `${juice.eventId}-${index}`,
    index,
    delayMs: index * juice.delayStepMs,
  }))

  return {
    visible: true,
    eventId: juice.eventId,
    juice,
    particles,
    pointerEvents: 'none',
    ariaHidden: true,
    semanticState: false,
  }
}
