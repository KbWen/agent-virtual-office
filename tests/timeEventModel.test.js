import { describe, expect, it } from 'vitest'
import {
  TIME_EVENT_KIND,
  TIME_EVENT_REASON,
  TIME_EVENT_RULES,
  buildTimeEventViewModel,
  drowsyReleaseAction,
  selectableDrowsyAgents,
  selectableLunchNapAgents,
  timeEventDecision,
  timeEventRulesFor,
} from '../src/systems/timeEventModel.mjs'

describe('timeEventModel public API', () => {
  it('documents the current time-linked event rules', () => {
    expect(TIME_EVENT_RULES).toEqual([
      { hour: 12, kind: TIME_EVENT_KIND.LUNCH_NAP, eventId: 'lunch-nap', durationMs: 45_000 },
      { hour: 14, kind: TIME_EVENT_KIND.DROWSY, eventId: 'post-lunch-drowsy', durationMs: 30_000 },
      { hour: 10, kind: TIME_EVENT_KIND.CATALOG_EVENT, eventId: 'tea-break' },
      { hour: 15, kind: TIME_EVENT_KIND.CATALOG_EVENT, eventId: 'tea-break' },
      { hour: 15, day: 5, kind: TIME_EVENT_KIND.CATALOG_EVENT, eventId: 'group-meeting' },
    ])
  })

  it('returns due events and advances lastTriggeredHour once per hour', () => {
    expect(timeEventDecision({ hour: 10 }, { day: 1, lastTriggeredHour: -1 })).toMatchObject({
      fire: true,
      reason: TIME_EVENT_REASON.DUE,
      nextLastTriggeredHour: 10,
      events: [{ eventId: 'tea-break' }],
    })
    expect(timeEventDecision({ hour: 10 }, { day: 1, lastTriggeredHour: 10 })).toEqual({
      fire: false,
      reason: TIME_EVENT_REASON.SAME_HOUR,
      events: [],
      nextLastTriggeredHour: 10,
    })
  })

  it('preserves Friday 15:00 legacy ordering as tea-break then group-meeting', () => {
    expect(timeEventRulesFor({ hour: 15, day: 5 }).map((event) => event.eventId)).toEqual([
      'tea-break',
      'group-meeting',
    ])
    expect(timeEventDecision({ hour: 15 }, { day: 5, lastTriggeredHour: -1 }).events.map((event) => event.eventId)).toEqual([
      'tea-break',
      'group-meeting',
    ])
  })

  it('does not advance the hour marker when cancelled, paused, or mutexed', () => {
    for (const [state, options, reason] of [
      [{ hour: 12 }, { cancelled: true, lastTriggeredHour: 9 }, TIME_EVENT_REASON.CANCELLED],
      [{ hour: 12, isPaused: true }, { lastTriggeredHour: 9 }, TIME_EVENT_REASON.PAUSED],
      [{ hour: 12, activeEvent: { id: 'tea-break' } }, { lastTriggeredHour: 9 }, TIME_EVENT_REASON.ACTIVE_EVENT],
    ]) {
      expect(timeEventDecision(state, options)).toEqual({
        fire: false,
        reason,
        events: [],
        nextLastTriggeredHour: 9,
      })
    }
  })

  it('still advances the marker for hours with no matching event', () => {
    expect(timeEventDecision({ hour: 9 }, { day: 1, lastTriggeredHour: -1 })).toEqual({
      fire: false,
      reason: TIME_EVENT_REASON.NO_MATCH,
      events: [],
      nextLastTriggeredHour: 9,
    })
  })

  it('selects lunch-nap and drowsy agents without touching group-event participants', () => {
    const agents = {
      dev: { behavior: 'typing', expression: 'normal' },
      qa: { behavior: 'typing', expression: 'normal', inGroupEvent: true },
      ops: { behavior: 'deploy', expression: 'tired' },
    }

    expect(selectableLunchNapAgents(agents, { random: () => 0.49 })).toEqual(['dev', 'ops'])
    expect(selectableLunchNapAgents(agents, { random: () => 0.5 })).toEqual([])
    expect(selectableDrowsyAgents(agents)).toEqual(['dev', 'ops'])
    expect(drowsyReleaseAction(agents.ops)).toEqual({ behavior: 'deploy', expression: 'normal', bubble: null })
    expect(drowsyReleaseAction({ ...agents.ops, inGroupEvent: true })).toBeNull()
    expect(drowsyReleaseAction({ ...agents.dev, expression: 'normal' })).toBeNull()
  })

  it('returns a renderer-facing view-model for alternate offices', () => {
    const vm = buildTimeEventViewModel({
      hour: 12,
      agents: {
        dev: { expression: 'normal' },
        qa: { expression: 'normal', inGroupEvent: true },
      },
    }, {
      day: 1,
      lastTriggeredHour: -1,
      random: () => 0.1,
    })

    expect(vm).toMatchObject({
      fire: true,
      reason: TIME_EVENT_REASON.DUE,
      eventIds: ['lunch-nap'],
      nappers: ['dev'],
      drowsyIds: [],
      nextLastTriggeredHour: 12,
    })
  })
})
