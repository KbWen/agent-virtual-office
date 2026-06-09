/**
 * Declutter — speech-bubble concurrency cap honesty/priority invariants (PURE).
 */
import { describe, it, expect } from 'vitest'
import { selectVisibleBubbles, bubblePriority } from '../src/systems/bubbleVisibility.js'

const A = (bubble, status) => ({ bubble, status })
const E = (status, changedAt) => ({ status, changedAt })

describe('bubblePriority', () => {
  it('blocked/awaiting < done < working < other', () => {
    expect(bubblePriority('blocked')).toBeLessThan(bubblePriority('done'))
    expect(bubblePriority('awaiting-approval')).toBe(bubblePriority('blocked'))
    expect(bubblePriority('done')).toBeLessThan(bubblePriority('working'))
    expect(bubblePriority('working')).toBe(bubblePriority('planning'))
    expect(bubblePriority('idle')).toBeGreaterThan(bubblePriority('working'))
  })
})

describe('selectVisibleBubbles', () => {
  it('caps the number of visible bubbles', () => {
    const agents = { a: A('x', 'working'), b: A('y', 'working'), c: A('z', 'working'), d: A('w', 'working') }
    const ext = { a: E('working', 4), b: E('working', 3), c: E('working', 2), d: E('working', 1) }
    expect(selectVisibleBubbles(agents, ext, 2).size).toBe(2)
  })

  it('only counts agents that actually have a bubble', () => {
    const agents = { a: A('x', 'working'), b: A(null, 'working'), c: A('', 'working') }
    const v = selectVisibleBubbles(agents, { a: E('working', 1) }, 3)
    expect(v.has('a')).toBe(true)
    expect(v.has('b')).toBe(false)
    expect(v.has('c')).toBe(false)
  })

  it('HONESTY/priority: a blocked bubble wins a slot over working ones', () => {
    const agents = { dev: A('typing', 'working'), qa: A('busy', 'working'), ops: A('stuck!', 'blocked') }
    const ext = { dev: E('working', 9), qa: E('working', 8), ops: E('blocked', 1) }  // ops oldest but blocked
    const v = selectVisibleBubbles(agents, ext, 1)
    expect(v.has('ops')).toBe(true)   // blocked outranks newer working
    expect(v.size).toBe(1)
  })

  it('done outranks working', () => {
    const agents = { a: A('done!', 'done'), b: A('typing', 'working') }
    const ext = { a: E('done', 1), b: E('working', 9) }
    expect(selectVisibleBubbles(agents, ext, 1).has('a')).toBe(true)
  })

  it('within a tier, most-recently-changed wins', () => {
    const agents = { a: A('x', 'working'), b: A('y', 'working') }
    const ext = { a: E('working', 5), b: E('working', 99) }
    expect(selectVisibleBubbles(agents, ext, 1).has('b')).toBe(true)
  })

  it('stable id tiebreak (no frame jitter) when tier + recency tie', () => {
    const agents = { dev: A('x', 'working'), qa: A('y', 'working') }
    const ext = { dev: E('working', 5), qa: E('working', 5) }
    const v = selectVisibleBubbles(agents, ext, 1)
    expect(v.has('dev')).toBe(true)  // 'dev' < 'qa'
  })

  it('falls back to agent.status when externalStatus is absent', () => {
    const agents = { a: A('x', 'blocked'), b: A('y', 'working') }
    expect(selectVisibleBubbles(agents, {}, 1).has('a')).toBe(true)
  })

  it('empty / cap 0 → empty set', () => {
    expect(selectVisibleBubbles({}, {}, 3).size).toBe(0)
    expect(selectVisibleBubbles({ a: A('x', 'working') }, {}, 0).size).toBe(0)
    expect(selectVisibleBubbles(null, null, 3).size).toBe(0)
  })
})
