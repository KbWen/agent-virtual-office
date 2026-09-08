/**
 * awaitingApprovalHonesty.test.js
 *
 * `awaiting-approval` (AVO-167) means the agent is STOPPED at a human permission prompt. It
 * reaches the store from `idleGapInfer` (blocked + 90s) carrying a status and nothing else --
 * no task, no label. Two code paths keyed off `task` and so never saw it:
 *
 *   1. `decideBehavior` had status branches for blocked/done/planning only, so with no task it
 *      fell through to the family default and returned 'typing' — a clattering keyboard on an
 *      agent doing nothing, directly under the calm cyan "waiting on you" ring.
 *   2. `generateContextBubble` fell past the error/done branches into the role `-working` pool,
 *      so the agent announced "almost... almost~" / "code first, think later!" while waiting for
 *      the human. That is a work claim over the absence of work — the failure mode ADR-007's
 *      honesty gate exists to prevent.
 *
 * These tests pin both channels, plus the constraint that ruled out the obvious cheap fix:
 * reusing an idle behavior like 'check-phone'/'stretch' would have sent the agent WALKING to the
 * lounge (they are lounge destinations in movementSystem's BEHAVIOR_LOCATIONS), turning a status
 * signal into a position change.
 */
import { describe, it, expect } from 'vitest'
import { decideBehavior } from '../src/systems/classify.js'
import { generateContextBubble } from '../src/systems/contextBubble.js'
import { needsLocationChange, SOCIAL_BEHAVIORS } from '../src/systems/movementSystem.js'
import en from '../src/locales/en.json'
import zhTW from '../src/locales/zh-TW.json'

const WAITING_BEHAVIOR = 'await-approval'

describe('awaiting-approval animation', () => {
  it('does not animate as typing when the update carries no task', () => {
    const behavior = decideBehavior({ status: 'awaiting-approval', role: 'dev' })
    expect(behavior).not.toBe('typing')
    expect(behavior).toBe(WAITING_BEHAVIOR)
  })

  it('keeps the waiting behavior even when a stale task is still attached', () => {
    // Status is a hard override above the task family, same as blocked/done/planning.
    expect(decideBehavior({ status: 'awaiting-approval', role: 'dev', task: 'Bash' })).toBe(WAITING_BEHAVIOR)
    expect(decideBehavior({ status: 'awaiting-approval', role: 'qa', task: 'Grep', workflow: '/test' })).toBe(WAITING_BEHAVIOR)
  })

  it('stays at the desk — the wait must never relocate the agent', () => {
    expect(needsLocationChange(WAITING_BEHAVIOR)).toBe(false)
    expect(SOCIAL_BEHAVIORS.has(WAITING_BEHAVIOR)).toBe(false)
    // The rejected alternatives, kept as a live reminder of WHY a dedicated behavior exists.
    expect(needsLocationChange('check-phone')).toBe(true)
    expect(needsLocationChange('stretch')).toBe(true)
  })

  it('has a label in both locales', () => {
    expect(en.behaviorLabels[WAITING_BEHAVIOR]).toBeTruthy()
    expect(zhTW.behaviorLabels[WAITING_BEHAVIOR]).toBeTruthy()
  })
})

describe('awaiting-approval bubble', () => {
  const WORKING_POOLS = ['dev-working', 'qa-working', 'ops-working', 'res-working', 'pm-working']

  it.each(['dev', 'qa', 'ops', 'res', 'pm'])('never speaks a working line for %s', (role) => {
    const forbidden = new Set(WORKING_POOLS.flatMap((k) => en.contextBubbles[k] ?? []))
    // 60 draws: the pools are random, so a single call could miss a regression by luck.
    for (let i = 0; i < 60; i++) {
      const bubble = generateContextBubble(role, { status: 'awaiting-approval' }, {})
      expect(bubble).toBeTruthy()
      expect(forbidden.has(bubble), `"${bubble}" is a working-pool line`).toBe(false)
      expect(en.contextBubbles['any-awaiting']).toContain(bubble)
    }
  })

  it('offers a waiting pool in both locales, in parity', () => {
    expect(en.contextBubbles['any-awaiting']?.length).toBeGreaterThan(0)
    expect(zhTW.contextBubbles['any-awaiting']?.length).toBe(en.contextBubbles['any-awaiting'].length)
  })

  it('still lets a real block win over the waiting line', () => {
    const bubble = generateContextBubble('dev', { status: 'blocked', hint: 'error' }, {})
    expect(en.contextBubbles['any-awaiting']).not.toContain(bubble)
  })
})
