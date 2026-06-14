import { describe, it, expect } from 'vitest'
import {
  poolKeyForStatus,
  pushPoke,
  pickQuipIndex,
  pickPokeReaction,
  POKE_RESET_MS,
  POKE_WINDOW_MS,
  LONG_AT,
  TURNAWAY_AT,
} from './pokeReaction.js'
import { useOfficeStore } from './store.js'

describe('poolKeyForStatus — AC-3 quips drawn from real status, no cross-status leak', () => {
  it('maps each status to its own honest pool', () => {
    expect(poolKeyForStatus('working')).toBe('working')
    expect(poolKeyForStatus('planning')).toBe('working')
    expect(poolKeyForStatus('thinking')).toBe('working')
    expect(poolKeyForStatus('blocked')).toBe('blocked')
    expect(poolKeyForStatus('awaiting-approval')).toBe('blocked')
    expect(poolKeyForStatus('done')).toBe('done')
    expect(poolKeyForStatus('idle')).toBe('idle')
  })
  it('a blocked agent NEVER gets a working/done quip (honesty)', () => {
    expect(poolKeyForStatus('blocked')).not.toBe('working')
    expect(poolKeyForStatus('blocked')).not.toBe('done')
  })
  it('unknown/garbage status falls back to idle (never invents a state)', () => {
    expect(poolKeyForStatus('nonsense')).toBe('idle')
    expect(poolKeyForStatus(undefined)).toBe('idle')
    expect(poolKeyForStatus(null)).toBe('idle')
  })
})

describe('pushPoke — trims by reset window', () => {
  it('drops pokes older than the reset gap, keeps recent, appends now', () => {
    const now = 100000
    const hist = [now - (POKE_RESET_MS + 1), now - 1000, now - 200]
    const next = pushPoke(hist, now)
    expect(next).toEqual([now - 1000, now - 200, now]) // oldest dropped, now appended
  })
  it('handles non-array / garbage history', () => {
    expect(pushPoke(undefined, 5)).toEqual([5])
    expect(pushPoke([NaN, 'x', null], 5)).toEqual([5])
  })
})

describe('pickQuipIndex — rotates, defensive', () => {
  it('cycles through the pool by streak', () => {
    expect(pickQuipIndex(4, 1)).toBe(0)
    expect(pickQuipIndex(4, 2)).toBe(1)
    expect(pickQuipIndex(4, 5)).toBe(0) // wraps (5-1)%4=0
  })
  it('handles empty / single pool', () => {
    expect(pickQuipIndex(0, 3)).toBe(0)
    expect(pickQuipIndex(1, 9)).toBe(0)
  })
})

describe('pickPokeReaction — AC-4 cozy escalation then honest reset', () => {
  it('1st-2nd poke = normal; 3rd-4th = long; 5th+ = turnaway', () => {
    let hist = []
    let t = 0
    const intensities = []
    for (let i = 0; i < 6; i++) {
      t += 500 // all within the 5s window
      const r = pickPokeReaction('working', hist, t)
      hist = r.nextHistory
      intensities.push(r.intensity)
    }
    expect(intensities).toEqual(['normal', 'normal', 'long', 'long', 'turnaway', 'turnaway'])
    // the last one flags turnAway
    expect(pickPokeReaction('working', hist, t + 500).turnAway).toBe(true)
  })

  it('resets to normal after a 10s+ idle gap', () => {
    let hist = []
    let t = 0
    for (let i = 0; i < 5; i++) { t += 400; hist = pickPokeReaction('working', hist, t).nextHistory }
    // now poke again after a long idle gap → streak resets, intensity normal again
    const after = pickPokeReaction('working', hist, t + POKE_RESET_MS + 1000)
    expect(after.intensity).toBe('normal')
    expect(after.streak).toBe(1)
  })

  it('escalation flips at exactly LONG_AT and TURNAWAY_AT (symbolic, not hard-coded)', () => {
    let hist = []
    let t = 0
    const seen = {}
    for (let i = 1; i <= TURNAWAY_AT; i++) {
      t += 300 // all within POKE_WINDOW_MS
      const r = pickPokeReaction('working', hist, t)
      hist = r.nextHistory
      seen[r.streak] = r.intensity
    }
    expect(seen[LONG_AT - 1]).toBe('normal')
    expect(seen[LONG_AT]).toBe('long')
    expect(seen[TURNAWAY_AT]).toBe('turnaway')
  })

  it('POKE_WINDOW_MS boundary is exclusive (strict <): a poke exactly one window later does not stack', () => {
    // a prior poke at t=0; poking again at exactly t=POKE_WINDOW_MS → the old one is OUT of window.
    expect(pickPokeReaction('working', [0], POKE_WINDOW_MS).streak).toBe(1)
    // one ms inside the window → both count.
    expect(pickPokeReaction('working', [0], POKE_WINDOW_MS - 1).streak).toBe(2)
  })

  it('carries the honest pool key + never mutates input history', () => {
    const hist = [10]
    const r = pickPokeReaction('blocked', hist, 20)
    expect(r.poolKey).toBe('blocked')
    expect(hist).toEqual([10]) // input not mutated
    expect(r.nextHistory).toEqual([10, 20])
  })
})

// AC-2 honesty guard: the ONLY store write the poke path performs is `setSelectedAgent`
// (firePoke otherwise touches only local React state). This locks that selection NEVER
// rewrites an agent's position or status — so a poke can never lie about where/what an agent
// is. (If a future edit adds a position/status write to the poke path, extend this guard.)
describe('AC-2 honesty — selection (the poke path store write) never touches position/status', () => {
  it('setSelectedAgent changes only selectedAgent; agent position + status untouched', () => {
    const store = useOfficeStore
    const id = Object.keys(store.getState().agents)[0]
    expect(id).toBeTruthy()
    const before = store.getState().agents[id]
    const snapPos = { ...before.position }
    const snapStatus = before.status

    store.getState().setSelectedAgent(id)
    let a = store.getState().agents[id]
    expect(store.getState().selectedAgent).toBe(id)
    expect(a.position).toEqual(snapPos)
    expect(a.status).toBe(snapStatus)

    // toggle off — still no position/status drift
    store.getState().setSelectedAgent(id)
    a = store.getState().agents[id]
    expect(store.getState().selectedAgent).toBe(null)
    expect(a.position).toEqual(snapPos)
    expect(a.status).toBe(snapStatus)
  })
})
