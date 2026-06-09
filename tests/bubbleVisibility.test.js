/**
 * Declutter — speech-bubble concurrency cap honesty/priority invariants (PURE).
 */
import { describe, it, expect } from 'vitest'
import { selectVisibleBubbles, bubblePriority, BUBBLE_ROTATE_MS } from '../src/systems/bubbleVisibility.js'

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

  it('stable WITHIN a rotation window (no frame jitter) when tier + recency tie', () => {
    const agents = { dev: A('x', 'working'), qa: A('y', 'working') }
    const ext = { dev: E('working', 5), qa: E('working', 5) }
    // same now → identical result on repeated calls (no per-frame flicker)
    const v1 = selectVisibleBubbles(agents, ext, 1, 1000)
    const v2 = selectVisibleBubbles(agents, ext, 1, 1000)
    expect([...v1]).toEqual([...v2])
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

describe('selectVisibleBubbles — LIVELINESS (rotation when ties, owner: "別蓋死/死氣沉沉")', () => {
  // 4 working agents all holding bubbles with the SAME stale changedAt (the dead-static case:
  // ambient chatter, no real status change to break the tie). cap 2.
  const agents = { arch: A('a', 'working'), dev: A('b', 'working'), ops: A('c', 'working'), qa: A('d', 'working') }
  const ext = {
    arch: E('working', 100), dev: E('working', 100), ops: E('working', 100), qa: E('working', 100),
  }

  it('the visible set ROTATES over time — every agent gets shown across a full cycle (not frozen)', () => {
    const seen = new Set()
    // sample across 4 rotation windows (n=4 ids) → the offset cycles through all
    for (let k = 0; k < 4; k++) {
      const v = selectVisibleBubbles(agents, ext, 2, k * BUBBLE_ROTATE_MS)
      expect(v.size).toBe(2)
      v.forEach((id) => seen.add(id))
    }
    expect(seen).toEqual(new Set(['arch', 'dev', 'ops', 'qa']))  // nobody is permanently mute
  })

  it('does NOT thrash within a single window (same now → same set)', () => {
    const a = [...selectVisibleBubbles(agents, ext, 2, 5000)]
    const b = [...selectVisibleBubbles(agents, ext, 2, 5000 + 100)]  // 100ms later, same 2.5s window
    expect(a).toEqual(b)
  })

  it('a real recency difference still WINS over rotation (meaningful, not just a carousel)', () => {
    const ext2 = { ...ext, qa: E('working', 999999) }  // qa just genuinely acted
    for (let k = 0; k < 4; k++) {
      // qa is freshest → always shown regardless of rotation phase
      expect(selectVisibleBubbles(agents, ext2, 1, k * BUBBLE_ROTATE_MS).has('qa')).toBe(true)
    }
  })

  it('blocked stays PINNED across all rotation phases (a real block is never rotated away)', () => {
    const agents2 = { ...agents, ops: A('stuck', 'blocked') }
    const ext2 = { ...ext, ops: E('blocked', 100) }
    for (let k = 0; k < 5; k++) {
      expect(selectVisibleBubbles(agents2, ext2, 2, k * BUBBLE_ROTATE_MS).has('ops')).toBe(true)
    }
  })
})
