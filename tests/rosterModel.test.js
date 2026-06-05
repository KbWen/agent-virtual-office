import { describe, it, expect } from 'vitest'
import {
  salienceTier, comparePresence, isIdleStatus, isFeedWorthy, feedEntries, teamStatus, PRESENCE_TIER, FEED_ORIGINS,
} from '../src/systems/rosterModel.js'

// The vertical roster's "liveliness" is its ordering (urgent rises, idle sinks) + an honest feed
// (real events only, not organic theater). These pure fns carry that contract — assert behaviour.

describe('salienceTier — what the operator scans for, urgent first', () => {
  it('blocked + awaiting-approval are the top tier (need a human)', () => {
    expect(salienceTier('blocked')).toBe(0)
    expect(salienceTier('awaiting-approval')).toBe(0)
  })
  it('active work (working/planning/thinking) is tier 1', () => {
    expect(salienceTier('working')).toBe(1)
    expect(salienceTier('planning')).toBe(1)
    expect(salienceTier('thinking')).toBe(1)
  })
  it('working / done / idle all share the stable roster tier (1) — only blocked reorders', () => {
    expect(salienceTier('done')).toBe(1)
    expect(salienceTier('idle')).toBe(1)
  })
  it('unknown / missing status holds the roster tier (1), never crashes', () => {
    expect(salienceTier('wat')).toBe(1)
    expect(salienceTier(undefined)).toBe(1)
    expect(salienceTier(null)).toBe(1)
  })
})

describe('comparePresence — tier first, then STABLE id (no within-tier churn)', () => {
  const row = (id, status) => ({ id, status })

  it('blocked pins to top; everyone else (incl. idle) holds a stable id order', () => {
    const out = [row('a', 'idle'), row('b', 'done'), row('c', 'working'), row('d', 'blocked')]
      .sort(comparePresence).map((r) => r.id)
    // d blocked first; a/b/c all tier 1 → stable id order a<b<c
    expect(out).toEqual(['d', 'a', 'b', 'c'])
  })
  it('working↔done does NOT change the row order (same tier)', () => {
    const asWorking = [row('x', 'working'), row('y', 'working')].sort(comparePresence).map((r) => r.id)
    const xDone = [row('x', 'done'), row('y', 'working')].sort(comparePresence).map((r) => r.id)
    expect(asWorking).toEqual(['x', 'y'])
    expect(xDone).toEqual(['x', 'y']) // x flipping to done did not move it
  })
  it('within a tier the order is STABLE by id (no recency reshuffle, no jitter)', () => {
    const out = [row('zeta', 'working'), row('alpha', 'working')].sort(comparePresence).map((r) => r.id)
    expect(out).toEqual(['alpha', 'zeta'])
    expect([...out].map((id) => row(id, 'working')).sort(comparePresence).map((r) => r.id)).toEqual(['alpha', 'zeta'])
  })
  it('a blocked agent outranks any active agent (urgency wins)', () => {
    const out = [row('w', 'working'), row('b', 'blocked')].sort(comparePresence).map((r) => r.id)
    expect(out).toEqual(['b', 'w'])
  })
})

describe('isIdleStatus', () => {
  it('treats idle / empty / missing as idle', () => {
    expect(isIdleStatus('idle')).toBe(true)
    expect(isIdleStatus('')).toBe(true)
    expect(isIdleStatus(undefined)).toBe(true)
  })
  it('active states are not idle', () => {
    expect(isIdleStatus('working')).toBe(false)
    expect(isIdleStatus('blocked')).toBe(false)
  })
})

describe('feed origin filter — real signal only, not organic theater', () => {
  it('keeps hook / event / inferred, drops organic', () => {
    expect(isFeedWorthy({ origin: 'hook' })).toBe(true)
    expect(isFeedWorthy({ origin: 'event' })).toBe(true)
    expect(isFeedWorthy({ origin: 'inferred' })).toBe(true)
    expect(isFeedWorthy({ origin: 'organic' })).toBe(false)
  })
  it('rejects entries with no/unknown origin and nullish input', () => {
    expect(isFeedWorthy({ type: 'status' })).toBe(false) // no origin
    expect(isFeedWorthy({ origin: 'random' })).toBe(false)
    expect(isFeedWorthy(null)).toBe(false)
    expect(isFeedWorthy(undefined)).toBe(false)
  })
  it('feedEntries filters organic out and preserves the (newest-first) order', () => {
    const log = [
      { id: 5, origin: 'organic', message: 'PM at whiteboard' },
      { id: 4, origin: 'hook', message: 'Dev blocked' },
      { id: 3, origin: 'organic', message: 'QA coffee' },
      { id: 2, origin: 'event', message: 'standup' },
      { id: 1, origin: 'inferred', message: 'Arch thinking' },
    ]
    expect(feedEntries(log).map((e) => e.id)).toEqual([4, 2, 1])
  })
  it('feedEntries tolerates a non-array', () => {
    expect(feedEntries(null)).toEqual([])
    expect(feedEntries(undefined)).toEqual([])
  })
})

describe('teamStatus — honest team-state strip priority (blocked > workflow > active > none)', () => {
  it('blocked outranks workflow AND active count', () => {
    const s = teamStatus({ blockedNames: ['QA'], activeWorkflow: 'review', activeCount: 5 })
    expect(s).toEqual({ kind: 'blocked', names: ['QA'] })
  })
  it('shows the live workflow phase when nobody is blocked', () => {
    expect(teamStatus({ activeWorkflow: 'review', activeCount: 3 })).toEqual({ kind: 'workflow', workflow: 'review', activeCount: 3 })
  })
  it('falls back to active count when no workflow', () => {
    expect(teamStatus({ activeCount: 4 })).toEqual({ kind: 'active', activeCount: 4 })
  })
  it('is "none" when the team is quiet (so the quiet hint shows instead)', () => {
    expect(teamStatus({})).toEqual({ kind: 'none' })
    expect(teamStatus({ blockedNames: [], activeWorkflow: null, activeCount: 0 })).toEqual({ kind: 'none' })
  })
  it('does NOT surface decorative events/mood (only blocked/workflow/active are inputs)', () => {
    // teamStatus has no event/mood parameter at all — proven by the signature ignoring extras
    expect(teamStatus({ activeEvent: 'tea-break', mood: 'rushing', activeCount: 0 })).toEqual({ kind: 'none' })
  })
})

describe('constants are sane', () => {
  it('FEED_ORIGINS excludes organic', () => {
    expect(FEED_ORIGINS.has('organic')).toBe(false)
    expect(FEED_ORIGINS.has('hook')).toBe(true)
  })
  it('PRESENCE_TIER covers the core statuses', () => {
    for (const s of ['blocked', 'working', 'planning', 'done', 'idle']) {
      expect(typeof PRESENCE_TIER[s]).toBe('number')
    }
  })
})
