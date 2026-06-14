import { describe, it, expect } from 'vitest'
import { bubblePriority, selectVisibleBubbles, BUBBLE_ROTATE_MS } from './bubbleVisibility.js'

const A = (status, bubble = 'hi') => ({ status, bubble })
const ext = (map) => map  // identity helper for readability

describe('bubblePriority', () => {
  it('blocked/awaiting=0, done=1, working/planning/thinking=2, unknown=3', () => {
    expect(bubblePriority('blocked')).toBe(0)
    expect(bubblePriority('awaiting-approval')).toBe(0)
    expect(bubblePriority('done')).toBe(1)
    expect(bubblePriority('working')).toBe(2)
    expect(bubblePriority('planning')).toBe(2)
    expect(bubblePriority('nonsense')).toBe(3)
  })
})

describe('selectVisibleBubbles — selection behavior', () => {
  it('only agents that actually have a bubble compete', () => {
    const agents = { dev: A('working'), qa: { status: 'working', bubble: null } }
    const r = selectVisibleBubbles(agents, {}, 3, 0)
    expect(r.has('dev')).toBe(true)
    expect(r.has('qa')).toBe(false)
  })

  it('respects the cap', () => {
    const agents = { a: A('working'), b: A('working'), c: A('working'), d: A('working') }
    expect(selectVisibleBubbles(agents, {}, 2, 0).size).toBe(2)
    expect(selectVisibleBubbles(agents, {}, 0, 0).size).toBe(0)
  })

  it('priority: a blocked agent beats a working agent for the only slot (honesty)', () => {
    const agents = { dev: A('working'), qa: A('blocked') }
    const r = selectVisibleBubbles(agents, ext({ dev: { status: 'working' }, qa: { status: 'blocked' } }), 1, 0)
    expect(r.has('qa')).toBe(true)
    expect(r.has('dev')).toBe(false)
  })

  it('recency: among same priority, the more recently changed wins', () => {
    const agents = { a: A('working'), b: A('working') }
    const r = selectVisibleBubbles(agents, ext({ a: { status: 'working', changedAt: 10 }, b: { status: 'working', changedAt: 99 } }), 1, 0)
    expect(r.has('b')).toBe(true)
    expect(r.has('a')).toBe(false)
  })

  it('empty set when nobody has a bubble', () => {
    expect(selectVisibleBubbles({ a: { status: 'working', bubble: null } }, {}, 3, 0).size).toBe(0)
  })

  it('rotation: equal priority+recency ties hand off slots as the epoch advances', () => {
    const agents = { a: A('working'), b: A('working'), c: A('working'), d: A('working') }
    const at0 = selectVisibleBubbles(agents, {}, 2, 0)                 // epoch 0 → offset 0 → {a,b}
    const at1 = selectVisibleBubbles(agents, {}, 2, BUBBLE_ROTATE_MS)  // epoch 1 → offset 1 → {b,c}
    expect([...at0].sort()).toEqual(['a', 'b'])
    expect([...at1].sort()).toEqual(['b', 'c'])
  })
})

describe('selectVisibleBubbles — AVO-159 memo (behavior-identical)', () => {
  it('same refs + same epoch → returns the SAME Set reference (cache hit, computed once)', () => {
    const agents = { a: A('working'), b: A('working') }
    const e = {}
    const s1 = selectVisibleBubbles(agents, e, 2, 0)
    const s2 = selectVisibleBubbles(agents, e, 2, 100)   // same rotation epoch (0)
    expect(s2).toBe(s1)                                   // identical reference → not recomputed
  })

  it('a new agents reference recomputes (cache invalidates on store write)', () => {
    const e = {}
    const s1 = selectVisibleBubbles({ a: A('working') }, e, 2, 0)
    const s2 = selectVisibleBubbles({ a: A('working') }, e, 2, 0)  // new object literal = new ref
    expect(s2).not.toBe(s1)
    expect([...s2]).toEqual([...s1])                               // but identical contents
  })

  it('crossing a rotation epoch recomputes even with the same refs', () => {
    const agents = { a: A('working'), b: A('working'), c: A('working'), d: A('working') }
    const e = {}
    const s1 = selectVisibleBubbles(agents, e, 2, 0)
    const s2 = selectVisibleBubbles(agents, e, 2, BUBBLE_ROTATE_MS) // next epoch
    expect(s2).not.toBe(s1)
  })
})
