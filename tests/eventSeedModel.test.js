import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEED_COOLDOWN_MS,
  MOOD_SEED_EVENT,
  OPS_DONE_SEED_EVENT,
  PER_EVENT_SEED_COOLDOWN_MULTIPLIER,
  SEED_DECISION,
  buildSeedEventViewModel,
  normalizeSeedCooldownState,
  seedEventCandidates,
  seedEventDecision,
  selectSeedEvent,
} from '../src/systems/eventSeedModel.mjs'
import { SEED_COOLDOWN_MS } from '../src/systems/constants.js'
import eventsData from '../src/config/officeEvents.json'

const NOW = 1_000_000
const eventById = Object.fromEntries([
  ...(eventsData.daily || []),
  ...(eventsData.rare || []),
].map((event) => [event.id, event]))

describe('eventSeedModel public API', () => {
  it('keeps public cooldown constants in parity with office-life constants', () => {
    expect(DEFAULT_SEED_COOLDOWN_MS).toBe(SEED_COOLDOWN_MS)
    expect(PER_EVENT_SEED_COOLDOWN_MULTIPLIER).toBe(3)
    expect(MOOD_SEED_EVENT).toMatchObject({
      frustrated: 'dev-arch-disagree',
      stuck: 'dev-arch-disagree',
      smooth: 'eureka',
    })
    expect(OPS_DONE_SEED_EVENT).toBe('deploy-success')
  })

  it('derives candidates from the same real edges as officeLife', () => {
    expect(seedEventCandidates({ mood: 'smooth' }, { mood: 'normal' })).toEqual([
      { eventId: 'eureka', source: 'mood-edge', value: 'smooth' },
    ])
    expect(seedEventCandidates({ mood: 'stuck' }, { mood: 'normal' })).toEqual([
      { eventId: 'dev-arch-disagree', source: 'mood-edge', value: 'stuck' },
    ])
    expect(seedEventCandidates({
      mood: 'normal',
      externalStatus: { ops: { status: 'done' } },
    }, {
      mood: 'normal',
      externalStatus: { ops: { status: 'working' } },
    })).toEqual([
      { eventId: 'deploy-success', source: 'ops-done-edge', value: 'done' },
    ])
    expect(seedEventCandidates({ helpers: [{ id: 'h1' }] }, { helpers: [] })).toEqual([])
  })

  it('blocks missing, paused, mutexed, and dishonest seed events with explicit reasons', () => {
    const state = { externalStatus: {}, mood: 'normal' }

    expect(seedEventDecision(null, state, { now: NOW }).reason).toBe(SEED_DECISION.MISSING_EVENT)
    expect(seedEventDecision(eventById.eureka, { ...state, isPaused: true }, { now: NOW }).reason).toBe(SEED_DECISION.PAUSED)
    expect(seedEventDecision(eventById.eureka, { ...state, activeEvent: { id: 'tea-break' } }, { now: NOW }).reason).toBe(SEED_DECISION.ACTIVE_EVENT)
    expect(seedEventDecision(eventById['deploy-success'], state, { now: NOW }).reason).toBe(SEED_DECISION.INELIGIBLE)
  })

  it('applies global and per-event cooldowns without mutating the input seed state', () => {
    const original = {
      lastSeedAt: NOW - 10,
      byEvent: { eureka: NOW - DEFAULT_SEED_COOLDOWN_MS * 2 },
    }

    const globalBlocked = seedEventDecision(eventById.eureka, { mood: 'smooth' }, {
      now: NOW,
      seedState: original,
    })
    expect(globalBlocked.reason).toBe(SEED_DECISION.GLOBAL_COOLDOWN)
    expect(original.byEvent.eureka).toBe(NOW - DEFAULT_SEED_COOLDOWN_MS * 2)

    const eventBlocked = seedEventDecision(eventById.eureka, { mood: 'smooth' }, {
      now: NOW,
      seedState: {
        lastSeedAt: NOW - DEFAULT_SEED_COOLDOWN_MS - 1,
        byEvent: { eureka: NOW - DEFAULT_SEED_COOLDOWN_MS * PER_EVENT_SEED_COOLDOWN_MULTIPLIER + 1 },
      },
    })
    expect(eventBlocked.reason).toBe(SEED_DECISION.EVENT_COOLDOWN)
  })

  it('fires honest candidates and returns the next cooldown state', () => {
    const decision = seedEventDecision(eventById['deploy-success'], {
      externalStatus: { ops: { status: 'done', changedAt: NOW - 1000 } },
      mood: 'normal',
    }, {
      now: NOW,
      seedState: { lastSeedAt: NOW - DEFAULT_SEED_COOLDOWN_MS - 1 },
    })

    expect(decision).toMatchObject({
      fire: true,
      eventId: 'deploy-success',
      reason: SEED_DECISION.FIRE,
      cooldownState: {
        lastSeedAt: NOW,
        byEvent: { 'deploy-success': NOW },
      },
    })
  })

  it('selects the first viable seed while preserving rejection reasons', () => {
    const selection = selectSeedEvent([
      { eventId: 'eureka', source: 'mood-edge', value: 'smooth' },
      { eventId: 'deploy-success', source: 'ops-done-edge', value: 'done' },
    ], eventById, {
      mood: 'smooth',
      externalStatus: { ops: { status: 'done', changedAt: NOW - 1000 } },
    }, {
      now: NOW,
      seedState: {
        lastSeedAt: NOW - DEFAULT_SEED_COOLDOWN_MS - 1,
        byEvent: { eureka: NOW - DEFAULT_SEED_COOLDOWN_MS * PER_EVENT_SEED_COOLDOWN_MULTIPLIER + 1 },
      },
    })

    expect(selection.fire).toBe(true)
    expect(selection.rejected).toMatchObject([{ eventId: 'eureka', reason: SEED_DECISION.EVENT_COOLDOWN }])
    expect(selection.selected).toMatchObject({ eventId: 'deploy-success', reason: SEED_DECISION.FIRE })
  })

  it('returns a compact renderer-facing seed event view-model', () => {
    expect(buildSeedEventViewModel({
      state: { mood: 'smooth' },
      prev: { mood: 'normal' },
      eventById,
      seedState: { lastSeedAt: NOW - DEFAULT_SEED_COOLDOWN_MS - 1 },
      now: NOW,
    })).toMatchObject({
      fire: true,
      selectedEventId: 'eureka',
      reason: SEED_DECISION.FIRE,
      candidates: [{ eventId: 'eureka', source: 'mood-edge' }],
      rejected: [],
    })
  })

  it('normalizes persisted cooldown state defensively', () => {
    expect(normalizeSeedCooldownState({
      lastSeedAt: '42',
      byEvent: { eureka: '100', bad: 'not-a-time', zero: 0 },
    })).toEqual({
      lastSeedAt: 42,
      byEvent: { eureka: 100 },
    })
  })
})
