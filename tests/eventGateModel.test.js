import { describe, expect, it } from 'vitest'
import {
  LIVE_FLOOR_FIRE_CHANCE,
  LIVE_FLOOR_PULSE_THRESHOLD,
  WORK_CLAIM_GATE_IDS,
  WORK_CLAIM_SIGNAL_WINDOW,
  buildEventGateViewModel,
  eligibleEvents,
  eventEligible,
  eventWorkClaimGate,
  floorTickAllowed,
  floorTickState,
  pickEligibleEvent,
  recentWorkSignal,
} from '../src/systems/eventGateModel.mjs'
import {
  LIVE_FLOOR_FIRE_CHANCE as LEGACY_LIVE_FLOOR_FIRE_CHANCE,
  WORK_CLAIM_SIGNAL_WINDOW as LEGACY_WORK_CLAIM_SIGNAL_WINDOW,
} from '../src/systems/constants.js'
import {
  eventEligible as legacyEventEligible,
  floorTickAllowed as legacyFloorTickAllowed,
} from '../src/systems/officeLife.js'
import eventsData from '../src/config/officeEvents.json'

const NOW = 1_000_000
const fresh = { changedAt: NOW - 5_000 }
const stale = { changedAt: NOW - (WORK_CLAIM_SIGNAL_WINDOW + 1) }
const ev = (id) => ({ id })

describe('eventGateModel public API', () => {
  it('keeps public timing constants in parity with the legacy office-life constants', () => {
    expect(WORK_CLAIM_SIGNAL_WINDOW).toBe(LEGACY_WORK_CLAIM_SIGNAL_WINDOW)
    expect(LIVE_FLOOR_FIRE_CHANCE).toBe(LEGACY_LIVE_FLOOR_FIRE_CHANCE)
    expect(LIVE_FLOOR_PULSE_THRESHOLD).toBe(0.2)
  })

  it('matches legacy work-claim event eligibility for current office states', () => {
    const cases = [
      ['tea-break', { externalStatus: {}, mood: 'normal' }],
      ['deploy-success', { externalStatus: { ops: fresh }, mood: 'normal' }],
      ['deploy-success', { externalStatus: { ops: stale }, mood: 'normal' }],
      ['ops-dev-deploy-check', { externalStatus: { ops: fresh }, mood: 'normal' }],
      ['dev-arch-disagree', { externalStatus: {}, mood: 'frustrated' }],
      ['dev-arch-disagree', { externalStatus: {}, mood: 'smooth' }],
      ['eureka', { externalStatus: {}, mood: 'smooth' }],
      ['eureka', { externalStatus: {}, mood: 'normal' }],
      ['review-debate', { externalStatus: { qa: fresh }, mood: 'normal' }],
      ['review-debate', { externalStatus: { gate: fresh }, mood: 'normal' }],
      ['review-debate', { externalStatus: { qa: stale }, mood: 'normal' }],
    ]

    for (const [eventId, state] of cases) {
      expect(eventEligible(ev(eventId), state, NOW)).toBe(legacyEventEligible(ev(eventId), state, NOW))
    }
    expect(eventEligible(null, {}, NOW)).toBe(false)
  })

  it('exposes explicit gate ids and strict recency semantics', () => {
    expect(WORK_CLAIM_GATE_IDS).toEqual([
      'deploy-success',
      'ops-dev-deploy-check',
      'dev-arch-disagree',
      'eureka',
      'review-debate',
    ])
    expect(eventWorkClaimGate('tea-break', {}, NOW)).toBeNull()
    expect(recentWorkSignal({ changedAt: NOW - WORK_CLAIM_SIGNAL_WINDOW + 1 }, NOW)).toBe(true)
    expect(recentWorkSignal({ changedAt: NOW - WORK_CLAIM_SIGNAL_WINDOW }, NOW)).toBe(false)
    expect(recentWorkSignal({ changedAt: 'not-a-time' }, NOW)).toBe(false)
    expect(recentWorkSignal({ changedAt: null }, 1)).toBe(false)
    expect(recentWorkSignal({ changedAt: false }, 1)).toBe(false)
    expect(recentWorkSignal({ changedAt: '' }, 1)).toBe(false)
    expect(recentWorkSignal({ changedAt: 0 }, 1)).toBe(false)
  })

  it('keeps every current work-claim gate id anchored to a catalog event', () => {
    const catalogIds = new Set([
      ...(eventsData.daily || []).map((event) => event.id),
      ...(eventsData.rare || []).map((event) => event.id),
    ])

    expect(WORK_CLAIM_GATE_IDS.every((id) => catalogIds.has(id))).toBe(true)
  })

  it('filters and picks eligible events with injectable time and randomness', () => {
    const pool = [
      ev('deploy-success'),
      ev('tea-break'),
      ev('review-debate'),
      ev('eureka'),
    ]
    const state = { externalStatus: { qa: fresh }, mood: 'normal' }

    expect(eligibleEvents(pool, state, NOW).map((event) => event.id)).toEqual([
      'tea-break',
      'review-debate',
    ])
    expect(pickEligibleEvent(pool, state, { now: NOW, random: () => 0 }).id).toBe('tea-break')
    expect(pickEligibleEvent(pool, state, { now: NOW, random: () => 0.99 }).id).toBe('review-debate')
    expect(pickEligibleEvent([ev('deploy-success')], { externalStatus: {}, mood: 'normal' }, { now: NOW })).toBeNull()
  })

  it('returns a renderer-facing event gate view-model without inventing work claims', () => {
    expect(buildEventGateViewModel(ev('deploy-success'), { externalStatus: {}, mood: 'normal' }, { now: NOW })).toEqual({
      eventId: 'deploy-success',
      eligible: false,
      workClaim: true,
      gate: false,
    })
    expect(buildEventGateViewModel(ev('standup'), { externalStatus: {}, mood: 'normal' }, { now: NOW })).toEqual({
      eventId: 'standup',
      eligible: true,
      workClaim: false,
      gate: null,
    })
  })

  it('exposes deterministic floor tick state while preserving legacy default behavior', () => {
    const idleDemo = { statusSource: 'organic', teamPulse: 0 }
    const live = { statusSource: 'external', teamPulse: 0.9 }
    const fallbackLive = { statusSource: 'fallback', teamPulse: 0.5 }

    expect(floorTickState(idleDemo)).toMatchObject({ live: false, chance: 1 })
    expect(floorTickState(live)).toMatchObject({ live: true, chance: LIVE_FLOOR_FIRE_CHANCE })
    expect(floorTickAllowed(idleDemo, { random: () => 0.99 })).toBe(true)
    expect(floorTickAllowed(live, { random: () => LIVE_FLOOR_FIRE_CHANCE - 0.01 })).toBe(true)
    expect(floorTickAllowed(live, { random: () => LIVE_FLOOR_FIRE_CHANCE })).toBe(false)
    expect(floorTickAllowed(fallbackLive, { random: () => 0.99 })).toBe(false)

    const originalRandom = Math.random
    try {
      Math.random = () => LIVE_FLOOR_FIRE_CHANCE - 0.01
      expect(floorTickAllowed(live)).toBe(legacyFloorTickAllowed(live))
      Math.random = () => LIVE_FLOOR_FIRE_CHANCE
      expect(floorTickAllowed(live)).toBe(legacyFloorTickAllowed(live))
    } finally {
      Math.random = originalRandom
    }
  })
})
