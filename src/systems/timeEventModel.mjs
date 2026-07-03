export const TIME_EVENT_KIND = Object.freeze({
  LUNCH_NAP: 'lunch-nap',
  DROWSY: 'drowsy',
  CATALOG_EVENT: 'catalog-event',
})

export const TIME_EVENT_REASON = Object.freeze({
  DUE: 'due',
  CANCELLED: 'cancelled',
  PAUSED: 'paused',
  ACTIVE_EVENT: 'active-event',
  SAME_HOUR: 'same-hour',
  NO_MATCH: 'no-match',
})

export const TIME_EVENT_RULES = Object.freeze([
  Object.freeze({ hour: 12, kind: TIME_EVENT_KIND.LUNCH_NAP, eventId: 'lunch-nap', durationMs: 45_000 }),
  Object.freeze({ hour: 14, kind: TIME_EVENT_KIND.DROWSY, eventId: 'post-lunch-drowsy', durationMs: 30_000 }),
  Object.freeze({ hour: 10, kind: TIME_EVENT_KIND.CATALOG_EVENT, eventId: 'tea-break' }),
  Object.freeze({ hour: 15, kind: TIME_EVENT_KIND.CATALOG_EVENT, eventId: 'tea-break' }),
  Object.freeze({ hour: 15, day: 5, kind: TIME_EVENT_KIND.CATALOG_EVENT, eventId: 'group-meeting' }),
])

export function timeEventRulesFor({ hour, day = null } = {}) {
  return TIME_EVENT_RULES.filter((rule) => (
    rule.hour === hour && (rule.day == null || rule.day === day)
  ))
}

export function timeEventDecision(state = {}, {
  day = new Date().getDay(),
  lastTriggeredHour = -1,
  cancelled = false,
} = {}) {
  const hour = Number(state?.hour)
  const currentLastTriggeredHour = Number.isFinite(Number(lastTriggeredHour)) ? Number(lastTriggeredHour) : -1

  if (cancelled) {
    return { fire: false, reason: TIME_EVENT_REASON.CANCELLED, events: [], nextLastTriggeredHour: currentLastTriggeredHour }
  }
  if (state?.isPaused) {
    return { fire: false, reason: TIME_EVENT_REASON.PAUSED, events: [], nextLastTriggeredHour: currentLastTriggeredHour }
  }
  if (state?.activeEvent) {
    return { fire: false, reason: TIME_EVENT_REASON.ACTIVE_EVENT, events: [], nextLastTriggeredHour: currentLastTriggeredHour }
  }
  if (hour === currentLastTriggeredHour) {
    return { fire: false, reason: TIME_EVENT_REASON.SAME_HOUR, events: [], nextLastTriggeredHour: currentLastTriggeredHour }
  }

  const events = timeEventRulesFor({ hour, day })
  return {
    fire: events.length > 0,
    reason: events.length > 0 ? TIME_EVENT_REASON.DUE : TIME_EVENT_REASON.NO_MATCH,
    events,
    nextLastTriggeredHour: hour,
  }
}

export function selectableLunchNapAgents(agents = {}, { random = Math.random } = {}) {
  return Object.keys(agents).filter((id) => !agents[id]?.inGroupEvent && random() < 0.5)
}

export function selectableDrowsyAgents(agents = {}) {
  return Object.keys(agents).filter((id) => !agents[id]?.inGroupEvent)
}

export function drowsyReleaseAction(agent) {
  if (!agent || agent.inGroupEvent || agent.expression !== 'tired') return null
  return {
    behavior: agent.behavior,
    expression: 'normal',
    bubble: null,
  }
}

export function buildTimeEventViewModel(state = {}, options = {}) {
  const decision = timeEventDecision(state, options)
  return {
    ...decision,
    eventIds: decision.events.map((event) => event.eventId),
    nappers: decision.events.some((event) => event.kind === TIME_EVENT_KIND.LUNCH_NAP)
      ? selectableLunchNapAgents(state.agents, options)
      : [],
    drowsyIds: decision.events.some((event) => event.kind === TIME_EVENT_KIND.DROWSY)
      ? selectableDrowsyAgents(state.agents)
      : [],
  }
}
