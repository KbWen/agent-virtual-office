import { describe, it, expect } from 'vitest'
import { eventEligible } from '../src/systems/officeLife.js'
import { WORK_CLAIM_SIGNAL_WINDOW } from '../src/systems/constants.js'

// living-office-events Phase 2 — AC-2: a WORK-CLAIM event renders ONLY when its matching real
// signal fired within WORK_CLAIM_SIGNAL_WINDOW; SOCIAL/WORLD events are always eligible.

const NOW = 1_000_000
const fresh = { changedAt: NOW - 5_000 }                       // within window
const stale = { changedAt: NOW - (WORK_CLAIM_SIGNAL_WINDOW + 5_000) } // older than window
const ev = (id) => ({ id })

describe('eventEligible — work-claim honesty gate', () => {
  it('SOCIAL/WORLD events are always eligible (no work-claim)', () => {
    const dead = { externalStatus: {}, mood: 'normal' }
    for (const id of ['tea-break', 'standup', 'group-meeting', 'pm-all-meeting', 'group-stretch',
                       'dog-visit', 'boss-visit', 'ac-broken', 'food-delivery', 'coffee-spill']) {
      expect(eventEligible(ev(id), dead, NOW)).toBe(true)
    }
  })

  it('WORK-CLAIM events are INELIGIBLE with no matching real signal', () => {
    const dead = { externalStatus: {}, mood: 'normal' }
    for (const id of ['deploy-success', 'ops-dev-deploy-check', 'dev-arch-disagree', 'eureka', 'review-debate']) {
      expect(eventEligible(ev(id), dead, NOW)).toBe(false)
    }
  })

  it('deploy events gate on a RECENT Ops signal, and reject a STALE one', () => {
    expect(eventEligible(ev('deploy-success'), { externalStatus: { ops: fresh }, mood: 'normal' }, NOW)).toBe(true)
    expect(eventEligible(ev('ops-dev-deploy-check'), { externalStatus: { ops: fresh }, mood: 'normal' }, NOW)).toBe(true)
    // stale signal must NOT mint the claim (claim must not outlive its truth)
    expect(eventEligible(ev('deploy-success'), { externalStatus: { ops: stale }, mood: 'normal' }, NOW)).toBe(false)
  })

  it('dev-arch-disagree gates on a real block-streak mood (frustrated/stuck)', () => {
    expect(eventEligible(ev('dev-arch-disagree'), { externalStatus: {}, mood: 'frustrated' }, NOW)).toBe(true)
    expect(eventEligible(ev('dev-arch-disagree'), { externalStatus: {}, mood: 'stuck' }, NOW)).toBe(true)
    expect(eventEligible(ev('dev-arch-disagree'), { externalStatus: {}, mood: 'smooth' }, NOW)).toBe(false)
  })

  it('eureka gates on a real done-streak (smooth mood)', () => {
    expect(eventEligible(ev('eureka'), { externalStatus: {}, mood: 'smooth' }, NOW)).toBe(true)
    expect(eventEligible(ev('eureka'), { externalStatus: {}, mood: 'normal' }, NOW)).toBe(false)
  })

  it('review-debate gates on a recent QA or Gatekeeper signal', () => {
    expect(eventEligible(ev('review-debate'), { externalStatus: { qa: fresh }, mood: 'normal' }, NOW)).toBe(true)
    expect(eventEligible(ev('review-debate'), { externalStatus: { gate: fresh }, mood: 'normal' }, NOW)).toBe(true)
    expect(eventEligible(ev('review-debate'), { externalStatus: { qa: stale }, mood: 'normal' }, NOW)).toBe(false)
  })
})
